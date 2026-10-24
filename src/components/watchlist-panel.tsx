'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { SearchResultItem } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { removeFromWatchlist, type WatchlistEntry } from '@/lib/watchlist';
import { Drawer } from './drawer';
import { EmptyState, ErrorState, LoadingState } from './states';
import { SmartImage } from './smart-image';
import { Icon } from './icon';
import { useToast } from './toast';

export function WatchlistPanel({ open, onClose, onPick, onOpen }: {
  open: boolean;
  onClose: () => void;
  onPick: (title: string) => void;
  onOpen?: (item: SearchResultItem) => void;
}) {
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const { toast } = useToast();
  const result = useLiveQuery(async () => {
    try {
      return { entries: await db.watchlist.orderBy('addedAt').reverse().toArray(), failed: false };
    } catch {
      return { entries: [], failed: true };
    }
  }, [open, retry]);
  const items = result?.entries.filter((item) => item.title.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN')));

  const remove = async (item: WatchlistEntry) => {
    try {
      await removeFromWatchlist(item.id);
      toast('已从待看片单移除', 'success');
    } catch {
      toast('移除失败，请检查浏览器存储权限后重试', 'error');
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="我的待看片单" width="max-w-lg" subheader={
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted">把想看的留给下次。仅保存在当前浏览器，清除网站数据后会消失。</p>
        {Boolean(result?.entries.length) && <input
          className="w-full rounded-xl border border-line bg-chip px-3 py-2 text-sm text-content"
          placeholder="在片单中找一找"
          aria-label="搜索我的待看片单"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />}
      </div>
    }>
      {!result ? <LoadingState label="正在打开你的片单…" /> : result.failed ? (
        <ErrorState message="暂时无法读取本机片单，请检查浏览器存储权限。" onRetry={() => setRetry((value) => value + 1)} />
      ) : result.entries.length === 0 ? (
        <EmptyState icon="plus" title="你的下一部好片，还在路上" description="在推荐卡片或影片详情中点「加入待看」，下次就能在这里找到。" />
      ) : items?.length === 0 ? (
        <EmptyState title="片单里还没有这部作品" description="试试其他片名，或清空搜索看看全部待看。" />
      ) : (
        <ul className="watchlist-panel space-y-3">
          {items?.map((item) => <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
            <WatchlistCover item={item} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-content" title={item.title}>{item.title}</p>
              <p className="mt-1 text-xs text-faint">{[item.year, item.source?.sourceName || '搜索各片源'].filter(Boolean).join(' · ')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {item.source && onOpen && <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => {
                  onClose();
                  onOpen(item.source!);
                }}>查看详情 <span aria-hidden>→</span></button>}
                <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => {
                  onClose();
                  onPick(item.title);
                }}>{item.source && onOpen ? '重新找片' : '找片播放'} <span aria-hidden>↗</span></button>
              </div>
            </div>
            <button type="button" className="rounded-full p-3 text-muted hover:bg-hover hover:text-danger" aria-label={`从待看片单移除：${item.title}`} onClick={() => void remove(item)}>
              <Icon name="close" className="h-4 w-4" />
            </button>
          </li>)}
        </ul>
      )}
    </Drawer>
  );
}

function WatchlistCover({ item }: { item: WatchlistEntry }) {
  const mode = useAppStore((state) => state.imageProxyMode);
  const customProxy = useAppStore((state) => state.customImageProxy);
  const [failed, setFailed] = useState(false);
  return item.cover && !failed
    ? <SmartImage url={item.cover} mode={mode} customProxy={customProxy} alt="" className="h-[84px] w-14 shrink-0 rounded-lg bg-chip object-cover" onExhausted={() => setFailed(true)} />
    : <div className="flex h-[84px] w-14 shrink-0 items-center justify-center rounded-lg bg-chip text-faint"><Icon name="plus" /></div>;
}
