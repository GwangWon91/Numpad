// 세션 상태 기계: 판정, 콤보, 종료 조건 (DOM 없음)
import { createRng, keyTarget, numberItem, exprItem, calcProblem } from './generator.js';
import { LEVELS } from './keys.js';
import { pointsFor } from './score.js';

export const MODES = {
  keys: { id: 'keys', name: '키 위치 익히기', short: '키 위치', strict: true, defaultCount: 30, unit: '타' },
  number: { id: 'number', name: '숫자 입력', short: '숫자', strict: true, defaultCount: 10, unit: '문항' },
  expr: { id: 'expr', name: '수식 입력', short: '수식', strict: true, defaultCount: 8, unit: '문항' },
  calc: { id: 'calc', name: '빠른 계산', short: '계산', strict: false, defaultCount: 15, unit: '문항' },
};

export const TIME_ATTACK_MS = 60_000;
const CALC_MAX_LEN = 10;

/**
 * @param {object} opts
 * @param {'keys'|'number'|'expr'|'calc'} opts.mode
 * @param {number} [opts.level] 키 위치 레벨 (1~4)
 * @param {'easy'|'normal'|'hard'} [opts.difficulty]
 * @param {{type: 'count'|'time', value: number}} [opts.length]
 * @param {number} [opts.seed]
 */
