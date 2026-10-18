'use client';
import { useEffect, useRef, useState } from 'react';
import { FRIEND_NOTES, getTimeGreeting, viewingDelta, getBufferingCare } from '@/lib/xiaoyu-caring';
import { Icon } from './icon';

/** 留在播放器下方；暂停、后台和快进都不算观看时长。 */
export function ViewingCare({ episodeKey }: { episodeKey: string }) {
  const [enabled, setEnabled] = useState(true);
  const [rest, setRest] = useState(false);
  const [note, setNote] = useState<number | null>(null);
  const [greeting, setGreeting] = useState('故事慢慢看，今天也慢慢来。');
  const watched = useRef(0);
  const nextNote = useRef(Math.floor(Date.now() / 86400000) % FRIEND_NOTES.length);
  useEffect(() => {
    try { setEnabled(localStorage.getItem('xiaoyu-care-enabled') !== 'false'); } catch { /* 无存储权限时仍可使用 */ }
  }, []);
  const toggleReminder = () => {
    const next = !enabled;
    setEnabled(next); setRest(false); watched.current = 0;
    try { localStorage.setItem('xiaoyu-care-enabled', String(next)); } catch { /* 当前页设置仍生效 */ }
  };
  useEffect(() => setGreeting(getTimeGreeting().subtitle), []);
  useEffect(() => {
    let previous = 0;
    let video: HTMLVideoElement | null = null;
    const update = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLVideoElement)) return;
      if (video !== target) { video = target; previous = target.currentTime; return; }
      if (enabled) watched.current += viewingDelta(previous, target.currentTime, target.paused || target.seeking, !document.hidden, target.playbackRate);
      previous = target.currentTime;
      if (enabled && watched.current >= 45 * 60) { watched.current = 0; setRest(true); }
    };
    document.addEventListener('timeupdate', update, true);
    return () => document.removeEventListener('timeupdate', update, true);
  }, [episodeKey, enabled]);

  return (
    <section className="viewing-care" aria-label="观影小憩">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="care-caption">幕间 · 给小鱼的一点小关心</p>
          <p className="care-message" role={rest ? 'status' : undefined}>{rest ? '已经看了45分钟，趁幕间看看远处、喝口水吧。故事会等你。' : greeting}</p>
        </div>
        {rest && <button className="care-icon shrink-0" onClick={() => setRest(false)} aria-label="收起休息提醒"><Icon name="close" /></button>}
      </div>
      <div className="flex flex-wrap justify-between gap-x-6 mt-2">
        <button className="care-action" aria-expanded={note !== null} aria-controls="friend-note" onClick={() => setNote(note === null ? nextNote.current++ % FRIEND_NOTES.length : null)}>{note === null ? '拆开一张小纸条 ↗' : '收好这张小纸条'}</button>
        <button className="care-action" aria-pressed={enabled} onClick={toggleReminder}>{enabled ? '45分钟休息提醒 · 已开启' : '休息提醒 · 已关闭'}</button>
      </div>
      {note !== null && <div id="friend-note" className="friend-note"><p className="friend-note-label">给小鱼的小纸条</p><p>{FRIEND_NOTES[note]}</p><p className="friend-note-signature">— 小皓</p></div>}
    </section>
  );
}

/** 只填补真实开场等待，不为读完纸条延迟播放。 */
export function BufferingCare({ show, episodeKey, ready, onPlay }: { show: boolean; episodeKey?: string; ready: boolean; onPlay: () => void }) {
  const [note, setNote] = useState<ReturnType<typeof getBufferingCare> | null>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setNote(null); setSlow(false);
    if (!show) return;
    const noteTimer = setTimeout(() => {
      let previous: string | undefined;
      try { previous = sessionStorage.getItem('xiaoyu-opening-note') ?? undefined; } catch { /* 不影响播放 */ }
      const next = getBufferingCare(new Date().getHours(), previous);
      setNote(next);
      try { sessionStorage.setItem('xiaoyu-opening-note', next.title); } catch { /* 当前纸条仍可显示 */ }
    }, 650);
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    return () => { clearTimeout(noteTimer); clearTimeout(slowTimer); };
  }, [show, episodeKey]);
  if (!show) return null;
  return <div className="cinema-opening">
    <div className="cinema-opening-label">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand-mark.svg" width="42" height="28" alt="" />
      <span>开场前 · 给小鱼的小纸条</span>
    </div>
    <div className="cinema-opening-note" aria-live="polite" aria-atomic="true">
      {note && <><p className="cinema-opening-title">{note.title}</p><p className="cinema-opening-body">{note.body}</p></>}
    </div>
    {ready ? <button className="cinema-opening-play" onClick={event => { event.stopPropagation(); onPlay(); }}>开始播放</button>
      : <p className="cinema-opening-status" role="status"><span className="cinema-opening-dots" aria-hidden="true"><i /><i /><i /></span>{slow ? '准备时间有点长，可以试试「切换资源」。' : '正在准备正片'}</p>}
  </div>;
}
