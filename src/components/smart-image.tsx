'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildImageCandidates } from '@/lib/utils';

interface SmartImageProps {
  /** 原始图片地址（未经代理加工，降级链由本组件按加载方式生成） */
  url?: string;
  mode: 'direct' | 'proxy' | 'custom';
  customProxy?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  /** 候选链耗尽后回调，调用方切换占位图等兜底 UI */
  onExhausted?: () => void;
}

/**
 * 带降级链的封面图组件：direct 模式按 buildImageCandidates 的顺序加载，
 * onError 逐级回退（豆瓣图：直连 → 公共镜像 → 内置代理）；
 * 全部失败后触发 onExhausted 并停止渲染，由调用方展示占位图。
 * referrerPolicy=no-referrer：不向图床暴露来源页，规避部分站点的 Referer 校验。
 */
export function SmartImage({
  url,
  mode,
  customProxy = '',
  alt,
  className,
  loading = 'lazy',
  onExhausted,
}: SmartImageProps) {
  const candidates = buildImageCandidates(url, mode, customProxy);
  const identity = `${url ?? ''}\n${mode}\n${customProxy}`;
  const [attempt, setAttempt] = useState({ identity, index: 0 });
  const idx = attempt.identity === identity ? attempt.index : 0;
  const imageRef = useRef<HTMLImageElement>(null);
  const advance = useCallback(() => setAttempt((current) => {
    const currentIndex = current.identity === identity ? current.index : 0;
    return currentIndex === idx ? { identity, index: idx + 1 } : current;
  }), [identity, idx]);

  useEffect(() => {
    if (idx >= candidates.length) onExhausted?.();
    // 候选数组随 url/mode 变化，length 是充分的稳定信号
  }, [idx, candidates.length, onExhausted]);

  const src = candidates[idx];
  useEffect(() => {
    const element = imageRef.current;
    if (!element || !src) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: IntersectionObserver | undefined;
    const start = () => {
      if (element.complete && element.naturalWidth > 0) return;
      // 挂起的图床不会触发 onError；只给即将进入视口的图计时，保留懒加载。
      timer = setTimeout(() => {
        if (!element.complete || element.naturalWidth === 0) advance();
      }, 6500);
    };
    if (loading === 'eager' || typeof IntersectionObserver === 'undefined') start();
    else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { start(); observer?.disconnect(); }
      }, { rootMargin: '200px' });
      observer.observe(element);
    }
    return () => { clearTimeout(timer); observer?.disconnect(); };
  }, [advance, src, loading]);

  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      ref={imageRef}
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={advance}
    />
  );
}
