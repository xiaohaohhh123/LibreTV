'use client';
import { useEffect, useRef, useState } from 'react';
import { FRIEND_NOTES, getCareMoment, viewingDelta, getBufferingCare } from '@/lib/xiaoyu-caring';
import { Icon } from './icon';

const HOME_CARE_KEY = 'private-tv-home-care-visible';
const INITIAL_CARE = { kind: 'water', label: '给自己一点小照顾', title: '把水杯放近一点', body: '喝口水，坐舒服一点，再继续今天的小快乐。' } as const;

function useCareMoment() {
  const [moment, setMoment] = useState<ReturnType<typeof getCareMoment>>(INITIAL_CARE);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setMoment(getCareMoment()); };
    refresh();
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return moment;
}

/** 与现有线性图标同一网格；全部本地渲染，不请求外部素材。 */
function CareMotif({ kind }: { kind: 'water' | 'meal' | 'rest' }) {
  return <svg className="care-motif" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'water' ? <><path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8ZM17 9h2a3 3 0 1 1 0 6h-2M8 3v2m4-2v2" /><path className="care-water-line" d="M5 12c2-2 4 2 6 0s4 2 6 0" /></>
      : kind === 'meal' ? <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="3" /><path d="M2 3v6c0 1 1 2 2 2V3m0 8v10M21 3c-2 2-2 6 0 8v10M21 3v8" /></>
      : <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />}
  </svg>;
}

/** 首页只占一行；收起后留恢复入口，不抢海报首屏。 */
export function HomeCareNote() {
  const moment = useCareMoment();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try { setVisible(localStorage.getItem(HOME_CARE_KEY) !== 'false'); } catch { /* 当前页面仍能收起。 */ }
  }, []);
  const toggle = (next: boolean) => {
    setVisible(next);
    try { localStorage.setItem(HOME_CARE_KEY, String(next)); } catch { /* 不承诺刷新保留。 */ }
  };
  return <aside className="home-care-note" aria-label="今日小关心" data-collapsed={!visible}>
    {visible ? <>
      <span className="home-care-icon"><CareMotif kind={moment.kind} /></span>
      <p className="home-care-copy" title={`${moment.title}。${moment.body}`}><span className="home-care-label">{moment.label}</span><span>{moment.title}</span></p>
      <button type="button" className="home-care-close" aria-label="收起首页小关心" onClick={() => toggle(false)}><Icon name="close" /></button>
    </> : <button type="button" className="home-care-reopen" onClick={() => toggle(true)}><CareMotif kind={moment.kind} /><span>今日小关心</span><Icon name="chevronDown" /></button>}
  </aside>;
}

/** 留在播放器下方；暂停、后台和快进都不算观看时长。 */
export function ViewingCare({ episodeKey }: { episodeKey: string }) {
  const [enabled, setEnabled] = useState(true);
  const [rest, setRest] = useState(false);
  const [note, setNote] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const moment = useCareMoment();
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
    const resetAnchor = (event: Event) => {
      if (event.target instanceof HTMLVideoElement) { video = event.target; previous = video.currentTime; }
    };
    const resetVisibleAnchor = () => { if (video) previous = video.currentTime; };
    document.addEventListener('timeupdate', update, true);
    document.addEventListener('seeking', resetAnchor, true);
    document.addEventListener('seeked', resetAnchor, true);
    document.addEventListener('visibilitychange', resetVisibleAnchor);
    return () => {
      document.removeEventListener('timeupdate', update, true);
      document.removeEventListener('seeking', resetAnchor, true);
      document.removeEventListener('seeked', resetAnchor, true);
      document.removeEventListener('visibilitychange', resetVisibleAnchor);
    };
  }, [episodeKey, enabled]);

  return (
    <section className="viewing-care" aria-label="观影小憩" data-collapsed={collapsed} data-care-kind={rest ? 'rest' : moment.kind}>
      {collapsed ? <button type="button" className="care-reopen" onClick={() => setCollapsed(false)}><CareMotif kind={rest ? 'rest' : moment.kind} /><span>{rest ? '看了一会儿，给眼睛放个小假吧' : '观影小关心'}</span><Icon name="chevronDown" /></button> : <>
      <div className="care-heading">
        <span className="care-motif-wrap"><CareMotif kind={rest ? 'rest' : moment.kind} /></span>
        <div className="min-w-0 flex-1">
          <p className="care-time-label">{rest ? '幕间休息' : moment.label}</p>
          <h2 className="care-title">{rest ? '一集的快乐，也要分一点给自己' : moment.title}</h2>
          <p className="care-message" role={rest ? 'status' : undefined}>{rest ? '已经看了45分钟，看看远处、喝口水吧。故事会等你。' : moment.body}</p>
        </div>
        <button className="care-icon shrink-0" onClick={() => {
          if (rest) setRest(false);
          else { setCollapsed(true); setNote(null); }
        }} aria-label={rest ? '收起休息提醒' : '收起观影关心卡片'}><Icon name="close" /></button>
      </div>
      <div className="care-controls">
        <div className="flex items-center gap-4">
          <button className="care-action" aria-expanded={note !== null} aria-controls="friend-note" onClick={() => setNote(note === null ? nextNote.current++ % FRIEND_NOTES.length : null)}>{note === null ? '看一条小提醒' : '收起小提醒'}</button>
          {note !== null && <button className="care-action care-note-swap" onClick={() => setNote(nextNote.current++ % FRIEND_NOTES.length)}><Icon name="refresh" className="h-3.5 w-3.5" />换一句</button>}
        </div>
        <button className="care-action" aria-pressed={enabled} onClick={toggleReminder}>{enabled ? '45分钟休息提醒 · 已开启' : '休息提醒 · 已关闭'}</button>
      </div>
      {note !== null && <div id="friend-note" className="friend-note" aria-live="polite"><p>{FRIEND_NOTES[note]}</p></div>}
      </>}
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
      <span>正在准备播放</span>
    </div>
    <div className="cinema-opening-note" aria-live="polite" aria-atomic="true">
      {note && <><p className="cinema-opening-title">{note.title}</p><p className="cinema-opening-body">{note.body}</p></>}
    </div>
    {ready ? <button className="cinema-opening-play" onClick={event => { event.stopPropagation(); onPlay(); }}>开始播放</button>
      : <p className="cinema-opening-status" role="status"><span className="cinema-opening-dots" aria-hidden="true"><i /><i /><i /></span>{slow ? '准备时间有点长，可以试试「切换资源」。' : '正在准备正片'}</p>}
  </div>;
}
