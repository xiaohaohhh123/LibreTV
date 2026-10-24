// Local convenience is tied to this real 127.0.0.1 listener, never to a public flag.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const rootId = crypto.createHash('sha256').update(process.platform === 'win32' ? root.toLowerCase() : root).digest('hex');
const url = 'http://127.0.0.1:8080';
const work = path.join(root, '.local-preview');
const identityPath = '/__private_tv_preview';
const appId = 'private-tv-local-preview-v2';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const buildId = () => fs.existsSync(path.join(root, '.next/BUILD_ID')) ? fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8').trim() : null;

async function identity() {
  try {
    const response = await fetch(url + identityPath, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return null;
    const info = await response.json();
    return info.appId === appId && info.rootId === rootId && Number.isInteger(info.pid) ? info : null;
  } catch { return null; }
}

function portOccupied() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: 8080 });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(true); });
  });
}

async function openBrowser() {
  if (process.argv.includes('--no-open')) return;
  if (process.platform === 'win32') {
    // cmd needs literal quotes; Node's default Windows escaping turns them into backslashes.
    await new Promise((resolve, reject) => {
      const browser = spawn('cmd.exe', ['/d', '/s', '/c', 'start "" "http://127.0.0.1:8080/"'], {
        windowsHide: true, windowsVerbatimArguments: true, stdio: 'ignore',
      });
      browser.once('error', reject);
      browser.once('close', (code) => code === 0 ? resolve() : reject(new Error(`自动打开浏览器失败，请手动打开 ${url}/`)));
    });
  } else console.log(`请在浏览器打开 ${url}/`);
}

