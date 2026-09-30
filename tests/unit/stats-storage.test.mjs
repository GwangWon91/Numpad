import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestByMode, personalBests, weakKeys, todaySummary, streakDays, formatDuration, formatPercent } from '../../js/core/stats.js';
import { createStorage, STORAGE_KEY, MAX_SESSIONS } from '../../js/core/storage.js';

const rec = (mode, kpm, accuracy, maxCombo, date = '2026-10-01T03:00:00') => ({ mode, kpm, accuracy, maxCombo, date: new Date(date).toISOString(), durationMs: 60_000 });

test('bestByMode와 personalBests', () => {
  const past = [rec('keys', 100, 0.9, 20), rec('keys', 120, 0.85, 30), rec('calc', 50, 1, 5)];
  assert.deepEqual(bestByMode(past).keys, { kpm: 120, accuracy: 0.9, maxCombo: 30, count: 2 });
  assert.deepEqual(personalBests(past, rec('keys', 130, 0.8, 31)), ['kpm', 'maxCombo']);
  assert.deepEqual(personalBests(past, rec('keys', 90, 0.8, 10)), []);
  assert.deepEqual(personalBests(past, rec('expr', 10, 0.5, 1)), ['first']);
});

test('weakKeys: 시도 수가 적은 키는 제외하고 오타율 순으로 정렬', () => {
  const r = [
    { attempts: { 7: 10, 5: 10, 0: 2 }, misses: { 7: 1, 5: 4, 0: 2 } },
    { attempts: { 7: 10 }, misses: { 7: 1 } },
  ];
  const w = weakKeys(r);
  assert.deepEqual(w.map((x) => x.token), ['5', '7']);
  assert.equal(w[1].rate, 2 / 20);
});

test('todaySummary와 streakDays', () => {
  const now = new Date('2026-10-03T12:00:00');
  const s = [
    rec('keys', 1, 1, 7, '2026-10-01T09:00:00'),
    rec('keys', 1, 1, 9, '2026-10-02T09:00:00'),
    rec('keys', 1, 1, 12, '2026-10-03T09:00:00'),
    rec('calc', 1, 1, 3, '2026-10-03T10:00:00'),
  ];
  assert.deepEqual(todaySummary(s, now), { count: 2, minutes: 2, maxCombo: 12 });
  assert.equal(streakDays(s, now), 3);
  assert.equal(streakDays(s.slice(0, 2), now), 2, '오늘 안 했어도 어제까지 이어지면 유지');
  assert.equal(streakDays(s.slice(0, 1), now), 0);
});

test('형식 함수', () => {
  assert.equal(formatDuration(61_400), '1:01');
  assert.equal(formatPercent(0.974), '97.4%');
  assert.equal(formatPercent(1), '100%');
});

function memoryBackend(initial) {
  const m = new Map(initial ? [[STORAGE_KEY, initial]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), raw: m };
}

test('storage: 저장 후 다시 읽으면 유지된다', () => {
  const be = memoryBackend();
  const a = createStorage(be);
  a.addSession(rec('keys', 100, 0.9, 20));
  a.updateSettings({ sound: false });
  const b = createStorage(be);
  assert.equal(b.sessions.length, 1);
  assert.ok(b.sessions[0].id);
  assert.equal(b.settings.sound, false);
  assert.equal(b.settings.showKeypad, true, '기본 설정은 병합됨');
});

test('storage: 손상된 데이터나 막힌 저장소에서도 동작한다', () => {
  assert.equal(createStorage(memoryBackend('{not json')).sessions.length, 0);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createStorage(blocked);
  s.addSession(rec('keys', 1, 1, 1));
  assert.equal(s.sessions.length, 1);
  assert.equal(createStorage(undefined).sessions.length, 0);
});

test('storage: 최대 개수를 넘으면 오래된 기록부터 지운다', () => {
  const s = createStorage(memoryBackend());
  for (let i = 0; i < MAX_SESSIONS + 5; i++) s.addSession({ ...rec('keys', i, 1, 1) });
  assert.equal(s.sessions.length, MAX_SESSIONS);
  assert.equal(s.sessions[0].kpm, 5);
  s.clearSessions();
  assert.equal(s.sessions.length, 0);
});
