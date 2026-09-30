// 문제 생성 (시드 가능한 난수, 순수 함수)

// mulberry32: 작고 빠른 시드 난수 생성기
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const chance = (p) => next() < p;
  return { next, int, pick, chance };
}

// n자리 정수 문자열 (첫 자리는 0이 아님)
function digits(rng, n) {
  let s = String(rng.int(1, 9));
  for (let i = 1; i < n; i++) s += rng.int(0, 9);
  return s;
}

// 키 위치 모드: 직전과 다른 키를 고른다
export function keyTarget(rng, pool, prev) {
  if (pool.length <= 1) return pool[0];
  let t;
  do t = rng.pick(pool);
  while (t === prev);
  return t;
}

const NUMBER_RULES = {
  easy: { len: [3, 4], decimalP: 0, fracLen: [0, 0] },
  normal: { len: [4, 6], decimalP: 0.35, fracLen: [1, 2] },
  hard: { len: [5, 8], decimalP: 0.5, fracLen: [1, 3] },
};

// 숫자 입력 모드: 정수부 + 가끔 소수부
export function numberItem(rng, difficulty = 'normal') {
  const r = NUMBER_RULES[difficulty] ?? NUMBER_RULES.normal;
  if (rng.chance(r.decimalP)) {
    const frac = Array.from({ length: rng.int(...r.fracLen) }, () => rng.int(0, 9)).join('');
    const intLen = Math.max(1, rng.int(...r.len) - frac.length);
    const intPart = difficulty === 'hard' && rng.chance(0.15) ? '0' : digits(rng, intLen);
    return `${intPart}.${frac}`;
  }
  return digits(rng, rng.int(...r.len));
}

const EXPR_RULES = {
  easy: { ops: ['+', '-'], count: [1, 1], len: [2, 3], decimalP: 0 },
  normal: { ops: ['+', '-', '*', '/'], count: [1, 2], len: [2, 4], decimalP: 0.2 },
  hard: { ops: ['+', '-', '*', '/'], count: [2, 3], len: [2, 5], decimalP: 0.35 },
};

function operand(rng, r) {
  if (rng.chance(r.decimalP)) {
    return `${digits(rng, rng.int(1, 3))}.${rng.int(1, 99)}`.replace(/0+$/, '');
  }
  return digits(rng, rng.int(...r.len));
}

// 수식 입력 모드: "1250*0.15+320" 같은 수식 문자열
export function exprItem(rng, difficulty = 'normal') {
  const r = EXPR_RULES[difficulty] ?? EXPR_RULES.normal;
  let s = operand(rng, r);
  const n = rng.int(...r.count);
  for (let i = 0; i < n; i++) s += rng.pick(r.ops) + operand(rng, r);
  return s;
}

// 빠른 계산 모드: 답이 깔끔한 정수로 떨어지는 문제
export function calcProblem(rng, difficulty = 'normal') {
  const kinds = {
    easy: ['add2', 'sub2'],
    normal: ['add3', 'sub3', 'mul1', 'div1'],
    hard: ['add3', 'sub3', 'mul2', 'div2', 'pct'],
  }[difficulty] ?? ['add3', 'sub3', 'mul1', 'div1'];

  const kind = rng.pick(kinds);
  let a, b, answer, op;
  switch (kind) {
    case 'add2': a = rng.int(10, 99); b = rng.int(10, 99); op = '+'; answer = a + b; break;
    case 'sub2': a = rng.int(20, 99); b = rng.int(10, a); op = '−'; answer = a - b; break;
    case 'add3': a = rng.int(100, 999); b = rng.int(10, 999); op = '+'; answer = a + b; break;
    case 'sub3': a = rng.int(200, 999); b = rng.int(10, a); op = '−'; answer = a - b; break;
    case 'mul1': a = rng.int(12, 99); b = rng.int(2, 9); op = '×'; answer = a * b; break;
    case 'mul2': a = rng.int(12, 99); b = rng.int(11, 49); op = '×'; answer = a * b; break;
    case 'div1': b = rng.int(2, 9); answer = rng.int(3, 60); a = b * answer; op = '÷'; break;
    case 'div2': b = rng.int(11, 29); answer = rng.int(3, 40); a = b * answer; op = '÷'; break;
    case 'pct': {
      b = rng.pick([5, 10, 15, 20, 25, 30, 40, 50, 75]);
      a = rng.int(2, 40) * 20; // 20의 배수 → 모든 비율에서 정수 답
      answer = (a * b) / 100;
      return { text: `${a}의 ${b}%`, answer: String(answer) };
    }
  }
  return { text: `${a} ${op} ${b}`, answer: String(answer) };
}
