'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type Artplayer from 'artplayer';
import { Icon } from './icon';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** 控件挂在 ArtPlayer 内，网页全屏和原生全屏都保留选集与提示。 */
export function PlayerChrome({ art, title, episodeLabel, episodeNames, currentIndex, onSelectEpisode, onNext, locked, children }: {
  art: Artplayer;
  title: string;
  episodeLabel?: string;
  episodeNames: string[];
  currentIndex: number;
  onSelectEpisode?: (index: number) => void;
  onNext?: () => void;
  locked: boolean;
  children: ReactNode;
}) {
  const [hosts, setHosts] = useState<Record<string, HTMLElement>>({});
  const [panel, setPanel] = useState<'speed' | 'episodes' | null>(null);
  const [rate, setRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const speedButton = useRef<HTMLButtonElement>(null);
  const episodesButton = useRef<HTMLButtonElement>(null);
  const activeEpisode = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const slots: Record<string, HTMLElement> = {};
    for (const [name, position, index] of [['next', 'left', 15], ['speed', 'right', 1], ['episodes', 'right', 2]] as const) {
      const slot = document.createElement('span');
      art.controls.add({ name: `cinema-${name}`, position, index, html: slot });
      slots[name] = slot;
    }
    setHosts(slots);
    const nativeControls: HTMLElement[] = [];
    const activateControl = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).click();
    };
    for (const [name, label] of Object.entries({playAndPause:'播放或暂停', setting:'播放设置', screenshot:'截取画面', pip:'画中画', fullscreenWeb:'网页全屏', fullscreen:'全屏'})) {
      const control = art.template.$player.querySelector<HTMLElement>(`.art-control-${name}`);
      if (!control) continue;
      control.setAttribute('role', 'button');
      control.setAttribute('aria-label', label);
      control.tabIndex = 0;
      control.addEventListener('keydown', activateControl);
      nativeControls.push(control);
    }
    let savedRate: unknown;
    try { savedRate = art.storage.get('xiaoyuRate'); } catch { /* 存储不可用时正常播放 */ }
    if (typeof savedRate === 'number' && RATES.includes(savedRate)) art.video.playbackRate = savedRate;
    const syncRate = () => setRate(art.video.playbackRate);
    syncRate();
    art.on('video:ratechange', syncRate);
    art.on('control', setControlsVisible);
    return () => {
      art.off('video:ratechange', syncRate);
      art.off('control', setControlsVisible);
      for (const name of ['next', 'speed', 'episodes']) art.controls.remove(`cinema-${name}`);
      for (const control of nativeControls) control.removeEventListener('keydown', activateControl);
    };
  }, [art]);

  useEffect(() => {
    art.template.$player.classList.toggle('cinema-is-locked', locked);
    if (locked) setPanel(null);
    return () => art.template.$player.classList.remove('cinema-is-locked');
  }, [art, locked]);

  useEffect(() => {
    art.template.$player.classList.toggle('cinema-panel-open', panel !== null);
    if (panel === 'episodes') activeEpisode.current?.scrollIntoView({ block: 'nearest' });
    if (panel) panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], [aria-current="true"]')?.focus({ preventScroll: true });
    return () => art.template.$player.classList.remove('cinema-panel-open');
  }, [art, panel]);

  const closePanel = () => {
    const button = panel === 'speed' ? speedButton.current : episodesButton.current;
    setPanel(null);
    button?.focus({ preventScroll: true });
  };

  return <>
    {hosts.next && createPortal(onNext ? <button className="cinema-bar-button cinema-next" aria-label="播放下一集" onClick={onNext}>下一集</button> : null, hosts.next)}
    {hosts.speed && createPortal(<button ref={speedButton} className="cinema-bar-button" aria-label={`播放速度，当前 ${rate} 倍`} aria-expanded={panel === 'speed'} aria-controls="cinema-speed-panel" onClick={() => setPanel(panel === 'speed' ? null : 'speed')}>{rate === 1 ? '倍速' : `${rate}x`}</button>, hosts.speed)}
    {hosts.episodes && createPortal(episodeNames.length > 1 ? <button ref={episodesButton} className="cinema-bar-button" aria-expanded={panel === 'episodes'} aria-controls="cinema-episodes-panel" onClick={() => setPanel(panel === 'episodes' ? null : 'episodes')}>选集</button> : null, hosts.episodes)}
    {createPortal(<div className="cinema-overlays" data-controls-visible={controlsVisible || panel !== null} data-locked={locked}>
      {!locked && <div className="cinema-topline"><span>{title}<small>{episodeLabel}</small></span><span className="cinema-watermark">小鱼 · 放映室</span></div>}
      {children}
      {panel && !locked && <>
        <button className="cinema-panel-dismiss" aria-label="关闭播放面板" onClick={closePanel} />
        <section ref={panelRef} id={`cinema-${panel}-panel`} className={`cinema-panel cinema-${panel}-panel`} role="dialog" aria-modal="false" aria-label={panel === 'speed' ? '播放速度' : '选择剧集'} onClick={e => e.stopPropagation()} onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); }
        }}>
          <div className="cinema-panel-heading"><strong>{panel === 'speed' ? '播放速度' : '选择剧集'}</strong><button className="cinema-panel-close" aria-label="收起播放面板" onClick={closePanel}><Icon name="close" /></button></div>
          {panel === 'speed' ? <>
            <p className="cinema-panel-caption">按自己的节奏看，会记住你的选择。</p>
            <div className="cinema-rate-options">{RATES.map(value => <button key={value} aria-pressed={value === rate} onClick={() => {
              art.video.playbackRate = value;
              try { art.storage.set('xiaoyuRate', value); } catch { /* 本轮仍可使用 */ }
              closePanel();
            }}>{value === 1 ? '正常' : `${value}x`}</button>)}</div>
            <p className="cinema-panel-footnote">画面长按可临时 2 倍速，松开恢复。</p>
          </> : <>
            <p className="cinema-panel-caption">{title} · 共 {episodeNames.length} 集</p>
            <div className="cinema-episode-options">{episodeNames.map((label, index) => <button key={index} ref={index === currentIndex ? activeEpisode : undefined} aria-current={index === currentIndex ? 'true' : undefined} onClick={() => {
              onSelectEpisode?.(index);
              closePanel();
            }}>{label || `第${index + 1}集`}</button>)}</div>
          </>}
        </section>
      </>}
    </div>, art.template.$player)}
  </>;
}
