'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { LOVE_LETTER } from '@/lib/xiaoyu-caring';
import { cn } from '@/lib/utils';
import { useFocusTrap } from './use-focus-trap';

/**
 * 小鱼TV 彩蛋：连点 Logo 5 次弹出表白信。
 * 用法：<LoveLetterEasterEgg /> 放在 layout 或首页，监听全局对 .brand-logo 的点击。
 */
export function LoveLetterEasterEgg() {
  const [show, setShow] = useState(false);
  const [, setClickCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(show, panelRef);
  useEffect(() => {
    if (!show) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setShow(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [show]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.brand-logo')) {
        setClickCount((c) => {
          const next = c + 1;
          if (next >= 5) {
            setShow(true);
            return 0;
          }
          return next;
        });
        // 2 秒内没点够 5 次就重置
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setClickCount(0), 2000);
      }
    };
    document.addEventListener('click', handler);
    return () => {
      document.removeEventListener('click', handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const close = useCallback(() => setShow(false), []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={close}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="给小鱼的一封小信" tabIndex={-1}
        className={cn(
          'mx-4 max-w-md rounded-2xl p-8 text-center',
          'bg-surface-raised text-content',
          'border border-line shadow-2xl',
          'animate-in fade-in zoom-in duration-300'
        )}
        onClick={(e) => e.stopPropagation()}
      >

        <h2 className="mb-4 text-2xl font-semibold text-content">
          {LOVE_LETTER.title}
        </h2>
        <div className="space-y-1.5 text-sm leading-loose text-muted">
          {LOVE_LETTER.body.map((line, i) => (
            <p key={i} className={line === '' ? 'h-2' : ''}>
              {line}
            </p>
          ))}
        </div>
        <button
          onClick={close}
          className="btn-primary mt-6 px-8 min-h-11"
        >
          收好这份心意
        </button>
      </div>
    </div>
  );
}

/**
 * 小鱼TV 彩蛋：Konami Code（上上下下左右左右BA）触发小鱼游过屏幕。
 */
export function KonamiFishEasterEgg() {
  const [swimming, setSwimming] = useState(false);

  useEffect(() => {
    const sequence = [
      'arrowup', 'arrowup',
      'arrowdown', 'arrowdown',
      'arrowleft', 'arrowright',
      'arrowleft', 'arrowright',
      'b', 'a',
    ];
    let idx = 0;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === sequence[idx]) {
        idx++;
        if (idx === sequence.length) {
          setSwimming(true);
          setTimeout(() => setSwimming(false), 6000);
          idx = 0;
        }
      } else {
        idx = key === sequence[0] ? 1 : 0;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!swimming) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
      <div className="konami-fish-swim text-6xl">🐟</div>
      <style>{`
        .konami-fish-swim {
          position: absolute;
          top: 40%;
          left: -80px;
          animation: konami-swim 6s linear forwards;
        }
        @keyframes konami-swim {
          0% { left: -80px; transform: scaleX(1); }
          45% { left: 50%; transform: scaleX(1) translateY(-20px); }
          50% { left: 50%; transform: scaleX(-1) translateY(-20px); }
          100% { left: 105%; transform: scaleX(-1); }
        }
      `}</style>
    </div>
  );
}
