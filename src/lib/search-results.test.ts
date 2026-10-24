import { expect, it } from 'vitest';
import { aggregateResults } from './search-results';
import type { SearchResultItem } from './types';

const item = (sourceKey: string, year?: string, remarks?: string): SearchResultItem => ({ name: '同名作品', sourceKey, sourceName: sourceKey, vodId: '1', year, remarks });

it('只聚合可确认相同年份和版本，未知年份单独展示', () => {
  const groups = aggregateResults([item('a', '2023'), item('b', '2023'), item('c', '2024'), item('d'), item('e', '2023', '预告片')]);
  expect(groups.map((group) => group.items.length)).toEqual([2, 1, 1, 1]);
});

it('忽略空标题并去重同一来源条目', () => {
  expect(aggregateResults([{ ...item('a'), name: ' ' }])).toEqual([]);
  expect(aggregateResults([item('a'), item('a')])[0].items).toHaveLength(1);
});
