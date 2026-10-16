'use client';

import { useEffect, useRef, useState } from 'react';
import { getBufferingCare } from '@/lib/xiaoyu-caring';
import { cn } from '@/lib/utils';

/** 观影中的温馨提醒文案 */
const VIEWING_REMINDERS = [
  { icon: '💧', text: '看了这么久了，喝口水休息一下吧' },
  { icon: '👀', text: '眼睛累了吧，看看远方放松一下' },
  { icon: '🧘', text: '起来伸个懒腰，活动一下肩颈' },
  { icon: '🍎', text: '追剧也要记得吃点东西哦' },
];

/**
 * 播放页观影关怀：在她看电视时适时出现，不打扰。
 * - 每 45 分钟一次温馨提醒（可关闭，右下角小浮条）
 * - 换集时显示一句关心语
 */
export function ViewingCare({ episodeIndex }: { episodeIndex: number }) {
  const [reminder, setReminder] = useState<(typeof VIEWING_REMINDERS)[number] | null>(null);
  const [episodeTip, setEpisodeTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevEpisode = useRef(episodeIndex);

  // 每 45 分钟提醒一次
  useEffect(() => {
    const showReminder = () => {
      const pick = VIEWING_REMINDERS[Math.floor(Math.random() * VIEWING_REMINDERS.length)];
      setReminder(pick);
      // 8 秒后自动消失
      setTimeout(() => setReminder(null), 8000);
    };
    // 45 分钟后第一次提醒
    timerRef.current = setInterval(showReminder, 45 * 60 * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 换集时显示关心语
  useEffect(() => {
    if (prevEpisode.current !== episodeIndex) {
      prevEpisode.current = episodeIndex;
      setEpisodeTip(true);
      setTimeout(() => setEpisodeTip(false), 5000);
    }
  }, [episodeIndex]);

  return (
    <>
      {/* 长时间观影提醒：右下角小浮条 */}
      {reminder && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-[9990] max-w-xs',
            'flex items-center gap-3 rounded-2xl px-4 py-3',
            'bg-gradient-to-r from-pink-500/90 to-purple-500/90',
            'text-sm text-white shadow-lg shadow-pink-500/30',
            'animate-in fade-in slide-in-from-bottom-4 duration-500'
          )}
        >
          <span className="text-xl">{reminder.icon}</span>
          <span>{reminder.text}</span>
          <button
            onClick={() => setReminder(null)}
            className="ml-1 shrink-0 rounded-full p-0.5 hover:bg-white/20"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      )}

      {/* 换集关心语：顶部小横幅 */}
      {episodeTip && (
        <div
          className={cn(
            'fixed top-4 left-1/2 z-[9990] -translate-x-1/2',
            'rounded-full px-5 py-2',
            'bg-black/70 backdrop-blur-sm border border-pink-300/20',
            'text-sm text-pink-200',
            'animate-in fade-in slide-in-from-top-4 duration-500'
          )}
        >
          ✨ 下一集开始了，记得喝水哦
        </div>
      )}
    </>
  );
}

/**
 * 缓冲时的关心语：替代生硬的"加载中"。
 */
export function BufferingCare({ show }: { show: boolean }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (show) {
      setText(getBufferingCare());
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
      <p>{text}</p>
    </div>
  );
}
