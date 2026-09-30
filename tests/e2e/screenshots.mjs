// README용 스크린샷 생성: 현실적인 데모 기록을 넣고 사람 속도로 입력한다
// 사용: node tests/e2e/screenshots.mjs  → docs/images/*.png
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';
import { launch } from './browser.mjs';

const OUT = resolve(fileURLToPath(new URL('../../docs/images/', import.meta.url)));
mkdirSync(OUT, { recursive: true });

// 2주 동안 조금씩 늘어난 데모 기록
function demoSessions() {
  const modes = ['keys', 'number', 'expr', 'calc'];
  const base = { keys: 140, number: 170, expr: 150, calc: 90 };
  const out = [];
  const start = new Date();
  start.setDate(start.getDate() - 13);
  for (let d = 0; d < 14; d++) {
    for (let k = 0; k < 2; k++) {
      const mode = modes[(d * 2 + k) % 4];
      const date = new Date(start);
      date.setDate(start.getDate() + d);
      date.setHours(20, k * 15);
      const kpm = Math.round(base[mode] * (1 + d * 0.035) + Math.sin(d * 1.7 + k) * 12);
      const accuracy = Math.min(0.995, 0.88 + d * 0.007 + Math.cos(d + k) * 0.01);
      out.push({
        id: `demo${d}${k}`, mode, level: mode === 'keys' ? 4 : null, difficulty: mode === 'keys' ? null : 'normal',
        lengthType: 'count', date: date.toISOString(), durationMs: 60_000 + d * 1000, kpm, accuracy,
        items: 10, solved: mode === 'calc' ? 9 : null, maxCombo: 12 + d * 3 + k * 5,
        score: Math.round(kpm * 6 * accuracy ** 2), avgMs: Math.round(60_000 / kpm),
        attempts: { 7: 20, 8: 18, 9: 16, 4: 22, 5: 25, 6: 20, 1: 15, 2: 17, 3: 14, 0: 12, '.': 10, '+': 6, '-': 6, '*': 5, '/': 5 },
        misses: { 7: 2, 9: 3, 1: 1, 0: 2, '.': 3, '/': 2, '*': 1 },
      });
    }
  }
  return out;
}

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/`;
const b = await launch({ width: 1280, height: 860 });
const shot = (name) => b.screenshot(resolve(OUT, `${name}.png`));
const target = () => b.eval('document.querySelector(".keycap.is-target")?.dataset.token ?? null');

try {
  for (const scheme of ['light', 'dark']) {
    await b.setColorScheme(scheme);
    await b.goto(base);
    const state = {
      version: 1,
      settings: { sound: false, theme: 'auto', showKeypad: true, lengthType: 'count', difficulty: 'normal', level: 4, lastMode: 'number' },
      sessions: demoSessions(),
    };
    await b.eval(`localStorage.setItem("numpad.v1", ${JSON.stringify(JSON.stringify(state))})`);
    await b.goto(base + '#/');
    await b.sleep(600);
    await b.press('5');
    await b.sleep(700);
    await shot(`home-${scheme}`);
  }

  // 숫자 입력 중간 화면 (콤보가 붙은 상태)
  await b.setColorScheme('light');
  await b.goto(base + '#/play/number');
  await b.sleep(300);
  for (let i = 0; i < 16; i++) {
    const item = await b.eval('document.querySelector(".prompt__line").textContent');
    await b.press(await target());
    await b.sleep(170);
    if (i >= 12 && item.length > 4 && (await b.eval('document.querySelectorAll(".char.is-done").length')) >= 3) break;
  }
  await b.sleep(400);
  await shot('play-number');

  // 끝까지 입력해 결과 화면
  while (await b.eval('!!document.querySelector(".play:not(.is-finished)")')) {
    await b.press(await target());
    await b.sleep(150);
  }
  await b.waitFor('document.body.dataset.screen === "result"');
  await b.sleep(1600);
  await shot('result');

  await b.goto(base + '#/history');
  await b.sleep(700);
  await shot('history');
  console.log(`스크린샷 저장: ${OUT}`);
} finally {
  await b.close();
  server.close();
}
