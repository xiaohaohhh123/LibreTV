'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onUnauthorized, STATUS_QUERY_KEY } from '@/lib/client-api';
import { applyEnvPresets } from '@/lib/subscription-sync';
import type { AuthStatusResponse } from '@/lib/types';
import { useToast } from './toast';
import { BrandLogo } from './brand-logo';
import { Icon } from './icon';
import { useFocusTrap } from './use-focus-trap';

/**
 * 认证上下文：
 * - 页面加载时查询 /api/status 判断会话有效性；
 * - 任何 API 返回 401/503 时全局打开登录框（客户端 API 层统一触发，不再散落检查）。
 */

type SetupRequired = boolean;

interface AuthContextValue {
  checked: boolean;
  verified: boolean;
  /** 服务器未设置 PASSWORD，需要管理员配置 */
  setupRequired: SetupRequired;
  /** /api/status 返回的应用版本（构建时从 package.json 注入） */
  version: string | null;
  localPreview: boolean;
  openLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  checked: false,
  verified: false,
  setupRequired: false,
  version: null,
  localPreview: false,
  openLogin: () => {},
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const authRevision = useRef(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 与 Providers 共用同一 query key 与缓存，避免 /api/status 被请求两次
  useEffect(() => {
    let cancelled = false;
    const revision = authRevision.current;
    queryClient
      .fetchQuery({ queryKey: STATUS_QUERY_KEY, queryFn: () => api.status() })
      .then((s) => {
        if (cancelled) return;
        setLocalPreview(Boolean(s.localPreview));
        setVersion(s.version);
        // 初始状态是旧快照，不能覆盖此后发生的登录、登出或会话失效。
        if (revision !== authRevision.current) return;
        setVerified(s.verified);
        setSetupRequired(!s.passwordRequired && !s.localPreview);
        setChecked(true);
        setModalOpen(!s.verified);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(
    () =>
      onUnauthorized((event) => {
        authRevision.current++;
        setChecked(true);
        const setup = (event as CustomEvent).detail === 'setup';
        setSetupRequired(setup);
        setVerified(false);
        setModalOpen(true);
      }),
    []
  );

  const openLogin = useCallback(() => { if (!localPreview) setModalOpen(true); }, [localPreview]);

  const logout = useCallback(async () => {
    if (localPreview) { toast('本机预览无需登录', 'info'); return; }
    authRevision.current++;
    try {
      await api.logout();
    } finally {
      setChecked(true);
      setVerified(false);
      setModalOpen(true);
      toast('已退出登录', 'info');
    }
  }, [toast, localPreview]);

  const handleLoginSuccess = useCallback(async () => {
    authRevision.current++;
    setChecked(true);
    setVerified(true);
    setSetupRequired(false);
    setModalOpen(false);
    // 登录前以 401 失败的查询（如豆瓣推荐）需要重新拉取
    queryClient.invalidateQueries();
    toast('验证成功', 'success');
    // 预置订阅（DEFAULT_SUBSCRIPTIONS）的首屏同步发生在登录之前，会 401 静默失败，
    // 这里用缓存中的 /api/status 补跑一次（缓存缺失时回落为一次请求）
    try {
      const cached = queryClient.getQueryData<AuthStatusResponse>(STATUS_QUERY_KEY);
      const status =
        cached ??
        (await queryClient.fetchQuery<AuthStatusResponse>({
          queryKey: STATUS_QUERY_KEY,
          queryFn: () => api.status(),
          staleTime: 0,
        }));
      if (status) await applyEnvPresets(status);
    } catch {
      // 补拉预置数据失败不影响登录后的正常使用
    }
  }, [toast, queryClient]);

  return (
    <AuthContext.Provider value={{ checked, verified, setupRequired, version, localPreview, openLogin, logout }}>
      {children}
      {modalOpen && (
        <LoginModal
          setupRequired={setupRequired}
          onSuccess={handleLoginSuccess}
          onClose={() => setModalOpen(false)}
        />
      )}
    </AuthContext.Provider>
  );
}

function LoginModal({
  setupRequired,
  onSuccess,
  onClose,
}: {
  setupRequired: boolean;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, panelRef);

  useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const submit = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '验证失败';
      setError(msg === '需要登录' ? '密码错误' : msg);
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="access-overlay fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="access-card relative my-auto w-full max-w-md rounded-2xl border border-line bg-surface-raised p-6 shadow-2xl sm:p-9"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        aria-describedby="access-description"
      >
        <button type="button" onClick={onClose} className="btn-ghost absolute right-2 top-2 min-h-11 min-w-11 p-2" aria-label="关闭登录">
          <Icon name="close" />
        </button>
        {setupRequired ? (
          <>
            <h2 id="access-title" className="mb-3 mt-4 text-lg font-semibold text-content">私人TV 尚未配置访问密码</h2>
            <p id="access-description" className="text-sm text-muted leading-relaxed">
              为确保安全，必须设置 <code className="text-accent">PASSWORD</code> 环境变量才能使用本服务。
              请联系管理员在部署配置中添加该变量后重启服务。
            </p>
          </>
        ) : (
          <>
            <div className="mb-8 mt-3 flex justify-center text-2xl">
              <BrandLogo />
            </div>
            <h2 id="access-title" className="mb-2 text-center text-xl font-semibold text-content">访问私人TV</h2>
            <p id="access-description" className="mb-6 text-center text-sm leading-relaxed text-muted">输入站点访问密码</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label htmlFor="access-password" className="mb-2 block text-sm font-medium text-content">访问密码</label>
              <div className="relative">
              <input
                ref={inputRef}
                id="access-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input min-h-12 w-full pr-16"
                placeholder="输入访问密码"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'access-error' : undefined}
              />
              <button type="button" className="absolute inset-y-0 right-1 min-h-11 min-w-12 px-2 text-sm text-muted hover:text-content" aria-controls="access-password" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? '隐藏' : '显示'}
              </button>
              </div>
              {error && <p id="access-error" role="alert" className="mt-2 text-sm text-danger">{error}</p>}
              <button type="submit" className="btn-primary mt-5 min-h-12 w-full" disabled={loading || !password.trim()} aria-busy={loading}>
                {loading ? '正在验证…' : '进入私人TV'}
              </button>
              <p className="mt-5 text-center text-xs leading-relaxed text-faint">记录与片单保存在当前浏览器，不需要注册。</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
