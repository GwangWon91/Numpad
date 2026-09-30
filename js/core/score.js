// 점수 규칙 (순수 함수)
// 정타 1개 점수 = 기본점 × 속도계수 × 콤보배율. 오타·오답은 0점이고 콤보가 끊긴다.

export const SCORE_RULES = {
  keys: { base: 10, targetMs: 600 }, // 무작위 목표 키에 반응하는 시간
  number: { base: 10, targetMs: 300, firstMs: 900 }, // 글자당, 문항 첫 글자는 읽는 시간 포함
  expr: { base: 10, targetMs: 300, firstMs: 900 },
  calc: { base: 50, targetMs: { easy: 3000, normal: 5000, hard: 8000 } }, // 정답 1문제
};

export const SPEED_MIN = 0.5;
export const SPEED_MAX = 2;

/** 목표시간 대비 빠르기. 기준 시각이 없으면(세션 첫 키) 1 */
export function speedFactor(targetMs, dtMs) {
  if (dtMs === null || dtMs === undefined) return 1;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, targetMs / Math.max(1, dtMs)));
}

export function comboMultiplier(combo) {
  if (combo >= 50) return 3;
  if (combo >= 25) return 2;
  if (combo >= 10) return 1.5;
  return 1;
}

export function targetMsFor(mode, { difficulty = 'normal', firstOfItem = false } = {}) {
  const r = SCORE_RULES[mode];
  if (typeof r.targetMs === 'object') return r.targetMs[difficulty] ?? r.targetMs.normal;
  return firstOfItem && r.firstMs ? r.firstMs : r.targetMs;
}

/**
 * @param {{mode: string, difficulty?: string, dtMs: number|null, combo: number, firstOfItem?: boolean}} p
 *   combo는 이번 정타를 포함한 콤보
 * @returns {{points: number, speed: number}}
 */
export function pointsFor({ mode, difficulty, dtMs, combo, firstOfItem = false }) {
  const speed = speedFactor(targetMsFor(mode, { difficulty, firstOfItem }), dtMs);
  const points = Math.round(SCORE_RULES[mode].base * speed * comboMultiplier(combo));
  return { points, speed: Math.round(speed * 100) / 100 };
}
