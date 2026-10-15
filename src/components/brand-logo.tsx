'use client';

import { cn } from '@/lib/utils';

/**
 * 小鱼TV 品牌 Logo：会游动的小鱼 + 流光渐变文字 + 上浮气泡。
 * 纯 CSS 动画，无 JS 定时器，SSR 安全。
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn('brand-logo', className)} aria-hidden="true">
      {/* 气泡 */}
      <span className="brand-bubble brand-bubble-1" />
      <span className="brand-bubble brand-bubble-2" />
      <span className="brand-bubble brand-bubble-3" />
      {/* 小鱼 */}
      <svg className="brand-fish" viewBox="0 0 120 80" fill="none">
        <defs>
          <linearGradient id="brand-fish-body" x1="0" y1="0" x2="120" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00ccff" />
            <stop offset="1" stopColor="#ff3c78" />
          </linearGradient>
        </defs>
        {/* 鱼身 */}
        <path
          d="M12 40 C 28 18, 62 14, 88 32 C 96 38, 96 42, 88 48 C 62 66, 28 62, 12 40 Z"
          fill="url(#brand-fish-body)"
        />
        {/* 鱼尾（摇摆） */}
        <path
          className="brand-fish-tail"
          d="M88 32 L 112 20 L 104 40 L 112 60 L 88 48 Z"
          fill="url(#brand-fish-body)"
          opacity="0.9"
        />
        {/* 眼睛 */}
        <circle cx="30" cy="34" r="5" fill="#0b101a" />
        <circle cx="31.5" cy="32.5" r="1.8" fill="#fff" />
        {/* 腮红 */}
        <circle cx="38" cy="44" r="3" fill="#ff3c78" opacity="0.55" />
      </svg>
      {/* 文字 */}
      <span className="brand-word">小鱼TV</span>
    </div>
  );
}
