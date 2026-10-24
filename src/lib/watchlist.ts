import { db } from './db';
import type { SearchResultItem } from './types';

export interface WatchlistInput {
  title: string;
  cover?: string;
  year?: string;
  rating?: string;
  source?: SearchResultItem;
}

export interface WatchlistEntry extends WatchlistInput {
  id: string;
  titleKey: string;
  addedAt: number;
}

export interface TonightCandidate extends WatchlistInput {
  reason: '你的待看片单' | '当前推荐';
}

export function titleKeyOf(title: string): string {
  return title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN');
}

export function matchingWatchlistEntry(entries: WatchlistEntry[], item: WatchlistInput): WatchlistEntry | undefined {
  const titleKey = titleKeyOf(item.title);
  const sameTitle = entries.filter((entry) => entry.titleKey === titleKey);
  const year = item.year?.trim() || '';
  return sameTitle.find((entry) => (entry.year?.trim() || '') === year);
}

export async function addToWatchlist(item: WatchlistInput): Promise<void> {
  const title = item.title.trim();
  if (!title) throw new Error('请先选择一部作品');
  const titleKey = titleKeyOf(title);
  const year = item.year?.trim() || undefined;
  await db.transaction('rw', db.watchlist, async () => {
    const entries = await db.watchlist.where('titleKey').equals(titleKey).toArray();
    const existing = matchingWatchlistEntry(entries, { ...item, title, year });
    await db.watchlist.put({
      ...existing,
      ...item,
      title,
      titleKey,
      year: year ?? existing?.year,
      cover: item.cover || existing?.cover,
      rating: item.rating || existing?.rating,
      source: item.source ?? existing?.source,
      id: existing?.id ?? JSON.stringify([titleKey, year ?? '']),
      addedAt: existing?.addedAt ?? Date.now(),
    });
  });
}

export async function removeFromWatchlist(id: string): Promise<void> {
  await db.watchlist.delete(id);
}

export function watchlistFromSearch(item: SearchResultItem): WatchlistInput {
  return { title: item.name, cover: item.pic, year: item.year, source: item };
}

export function tonightCandidates(watchlist: WatchlistEntry[], recommendations: WatchlistInput[]): TonightCandidate[] {
  const candidates: TonightCandidate[] = [];
  for (const item of [
    ...watchlist.map((entry) => ({ ...entry, reason: '你的待看片单' as const })),
    ...recommendations.map((entry) => ({ ...entry, reason: '当前推荐' as const })),
  ]) {
    if (!item.title.trim()) continue;
    if (candidates.some((previous) => titleKeyOf(previous.title) === titleKeyOf(item.title)
      && (previous.year?.trim() || '') === (item.year?.trim() || ''))) continue;
    candidates.push(item);
  }
  return candidates;
}

export function pickTonight(candidates: TonightCandidate[], round: number): TonightCandidate[] {
  if (candidates.length <= 3) return candidates;
  const start = (Math.max(0, Math.floor(round)) * 3) % candidates.length;
  return Array.from({ length: 3 }, (_, index) => candidates[(start + index) % candidates.length]);
}
