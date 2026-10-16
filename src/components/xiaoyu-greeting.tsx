'use client';

import { useMemo } from 'react';
import { getTimeGreeting } from '@/lib/xiaoyu-caring';

/**
 * 小鱼TV 首页 Hero 问候区：按时间段显示不同的关心语。
 * 放在搜索框上方，温馨开场。
 */
export function XiaoyuGreeting() {
  const greeting = useMemo(() => getTimeGreeting(), []);

  return (
    <div className="mb-6 text-center">
      <h1 className="bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
        {greeting.title}
      </h1>
      <p className="mt-2 text-sm text-gray-400">{greeting.subtitle}</p>
    </div>
  );
}
