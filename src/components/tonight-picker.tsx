'use client';

import { useEffect, useReducer, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import type { BangumiCalendarResponse, DoubanResponse, SearchResultItem } from '@/lib/types';
import { pickTonight, tonightCandidates, type WatchlistInput } from '@/lib/watchlist';
import { WatchlistButton } from './watchlist-button';
import { Icon } from './icon';

export function TonightPicker({ onPick, onOpen }: { onPick: (title: string) => void; onOpen?: (item: SearchResultItem) => void }) {
  const client = useQueryClient();
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const [round, setRound] = useState(0);
  const source = useAppStore((state) => state.recommendSource);
  const enabled = useAppStore((state) => state.doubanEnabled);
  const saved = useLiveQuery(async () => {
    try {
      return { entries: await db.watchlist.orderBy('addedAt').reverse().toArray(), failed: false };
    } catch {
      return { entries: [], failed: true };
    }
  });

  useEffect(() => client.getQueryCache().subscribe(() => refresh()), [client]);

  const key = source === 'bangumi' ? 'bangumi-calendar' : source === 'hot-list' ? 'hot-list' : 'douban';
  const queries = enabled ? client.getQueryCache().findAll({ queryKey: [key] }) : [];
  const latest = queries.filter((query) => query.state.data !== undefined).sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0];
  const data = latest?.state.data as DoubanResponse | BangumiCalendarResponse | undefined;
  const recommendations: WatchlistInput[] = data
    ? ('items' in data ? data.items : data.days.flatMap((day) => day.items)).map((item) => ({ title: item.title, cover: item.cover, rating: item.rating }))
    : [];
  const candidates = tonightCandidates(saved?.entries ?? [], recommendations);
  const picked = pickTonight(candidates, round);
  const fetching = queries.some((query) => query.state.fetchStatus === 'fetching');
  const failed = queries.some((query) => query.state.status === 'error');

  return (
    <details className="tonight-picker relative" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }
    }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-hover hover:text-content">
        <Icon name="bolt" className="h-4 w-4" />今晚看什么 <Icon name="chevronDown" className="h-3.5 w-3.5" />
      </summary>
      <section className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-line bg-surface p-4 shadow-xl" aria-label="今晚看什么">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted">从待看与当前推荐中挑选</p>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setRound((value) => value + 1)} disabled={candidates.length <= 3}>
            <Icon name="refresh" className="h-4 w-4" />换一组
          </button>
        </div>
        {picked.length > 0 ? <ul className="space-y-2" aria-live="polite">
          {picked.map((item) => <li key={`${item.title}|${item.year ?? ''}`} className="flex items-center gap-2 rounded-lg border border-line bg-card p-2">
            <button type="button" className="min-h-11 min-w-0 flex-1 text-left text-sm text-content hover:text-accent" onClick={() => item.source && onOpen ? onOpen(item.source) : onPick(item.title)}>
              <span className="line-clamp-2 font-medium">{item.title}</span>
              <span className="mt-1 block text-xs text-muted">{item.year || item.reason}</span>
            </button>
            <WatchlistButton item={item} compact />
          </li>)}
        </ul> : <p className="py-3 text-sm leading-relaxed text-muted" role="status">
          {!saved || fetching ? '推荐正在载入，也可以先搜索片名。' : failed ? '推荐暂时未连上，可以先搜索并加入待看。' : '还没有候选，先将喜欢的影片加入待看。'}
        </p>}
        {saved?.failed && <p className="mt-3 text-xs text-warning" role="status">本机待看暂时无法读取，仍可从推荐中挑选。</p>}
        {failed && picked.length > 0 && <p className="mt-3 text-xs text-muted" role="status">推荐刷新失败，当前显示已载入的候选。</p>}
      </section>
    </details>
  );
}
