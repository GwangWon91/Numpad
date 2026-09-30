// 기록 분석: 최고 기록, 약한 키, 추이 (순수 함수)

const METRICS = ['score', 'kpm', 'accuracy', 'maxCombo'];

/** 모드별 최고 기록 { mode: { score, kpm, accuracy, maxCombo, count } }. 점수가 없던 이전 기록은 0점 취급 */
export function bestByMode(sessions) {
  const out = {};
  for (const s of sessions) {
    const b = (out[s.mode] ??= { score: 0, kpm: 0, accuracy: 0, maxCombo: 0, count: 0 });
    b.count++;
    for (const m of METRICS) b[m] = Math.max(b[m], s[m] ?? 0);
  }
  return out;
}

/**
 * 새 기록이 같은 모드의 이전 기록보다 나은 지표 목록.
 * 이전 기록이 없으면 'first'를 돌려준다.
 */
export function personalBests(previous, record) {
  const same = previous.filter((s) => s.mode === record.mode);
  if (same.length === 0) return ['first'];
  const best = bestByMode(same)[record.mode];
  return METRICS.filter((m) => (record[m] ?? 0) > best[m]);
}

/** 기대 키별 오타율. attempts가 minAttempts 이상인 키만, 오타율 높은 순 */
export function weakKeys(records, minAttempts = 3) {
  const list = Array.isArray(records) ? records : [records];
  const attempts = {};
  const misses = {};
  for (const r of list) {
    for (const [k, v] of Object.entries(r.attempts ?? {})) attempts[k] = (attempts[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.misses ?? {})) misses[k] = (misses[k] ?? 0) + v;
  }
  return Object.keys(attempts)
    .filter((k) => attempts[k] >= minAttempts)
    .map((k) => ({ token: k, attempts: attempts[k], misses: misses[k] ?? 0, rate: (misses[k] ?? 0) / attempts[k] }))
    .sort((a, b) => b.rate - a.rate || b.misses - a.misses);
}

/** 오늘(로컬 날짜) 세션 요약 */
export function todaySummary(sessions, now = new Date()) {
  const key = localDateKey(now);
  const today = sessions.filter((s) => localDateKey(new Date(s.date)) === key);
  return {
    count: today.length,
    minutes: Math.round(today.reduce((a, s) => a + s.durationMs, 0) / 60_000),
    maxCombo: today.reduce((a, s) => Math.max(a, s.maxCombo ?? 0), 0),
  };
}

/** 연속 연습 일수 (오늘 또는 어제까지 이어진 날짜 수) */
export function streakDays(sessions, now = new Date()) {
  const days = new Set(sessions.map((s) => localDateKey(new Date(s.date))));
  const d = new Date(now);
  if (!days.has(localDateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(localDateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** 그래프용 최근 n개 세션 */
export function series(sessions, mode, n = 30) {
  const list = mode ? sessions.filter((s) => s.mode === mode) : sessions;
  return list.slice(-n).map((s) => ({ date: s.date, score: s.score ?? null, kpm: s.kpm, accuracy: s.accuracy, mode: s.mode }));
}

export function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatPercent(x) {
  return `${(x * 100).toFixed(x >= 0.9995 ? 0 : 1)}%`;
}
