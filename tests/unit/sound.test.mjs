import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteFor, layersFor, MAX_NOTE_HZ } from '../../js/core/sound.js';

test('noteFor: 어떤 위치에서도 한 옥타브(C5~C6)를 넘지 않는다', () => {
  for (let step = 0; step < 500; step++) {
    const { freq } = noteFor(step);
    assert.ok(freq >= 523 && freq <= MAX_NOTE_HZ + 0.01, `step ${step}: ${freq}`);
  }
});

test('noteFor: 프레이즈는 올라갔다 내려오며 반복된다', () => {
  const up = [0, 1, 2, 3, 4, 5].map((s) => noteFor(s).freq);
  for (let i = 1; i < up.length; i++) assert.ok(up[i] > up[i - 1]);
  assert.ok(noteFor(6).freq < noteFor(5).freq, '최고음 뒤에는 내려옴');
  assert.equal(noteFor(10).freq, noteFor(0).freq, '10타마다 반복');
});

test('noteFor: 4박마다 첫 박에 강세', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 8].map((s) => noteFor(s).accent), [true, false, false, false, true, true]);
});

test('layersFor: 콤보 단계별 레이어 경계', () => {
  assert.deepEqual(layersFor(9), { hat: false, bass: false, fifth: false });
  assert.deepEqual(layersFor(10), { hat: true, bass: false, fifth: false });
  assert.deepEqual(layersFor(24), { hat: true, bass: false, fifth: false });
  assert.deepEqual(layersFor(25), { hat: true, bass: true, fifth: false });
  assert.deepEqual(layersFor(49), { hat: true, bass: true, fifth: false });
  assert.deepEqual(layersFor(50), { hat: true, bass: true, fifth: true });
});
