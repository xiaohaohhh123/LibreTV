'use client';

import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { buildWatchUrl, formatTime } from '@/lib/utils';
import { Icon } from './icon';

/** 从已有观看记录续播，不另存一份进度。 */
export function ContinueWatching() {
  const history = useLiveQuery(() => db.history.orderBy('timestamp').reverse().limit(20).toArray());
  const seen = new Set<string>();
  const items = (history ?? []).filter((item) => item.playbackPosition > 10 &&
    (item.duration <= 0 || item.playbackPosition < item.duration - 5)).filter((item) => {
      const title = item.title.trim();
      if (seen.has(title)) return false;
      seen.add(title);
      return true;
    }).slice(0, 3);
  if (!items.length) return null;
  return (
    <section aria-label="继续观看" className="mb-8">
      <h2 className="mb-3 text-base font-medium text-content">接着上次的故事</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} className="resume-card" href={buildWatchUrl({sourceKey:item.sourceKey, vodId:item.vodId, sourceUrl:item.sourceUrl, title:item.title, index:item.episodeIndex, position:item.playbackPosition})}>
            <span className="resume-icon"><Icon name="undo" /></span>
            <span className="min-w-0"><strong className="block truncate text-sm font-medium">{item.title}</strong><span className="text-xs text-muted">接着看 · 已看到 {formatTime(item.playbackPosition)}</span></span>
            <span className="ml-auto text-accent" aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
