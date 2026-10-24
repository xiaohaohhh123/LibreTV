'use client';

import { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls, { type HlsConfig } from 'hls.js';

import { PlaybackRecovery, describeHlsError } from '@/lib/playback-recovery';
import { createHlsLoader } from '@/lib/hls-loader';
import {
  getVideoPrefetcher,
  getNextEpisodePrefetcher,
} from '@/lib/video-prefetcher';
import { loadCacheSettings } from '@/lib/video-cache';
import { hasPrefetchHeadroom, shouldWarmNextEpisode } from '@/lib/source-recovery-match';
import { formatTime } from '@/lib/utils';
import { PlayerChrome } from './player-chrome';
import { BufferingCare } from './viewing-care';

/**
 * 播放器外壳：ArtPlayer + hls.js（旧版 player.js 的 React 化）。
 * 保留：广告分片过滤、自动连播回调、进度回调、快捷键、移动端长按倍速、错误恢复。
 * 移除：DOM 手工操作、watch.html 跳转链、localStorage 状态总线。
 *
 * 关键设计：ArtPlayer 实例只在挂载时创建一次，换集（url 变化）只「切换 HLS 源」
 * 而不销毁重建。否则在「网页全屏（页面全屏）」下整实例重建会丢失全屏上下文、
 * 重建 <video> 元素，触发「黑屏有声」的渲染竞态。
 */

interface PlayerShellProps {
  url: string;
  title: string;
  episodeNames?: string[];
  currentIndex?: number;
  onSelectEpisode?: (index: number) => void;
  adFilter: boolean;
  autoplayNext: boolean;
  /** 剧集标识 `${source}:${vodId}:${episodeIndex}`（片段缓存按集淘汰的分组键） */
  episodeKey?: string;
  /** 下一集 m3u8 地址：当前集预取完成后预热下一集前 7 分钟 */
  nextUrl?: string;
  nextEpisodeKey?: string;
  /** 跳过片头秒数（0=关闭）；片头显示「跳过片头」按钮 */
  skipIntroSeconds?: number;
  /** 片尾剩余秒数（0=关闭）；片尾显示「下一集」按钮 */
  outroNextSeconds?: number;
  /** 切下一集回调（父级提供 goEpisode）；缺省时不显示「下一集」按钮 */
  onRequestNext?: () => void;
  /** 进度恢复：优先 URL position，其次查询该回调（返回 0 表示无记录） */
  getRestorePosition?: () => number | Promise<number>;
  /** 轻量进度采样用于立即换源；不触发每帧持久化。 */
  onPositionChange?: (position: number) => void;
  onTimeUpdate?: (position: number, duration: number) => void;
  onEnded?: () => void;
  onPause?: (position: number, duration: number) => void;
  /** 恢复策略判源不可用（重试耗尽/格式硬失败）时回调：父级弹出换源面板 */
  onRequestSwitchSource?: (reason: string, position?: number) => void;
}

export function PlayerShell({
  url,
  title,
  episodeNames = [],
  currentIndex = 0,
  onSelectEpisode,
  adFilter,
  autoplayNext,
  episodeKey,
  nextUrl,
  nextEpisodeKey,
  skipIntroSeconds = 90,
  outroNextSeconds = 90,
  onRequestNext,
  getRestorePosition,
  onPositionChange,
  onTimeUpdate,
  onEnded,
  onPause,
  onRequestSwitchSource,
}: PlayerShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [player, setPlayer] = useState<Artplayer | null>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  // 实际开始播放后隐藏品牌占位，点击仍由原播放器接管。
  const [showPoster, setShowPoster] = useState(true);
  const [readyToPlay, setReadyToPlay] = useState(false);
  // 跳过片头 / 片尾下一集 悬浮按钮
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEp, setShowNextEp] = useState(false);
  // —— 锁屏（对标腾讯视频移动端）：锁定后屏蔽所有触摸操作，只留解锁按钮 ——
  const [locked, setLocked] = useState(false);
  // 锁屏状态同步到 ref，供触摸/快捷键处理器读取
  useEffect(() => { lockedRef.current = locked; }, [locked]);
  // 本集是否已跳过/播过片头（换集重置）
  const introDoneRef = useRef(false);
  // 按钮显隐的上一帧状态，避免 timeupdate 高频 setState
  const skipShownRef = useRef(false);
  const nextShownRef = useRef(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 始终持有最新 props/回调，避免重建播放器
  const propsRef = useRef({
    url, title, adFilter, autoplayNext, episodeKey, nextUrl, nextEpisodeKey,
    skipIntroSeconds, outroNextSeconds, onRequestNext,
    getRestorePosition, onPositionChange, onTimeUpdate, onEnded, onPause, onRequestSwitchSource,
  });
  propsRef.current = {
    url, title, adFilter, autoplayNext, episodeKey, nextUrl, nextEpisodeKey,
    skipIntroSeconds, outroNextSeconds, onRequestNext,
    getRestorePosition, onPositionChange, onTimeUpdate, onEnded, onPause, onRequestSwitchSource,
  };

  // 跨集共享、每次换集重置的播放链路状态
  // 媒体健康度：音频轨可播不代表视频轨正常（「黑屏但有声」的假死态）。
  // 仅当有分片真正进入 MSE buffer 后才视为恢复，错误遮罩才能被清除。
  const mediaHealthyRef = useRef(true);
  const playbackStartedRef = useRef(false);
  // 起播阶段的 video 元素级错误允许自愈重试一次（重建 hls/MSE）
  const videoErrorRetryUsedRef = useRef(false);
  // 进度恢复每集只执行一次（MANIFEST_PARSED 可能因代理回退再次触发）
  const restoredRef = useRef(false);
  // timeupdate 续跑预取的游标：必须按集清零，否则会沿用上一集的时间戳推迟首次续跑
  const lastPrefetchEnsureRef = useRef(0);
  // setupHls 可能改走代理形式，video:error 重试要用最近一次的地址
  const currentMediaUrlRef = useRef(url);
  // 本集的恢复策略实例：跨直连/代理两级重建共享计数
  const recoveryRef = useRef<PlaybackRecovery | null>(null);
  // 自然播完标记，卸载时不回写进度（避免覆盖「已看完」记录）
  const endedRef = useRef(false);
  const lockedRef = useRef(false);

  const showHint = (text: string) => {
    setHint(text);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHint(''), 2500);
  };

  // 片段缓存开启时调大 hls.js 自身缓冲，缓冲之外的空窗由预取器补齐
  const buildHlsConfig = (): Partial<HlsConfig> => {
    const p = propsRef.current;
    const cacheSettings = loadCacheSettings();
    const cacheEnabled = cacheSettings.enabled && !!p.episodeKey;
    return {
      debug: false,
      enableWorker: true,
      backBufferLength: 90,
      maxBufferLength: cacheEnabled ? 120 : 60,
      maxMaxBufferLength: cacheEnabled ? 600 : 120,
      maxBufferSize: (cacheEnabled ? 90 : 60) * 1000 * 1000,
      maxBufferHole: 0.5,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1000,
      startLevel: -1,
      abrEwmaDefaultEstimate: 500_000,
      appendErrorMaxRetry: 5,
      // 组合 loader：广告过滤（blockAd 随设置）+ 片段缓存命中（cacheEnabled）
      loader: createHlsLoader(Hls, { blockAd: p.adFilter }) as unknown as HlsConfig['loader'],
    };
  };

  // 当前集预取（episodeKey 缺省 = 关闭，见 ensure 内部 settings.enabled 判断）
  const ensurePrefetch = (mediaUrl: string, currentTime: number, horizonSeconds?: number) => {
    const p = propsRef.current;
    if (!p.episodeKey) return;
    const video = artRef.current?.video;
    if (!video) return;
    let bufferAhead = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= currentTime && video.buffered.end(i) >= currentTime) bufferAhead = video.buffered.end(i) - currentTime;
    }
    if (!hasPrefetchHeadroom(bufferAhead, video.paused && playbackStartedRef.current)) return;
    getVideoPrefetcher().ensure({
      m3u8Url: mediaUrl,
      currentTime,
      episodeKey: p.episodeKey,
      horizonSeconds,
      concurrency: 1,
      onProgress: (stats) => {
        // 当前集有余量且快到片尾时才预热，避免开场就争抢下一集带宽。
        if (stats.state === 'done' && p.nextUrl && p.nextEpisodeKey && shouldWarmNextEpisode(video.currentTime, video.duration, p.autoplayNext)) {
          getNextEpisodePrefetcher().ensure({
            m3u8Url: p.nextUrl,
            currentTime: 0,
            episodeKey: p.nextEpisodeKey,
            horizonSeconds: 90,
            concurrency: 1,
          });
        }
      },
    });
  };

  const restorePlaybackPosition = async () => {
    const art = artRef.current;
    if (!art || restoredRef.current || !Number.isFinite(art.video.duration) || art.video.duration <= 0) return;
    const episode = propsRef.current.episodeKey;
    restoredRef.current = true;
    try {
      const saved = (await propsRef.current.getRestorePosition?.()) ?? 0;
      if (artRef.current !== art || propsRef.current.episodeKey !== episode) return;
      if (saved > 10 && saved < art.video.duration - 2) {
        art.currentTime = saved;
        showHint(`已从 ${formatTime(saved)} 继续播放`);
      }
    } catch { /* 读取进度失败仍正常播放 */ }
  };

  /**
   * 初始化/切换 HLS。allowProxyFallback：直连致命网络错误（CORS/防盗链/分片被拒）时，
   * 自动改走同源 cookie 鉴权的 /api/proxy 重试一次。
   * 注意：不销毁 ArtPlayer，只销毁并重建 hls，从而保留网页全屏等播放器状态。
   */
  const setupHls = (video: HTMLVideoElement, mediaUrl: string, allowProxyFallback: boolean) => {
    hlsRef.current?.destroy();
    currentMediaUrlRef.current = mediaUrl;
    const hls = new Hls(buildHlsConfig());
    hlsRef.current = hls;

    hls.loadSource(mediaUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, async () => {
      recoveryRef.current?.markHealthy();
      // 画质选择器：多码率时在设置面板加「画质」选项，慢网络可手动降画质
      try {
        const levels = hls.levels || [];
        if (levels.length > 1) {
          const art = artRef.current;
          // 先移除旧的画质设置（换集时重建）
          try { art?.setting.remove('画质'); } catch { /* 忽略 */ }
          const selector = [
            { html: '自动', value: -1, default: true },
            ...levels.map((l, i) => ({
              html: l.height ? `${l.height}P` : `线路${i + 1}`,
              value: i,
            })),
          ];
          art?.setting.add({
            html: '画质',
            selector,
            onSelect: (item: { value: number; html: string }) => {
              hls.currentLevel = item.value;
              showHint(item.value === -1 ? '已切换为自动画质' : `已切换画质`);
              return item.html;
            },
          });
        }
      } catch { /* 画质选择器失败不影响播放 */ }
      // 起播先交给 HLS；待媒体时长就绪后再恢复进度。
      ensurePrefetch(mediaUrl, video.currentTime);
      video.play().catch(() => {});
    });
    // 播放链路恢复（FRAG_LOADED / MANIFEST_PARSED）：静默窗外清零连续失败计数
    hls.on(Hls.Events.FRAG_LOADED, () => recoveryRef.current?.markHealthy());
    // 分片真正进入 MSE buffer 才算媒体恢复：此时视频轨可渲染，错误态可解除
    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      mediaHealthyRef.current = true;
    });

    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return;
      const recovery = recoveryRef.current;
      if (!recovery) return;
      const decision = recovery.onFatal(data.type, data.details);
      switch (decision.action) {
        case 'ignore':
          break;
        case 'retry': {
          // 前两次重试保留直连；达到退避阈值或清单级错误时升级为代理形式
          // （同源 cookie 鉴权，规避 CORS/防盗链/分片被拒）
          if (
            allowProxyFallback &&
            !mediaUrl.startsWith('/api/proxy') &&
            (decision.attempt >= 2 || data.details === 'manifestLoadError')
          ) {
            showHint('直连失败，改用代理重试...');
            setupHls(video, `/api/proxy?url=${encodeURIComponent(mediaUrl)}`, false);
            return;
          }
          showHint(`${decision.reason}（第 ${decision.attempt} 次）...`);
          recovery.schedule(decision.delayMs, () => hls.startLoad());
          break;
        }
        case 'recover-media': {
          showHint(`${decision.reason}（第 ${decision.attempt} 次）...`);
          if (decision.swapAudio) hls.swapAudioCodec?.();
          hls.recoverMediaError();
          break;
        }
        case 'switch-source': {
          // 覆盖播放开始后的场景：起播失败走 setError 遮罩；
          // 播放中失败走回调弹换源面板（父级未提供回调时同样 setError）
          const message = `${describeHlsError(data.type, data.details)}：${decision.reason}`;
          setError(`当前线路暂不可用，${message}`);
          if (propsRef.current.onRequestSwitchSource) {
            showHint(message);
            propsRef.current.onRequestSwitchSource?.(decision.reason, video.currentTime);
          } else {
            setError(`视频加载失败，${message}，请尝试其他视频源`);
          }
          break;
        }
      }
    });
  };

  /** 换集：重置每集状态并切换到新 HLS 源（不重建 ArtPlayer）。 */
  const loadEpisode = (targetUrl: string) => {
    if (!targetUrl) return;
    endedRef.current = false;
    introDoneRef.current = false;
    skipShownRef.current = false;
    nextShownRef.current = false;
    setShowSkipIntro(false);
    setShowNextEp(false);
    mediaHealthyRef.current = true;
    playbackStartedRef.current = false;
    videoErrorRetryUsedRef.current = false;
    restoredRef.current = false;
    lastPrefetchEnsureRef.current = 0;
    recoveryRef.current = new PlaybackRecovery();
    // 换集时清掉上一集的预取窗口，避免带宽被旧集占用
    getVideoPrefetcher().stop();
    getNextEpisodePrefetcher().stop();
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    setError('');
    setShowPoster(true);
    setReadyToPlay(false);
    const art = artRef.current;
    if (!art) return;
    setupHls(art.video, targetUrl, true);
  };

  // —— 创建播放器（仅一次，挂载即创建） ——
  useEffect(() => {
    if (!containerRef.current || !propsRef.current.url) return;
    const initialUrl = propsRef.current.url;

    // 初始化每集状态
    mediaHealthyRef.current = true;
    playbackStartedRef.current = false;
    videoErrorRetryUsedRef.current = false;
    restoredRef.current = false;
    recoveryRef.current = new PlaybackRecovery();
    endedRef.current = false;

    let lastSave = 0;

    const art = new Artplayer({
      container: containerRef.current,
      url: initialUrl,
      type: 'm3u8',
      volume: 0.8,
      autoplay: true,
      pip: true,
      autoMini: true,
      screenshot: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      airplay: true,
      hotkey: false,
      gesture: true,
      theme: getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() ? `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim()})` : '#00B8E6',
      lang: navigator.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en',
      moreVideoAttr: { crossOrigin: 'anonymous', playsInline: true },
      customType: {
        m3u8: (video: HTMLVideoElement, mediaUrl: string) => {
          setupHls(video, mediaUrl, true);
        },
      },
    });
    artRef.current = art;
    setPlayer(art);
    art.on('video:durationchange', () => { void restorePlaybackPosition(); });
    art.on('video:canplay', () => setReadyToPlay(true));
    art.on('video:loadedmetadata', () => {
      void restorePlaybackPosition();
      // ArtPlayer 运行时支持 title 选项（类型定义未覆盖），用于界面标题展示
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (art as any).title = propsRef.current.title;
      } catch { /* 忽略 */ }
    });

    art.on('video:playing', () => {
      playbackStartedRef.current = true;
      setShowPoster(false);
      // 仅在媒体真正恢复（有分片进入 buffer）后清错误遮罩：
      // 否则「视频轨挂了、音频轨先播出来」时会清掉遮罩，留下黑屏假死态
      if (mediaHealthyRef.current) setError('');
    });
    art.on('video:error', () => {
      mediaHealthyRef.current = false;
      // 起播阶段的 video 元素级错误（MSE/解码偶发失败）：重建一次播放链路自愈，
      // 而不是直接钉死错误遮罩——重建后视频轨重新 append，黑屏有声即可解除
      if (!playbackStartedRef.current && !videoErrorRetryUsedRef.current) {
        videoErrorRetryUsedRef.current = true;
        showHint('播放异常，正在重试...');
        setupHls(art.video, currentMediaUrlRef.current, true);
        return;
      }
      setError('视频播放失败，请尝试其他视频源');
      propsRef.current.onRequestSwitchSource?.('当前线路播放失败', art.currentTime);
    });
    art.on('video:timeupdate', () => {
      propsRef.current.onPositionChange?.(art.currentTime);
      const now = Date.now();
      if (now - lastSave > 5000) {
        lastSave = now;
        propsRef.current.onTimeUpdate?.(art.currentTime, art.duration);
      }
      // 每 30s 续跑一次前向预取窗口（ensure 幂等，窗口未覆盖足够余量才会重建）
      if (now - lastPrefetchEnsureRef.current > 30_000) {
        lastPrefetchEnsureRef.current = now;
        // 用 currentMediaUrlRef（代理回退后的实际地址）：否则预取的 key 与
        // loader 读取的 key 不一致，缓存永不命中且直连 fetch 白耗流量
        ensurePrefetch(currentMediaUrlRef.current, art.currentTime);
      }
    });
    art.on('video:seeked', () => {
      lastSave = Date.now();
      propsRef.current.onPositionChange?.(art.currentTime);
      propsRef.current.onTimeUpdate?.(art.currentTime, art.duration);
      ensurePrefetch(currentMediaUrlRef.current, art.currentTime);
    });
    art.on('video:pause', () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      propsRef.current.onPause?.(art.currentTime, art.duration);
      // 暂停时沿用用户的缓存窗口，不擅自把有限缓存放大到整集。
      getVideoPrefetcher().setThrottled(false);
      ensurePrefetch(currentMediaUrlRef.current, art.currentTime);
    });
    art.on('video:waiting', () => {
      if (!playbackStartedRef.current) setReadyToPlay(false);
      // 卡顿：预取临时让出带宽给播放
      getVideoPrefetcher().setThrottled(true);
      getNextEpisodePrefetcher().stop();
      // 卡顿检测：连续缓冲超过 12 秒，提示用户换源
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        stallTimerRef.current = null;
        if (!art.video.paused && !document.hidden && art.video.readyState < 3) propsRef.current.onRequestSwitchSource?.('当前线路连续缓冲超过12秒', art.currentTime);
      }, 12000);
    });
    art.on('video:playing', () => {
      getVideoPrefetcher().setThrottled(false);
      // 恢复播放：清除卡顿计时
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    });
    art.on('video:ended', () => {
      endedRef.current = true;
      propsRef.current.onEnded?.();
    });
    // —— 跳过片头 / 片尾「下一集」悬浮按钮的显隐 ——
    art.on('video:timeupdate', () => {
      const pr = propsRef.current;
      const v = art.video as HTMLVideoElement | undefined;
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
      const pos = v.currentTime;
      const dur = v.duration;
      // 片头：未跳过且仍在片头区间内 → 显示按钮
      const introSec = pr.skipIntroSeconds ?? 90;
      let wantSkip = false;
      if (introSec > 0 && !introDoneRef.current) {
        if (pos < introSec) wantSkip = true;
        else introDoneRef.current = true; // 自然播过片头，不再打扰
      }
      if (wantSkip !== skipShownRef.current) {
        skipShownRef.current = wantSkip;
        setShowSkipIntro(wantSkip);
      }
      // 片尾：有下一集且剩余时长进入阈值 → 显示「下一集」
      const outroSec = pr.outroNextSeconds ?? 90;
      const remain = dur - pos;
      const wantNext = outroSec > 0 && !!pr.onRequestNext && remain <= outroSec && remain > 2;
      if (wantNext !== nextShownRef.current) {
        nextShownRef.current = wantNext;
        setShowNextEp(wantNext);
      }
    });

    // —— 键盘快捷键（旧版 hotkey:false + 自定义逻辑的移植） ——
    const shortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (lockedRef.current || e.ctrlKey || e.metaKey || target.isContentEditable || target.closest('[role="dialog"]')) return;
      // 输入框或按钮获得焦点时不劫持按键：否则空格会吞掉按钮的默认激活
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('button')) return;
      const current = artRef.current;
      if (!current) return;
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return; } // 由父层处理集数切换
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); return; }
      switch (e.key) {
        case 'ArrowLeft':
          if (current.currentTime > 5) { current.currentTime -= 5; showHint('快退 5s'); e.preventDefault(); }
          break;
        case 'ArrowRight':
          if (current.duration - current.currentTime > 5) { current.currentTime += 5; showHint('快进 5s'); e.preventDefault(); }
          break;
        case 'ArrowUp':
          if (current.volume < 1) { current.volume = Math.min(1, current.volume + 0.1); showHint(`音量 ${Math.round(current.volume * 100)}%`); e.preventDefault(); }
          break;
        case 'ArrowDown':
          if (current.volume > 0) { current.volume = Math.max(0, current.volume - 0.1); showHint(`音量 ${Math.round(current.volume * 100)}%`); e.preventDefault(); }
          break;
        case ' ':
          current.toggle(); showHint('播放/暂停'); e.preventDefault();
          break;
        case 'f': case 'F':
          current.fullscreen = !current.fullscreen; e.preventDefault();
          break;
        case 'm': case 'M':
          current.muted = !current.muted; e.preventDefault();
          break;
      }
    };
    document.addEventListener('keydown', shortcuts);

    // —— 长按临时 2 倍速，滑动或失焦时恢复 ——
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;
    let originalRate = 1.0;
    let touchX = 0;
    let touchY = 0;
    const el = containerRef.current;

    const onTouchStart = (e: TouchEvent) => {
      if (lockedRef.current) return;
      if (art.video?.paused) return;
      // 已有触控在处理时忽略新手指：否则第二指会把 originalRate 捕获成 3.0，
      // 松手后倍速永久卡在 3x；旧定时器句柄也会被覆盖成无法清除的幽灵触发
      if (isLongPress || longPressTimer) return;
      // 控制栏 / 设置面板上的长按不触发倍速（按住进度条拖动、长按倍速菜单项会误触）
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest?.('.art-controls, .art-settings, button, .cinema-panel')) return;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      originalRate = art.video.playbackRate;
      longPressTimer = setTimeout(() => {
        if (art.video?.paused) return;
        art.video.playbackRate = Math.max(2, originalRate);
        isLongPress = true;
        showHint(`${art.video.playbackRate} 倍速播放中 · 松开恢复`);
      }, 500);
    };
    const onTouchEnd = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (isLongPress) {
        art.video.playbackRate = originalRate;
        isLongPress = false;
        showHint(`${originalRate} 倍速`);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!isLongPress && touch && (Math.abs(touch.clientX - touchX) > 12 || Math.abs(touch.clientY - touchY) > 12)) onTouchEnd();
      if (isLongPress) { e.preventDefault(); e.stopPropagation(); }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || lockedRef.current || art.video.paused || (e.target as HTMLElement).closest('.art-controls, .art-settings, button, .cinema-panel')) return;
      originalRate = art.video.playbackRate;
      longPressTimer = setTimeout(() => {
        if (art.video.paused) return;
        art.video.playbackRate = Math.max(2, originalRate);
        isLongPress = true;
        showHint(`${art.video.playbackRate} 倍速播放中 · 松开恢复`);
      }, 500);
    };
    let suppressClick = false;
    const onMouseUp = () => { suppressClick = isLongPress; onTouchEnd(); };
    const consumeHoldClick = (e: MouseEvent) => {
      if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); }
    };
    // ArtPlayer 的 contextmenu 组件只在桌面端初始化（移动端构造函数里跳过 init），
    // 长按倍速因而会连带呼出系统原生菜单/气泡。播放器表面没有可用的原生菜单，统一抑制
    const onContextMenu = (e: Event) => e.preventDefault();
    el?.addEventListener('touchstart', onTouchStart, { passive: false });
    el?.addEventListener('touchend', onTouchEnd);
    el?.addEventListener('touchcancel', onTouchEnd);
    el?.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    el?.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    el?.addEventListener('mouseleave', onTouchEnd);
    el?.addEventListener('click', consumeHoldClick, true);
    window.addEventListener('blur', onTouchEnd);
    el?.addEventListener('contextmenu', onContextMenu);

    // 卸载与页面隐藏时保存进度
    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') {
        onTouchEnd();
        propsRef.current.onPause?.(art.currentTime, art.duration);
      }
    };
    document.addEventListener('visibilitychange', saveOnHide);

    return () => {
      // 卸载前刷一次最终进度，避免丢失最后几秒。
      // 已自然播完的集数不回写，避免覆盖 onEnded 里清除的「已看完」记录
      if (!endedRef.current) {
        try {
          propsRef.current.onPause?.(art.currentTime, art.duration);
        } catch { /* 忽略 */ }
      }
      document.removeEventListener('keydown', shortcuts);
      document.removeEventListener('visibilitychange', saveOnHide);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      el?.removeEventListener('touchstart', onTouchStart);
      el?.removeEventListener('touchend', onTouchEnd);
      el?.removeEventListener('touchcancel', onTouchEnd);
      el?.removeEventListener('touchmove', onTouchMove, true);
      el?.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      el?.removeEventListener('mouseleave', onTouchEnd);
      el?.removeEventListener('click', consumeHoldClick, true);
      window.removeEventListener('blur', onTouchEnd);
      onTouchEnd();
      el?.removeEventListener('contextmenu', onContextMenu);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      recoveryRef.current?.dispose();
      getVideoPrefetcher().stop();
      getNextEpisodePrefetcher().stop();
      art.destroy();
      artRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— 移动端双击快进 / 快退 10 秒（对标腾讯视频） ——
  // 只拦截双击的第二次 tap（捕获阶段 preventDefault 吞掉合成 click），
  // ArtPlayer 的 click 计数到不了 2，就不会误触发暂停/全屏；第一次 tap 保持原生行为。
  // 需 passive:false 否则 preventDefault 无效；控制栏/按钮上的触摸不拦截。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastTapAt = 0;
    let lastTapX = 0;
    let downX = 0;
    let downY = 0;
    const onTouchStartCapture = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) { downX = t.clientX; downY = t.clientY; }
    };
    const onTouchEndCapture = (e: TouchEvent) => {
      if (lockedRef.current) return;
      if ((e.target as HTMLElement).closest?.('.art-controls, .art-settings, button')) return;
      const t = e.changedTouches[0];
      if (!t) return;
      // 滑动（手势搜进度/调音量）不算 tap
      if (Math.abs(t.clientX - downX) > 14 || Math.abs(t.clientY - downY) > 14) return;
      const rect = el.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const w = rect.width;
      const inLeft = x < w * 0.4;
      const inRight = x > w * 0.6;
      if (!inLeft && !inRight) return;
      const now = Date.now();
      if (now - lastTapAt < 350 && Math.abs(t.clientX - lastTapX) < 80) {
        lastTapAt = 0;
        e.preventDefault();
        e.stopPropagation();
        const v = artRef.current?.video as HTMLVideoElement | undefined;
        if (v && Number.isFinite(v.duration)) {
          const delta = inLeft ? -10 : 10;
          v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration);
          showHint(inLeft ? '快退 10 秒' : '快进 10 秒');
        }
      } else {
        lastTapAt = now;
        lastTapX = t.clientX;
      }
    };
    el.addEventListener('touchstart', onTouchStartCapture, { capture: true, passive: true });
    el.addEventListener('touchend', onTouchEndCapture, { capture: true, passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStartCapture, { capture: true } as EventListenerOptions);
      el.removeEventListener('touchend', onTouchEndCapture, { capture: true } as EventListenerOptions);
    };
  }, []);

  // 桌面双击沿用 ArtPlayer 的全屏行为；触摸双击由上面的分区手势接管。

  // —— 换集：仅切换 HLS 源，不重建播放器（保留网页全屏等状态） ——
  const firstUrlRef = useRef(true);
  useEffect(() => {
    // 挂载时的首次由创建 effect 的 customType 触发，跳过避免重复加载
    if (firstUrlRef.current) { firstUrlRef.current = false; return; }
    loadEpisode(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // —— 广告过滤开关变化：重建 HLS loader（无需重建整个播放器） ——
  const firstAdFilterRef = useRef(true);
  useEffect(() => {
    if (firstAdFilterRef.current) { firstAdFilterRef.current = false; return; }
    if (artRef.current && hlsRef.current) {
      // 用当前实际媒体地址：代理回退生效时切广告过滤不应跳回直连形式
      loadEpisode(currentMediaUrlRef.current || propsRef.current.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adFilter]);

  return (
    <div className="cinema-shell relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ WebkitTouchCallout: 'none' }} />
      {player && <PlayerChrome art={player} title={title} episodeLabel={episodeNames[currentIndex]} episodeNames={episodeNames} currentIndex={currentIndex} onSelectEpisode={onSelectEpisode} onNext={onRequestNext} locked={locked}>
      {showPoster && !error && (
        <div className="cinema-poster">
          <BufferingCare show={showPoster} episodeKey={episodeKey} ready={readyToPlay} onPlay={() => {
            void player.video.play().catch(() => showHint('暂时无法播放，可以尝试切换资源。'));
          }} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
          <p className="text-danger text-sm">{error}</p>
          <button className="btn-ghost text-xs" onClick={() => location.reload()}>
            重新加载
          </button>
        </div>
      )}
      {hint && (
        <div className="cinema-hint" role="status">
          {hint}
        </div>
      )}
      {showSkipIntro && !error && (
        <button
          className="cinema-skip"
          onClick={() => {
            const v = artRef.current?.video as HTMLVideoElement | undefined;
            const sec = propsRef.current.skipIntroSeconds ?? 90;
            if (v && Number.isFinite(v.duration)) {
              v.currentTime = Math.min(sec, Math.max(0, v.duration - 5));
            }
            introDoneRef.current = true;
            skipShownRef.current = false;
            setShowSkipIntro(false);
            showHint('已跳过片头');
          }}
        >
          跳过片头 ›
        </button>
      )}
      {showNextEp && !error && (
        <button
          className="cinema-skip"
          onClick={() => propsRef.current.onRequestNext?.()}
        >
          下一集 ›
        </button>
      )}
      {/* 锁屏按钮（对标腾讯视频）：右上角小锁 */}
      {!error && !locked && (
        <button
          aria-label="锁定屏幕"
          className="cinema-lock"
          onClick={() => { setLocked(true); showHint('屏幕已锁定'); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10 V7 a4 4 0 0 1 8 0 v3" />
          </svg>
        </button>
      )}
      {/* 锁屏遮罩：屏蔽所有触摸，只留解锁按钮 */}
      {locked && !error && (
        <div
          className="cinema-locked-surface"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="解锁屏幕"
            className="cinema-unlock"
            onClick={() => { setLocked(false); showHint('屏幕已解锁'); }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10 V7 a4 4 0 0 1 7.5 -2" />
            </svg>
          </button>
        </div>
      )}
      </PlayerChrome>}
    </div>
  );
}
