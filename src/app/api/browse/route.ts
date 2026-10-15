import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/api-guard';
import { cmsRequestHeaders, isAdultContent, parseSearchList } from '@/lib/cms-parser';
import { fetchUpstream } from '@/lib/fetch-utils';
import { checkUpstreamAllowed } from '@/lib/ssrf';
import type { SearchResultItem, SourceConfig } from '@/lib/types';

export const runtime = 'nodejs';

interface BrowseBody {
  source: SourceConfig;
  /** 分类 id；缺省时返回该源的分类树 */
  typeId?: number | null;
  page?: number;
}

export interface BrowseCategory {
  id: number;
  name: string;
}

interface BrowseResponse {
  ok: boolean;
  categories?: BrowseCategory[];
  list?: SearchResultItem[];
  page?: number;
  pagecount?: number;
  error?: string;
}

function parseCategories(data: unknown): BrowseCategory[] {
  if (!data || typeof data !== 'object') return [];
  const raw = (data as { class?: unknown }).class;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const o = c as Record<string, unknown>;
      const id = parseInt(String(o.type_id ?? ''), 10);
      const name = String(o.type_name ?? '').trim();
      if (!Number.isFinite(id) || !name) return null;
      // 成人分类直接过滤，不返回给前端
      if (isAdultContent(name)) return null;
      return { id, name };
    })
    .filter((c): c is BrowseCategory => c !== null);
}

export async function POST(req: Request) {
  const blocked = guardRequest(req);
  if (blocked) return blocked;

  let body: BrowseBody;
  try {
    body = (await req.json()) as BrowseBody;
  } catch {
    return NextResponse.json({ ok: false, error: '请求体不是合法 JSON' } satisfies BrowseResponse, { status: 400 });
  }
  const { source, typeId, page = 1 } = body;
  if (!source || !/^https?:\/\//.test(source.url || '')) {
    return NextResponse.json({ ok: false, error: '无效的源地址' } satisfies BrowseResponse, { status: 400 });
  }
  const verdict = await checkUpstreamAllowed(source.url);
  if (!verdict.ok) {
    return NextResponse.json({ ok: false, error: verdict.reason } satisfies BrowseResponse, { status: 400 });
  }

  const base = source.url.replace(/\/+$/, '');
  try {
    if (typeId == null) {
      // 分类树
      const res = await fetchUpstream(`${base}?ac=list`, {
        timeoutMs: 8000,
        headers: cmsRequestHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const categories = parseCategories(await res.json());
      return NextResponse.json({ ok: true, categories } satisfies BrowseResponse);
    }
    // 分类影片列表
    const pg = Math.min(Math.max(1, Math.floor(page) || 1), 100);
    const res = await fetchUpstream(`${base}?ac=videolist&t=${typeId}&pg=${pg}`, {
      timeoutMs: 10000,
      headers: cmsRequestHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = parseSearchList(data, source).filter((item) => !isAdultContent(item.typeName));
    const rawPageCount = parseInt(String((data as { pagecount?: unknown }).pagecount ?? '1'), 10);
    const pagecount = Number.isFinite(rawPageCount) ? Math.max(1, rawPageCount) : 1;
    return NextResponse.json({ ok: true, list, page: pg, pagecount } satisfies BrowseResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '请求失败';
    return NextResponse.json({ ok: false, error: msg } satisfies BrowseResponse, { status: 502 });
  }
}
