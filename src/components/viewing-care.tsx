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

export function BufferingCare({ show }: { show: boolean }) {
  const [text, setText] = useState('');
  useEffect(() => { if (show) setText(getBufferingCare()); }, [show]);
  return show ? <p className="text-sm text-muted" role="status">{text}</p> : null;
}
