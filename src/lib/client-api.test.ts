import { afterEach, expect, it, vi } from 'vitest';
import { api } from './client-api';

afterEach(() => vi.unstubAllGlobals());

it('流中断不能冒充没有搜索结果', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"type":"source","sourceKey":"a","ok":true,"list":[]}\n')));
  await expect(api.search('片名', [], true, { onSource: vi.fn() })).rejects.toThrow('搜索连接中断');
});

it('已完成的空搜索保留真实无结果状态', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"type":"done","list":[],"failures":[]}\n')));
  await expect(api.search('片名', [], true, { onSource: vi.fn() })).resolves.toEqual({ list: [], failures: [] });
});
