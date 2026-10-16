'use client';

import { useEffect, useState, useCallback } from 'react';
import { LOVE_LETTER } from '@/lib/xiaoyu-caring';
import { cn } from '@/lib/utils';

/**
 * 小鱼TV 彩蛋：连点 Logo 5 次弹出表白信。
 * 用法：<LoveLetterEasterEgg /> 放在 layout 或首页，监听全局对 .brand-logo 的点击。
 */
export function LoveLetterEasterEgg() {
  const [show, setShow] = useState(false);
  const [clickCount, setClickCount] = useState(0);

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
      <div
        className={cn(
          'mx-4 max-w-md rounded-2xl p-8 text-center',
          'bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20',
          'border border-pink-300/30 shadow-2xl shadow-pink-500/20',
          'animate-in fade-in zoom-in duration-300'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-4xl">💌</div>
        <h2 className="mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
          {LOVE_LETTER.title}
        </h2>
        <div className="space-y-1 text-sm leading-relaxed text-gray-200">
          {LOVE_LETTER.body.map((line, i) => (
            <p key={i} className={line === '' ? 'h-2' : ''}>
              {line}
            </p>
          ))}
        </div>
        <button
          onClick={close}
          className="mt-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-2 text-sm font-medium text-white transition-transform hover:scale-105"
        >
          收下啦 💕
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
