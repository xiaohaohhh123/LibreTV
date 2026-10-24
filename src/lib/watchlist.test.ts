import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WatchlistEntry } from './watchlist';

const storage = vi.hoisted(() => ({ rows: new Map<string, WatchlistEntry>(), fail: false }));
vi.mock('./db', () => ({
  db: {
    transaction: async (_mode: string, _table: unknown, run: () => Promise<void>) => {
      if (storage.fail) throw new Error('storage denied');
      await run();
    },
    watchlist: {
      where: () => ({ equals: (titleKey: string) => ({ toArray: async () => [...storage.rows.values()].filter((entry) => entry.titleKey === titleKey) }) }),
      put: async (entry: WatchlistEntry) => { storage.rows.set(entry.id, entry); },
      delete: async (id: string) => {
        if (storage.fail) throw new Error('storage denied');
        storage.rows.delete(id);
      },
    },
  },
}));

import { addToWatchlist, matchingWatchlistEntry, pickTonight, removeFromWatchlist, titleKeyOf, tonightCandidates, watchlistFromSearch } from './watchlist';

beforeEach(() => {
  storage.rows.clear();
  storage.fail = false;
});

describe('待看片单', () => {
  it('同名同年的不同片源只保存一次，保留封面与加入时间', async () => {
    await addToWatchlist({ title: ' Ｔｅｓｔ　电影 ', cover: 'cover.jpg', year: '2024' });
    const original = [...storage.rows.values()][0];
    const source = { sourceKey: 'one', sourceName: '片源一', vodId: '42', name: 'Test 电影', year: '2024', sourceUrl: 'https://source.example/api' };
    await addToWatchlist(watchlistFromSearch(source));
    await addToWatchlist(watchlistFromSearch({ ...source, sourceKey: 'two', sourceName: '片源二' }));
    expect(storage.rows.size).toBe(1);
    expect([...storage.rows.values()][0]).toMatchObject({ id: original.id, cover: 'cover.jpg', addedAt: original.addedAt, year: '2024', source: { sourceKey: 'two' } });
    expect(titleKeyOf(' Ｔｅｓｔ　电影 ')).toBe('test 电影');
  });

  it('未知年与已知年分别保存，不让新推荐继承旧片源', async () => {
    const source = { sourceKey: 'old', sourceName: '旧版片源', vodId: '42', name: '同名作品', year: '1999' };
    await addToWatchlist(watchlistFromSearch(source));
    await addToWatchlist({ title: '同名作品', cover: 'new-recommendation.jpg' });
    await addToWatchlist({ title: '同名作品', year: '2024' });
    const entries = [...storage.rows.values()];
    expect(entries).toHaveLength(3);
    expect(matchingWatchlistEntry(entries, { title: '同名作品' })?.source).toBeUndefined();
    expect(matchingWatchlistEntry(entries, { title: '同名作品', year: '2024' })?.source).toBeUndefined();
    expect(matchingWatchlistEntry(entries, { title: '同名作品', year: '1999' })?.source).toMatchObject({ sourceKey: 'old' });
  });

  it('已知年份不同的同名作品分开保存，移除后不会影响另一部', async () => {
    await addToWatchlist({ title: '同名作品', year: '1999' });
    await addToWatchlist({ title: '同名作品', year: '2024' });
    const entries = [...storage.rows.values()];
    expect(entries).toHaveLength(2);
    expect(matchingWatchlistEntry(entries, { title: '同名作品', year: '2024' })?.year).toBe('2024');
    await removeFromWatchlist(entries[0].id);
    expect([...storage.rows.values()]).toHaveLength(1);
    expect([...storage.rows.values()][0].year).toBe('2024');
  });

  it('空片名拒绝保存，存储错误向调用者传递以便显示失败反馈', async () => {
    await expect(addToWatchlist({ title: ' ' })).rejects.toThrow('请先选择');
    storage.fail = true;
    await expect(addToWatchlist({ title: '电影' })).rejects.toThrow('storage denied');
    await expect(removeFromWatchlist('missing')).rejects.toThrow('storage denied');
    expect(storage.rows.size).toBe(0);
  });
});

describe('今晚看什么', () => {
  it('只使用真实传入作品，片单优先、去重、换组，不改动原列表', async () => {
    await addToWatchlist({ title: '待看一', year: '2020' });
    const candidates = tonightCandidates([...storage.rows.values()], [
      { title: '待看一', year: '2020' }, { title: '推荐二' }, { title: '推荐三' }, { title: '推荐四' }, { title: ' ' },
    ]);
    expect(candidates.map((item) => item.title)).toEqual(['待看一', '推荐二', '推荐三', '推荐四']);
    expect(candidates[0].reason).toBe('你的待看片单');
    expect(pickTonight(candidates, 0).map((item) => item.title)).toEqual(['待看一', '推荐二', '推荐三']);
    expect(pickTonight(candidates, 1).map((item) => item.title)).toEqual(['推荐四', '待看一', '推荐二']);
    expect(candidates).toHaveLength(4);
  });

  it('空数据保持为空，少量候选不重复凑三部，同名的未知年与不同翻拍保留', async () => {
    expect(pickTonight(tonightCandidates([], []), 10)).toEqual([]);
    const candidates = tonightCandidates([], [{ title: '同名', year: '1999' }, { title: '同名', year: '2024' }]);
    expect(pickTonight(candidates, 3)).toHaveLength(2);
    expect(tonightCandidates([], [...candidates, { title: '同名' }])).toHaveLength(3);
  });
});