export function createSession(opts) {
  const mode = MODES[opts.mode];
  if (!mode) throw new Error(`알 수 없는 모드: ${opts.mode}`);
  const level = opts.level ?? 1;
  const difficulty = opts.difficulty ?? 'normal';
  const length = opts.length ?? { type: 'count', value: mode.defaultCount };
  const rng = createRng(opts.seed);
  const pool = LEVELS.find((l) => l.id === level)?.tokens ?? LEVELS[0].tokens;

  const s = {
    mode: mode.id,
    level,
    difficulty,
    length,
    startedAt: null,
    endedAt: null,
    done: false,
    itemsDone: 0,
    hits: 0, // 맞힌 키 (엄격 모드) / 맞힌 문항의 키 수 (계산 모드)
    misses: 0, // 틀린 키 (엄격 모드) / 틀린 문항 수 (계산 모드)
    keystrokes: 0,
    solved: 0, // 계산 모드: 맞힌 문항
    submitted: 0, // 계산 모드: 제출한 문항
    combo: 0,
    maxCombo: 0,
    attempts: {}, // 기대 키별 시도 수
    missMap: {}, // 기대 키별 오타 수
    score: 0,
    lastAt: null, // 직전 정타(엄격) 또는 제출(계산) 시각: 속도 측정 기준
    unitMs: 0, // 측정된 단위 시간 합
    units: 0, // 측정된 단위 수
    item: null,
  };

  // 정타 1개(엄격) 또는 정답 1문제(계산)의 점수와 속도
  function score(now, firstOfItem) {
    const dtMs = s.lastAt === null ? null : now - s.lastAt;
    if (dtMs !== null) {
      s.unitMs += dtMs;
      s.units++;
    }
    const r = pointsFor({ mode: mode.id, difficulty, dtMs, combo: s.combo, firstOfItem });
    s.score += r.points;
    return { ...r, dtMs };
  }

  function nextItem() {
    const prev = s.item;
    switch (mode.id) {
      case 'keys': {
        const t = keyTarget(rng, pool, prev?.target[0]);
        s.item = { display: t, target: [t], pos: 0 };
        break;
      }
      case 'number': {
        const text = numberItem(rng, difficulty);
        s.item = { display: text, target: [...text, 'Enter'], pos: 0 };
        break;
      }
      case 'expr': {
        const text = exprItem(rng, difficulty);
        s.item = { display: text, target: [...text, 'Enter'], pos: 0 };
        break;
      }
      case 'calc': {
        const p = calcProblem(rng, difficulty);
        s.item = { display: p.text, answer: p.answer, typed: '', startedAt: null };
        break;
      }
    }
  }

  function finish(now) {
    s.done = true;
    s.endedAt = now;
  }

  function checkTime(now) {
    if (!s.done && length.type === 'time' && s.startedAt !== null && now - s.startedAt >= length.value) {
      finish(s.startedAt + length.value);
      return true;
    }
    return false;
  }

  function completeItem(now) {
    s.itemsDone++;
    if (length.type === 'count' && s.itemsDone >= length.value) {
      finish(now);
      return true;
    }
    nextItem();
    return false;
  }

  function pressStrict(token, now) {
    if (token === 'Back') return { type: 'ignored' };
    const expected = s.item.target[s.item.pos];
    s.keystrokes++;
    s.attempts[expected] = (s.attempts[expected] ?? 0) + 1;
    if (token !== expected) {
      s.misses++;
      s.missMap[expected] = (s.missMap[expected] ?? 0) + 1;
      s.combo = 0;
      return { type: 'miss', expected, token };
    }
    s.hits++;
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    const pts = score(now, s.item.pos === 0);
    s.lastAt = now;
    s.item.pos++;
    if (s.item.pos < s.item.target.length) return { type: 'hit', token, combo: s.combo, ...pts };
    const end = completeItem(now);
    return { type: 'item', token, combo: s.combo, end, ...pts };
  }

  function pressCalc(token, now) {
    const item = s.item;
    item.startedAt ??= now;
    s.keystrokes++;
    if (token === 'Back') {
      item.typed = item.typed.slice(0, -1);
      return { type: 'typed', typed: item.typed };
    }
    if (token === 'Enter') {
      if (item.typed === '') return { type: 'ignored' };
      s.lastAt ??= s.startedAt;
      s.submitted++;
      const answer = item.answer;
      const ok = item.typed === answer;
      let pts = { points: 0, speed: null, dtMs: null };
      if (ok) {
        s.solved++;
        s.hits += answer.length + 1;
        s.combo++;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        pts = score(now, true);
      } else {
        s.misses++;
        s.combo = 0;
      }
      // 첫 문제는 첫 키 입력부터, 이후 문제는 직전 제출부터 잰다
      s.lastAt = now;
      const typed = item.typed;
      const end = completeItem(now);
      return { type: ok ? 'solved' : 'wrong', typed, answer, combo: s.combo, end, ...pts };
    }
    if (!/^[0-9.\-]$/.test(token)) return { type: 'ignored' };
    if (item.typed.length >= CALC_MAX_LEN) return { type: 'ignored' };
    item.typed += token;
    return { type: 'typed', typed: item.typed };
  }

  nextItem();

  return {
    state: s,
    mode,
    /** 키 입력 처리. 반환 이벤트: hit | miss | item | typed | solved | wrong | ignored | end(시간 종료). end: true면 세션 끝 */
    press(token, now) {
      if (s.done) return { type: 'ignored' };
      if (checkTime(now)) return { type: 'end' };
      s.startedAt ??= now;
      return mode.strict ? pressStrict(token, now) : pressCalc(token, now);
    },
    /** 타이머 갱신. 시간 제한이 끝났으면 true */
    tick(now) {
      return checkTime(now);
    },
    elapsed(now) {
      if (s.startedAt === null) return 0;
      return (s.endedAt ?? now) - s.startedAt;
    },
    remaining(now) {
      if (length.type !== 'time') return null;
      return Math.max(0, length.value - this.elapsed(now));
    },
    /** 저장용 기록 */
    summary(now = s.endedAt) {
      const durationMs = Math.max(1, this.elapsed(now));
      const minutes = durationMs / 60_000;
      const strict = mode.strict;
      const judged = s.hits + (strict ? s.misses : 0);
      return {
        mode: mode.id,
        level: mode.id === 'keys' ? level : null,
        difficulty: mode.id === 'keys' ? null : difficulty,
        lengthType: length.type,
        date: new Date(s.startedAt ?? now).toISOString(),
        durationMs,
        // 계산 모드도 맞힌 문제의 키만 센다 (Backspace·오답 타이핑 제외)
        kpm: Math.round(s.hits / minutes),
        score: s.score,
        // 엄격: 정타 사이 평균 시간 / 계산: 제출한 문제당 평균 시간
        avgMs: strict ? (s.units ? Math.round(s.unitMs / s.units) : null) : (s.submitted ? Math.round(durationMs / s.submitted) : null),
        accuracy: strict
          ? (judged ? s.hits / judged : 0)
          : (s.submitted ? s.solved / s.submitted : 0),
        items: s.itemsDone,
        solved: strict ? null : s.solved,
        maxCombo: s.maxCombo,
        attempts: { ...s.attempts },
        misses: { ...s.missMap },
      };
    },
  };
}
