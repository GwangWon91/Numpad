// 헤드리스 Chrome을 DevTools 프로토콜로 조작하는 최소 도구 (의존성 없음, Node 22+)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 넘패드 토큰 → CDP 키 이벤트 정보
const KEY_INFO = {
  0: ['Numpad0', '0', 96], 1: ['Numpad1', '1', 97], 2: ['Numpad2', '2', 98],
  3: ['Numpad3', '3', 99], 4: ['Numpad4', '4', 100], 5: ['Numpad5', '5', 101],
  6: ['Numpad6', '6', 102], 7: ['Numpad7', '7', 103], 8: ['Numpad8', '8', 104],
  9: ['Numpad9', '9', 105],
  '.': ['NumpadDecimal', '.', 110], '+': ['NumpadAdd', '+', 107],
  '-': ['NumpadSubtract', '-', 109], '*': ['NumpadMultiply', '*', 106],
  '/': ['NumpadDivide', '/', 111],
  Enter: ['NumpadEnter', 'Enter', 13], Back: ['Backspace', 'Backspace', 8],
};

export async function launch({ width = 1280, height = 860 } = {}) {
  const exe = CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error('Chrome/Edge를 찾을 수 없습니다. CHROME_PATH를 지정하세요.');
  const profile = resolve(ROOT, 'progress/.chrome-profile');
  mkdirSync(profile, { recursive: true });
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((ok, fail) => {
    let buf = '';
    const timer = setTimeout(() => fail(new Error('Chrome 시작 시간 초과')), 15000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); ok(m[1]); }
    });
  });

  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok) => ws.addEventListener('open', ok, { once: true }));

  let seq = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
    } else if (msg.method === 'Log.entryAdded') {
      logs.push(`[${msg.params.entry.level}] ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
    }
  });
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const api = {
    logs,
    send,
    sleep,
    async goto(url) {
      await send('Page.navigate', { url });
      await api.waitFor('document.readyState === "complete"');
      await sleep(150);
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async waitFor(expr, timeout = 5000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        try { if (await api.eval(expr)) return; } catch { /* 페이지 이동 중 */ }
        await sleep(50);
      }
      throw new Error(`대기 시간 초과: ${expr}`);
    },
    // 넘패드 토큰 입력. opts.key로 key 값을 바꿔 NumLock 꺼짐 등을 흉내 낼 수 있다
    async press(token, opts = {}) {
      const [code, key, vk] = KEY_INFO[token] ?? [opts.code, opts.key ?? token, opts.vk ?? 0];
      const base = {
        code: opts.code ?? code, key: opts.key ?? key,
        windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
        location: (opts.code ?? code).startsWith('Numpad') ? 3 : 0,
      };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    async type(tokens, gap = 0) {
      for (const t of tokens) {
        await api.press(t);
        if (gap) await sleep(gap);
      }
    },
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(file, Buffer.from(data, 'base64'));
    },
    async setColorScheme(value) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
    },
    async close() {
      try { await send('Browser.close'); } catch { /* 이미 종료 */ }
      ws.close();
      proc.kill();
    },
  };
  return api;
}
