import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKey } from '../../js/core/input.js';

test('넘패드 숫자와 연산자는 토큰으로 바뀐다', () => {
  assert.deepEqual(normalizeKey({ code: 'Numpad7', key: '7' }), { kind: 'key', token: '7' });
  assert.deepEqual(normalizeKey({ code: 'NumpadDecimal', key: '.' }), { kind: 'key', token: '.' });
  assert.deepEqual(normalizeKey({ code: 'NumpadMultiply', key: '*' }), { kind: 'key', token: '*' });
  assert.deepEqual(normalizeKey({ code: 'NumpadEnter', key: 'Enter' }), { kind: 'key', token: 'Enter' });
  assert.deepEqual(normalizeKey({ code: 'Backspace', key: 'Backspace' }), { kind: 'key', token: 'Back' });
});

test('소수점 키가 쉼표를 내는 로케일도 허용한다', () => {
  assert.deepEqual(normalizeKey({ code: 'NumpadDecimal', key: ',' }), { kind: 'key', token: '.' });
});

test('상단 숫자키와 메인 Enter는 넘패드 아님으로 판정한다', () => {
  assert.deepEqual(normalizeKey({ code: 'Digit5', key: '5' }), { kind: 'notNumpad', token: '5' });
  assert.deepEqual(normalizeKey({ code: 'Enter', key: 'Enter' }), { kind: 'notNumpad', token: 'Enter' });
});

test('NumLock이 꺼지면 숫자 키가 방향키가 되므로 감지한다', () => {
  assert.equal(normalizeKey({ code: 'Numpad8', key: 'ArrowUp' }).kind, 'numLockOff');
  assert.equal(normalizeKey({ code: 'NumpadDecimal', key: 'Delete' }).kind, 'numLockOff');
  // 연산자 키는 NumLock과 무관
  assert.equal(normalizeKey({ code: 'NumpadAdd', key: '+' }).kind, 'key');
});

test('길게 누름, 조합키, 기타 키는 무시한다', () => {
  assert.equal(normalizeKey({ code: 'Numpad1', key: '1', repeat: true }).kind, 'ignore');
  assert.equal(normalizeKey({ code: 'Numpad1', key: '1', ctrlKey: true }).kind, 'ignore');
  assert.equal(normalizeKey({ code: 'KeyA', key: 'a' }).kind, 'ignore');
  assert.equal(normalizeKey({ code: 'NumLock', key: 'NumLock' }).kind, 'numLockToggle');
});

test('상단 숫자키를 켜면 메인 키보드 숫자·연산자·Enter도 토큰이 된다', () => {
  const on = { topRow: true };
  assert.deepEqual(normalizeKey({ code: 'Digit5', key: '5' }, on), { kind: 'key', token: '5' });
  assert.deepEqual(normalizeKey({ code: 'Enter', key: 'Enter' }, on), { kind: 'key', token: 'Enter' });
  assert.deepEqual(normalizeKey({ code: 'Period', key: '.' }, on), { kind: 'key', token: '.' });
  assert.deepEqual(normalizeKey({ code: 'Digit8', key: '*' }, on), { kind: 'key', token: '*' }, 'Shift+8');
  assert.deepEqual(normalizeKey({ code: 'Equal', key: '+' }, on), { kind: 'key', token: '+' }, 'Shift+=');
  assert.equal(normalizeKey({ code: 'Equal', key: '=' }, on).kind, 'ignore');
  assert.equal(normalizeKey({ code: 'Digit5', key: '%' }, on).kind, 'ignore');
  // 넘패드와 NumLock 감지는 그대로
  assert.deepEqual(normalizeKey({ code: 'Numpad7', key: '7' }, on), { kind: 'key', token: '7' });
  assert.equal(normalizeKey({ code: 'Numpad8', key: 'ArrowUp' }, on).kind, 'numLockOff');
});
