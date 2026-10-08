// E2E 테스트: 헤드리스 Chrome에 실제 넘패드 key code를 보내 전체 흐름을 검증한다
// 사용: node tests/e2e/run.mjs [--shots <폴더>]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { startServer } from './server.mjs';
import { launch } from './browser.mjs';

const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? resolve(process.argv[shotsArg + 1]) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/`;
const b = await launch();
let passed = 0;

async function step(name, fn) {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
}
const shot = async (name) => SHOTS && b.screenshot(resolve(SHOTS, `${name}.png`));
const target = () => b.eval('document.querySelector(".keycap.is-target")?.dataset.token ?? null');
const screen = () => b.eval('document.body.dataset.screen');
const sessions = () => b.eval('JSON.parse(localStorage.getItem("numpad.v1") ?? "{}").sessions?.length ?? 0');

async function playStrict({ wrongAt = -1 } = {}) {
  let n = 0;
  while (await b.eval('!!document.querySelector(".play:not(.is-finished)")')) {
    const t = await target();
    if (t === null) break;
    if (n === wrongAt) await b.press(t === '9' ? '8' : '9');
    await b.press(t);
    n++;
    if (n > 400) throw new Error('끝나지 않는 세션');
  }
  await b.waitFor('document.body.dataset.screen === "result"');
  return n;
}

async function home() {
  await b.goto(base + '#/');
  await b.waitFor('document.body.dataset.screen === "home"');
}

try {
  await step('홈: 오류 없이 열리고 모드 카드 4개가 보인다', async () => {
    await b.setColorScheme('light');
    await b.goto(base);
    await b.eval('localStorage.clear()');
    await home();
    assert.equal(await b.eval('document.querySelectorAll(".mode-card").length'), 4);
    await shot('01-home-light');
  });

  await step('홈: 워밍업 넘패드가 넘패드·상단 숫자키·NumLock 꺼짐을 구분한다', async () => {
    await b.press('5');
    assert.match(await b.eval('document.querySelector(".warmup__hint").textContent'), /인식/);
    await b.press(null, { code: 'Digit5', key: '5', vk: 53 });
    assert.match(await b.eval('document.querySelector(".warmup__hint").textContent'), /넘패드로/);
    await b.press(null, { code: 'Numpad8', key: 'ArrowUp', vk: 38 });
    assert.match(await b.eval('document.querySelector(".warmup__hint").textContent'), /NumLock/);
  });

  await step('홈: 넘패드 키로 모드·레벨·길이를 바꾼다', async () => {
    await b.press('2');
    assert.equal(await b.eval('document.querySelector(".mode-card.is-selected").dataset.mode'), 'number');
    await b.press('1');
    await b.press('+');
    const level = await b.eval('JSON.parse(localStorage.getItem("numpad.v1")).settings.level');
    assert.equal(level, 2);
    await b.press('-');
    await b.press('*');
    assert.equal(await b.eval('JSON.parse(localStorage.getItem("numpad.v1")).settings.lengthType'), 'time');
    await b.press('*');
  });

  await step('키 위치: 30타를 끝까지 치면 결과 화면과 기록이 남는다', async () => {
    await b.press('1');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    const pool = await b.eval('[...document.querySelectorAll(".keycap:not(.is-dim):not(.is-inert)")].map(k => k.dataset.token).join("")');
    assert.equal(pool, '456', '레벨 1은 4 5 6만 활성');
    await b.press(await target());
    await b.press(await target());
    await shot('02-play-keys');
    const n = await playStrict({ wrongAt: 3 });
    assert.equal(n, 28);
    assert.equal(await sessions(), 1);
    const tiles = await b.eval('[...document.querySelectorAll(".stat__label")].map(e => e.textContent).join("|")');
    assert.match(tiles, /타\/분/);
    assert.match(await b.eval('document.querySelector(".result__title").textContent'), /첫 기록/);
    assert.equal(await b.eval('document.querySelector(".grade").textContent'), 'A', '96.8% → A');
    const acc = await b.eval('document.querySelectorAll(".stat__value")[1].textContent');
    assert.equal(acc, '96.8%', '30타 중 오타 1 → 30/31');
    assert.equal(await b.eval('document.querySelectorAll(".weak-list li").length'), 1);
    const chips = await b.eval('[...document.querySelectorAll(".result__settings .chip")].map(c => c.textContent).join("|")');
    assert.equal(chips, '키 위치 익히기|L1 홈 행|30타|넘패드 보기', '설정 표시, 공식 기록 아님');
    const saved = await b.eval('JSON.parse(localStorage.getItem("numpad.v1")).sessions[0]');
    assert.ok(saved.score > 0 && saved.avgMs > 0, '기록에 점수·평균 시간 저장');
    assert.equal(await b.eval('document.querySelector(".result__score-n").textContent.replace(/,/g, "")'), String(saved.score));
    await shot('03-result-first');
  });

  await step('결과: 바로 누른 Enter는 무시되고, 잠시 뒤 Enter로 다시 시작한다', async () => {
    await b.goto(base + '#/');
    await b.waitFor('document.body.dataset.screen === "home"');
    await b.press('1');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    await playStrict();
    await b.press('Enter');
    assert.equal(await screen(), 'result', '가드 시간 안의 Enter는 무시');
    await b.sleep(800);
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    await b.press(null, { code: 'Escape', key: 'Escape', vk: 27 });
    await b.waitFor('document.body.dataset.screen === "home"');
    assert.equal(await sessions(), 2, '중단한 세션은 저장하지 않음');
  });

  await step('콤보 마일스톤 배지가 문제를 가리지 않는다', async () => {
    await home();
    await b.press('1');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    for (let k = 0; k < 10; k++) await b.press(await target());
    await b.sleep(200);
    const r = await b.eval(`(() => {
      const a = document.querySelector('.burst').getBoundingClientRect();
      const p = document.querySelector('.prompt').getBoundingClientRect();
      const c = document.querySelector('.combo').getBoundingClientRect();
      const hit = (x, y) => !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top);
      return { text: document.querySelector('.burst').textContent, opacity: +getComputedStyle(document.querySelector('.burst')).opacity, prompt: hit(a, p), combo: hit(a, c) };
    })()`);
    assert.equal(r.text, '10 COMBO!');
    assert.ok(r.opacity > 0.5, '배지가 보임');
    assert.equal(r.prompt, false, '문제와 겹치지 않음');
    assert.equal(r.combo, false, '콤보 숫자와 겹치지 않음');
    const hudScore = await b.eval('Number(document.querySelector(".hud__score strong").textContent.replace(/,/g, ""))');
    assert.ok(hudScore >= 100, `10타 정타 점수 누적: ${hudScore}`);
    assert.match(await b.eval('document.querySelector(".gain").textContent'), /^\+\d+/);
    await b.press(await target());
    assert.ok(await b.eval(`Number(document.querySelector(".hud__score strong").textContent.replace(/,/g, "")) > ${hudScore}`), '정타마다 점수 증가');
    await shot('02b-milestone');
    await b.press(null, { code: 'Escape', key: 'Escape', vk: 27 });
    await b.waitFor('document.body.dataset.screen === "home"');
  });

  await step('숫자 입력: Enter까지 쳐야 다음 문항, 10문항 완료', async () => {
    await b.press('2');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    await b.press(await target());
    await shot('04-play-number');
    await playStrict({ wrongAt: 5 });
    assert.equal(await sessions(), 3);
  });

  await step('수식 입력: 연산자 키를 포함해 완료', async () => {
    await home();
    await b.press('3');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    const text = await b.eval('document.querySelector(".prompt__line").textContent');
    assert.match(text, /[+−*/]/);
    await playStrict();
    assert.equal(await sessions(), 4);
  });

  await step('경고: NumLock 꺼짐과 상단 숫자키 입력 시 배너가 뜨고 오타로 세지 않는다', async () => {
    await home();
    await b.press('1');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    await b.press(null, { code: 'Numpad4', key: 'ArrowLeft', vk: 37 });
    assert.match(await b.eval('document.querySelector(".play__banner").textContent'), /NumLock/);
    await b.press(null, { code: 'Digit4', key: '4', vk: 52 });
    assert.match(await b.eval('document.querySelector(".play__banner").textContent'), /넘패드/);
    await shot('05-play-warning');
    assert.equal(await b.eval('document.querySelector(".hud__stat:nth-child(4) strong").textContent'), '—', '판정 없음');
    assert.equal(await b.eval('document.querySelector(".hud__score strong").textContent'), '0', '경고 입력은 점수 없음');
  });

  await step('빠른 계산: 정답·오답 판정, Backspace, 정답률 기록', async () => {
    await home();
    await b.press('4');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    let i = 0;
    while ((await screen()) === 'play') {
      await b.waitFor('document.body.dataset.screen !== "play" || document.querySelector(".answer")?.dataset.empty === "true"');
      if ((await screen()) !== 'play') break;
      const text = await b.eval('document.querySelector(".prompt__calc span").textContent');
      const answer = String(solveCalc(text));
      if (i === 1) {
        await b.type(['9', 'Back']);
        await b.type([...String(Number(answer) + 1), 'Enter']);
        await b.waitFor('document.querySelector(".answer__correct")');
        if (SHOTS) await shot('06-play-calc-wrong');
      } else {
        await b.type([...answer]);
        if (i === 0) await shot('06-play-calc');
        await b.press('Enter');
      }
      i++;
      await b.sleep(i === 2 ? 700 : 220);
      if (i > 40) throw new Error('끝나지 않는 계산 세션');
    }
    await b.waitFor('document.body.dataset.screen === "result"');
    const rate = await b.eval('document.querySelectorAll(".stat__value")[1].textContent');
    assert.equal(rate, `${((14 / 15) * 100).toFixed(1)}%`);
    assert.equal(await b.eval('document.querySelectorAll(".stat__value")[4].textContent'), '14/15');
  });

  await step('타임어택: 60초가 지나면 자동으로 끝난다', async () => {
    await home();
    await b.eval('window.__skew = 0; const n = Date.now.bind(Date); Date.now = () => n() + window.__skew;');
    await b.press('1');
    await b.press('*');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    for (let k = 0; k < 5; k++) await b.press(await target());
    await b.eval('window.__skew = 61000');
    await b.waitFor('document.body.dataset.screen === "result"', 3000);
    assert.equal(await b.eval('document.querySelectorAll(".stat__value")[2].textContent'), '1:00');
    await b.sleep(800);
    await b.press('0');
    await b.waitFor('document.body.dataset.screen === "home"');
    await b.press('*');
  });

  await step('공식 기록: 수식·어려움·60초·넘패드 숨김이면 결과에 표시되고 홈에 개인 최고가 뜬다', async () => {
    assert.match(await b.eval('document.querySelector(".chip--official").textContent'), /—/, '기록 전엔 기준만');
    await b.press('3');
    await b.press('+');
    await b.press('*');
    await b.press('/');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    await b.eval('window.__skew = 0');
    assert.equal(await b.eval('document.querySelectorAll(".keycap").length'), 0, '넘패드 숨김');
    const current = () => b.eval('({ "⏎": "Enter", "−": "-" })[document.querySelector(".char.is-current").textContent] ?? document.querySelector(".char.is-current").textContent');
    for (let k = 0; k < 6; k++) await b.press(await current());
    await b.eval('window.__skew = 61000');
    await b.waitFor('document.body.dataset.screen === "result"', 3000);
    const chips = await b.eval('[...document.querySelectorAll(".result__settings .chip")].map(c => c.textContent).join("|")');
    assert.equal(chips, '수식 입력|어려움|60초 타임어택|넘패드 숨김|🏅 개인 최고 갱신');
    assert.match(await b.eval('document.querySelector(".result__title").textContent'), /첫 공식 기록/);
    await b.waitFor('document.querySelector(".confetti")', 2000);
    const score = await b.eval('JSON.parse(localStorage.getItem("numpad.v1")).sessions.at(-1).score');
    assert.ok(score > 0);
    await shot('07a-result-official');
    await b.sleep(800);
    await b.press('0');
    await b.waitFor('document.body.dataset.screen === "home"');
    assert.equal(await b.eval('document.querySelector(".chip--official strong").textContent'), score.toLocaleString('ko-KR'));
    assert.match(await b.eval('document.querySelector(".mode-card__best").textContent'), /^연습 최고/);
    await b.press('*');
    await b.press('/');
    await b.press('-');
  });

  await step('연습 최고 갱신은 제목만 바뀌고 색종이는 없다', async () => {
    await b.press('1');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    await playStrict();
    const title = await b.eval('document.querySelector(".result__title").textContent');
    assert.match(title, /연습 최고|완벽|정확/);
    await b.sleep(400);
    assert.equal(await b.eval('document.querySelector(".confetti")'), null, '연습 기록은 색종이 없음');
    await shot('07-result-best');
  });

  await step('기록: 그래프, 최고 기록, 약한 키, 세션 목록, 필터', async () => {
    await b.goto(base + '#/history');
    await b.waitFor('document.body.dataset.screen === "history"');
    assert.ok(await b.eval('document.querySelectorAll(".chart .chart__dot").length >= 6'));
    assert.equal(await b.eval('document.querySelectorAll(".sessions tbody tr").length'), await sessions());
    assert.ok(await b.eval('!!document.querySelector(".history__heat .keypad")'));
    await shot('08-history');
    await b.press('4');
    assert.equal(await b.eval('document.querySelectorAll(".sessions tbody tr").length'), 1, '계산 모드만');
  });

  await step('점수 도입 전 기록이 섞여 있어도 기록 화면이 동작한다', async () => {
    await b.eval(`(() => {
      const d = JSON.parse(localStorage.getItem('numpad.v1'));
      d.sessions.unshift({ id: 'legacy', mode: 'keys', level: 1, date: new Date(Date.now() - 86400000).toISOString(), durationMs: 60000, kpm: 120, accuracy: 0.9, items: 30, maxCombo: 12, attempts: {}, misses: {} });
      localStorage.setItem('numpad.v1', JSON.stringify(d));
    })()`);
    await b.goto(base + '#/history');
    await b.waitFor('document.body.dataset.screen === "history"');
    assert.equal(await b.eval('document.querySelectorAll(".sessions thead th").length'), 7);
    assert.match(await b.eval('document.querySelector(".legend span").textContent'), /점수/);
    assert.ok(await b.eval('!!document.querySelector(".chart .chart__dot")'));
  });

  await step('새로고침해도 기록이 유지된다', async () => {
    const before = await sessions();
    await b.goto(base + '#/history');
    await b.waitFor('document.body.dataset.screen === "history"');
    assert.equal(await sessions(), before);
    assert.ok(before >= 7);
  });

  await step('다크 모드에서 스타일 적용', async () => {
    await b.setColorScheme('dark');
    await home();
    const bg = await b.eval('getComputedStyle(document.body).backgroundColor');
    assert.equal(bg, 'rgb(19, 19, 22)');
    await shot('09-home-dark');
    await b.press('2');
    await b.press('Enter');
    await b.waitFor('document.body.dataset.screen === "play"');
    for (let k = 0; k < 3; k++) await b.press(await target());
    await shot('10-play-dark');
    await b.setColorScheme('light');
  });

  await step('모바일 너비에서 가로 스크롤이 없다', async () => {
    await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    for (const path of ['#/', '#/history']) {
      await b.goto(base + path);
      await b.sleep(200);
      assert.ok(await b.eval('document.documentElement.scrollWidth <= innerWidth'), `${path} 가로 넘침`);
    }
    await shot('11-mobile-home');
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
  });

  const errors = b.logs.filter((l) => /exception|\[error\]/.test(l) && !/fonts|jsdelivr|favicon/.test(l));
  assert.deepEqual(errors, [], '콘솔 오류 없음');
  console.log(`\n모든 E2E 통과 (${passed}개)`);
} catch (err) {
  console.error('✗ 실패:', err.message);
  console.error(b.logs.slice(-15).join('\n'));
  await shot('zz-failure').catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
  server.close();
}

function solveCalc(text) {
  const pct = text.match(/^(\d+)의 (\d+)%$/);
  if (pct) return (Number(pct[1]) * Number(pct[2])) / 100;
  const [, a, op, c] = text.match(/^(\d+) (.) (\d+)$/);
  const x = Number(a);
  const y = Number(c);
  return { '+': x + y, '−': x - y, '×': x * y, '÷': x / y }[op];
}
