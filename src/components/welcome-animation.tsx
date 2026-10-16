'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getTimeGreeting } from '@/lib/xiaoyu-caring';

/**
 * 小鱼TV 进站欢迎动画：全屏品牌开场，优雅淡入后进入网站。
 * - 首次访问（每天一次）播放完整动画
 * - 当天已看过则播放快速版（1秒）
 * - 点击任意处可跳过
 */
export function WelcomeAnimation() {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const [isQuick, setIsQuick] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastSeen = localStorage.getItem('xiaoyu-welcome-seen');
    const quick = lastSeen === today;
    setIsQuick(quick);
    setShow(true);
    localStorage.setItem('xiaoyu-welcome-seen', today);

    const duration = quick ? 1000 : 2800;
    const exitTimer = setTimeout(() => setPhase('exit'), duration);
    const hideTimer = setTimeout(() => setShow(false), duration + 600);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!show) return null;

  const greeting = getTimeGreeting();

  return (
    <div
      className={cn(
        'fixed inset-0 z-[10000] flex flex-col items-center justify-center',
        'bg-gradient-to-b from-[#0b101a] via-[#141c29] to-[#0b101a]',
        'transition-opacity duration-600 cursor-pointer',
        phase === 'exit' ? 'opacity-0' : 'opacity-100'
      )}
      onClick={() => {
        setPhase('exit');
        setTimeout(() => setShow(false), 600);
      }}
    >
      {/* 上浮气泡 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className="welcome-bubble"
            style={{
              left: `${5 + i * 8}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + (i % 3)}s`,
              width: `${6 + (i % 4) * 4}px`,
              height: `${6 + (i % 4) * 4}px`,
            }}
          />
        ))}
      </div>

      {/* 小鱼游入 */}
      <div className={cn('welcome-fish', isQuick && 'welcome-fish-quick')}>
        <svg viewBox="0 0 120 80" fill="none" className="w-24 h-16 sm:w-32 sm:h-20">
          <defs>
            <linearGradient id="welcome-fish-body" x1="0" y1="0" x2="120" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#00ccff" />
              <stop offset="1" stopColor="#ff3c78" />
            </linearGradient>
          </defs>
          <path
            d="M12 40 C 28 18, 62 14, 88 32 C 96 38, 96 42, 88 48 C 62 66, 28 62, 12 40 Z"
            fill="url(#welcome-fish-body)"
          />
          <path
            className="welcome-fish-tail"
            d="M88 32 L 112 20 L 104 40 L 112 60 L 88 48 Z"
            fill="url(#welcome-fish-body)"
            opacity="0.9"
          />
          <circle cx="30" cy="34" r="5" fill="#0b101a" />
          <circle cx="31.5" cy="32.5" r="1.8" fill="#fff" />
          <circle cx="38" cy="44" r="3" fill="#ff3c78" opacity="0.55" />
        </svg>
      </div>

      {/* 品牌字 */}
      <h1 className="welcome-title font-display text-5xl sm:text-6xl font-black mt-4">
        <span className="bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
          小鱼TV
        </span>
      </h1>

      {/* 问候语 */}
      <p className="welcome-subtitle mt-3 text-sm text-gray-400 tracking-widest">
        {greeting.subtitle}
      </p>

      {/* 加载条 */}
      <div className="welcome-loader mt-8 w-40 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={cn('h-full rounded-full bg-gradient-to-r from-cyan-400 to-pink-500', isQuick ? 'welcome-load-quick' : 'welcome-load')} />
      </div>

      <style>{`
        .welcome-bubble {
          position: absolute;
          bottom: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,204,255,0.3), transparent);
          animation: welcome-rise linear infinite;
        }
        @keyframes welcome-rise {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
        .welcome-fish {
          animation: welcome-swim-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          opacity: 0;
        }
        .welcome-fish-quick {
          animation-duration: 0.5s;
        }
        @keyframes welcome-swim-in {
          0% { transform: translateX(-120px) translateY(10px); opacity: 0; }
          60% { opacity: 1; }
          100% { transform: translateX(0) translateY(0); opacity: 1; }
        }
        .welcome-fish-tail {
          transform-origin: 88px 40px;
          animation: welcome-tail 0.6s ease-in-out infinite alternate;
        }
        @keyframes welcome-tail {
          from { transform: rotate(-12deg); }
          to { transform: rotate(12deg); }
        }
        .welcome-title {
          animation: welcome-fade-up 0.8s ease-out 0.4s forwards;
          opacity: 0;
        }
        @keyframes welcome-fade-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .welcome-subtitle {
          animation: welcome-fade-up 0.8s ease-out 0.8s forwards;
          opacity: 0;
        }
        .welcome-loader {
          animation: welcome-fade-up 0.8s ease-out 1s forwards;
          opacity: 0;
        }
        .welcome-load {
          animation: welcome-progress 2.2s ease-out forwards;
          width: 0;
        }
        .welcome-load-quick {
          animation: welcome-progress 0.7s ease-out forwards;
          width: 0;
        }
        @keyframes welcome-progress {
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
