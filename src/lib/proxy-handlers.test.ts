import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ fetch: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/fetch-utils', () => ({ fetchWithSafeRedirects: mock.fetch }));
vi.mock('@/lib/api-guard', () => ({ guardRequest: mock.guard, jsonError: (error: string, status: number) => Response.json({ error }, { status }) }));
vi.mock('@/lib/ssrf', () => ({ isValidProxyUrl: () => true, isBlockedByDNS: async () => false, checkLiveUrlAllowed: async () => ({ ok: true }) }));
import { handleProxyRequest } from './proxy-handlers';
const target = 'https://93.184.216.34/video';
const req = (headers?: HeadersInit) => new Request('http://localhost/api/proxy', { headers });
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.useRealTimers(); });

function fakeDeadlines() {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('deadline', 'TimeoutError')), ms);
    return controller.signal;
  });
}

describe('point-of-use proxy contracts', () => {
  it('响应头已到达后，9秒分片不能被8秒连接死线截断', async () => {
    fakeDeadlines();
    mock.fetch.mockImplementation((_url: string, init: RequestInit) => {
      const body = new ReadableStream({ start(controller) {
        const timer = setTimeout(() => { controller.enqueue(new Uint8Array([1, 2])); controller.close(); }, 9000);
        init.signal!.addEventListener('abort', () => { clearTimeout(timer); controller.error(init.signal!.reason); });
      } });
      return Promise.resolve({ res: new Response(body, { headers: { 'content-type': 'video/mp2t' } }), finalUrl: target });
    });
    const result = await handleProxyRequest(req(), target);
    const reading = result.arrayBuffer().then(data => ({ ok: true, bytes: [...new Uint8Array(data)] }), () => ({ ok: false }));
    await vi.advanceTimersByTimeAsync(9001);
    expect(await reading).toEqual({ ok: true, bytes: [1, 2] });
    expect(mock.fetch.mock.calls[0][2]).toMatchObject({ headerTimeoutMs: 8000 });
  });

  it('分片body挂起仍有60秒上限，播放列表body仍有8秒上限', async () => {
    fakeDeadlines();
    mock.fetch.mockImplementation((_url: string, init: RequestInit) => {
      const body = new ReadableStream({ start(controller) {
        init.signal!.addEventListener('abort', () => controller.error(init.signal!.reason));
      } });
      return Promise.resolve({ res: new Response(body), finalUrl: _url });
    });
    const media = await handleProxyRequest(req(), target);
    const reading = media.arrayBuffer().then(() => false, () => true);
    await vi.advanceTimersByTimeAsync(60_001);
    expect(await reading).toBe(true);
    const manifest = handleProxyRequest(req(), target + '.m3u8');
    await vi.advanceTimersByTimeAsync(8001);
    expect((await manifest).status).toBe(502);
  });

  it('上游拒绝响应保留状态码且不能长缓存', async () => {
    mock.fetch.mockResolvedValue({ res: new Response('blocked', { status: 418, headers: { 'content-type': 'image/jpeg' } }), finalUrl: target });
    const result = await handleProxyRequest(req(), target);
    expect(result.status).toBe(418);
    expect(result.headers.get('cache-control')).toBe('no-store');
  });

  it('带查询参数和重定向的m3u8仍重写分片/key/map', async () => {
    const manifest = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6,\nseg.ts\n';
    mock.fetch.mockResolvedValue({ res: new Response(manifest, { headers: { 'content-type': 'application/octet-stream' } }), finalUrl: 'https://93.184.216.34/hls/play.m3u8?ticket=fixture' });
    const result = await handleProxyRequest(req(), target + '?entry=fixture');
    expect(result.headers.get('content-type')).toContain('mpegurl');
    const body = await result.text();
    for (const name of ['key.bin', 'init.mp4', 'seg.ts']) expect(body).toContain('/api/proxy?url=' + encodeURIComponent('https://93.184.216.34/hls/' + name));
  });

  it('假播放列表和中断的播放列表明确失败', async () => {
    mock.fetch.mockResolvedValueOnce({ res: new Response('<html>try later</html>'), finalUrl: target + '.m3u8?q=fixture' });
    const invalid = await handleProxyRequest(req(), target + '.m3u8?q=fixture');
    expect(invalid.status).toBe(502);
    expect(invalid.headers.get('cache-control')).toBe('no-store');
    const broken = new ReadableStream({ start(controller) { controller.error(new Error('upstream closed')); } });
    mock.fetch.mockResolvedValueOnce({ res: new Response(broken), finalUrl: target + '.m3u8' });
    expect((await handleProxyRequest(req(), target + '.m3u8')).status).toBe(502);
  });

  it('Range响应的边界仍原样透传', async () => {
    mock.fetch.mockResolvedValue({ res: new Response(new Uint8Array([1, 2]), { status: 206, headers: { 'content-type': 'video/mp2t', 'content-range': 'bytes 2-3/8', 'accept-ranges': 'bytes' } }), finalUrl: target });
    const result = await handleProxyRequest(req({ range: 'bytes=2-3' }), target);
    expect(result.status).toBe(206);
    expect(result.headers.get('content-range')).toBe('bytes 2-3/8');
    expect(mock.fetch.mock.calls[0][1].headers.Range).toBe('bytes=2-3');
    expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([1, 2]);
  });

  it('已取消请求不再访问或重试上游', async () => {
    const controller = new AbortController(); controller.abort();
    const canceled = new Request('http://localhost/api/proxy', { signal: controller.signal });
    const result = await handleProxyRequest(canceled, target);
    expect(result.status).toBe(502);
    expect(mock.fetch).not.toHaveBeenCalled();
  });

  it('鉴权错误不会因代理优化绕过', async () => {
    mock.guard.mockReturnValueOnce(new Response('auth required', { status: 401 }));
    expect((await handleProxyRequest(req(), target)).status).toBe(401);
    expect(mock.fetch).not.toHaveBeenCalled();
  });
});
