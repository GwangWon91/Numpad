import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointsFor, speedFactor, comboMultiplier, targetMsFor } from '../../js/core/score.js';
import { createSession } from '../../js/core/session.js';

test('speedFactor: 목표시간 대비 빠르기를 0.5~2.0으로 제한', () => {
  assert.equal(speedFactor(300, 300), 1);
  assert.equal(speedFactor(300, 150), 2);
  assert.equal(speedFactor(300, 50), 2, '상한');
  assert.equal(speedFactor(300, 600), 0.5);
  assert.equal(speedFactor(300, 5000), 0.5, '하한');
  assert.equal(speedFactor(300, null), 1, '기준 없음');
});

test('comboMultiplier 경계', () => {
  assert.deepEqual([0, 9, 10, 24, 25, 49, 50, 200].map(comboMultiplier), [1, 1, 1.5, 1.5, 2, 2, 3, 3]);
});

test('targetMsFor: 모드·첫 글자·난이도별 목표시간', () => {
  assert.equal(targetMsFor('keys'), 600);
  assert.equal(targetMsFor('number'), 300);
  assert.equal(targetMsFor('number', { firstOfItem: true }), 900);
  assert.equal(targetMsFor('keys', { firstOfItem: true }), 600, '키 위치는 첫 글자 구분 없음');
  assert.equal(targetMsFor('calc', { difficulty: 'hard' }), 8000);
});

test('pointsFor: 기본점 × 속도 × 콤보', () => {
  assert.deepEqual(pointsFor({ mode: 'number', dtMs: 150, combo: 25 }), { points: 40, speed: 2 });
  assert.deepEqual(pointsFor({ mode: 'keys', dtMs: 600, combo: 1 }), { points: 10, speed: 1 });
  assert.deepEqual(pointsFor({ mode: 'calc', difficulty: 'normal', dtMs: 10000, combo: 10 }), { points: 38, speed: 0.5 });
});

test('세션: 빠를수록 점수가 높고 오타는 0점·콤보 끊김', () => {
  const run = (gap, withMiss) => {
    const s = createSession({ mode: 'keys', level: 1, seed: 1, length: { type: 'count', value: 12 } });
    let t = 0;
    while (!s.state.done) {
      const target = s.state.item.target[0];
      if (withMiss && s.state.itemsDone === 5) {
        const ev = s.press(target === '4' ? '5' : '4', (t += 10));
        assert.equal(ev.type, 'miss');
        assert.equal(s.state.combo, 0);
      }
      s.press(target, (t += gap));
    }
    return s.summary();
  };
  const fast = run(200, false);
  const slow = run(1200, false);
  assert.ok(fast.score > slow.score * 2, `${fast.score} vs ${slow.score}`);
  assert.equal(fast.avgMs, 200);
  assert.ok(run(200, true).score < fast.score, '오타가 있으면 점수 손해');
});

test('세션: 숫자 입력 첫 글자는 읽는 시간을 더 준다', () => {
  const s = createSession({ mode: 'number', seed: 2, length: { type: 'count', value: 2 } });
  const first = s.state.item.target;
  let t = 0;
  for (const k of first) s.press(k, (t += 300));
  const ev = s.press(s.state.item.target[0], (t += 900));
  assert.equal(ev.speed, 1, '다음 문항 첫 글자 900ms = 목표');
});

test('세션: 계산 모드 속도는 정답 키만 세고 문제당 평균 시간을 낸다', () => {
  const s = createSession({ mode: 'calc', seed: 4, length: { type: 'count', value: 2 } });
  const a1 = s.state.item.answer;
  s.press('9', 0);
  s.press('Back', 100);
  for (const ch of a1) s.press(ch, 1000);
  const ev = s.press('Enter', 5000);
  assert.equal(ev.type, 'solved');
  assert.equal(ev.dtMs, 5000, '첫 문제는 첫 키부터');
  assert.equal(ev.points, 50, '보통 목표 5초, 콤보 1');
  s.press('0', 6000);
  s.press('Enter', 15_000);
  const r = s.summary();
  assert.equal(r.kpm, Math.round((a1.length + 1) / (15_000 / 60_000)));
  assert.equal(r.avgMs, 7500);
  assert.equal(r.score, 50);
});
