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

it.each([401, 503])('登录前的迟到 %s 不重新打开登录框，请求仍明确失败', async (status) => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/auth'
    ? Promise.resolve(Response.json({ success: true }))
    : new Promise<Response>((resolve) => { finish = resolve; })));
  const pending = api.hotList('douban_movie_weekly');
  await api.login('unit-test-placeholder');
  finish(Response.json({ error: '旧请求未验证' }, { status }));
  await expect(pending).rejects.toMatchObject({ status });
  expect(dispatchEvent).not.toHaveBeenCalled();
});

it.each(['search', 'live'] as const)('登录前的迟到 %s 流请求仍失败但不覆盖新会话', async (kind) => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/auth'
    ? Promise.resolve(Response.json({ success: true }))
    : new Promise<Response>((resolve) => { finish = resolve; })));
  const pending = kind === 'search'
    ? api.search('片名', [], true, { onSource: vi.fn() })
    : api.liveProbeStream([], vi.fn());
  await api.login('unit-test-placeholder');
  finish(new Response(null, { status: 401 }));
  await expect(pending).rejects.toMatchObject({ status: 401 });
  expect(dispatchEvent).not.toHaveBeenCalled();
});

it('当前会话失效仍正常提示重新登录', async () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/auth'
    ? Response.json({ success: true })
    : new Response(null, { status: 401 })));
  await api.login('unit-test-placeholder');
  await expect(api.hotList('douban_movie_weekly')).rejects.toMatchObject({ status: 401 });
  expect(dispatchEvent).toHaveBeenCalledOnce();
  expect(dispatchEvent.mock.calls[0][0].type).toBe('libretv:unauthorized');
});
