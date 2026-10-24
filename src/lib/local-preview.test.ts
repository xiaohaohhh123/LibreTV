import { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalPreview } from './local-preview';
import { guardRequest } from './api-guard';
import { GET as status } from '@/app/api/status/route';
import { GET as authStatus, POST as login } from '@/app/api/auth/route';
import { clearRateLimit, SESSION_COOKIE } from './auth';

const key = Symbol.for('private-tv.local-preview');
const runtimeProcess = process as unknown as Record<symbol, unknown>;
const makeRequest = (password?: string, ip = 'local-preview-test') => new Request('http://127.0.0.1:8080/api/auth', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify({ password }),
});
let server: Server | undefined;
afterEach(async () => {
  delete runtimeProcess[key];
  vi.unstubAllEnvs();
  clearRateLimit('local-preview-test');
  if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe('local-only authentication mode', () => {
  it('environment flags and forged local headers alone never enable convenience mode', () => {
    vi.stubEnv('PRIVATE_TV_LOCAL_PREVIEW', '1');
    vi.stubEnv('PASSWORD', '');
    expect(getLocalPreview()).toBeNull();
    const req = new Request('http://127.0.0.1:8080/api/search', { headers: { host: '127.0.0.1:8080', 'x-forwarded-for': '127.0.0.1' } });
    expect(guardRequest(req)?.status).toBe(503);
  });

  it('a serialized sentinel cannot stand in for a live HTTP server', () => {
    vi.stubEnv('PRIVATE_TV_LOCAL_PREVIEW', '1');
    runtimeProcess[key] = { server: { listening: true, address: { address: '127.0.0.1', port: 8080 } }, buildId: 'fake' };
    expect(getLocalPreview()).toBeNull();
  });

  it('an unbound server does not enable convenience mode', () => {
    vi.stubEnv('PRIVATE_TV_LOCAL_PREVIEW', '1');
    server = new Server();
    runtimeProcess[key] = { server, buildId: 'unbound' };
    expect(getLocalPreview()).toBeNull();
  });

  it('a server on a different port cannot enable convenience mode', async () => {
    vi.stubEnv('PRIVATE_TV_LOCAL_PREVIEW', '1');
    server = new Server();
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    runtimeProcess[key] = { server, buildId: 'other-port' };
    expect(getLocalPreview()).toBeNull();
  });

  it('the inspected loopback address authorizes frontend and all API gates consistently', async () => {
    vi.stubEnv('PRIVATE_TV_LOCAL_PREVIEW', '1');
    vi.stubEnv('PASSWORD', '');
    server = new Server();
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    // Unit-check the address gate without occupying the user's preview port; launcher QA checks the actual binding.
    vi.spyOn(server, 'address').mockReturnValue({ address: '127.0.0.1', port: 8080, family: 'IPv4' });
    runtimeProcess[key] = { server, buildId: 'actual-listener-test' };
    const req = new Request('http://127.0.0.1:8080/api/status');
    expect(getLocalPreview()).not.toBeNull();
    expect(guardRequest(req)).toBeNull();
    expect(await (await status(req)).json()).toMatchObject({ verified: true, passwordRequired: false, localPreview: true, previewBuildId: 'actual-listener-test' });
    expect(await (await authStatus(req)).json()).toMatchObject({ verified: true });
    expect((await login(makeRequest())).headers.has('set-cookie')).toBe(false);
    vi.stubEnv('PRIVATE_TV_LOCAL_PREVIEW', '');
    expect(getLocalPreview()).toBeNull();
    expect(guardRequest(req)?.status).toBe(503);
  });
});

describe('ordinary production authentication remains closed by default', () => {
  it('unconfigured password rejects requests with 503 and status never claims verification', async () => {
    vi.stubEnv('PASSWORD', '');
    expect((await login(makeRequest('not-a-secret'))).status).toBe(503);
    const data = await (await status(new Request('https://normal.example/api/status'))).json();
    expect(data).toMatchObject({ passwordRequired: false, verified: false, localPreview: false, previewBuildId: null });
    expect(guardRequest(new Request('https://normal.example/api/search'))?.status).toBe(503);
  });

  it('wrong password is refused and a correct password establishes the existing cookie session', async () => {
    vi.stubEnv('PASSWORD', 'ephemeral-test-only');
    expect((await login(makeRequest('wrong'))).status).toBe(401);
    const accepted = await login(makeRequest('ephemeral-test-only'));
    expect(accepted.status).toBe(200);
    const cookie = accepted.headers.get('set-cookie')!;
    expect(cookie).toContain(SESSION_COOKIE + '=');
    expect(cookie).toContain('HttpOnly');
    const req = new Request('https://normal.example/api/search', { headers: { cookie: cookie.split(';')[0] } });
    expect(guardRequest(req)).toBeNull();
    expect(guardRequest(new Request('https://normal.example/api/search'))?.status).toBe(401);
  });

  it('ordinary login still enforces its attempt limit', async () => {
    vi.stubEnv('PASSWORD', 'ephemeral-test-only');
    for (let i = 0; i < 10; i++) expect((await login(makeRequest('wrong'))).status).toBe(401);
    expect((await login(makeRequest('ephemeral-test-only'))).status).toBe(429);
  });
});
