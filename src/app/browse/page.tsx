'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveSource, useAppStore } from '@/lib/store';
import type { SearchResultItem } from '@/lib/types';
import { VideoCard } from '@/components/video-card';
import { DetailModal } from '@/components/detail-modal';
import { EmptyState, Spinner } from '@/components/states';
import { isAdultContent } from '@/lib/cms-parser';

export interface BrowseCategory {
  id: number;
  name: string;
}

interface BrowseState {
  categories: BrowseCategory[];
  list: SearchResultItem[];
  page: number;
  pagecount: number;
}

export default function BrowsePage() {
  const customAPIs = useAppStore((s) => s.customAPIs);
  const envSources = useAppStore((s) => s.envSources);
  const selectedKeys = useAppStore((s) => s.selectedKeys);
  const enabledSources = useMemo(
    () =>
      selectedKeys
        .map((key) => resolveSource({ customAPIs, envSources }, key))
        .filter((s): s is NonNullable<typeof s> => !!s),
    [customAPIs, envSources, selectedKeys]
  );
  const [sourceKey, setSourceKey] = useState<string>('');
  const [state, setState] = useState<BrowseState>({ categories: [], list: [], page: 1, pagecount: 1 });
  const [typeId, setTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailItem, setDetailItem] = useState<SearchResultItem | null>(null);

  const activeSource = useMemo(
    () => enabledSources.find((s) => s.key === sourceKey) ?? enabledSources[0] ?? null,
    [enabledSources, sourceKey]
  );

  const fetchCategories = useCallback(async (sourceKeyValue: string) => {
    const src = enabledSources.find((s) => s.key === sourceKeyValue);
    if (!src) return;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('/api/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { key: src.key, name: src.name, url: src.url } }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '获取分类失败');
      // 前端兜底：再次过滤成人分类（API 层已过滤）
      const cats: BrowseCategory[] = (data.categories ?? []).filter(
        (c: BrowseCategory) => !isAdultContent(c.name)
      );
      setState({ categories: cats, list: [], page: 1, pagecount: 1 });
      setTypeId(cats[0]?.id ?? null);
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? '请求超时，换个片源试试' : err.message)
        : '获取分类失败';
      setError(msg);
      setState({ categories: [], list: [], page: 1, pagecount: 1 });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [enabledSources]);

  const fetchList = useCallback(async (sourceKeyValue: string, tid: number, pg: number) => {
    const src = enabledSources.find((s) => s.key === sourceKeyValue);
    if (!src) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { key: src.key, name: src.name, url: src.url }, typeId: tid, page: pg }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '获取列表失败');
      setState((prev) => ({
        ...prev,
        list: data.list ?? [],
        page: data.page ?? pg,
        pagecount: data.pagecount ?? 1,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取列表失败');
    } finally {
      setLoading(false);
    }
  }, [enabledSources]);

  // 源切换 → 拉分类
  useEffect(() => {
    if (activeSource) {
      setSourceKey(activeSource.key);
      fetchCategories(activeSource.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource?.key]);

  // 分类切换 → 拉第 1 页
  useEffect(() => {
    if (activeSource && typeId != null) fetchList(activeSource.key, typeId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  const goPage = (pg: number) => {
    if (!activeSource || typeId == null) return;
    const next = Math.min(Math.max(1, pg), state.pagecount);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchList(activeSource.key, typeId, next);
  };

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">片库浏览</h1>
        {enabledSources.length > 0 && (
          <select
            aria-label="选择片源"
            className="rounded-lg bg-chip px-3 py-2 text-sm ring-1 ring-inset ring-line focus:outline-none"
            value={activeSource?.key ?? ''}
            onChange={(e) => { setTypeId(null); setSourceKey(e.target.value); }}
          >
            {enabledSources.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {enabledSources.length === 0 ? (
        <EmptyState variant="plain" title="还没有可用的片源" />
      ) : (
        <>
          {/* 分类 tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-thin">
            {state.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setTypeId(c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
                  typeId === c.id
                    ? 'bg-accent text-white'
                    : 'bg-chip text-content ring-1 ring-inset ring-line'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {loading && state.list.length === 0 ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : error ? (
            <EmptyState variant="plain" title={error} />
          ) : state.list.length === 0 ? (
            <EmptyState variant="plain" title="这个分类暂无内容，换个分类或片源试试" />
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {state.list.map((item) => (
                  <VideoCard key={`${item.sourceKey}:${item.vodId}`} item={item} onClick={() => setDetailItem(item)} />
                ))}
              </div>
              {/* 分页 */}
              {state.pagecount > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    className="btn-ghost text-sm disabled:opacity-40"
                    disabled={state.page <= 1 || loading}
                    onClick={() => goPage(state.page - 1)}
                  >
                    ← 上一页
                  </button>
                  <span className="text-sm text-faint">{state.page} / {state.pagecount}</span>
                  <button
                    className="btn-ghost text-sm disabled:opacity-40"
                    disabled={state.page >= state.pagecount || loading}
                    onClick={() => goPage(state.page + 1)}
                  >
                    下一页 →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />
    </main>
  );
}
