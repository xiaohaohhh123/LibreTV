'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { useAuth } from './auth';
/** 登录后轻声欢迎，同一标签页会话只出现一次。 */
export function WelcomeAnimation() {
  const [visible, setVisible] = useState(false);
  const greeted = useRef(false);
  const { checked, verified } = useAuth();
  useEffect(() => {
    if (!checked || !verified) {
      setVisible(false);
      return;
    }
    if (!greeted.current) {
      try {
        if (sessionStorage.getItem('yingjian-welcomed')) return;
        sessionStorage.setItem('yingjian-welcomed', '1');
      } catch { /* 存储受限时，本次页面仍可正常欢迎与播放。 */ }
      greeted.current = true;
      setVisible(true);
    }
    const timer = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(timer);
  }, [checked, verified]);
  if (!visible || !verified) return null;
  return (
    <div className="welcome-note" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span><img src="/brand-mark.svg" width="32" height="32" alt="" /></span>
      <div><strong>欢迎使用私人TV</strong><p>搜索喜欢的影片，接着上次看。</p></div>
      <button className="care-icon" aria-label="关闭欢迎" onClick={() => setVisible(false)}><Icon name="close" /></button>
    </div>
  );
}
