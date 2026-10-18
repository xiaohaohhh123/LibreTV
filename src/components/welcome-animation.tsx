'use client';
import { useEffect, useState } from 'react';
import { Icon } from './icon';
/** 每次进入都欢迎，不遮挡页面，不伪装成真实加载进度。 */
export function WelcomeAnimation() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="welcome-note" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span className="welcome-fish"><img src="/brand-mark.svg" width="44" height="32" alt="" /></span>
      <div><strong>欢迎回来，小鱼</strong><p>你的放映室，开场了。</p></div>
      <button className="care-icon" aria-label="关闭欢迎" onClick={() => setVisible(false)}><Icon name="close" /></button>
    </div>
  );
}
