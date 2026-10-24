import type { SearchResultItem } from './types';

export interface AggregatedGroup {
  key: string;
  name: string;
  year?: string;
  typeName?: string;
  pic?: string;
  remarks?: string;
  items: SearchResultItem[];
}

/** 不确定的年份及预告版本单独展示，避免把不同作品当成可互换的来源。 */
export function aggregateResults(list: SearchResultItem[]): AggregatedGroup[] {
  const groups = new Map<string, AggregatedGroup>();
  for (const item of list) {
    const name = item.name.trim();
    if (!name) continue;
    const edition = `${item.typeName ?? ''} ${item.remarks ?? ''}`.match(/预告|花絮|解说|幕后/)?.[0] ?? '正片';
    const year = item.year?.trim();
    const key = JSON.stringify([name, year || null, edition]);
    const existing = groups.get(key);
    if (existing) {
      if (!existing.items.some((other) => other.sourceKey === item.sourceKey && other.vodId === item.vodId)) existing.items.push(item);
      existing.pic ||= item.pic;
    } else {
      groups.set(key, { key, name, year, typeName: item.typeName, pic: item.pic, remarks: item.remarks, items: [item] });
    }
  }
  return [...groups.values()];
}
