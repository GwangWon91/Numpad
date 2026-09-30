import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../../js/core/session.js';

// 현재 문항을 정확히 입력한다
function solve(session, now) {
  const item = session.state.item;
  if (session.mode.strict) {
    let ev;
    for (const t of item.target.slice(item.pos)) ev = session.press(t, now);
    return ev;
  }
  for (const ch of item.answer) session.press(ch, now);
  return session.press('Enter', now);
}

test('키 위치: 맞히면 콤보가 오르고 다음 키로 넘어간다', () => {
  const s = createSession({ mode: 'keys', level: 1, seed: 1, length: { type: 'count', value: 3 } });
  const first = s.state.item.target[0];
  const ev = s.press(first, 0);
  assert.equal(ev.type, 'item');
  assert.equal(ev.combo, 1);
  assert.equal(s.state.itemsDone, 1);
  assert.notEqual(s.state.item.target[0], first);
});

test('엄격 모드: 틀리면 제자리, 콤보 초기화, 약한 키 집계', () => {
  const s = createSession({ mode: 'number', seed: 3, difficulty: 'easy' });
  const expected = s.state.item.target[0];
  s.press(expected, 0);
  const second = s.state.item.target[1];
  const wrong = second === '9' ? '8' : '9';
  const ev = s.press(wrong, 100);
  assert.deepEqual([ev.type, ev.expected], ['miss', second]);
  assert.equal(s.state.item.pos, 1);
  assert.equal(s.state.combo, 0);
  assert.equal(s.state.missMap[second], 1);
  assert.equal(s.state.attempts[second], 1);
});

test('숫자 입력: 마지막에 Enter를 눌러야 문항이 끝난다', () => {
  const s = createSession({ mode: 'number', seed: 5 });
  const { target } = s.state.item;
  assert.equal(target.at(-1), 'Enter');
  for (const t of target.slice(0, -1)) assert.equal(s.press(t, 0).type, 'hit');
  assert.equal(s.press('Enter', 0).type, 'item');
});

test('Backspace는 엄격 모드에서 무시되고 집계되지 않는다', () => {
  const s = createSession({ mode: 'expr', seed: 5 });
  assert.equal(s.press('Back', 0).type, 'ignored');
  assert.equal(s.state.keystrokes, 0);
});

test('문항 수를 채우면 end: true로 끝나고 이후 입력은 무시된다', () => {
  const s = createSession({ mode: 'number', seed: 8, length: { type: 'count', value: 2 } });
  assert.equal(solve(s, 1000).end, false);
  const last = solve(s, 5000);
  assert.equal(last.end, true);
  assert.equal(s.state.done, true);
  assert.equal(s.press('1', 6000).type, 'ignored');
});

test('타임어택: 시간이 지나면 끝나고 경과 시간은 제한 시간으로 고정된다', () => {
  const s = createSession({ mode: 'keys', level: 4, seed: 2, length: { type: 'time', value: 60_000 } });
  assert.equal(s.tick(999_999), false, '첫 키 전에는 타이머가 돌지 않음');
  solve(s, 1000);
  assert.equal(s.tick(30_000), false);
  assert.equal(s.remaining(31_000), 30_000);
  assert.equal(s.tick(61_000), true);
  assert.equal(s.elapsed(90_000), 60_000);
  assert.equal(s.press('5', 90_000).type, 'ignored');
});

test('빠른 계산: 입력, 지우기, 정답/오답 판정', () => {
  const s = createSession({ mode: 'calc', seed: 4, length: { type: 'count', value: 3 } });
  const { answer } = s.state.item;
  s.press('9', 0);
  assert.equal(s.press('Back', 10).typed, '');
  assert.equal(s.press('Enter', 20).type, 'ignored', '빈 답은 제출하지 않음');
  const ok = solve(s, 1000);
  assert.deepEqual([ok.type, ok.answer], ['solved', answer]);
  assert.equal(s.state.combo, 1);

  s.press('0', 2000);
  s.press('.', 2000);
  const bad = s.press('Enter', 2000);
  assert.equal(bad.type, 'wrong');
  assert.equal(s.state.combo, 0);
});

test('요약: 정확도와 타/분 계산', () => {
  const s = createSession({ mode: 'keys', level: 1, seed: 6, length: { type: 'count', value: 4 } });
  const wrongFor = (t) => (t === '4' ? '5' : '4');
  s.press(wrongFor(s.state.item.target[0]), 0); // 오타 1
  for (let i = 0; i < 4; i++) solve(s, 30_000); // 정타 4, 30초
  const r = s.summary();
  assert.equal(r.accuracy, 4 / 5);
  assert.equal(r.kpm, 8);
  assert.equal(r.items, 4);
  assert.equal(r.maxCombo, 4);
  assert.equal(r.durationMs, 30_000);
  assert.equal(Object.values(r.misses).reduce((a, b) => a + b, 0), 1);
});

test('빠른 계산 요약: 정확도는 맞힌 문항 비율', () => {
  const s = createSession({ mode: 'calc', seed: 12, length: { type: 'count', value: 2 } });
  solve(s, 0);
  s.press('0', 10_000);
  s.press('Enter', 60_000);
  const r = s.summary();
  assert.equal(r.accuracy, 0.5);
  assert.equal(r.solved, 1);
  assert.equal(r.items, 2);
});
