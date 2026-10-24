'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { addToWatchlist, matchingWatchlistEntry, removeFromWatchlist, titleKeyOf, type WatchlistInput } from '@/lib/watchlist';
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import { useToast } from './toast';

export function WatchlistButton({ item, compact = false, className }: {
  item: WatchlistInput;
  compact?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const saved = useLiveQuery(async () => {
    try {
      const entries = await db.watchlist.where('titleKey').equals(titleKeyOf(item.title)).toArray();
      return { entry: matchingWatchlistEntry(entries, item), failed: false };
    } catch {
      return { entry: undefined, failed: true };
    }
  }, [item.title, item.year]);
  const added = Boolean(saved?.entry);

  const toggle = async () => {
    setBusy(true);
    try {
      if (saved?.failed) throw new Error('storage');
      if (saved?.entry) await removeFromWatchlist(saved.entry.id);
      else await addToWatchlist(item);
      toast(added ? '已从待看片单移除' : '已加入待看片单 · 保存在当前浏览器', 'success');
    } catch {
      toast('片单保存失败，请检查浏览器存储权限后重试', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={cn('watchlist-button inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 text-xs text-content transition-colors hover:border-accent hover:text-accent disabled:opacity-50', compact && 'h-11 w-11 shrink-0 !px-0 shadow-sm', added && 'border-accent/40 text-accent', className)}
      disabled={busy || !saved}
      aria-pressed={added}
      aria-label={`${added ? '从待看片单移除' : '加入待看片单'}：${item.title}`}
      title={added ? '已在待看片单 · 点击移除' : '加入待看片单'}
      onClick={(event) => {
        event.stopPropagation();
        void toggle();
      }}
    >
      <Icon name={added ? 'check' : 'plus'} className="h-4 w-4" />
      {!compact && <span>{busy ? '保存中…' : added ? '已加入待看' : '加入待看'}</span>}
    </button>
  );
}
