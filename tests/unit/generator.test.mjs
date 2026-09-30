import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, keyTarget, numberItem, exprItem, calcProblem } from '../../js/core/generator.js';

const DIFFS = ['easy', 'normal', 'hard'];

test('같은 시드는 같은 문제를 만든다', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(numberItem(a), numberItem(b));
});

test('keyTarget은 풀 안에서 고르고 직전 키를 반복하지 않는다', () => {
  const rng = createRng(1);
  const pool = ['4', '5', '6'];
  let prev;
  for (let i = 0; i < 200; i++) {
    const t = keyTarget(rng, pool, prev);
    assert.ok(pool.includes(t));
    assert.notEqual(t, prev);
    prev = t;
  }
  assert.equal(keyTarget(rng, ['5'], '5'), '5');
});

test('numberItem: 넘패드로 칠 수 있는 숫자이고 앞자리 0이 없다', () => {
  for (const d of DIFFS) {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const n = numberItem(rng, d);
      assert.match(n, /^(0|[1-9]\d*)(\.\d+)?$/, `${d}: ${n}`);
      if (d === 'easy') assert.doesNotMatch(n, /\./);
      if (d !== 'hard') assert.ok(!n.startsWith('0'), `${d}: ${n}`);
    }
  }
});

test('exprItem: 숫자와 넘패드 연산자로만 이루어지고 연산자가 연속되지 않는다', () => {
  for (const d of DIFFS) {
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) {
      const e = exprItem(rng, d);
      assert.match(e, /^\d+(\.\d+)?([+\-*/]\d+(\.\d+)?)+$/, `${d}: ${e}`);
      assert.doesNotMatch(e, /\.\d*0(?=\D|$)/, `소수 끝에 0이 없어야 함: ${e}`);
    }
  }
});

test('calcProblem: 답이 음수가 아닌 정수이고 식과 맞는다', () => {
  const ops = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
  for (const d of DIFFS) {
    const rng = createRng(11);
    for (let i = 0; i < 1000; i++) {
      const p = calcProblem(rng, d);
      assert.match(p.answer, /^\d+$/, `${d}: ${p.text} = ${p.answer}`);
      const m = p.text.match(/^(\d+) (.) (\d+)$/);
      if (m) {
        assert.equal(ops[m[2]](Number(m[1]), Number(m[3])), Number(p.answer), p.text);
      } else {
        const pm = p.text.match(/^(\d+)의 (\d+)%$/);
        assert.ok(pm, p.text);
        assert.equal((Number(pm[1]) * Number(pm[2])) / 100, Number(p.answer), p.text);
      }
    }
  }
});
