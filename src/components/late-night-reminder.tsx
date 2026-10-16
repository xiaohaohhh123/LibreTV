'use client';

import { useEffect, useState } from 'react';
import { LATE_NIGHT_REMINDER } from '@/lib/xiaoyu-caring';
import { cn } from '@/lib/utils';

/**
 * 深夜观影提醒：23点后打开播放页，顶部显示温馨提示条。
 * 5 秒后自动淡出，也可以手动关闭。
 */
export function LateNightReminder() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 6) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 z-[9990] -translate-x-1/2',
        'flex items-center gap-3 rounded-full px-5 py-2.5',
        'bg-gradient-to-r from-indigo-500/90 to-purple-500/90',
        'text-sm text-white shadow-lg shadow-purple-500/30',
        'animate-in fade-in slide-in-from-top-4 duration-500'
      )}
    >
      <span>🌙</span>
      <span>{LATE_NIGHT_REMINDER}</span>
      <button
        onClick={() => setShow(false)}
        className="ml-1 rounded-full p-0.5 hover:bg-white/20"
        aria-label="关闭"
      >
        ✕
      </button>
    </div>
  );
}