function runNpm(args) {
  // Arguments are fixed task commands; cwd is passed separately for Chinese/space paths.
  const result = spawnSync('npm', args, {
    cwd: root, shell: process.platform === 'win32', stdio: 'inherit', windowsHide: true,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  if (result.error || result.status !== 0) throw new Error(`npm ${args.join(' ')} 失败，请查看上方输出。`);
}

function newestInput(file) {
  if (!fs.existsSync(file)) return 0;
  const stat = fs.statSync(file);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(stat.mtimeMs, ...fs.readdirSync(file).map((name) => newestInput(path.join(file, name))));
}

function needsBuild() {
  const stamp = path.join(root, '.next/BUILD_ID');
  if (!fs.existsSync(stamp)) return true;
  return ['src', 'public', 'next.config.ts', 'package.json', 'package-lock.json', 'tailwind.config.ts', 'postcss.config.mjs', 'tsconfig.json']
    .some((file) => newestInput(path.join(root, file)) > fs.statSync(stamp).mtimeMs);
}

async function stop() {
  const current = await identity();
  if (!current) {
    if (await portOccupied()) throw new Error('8080 被其他服务占用，未停止任何进程。请先关闭占用程序。');
    console.log('私人TV 本地服务已停止。');
    return;
  }
  const response = await fetch(url + identityPath + '/stop', {
    method: 'POST', headers: { 'x-private-tv-control': 'stop' }, signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('本机服务拒绝停止请求，请查看 .local-preview/server.log。');
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!(await portOccupied())) { console.log('私人TV 本地服务已停止，观看记录保持不变。'); return; }
    await sleep(250);
  }
  throw new Error('停止尚未完成；未结束任何不相关进程，请查看 .local-preview/server.log。');
}

async function start() {
  fs.mkdirSync(work, { recursive: true });
  const lock = path.join(work, 'start.lock');
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner = 0;
    try { owner = Number(fs.readFileSync(lock, 'utf8')); process.kill(owner, 0); }
    catch { fs.rmSync(lock, { force: true }); return start(); }
    if (!owner) throw new Error('启动锁异常，请删除 .local-preview/start.lock 后重试。');
    console.log('私人TV 正在启动，请等待已打开的启动窗口完成。');
    for (let attempt = 0; attempt < 180; attempt++) {
      if (await identity()) { await openBrowser(); return; }
      await sleep(1000);
    }
    throw new Error('另一个启动仍未就绪，请查看启动窗口；没有重复创建服务。');
  }
  fs.writeFileSync(lockFd, String(process.pid));
  try {
    const current = await identity();
    if (current && current.buildId === buildId() && !needsBuild()) {
      console.log(`私人TV 已在运行：${url}/ （无需密码）`);
      await openBrowser(); return;
    }
    if (current) await stop();
    else if (await portOccupied()) throw new Error('8080 被其他服务占用，未停止任何进程。请先关闭占用程序，再运行本脚本。');
    if (!fs.existsSync(path.join(root, 'node_modules/next/package.json'))) {
      console.log('首次使用，正在安装锁定版本的项目依赖…'); runNpm(['ci']);
    }
    if (needsBuild()) { console.log('正在生成当前版本，请等待完成…'); runNpm(['run', 'build']); }
    const logPath = path.join(work, 'server.log');
    const log = fs.openSync(logPath, 'a');
    const child = spawn(process.execPath, [__filename, 'serve'], {
      cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    });
    fs.closeSync(log);
    child.unref();
    for (let attempt = 0; attempt < 60; attempt++) {
      const ready = await identity();
      if (ready && ready.buildId === buildId()) {
        const response = await fetch(url + '/api/status', { signal: AbortSignal.timeout(5000) });
        const status = await response.json();
        if (!status.localPreview || !status.verified || status.previewBuildId !== ready.buildId) throw new Error('本地入口未通过服务端免密码核对。');
        console.log(`私人TV 已启动：${url}/ （仅限本机，无需密码）`);
        await openBrowser(); return;
      }
      await sleep(500);
    }
    throw new Error(`启动失败，请查看 ${logPath}；未切换其他端口或公开服务。`);
  } finally { fs.closeSync(lockFd); fs.rmSync(lock, { force: true }); }
}

async function serve() {
  process.chdir(root);
  process.env.PRIVATE_TV_LOCAL_PREVIEW = '1';
  // Public source settings are cached locally, so restarts never depend on the online site.
  if (!process.env.DEFAULT_SOURCES) process.env.DEFAULT_SOURCES = fs.readFileSync(path.join(__dirname, 'local-sources.json'), 'utf8');
  if (!process.env.DEFAULT_RECOMMEND_SOURCE) process.env.DEFAULT_RECOMMEND_SOURCE = 'hot-list';
  const next = require('next');
  const app = next({ dev: false, hostname: '127.0.0.1', port: 8080, dir: root });
  await app.prepare();
  const handler = app.getRequestHandler();
  const id = buildId();
  let closing = false;
  const server = http.createServer(async (req, res) => {
    if (req.socket.remoteAddress !== '127.0.0.1' || req.headers.host !== '127.0.0.1:8080') {
      res.writeHead(403); res.end('Only http://127.0.0.1:8080/ is supported by the local preview.'); return;
    }
    if (req.url === identityPath && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ appId, rootId, pid: process.pid, buildId: id, localPreview: true })); return;
    }
    if (req.url === identityPath + '/stop') {
      if (req.method !== 'POST' || req.headers['x-private-tv-control'] !== 'stop' || req.headers.origin) {
        res.writeHead(403); res.end(); return;
      }
      res.writeHead(200); res.end('stopping');
      if (!closing) {
        closing = true;
        server.close();
        setTimeout(async () => { server.closeAllConnections(); await app.close(); process.exit(0); }, 100).unref();
      }
      return;
    }
    try { await handler(req, res); }
    catch (error) { console.error(error.message); if (!res.headersSent) res.writeHead(500); res.end('Local preview error'); }
  });
  server.on('error', (error) => { console.error(`本地服务未启动：${error.code || error.message}`); process.exit(1); });
  await new Promise((resolve) => server.listen(8080, '127.0.0.1', resolve));
  process[Symbol.for('private-tv.local-preview')] = Object.freeze({ server, buildId: id });
  console.log(JSON.stringify({ appId, buildId: id, boundTo: '127.0.0.1:8080', startedAt: new Date().toISOString() }));
}

const action = process.argv[2] || 'start';
const actions = { start, stop, serve };
if (!actions[action]) { console.error('用法：node scripts/local-preview.cjs start|stop'); process.exitCode = 1; }
else actions[action]().catch((error) => { console.error(error.message); process.exitCode = 1; });
