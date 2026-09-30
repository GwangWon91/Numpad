// 넘패드 키 정의: 토큰, 라벨, 격자 위치(행/열/병합), 레벨, 권장 손가락

// 표준 풀사이즈 넘패드 배열 (4열 × 5행)
export const KEYPAD = [
  { token: 'NumLock', label: 'Num', row: 1, col: 1, inert: true },
  { token: '/', label: '/', row: 1, col: 2 },
  { token: '*', label: '*', row: 1, col: 3 },
  { token: '-', label: '−', row: 1, col: 4 },
  { token: '7', label: '7', row: 2, col: 1 },
  { token: '8', label: '8', row: 2, col: 2 },
  { token: '9', label: '9', row: 2, col: 3 },
  { token: '+', label: '+', row: 2, col: 4, rowSpan: 2 },
  { token: '4', label: '4', row: 3, col: 1 },
  { token: '5', label: '5', row: 3, col: 2, home: true },
  { token: '6', label: '6', row: 3, col: 3 },
  { token: '1', label: '1', row: 4, col: 1 },
  { token: '2', label: '2', row: 4, col: 2 },
  { token: '3', label: '3', row: 4, col: 3 },
  { token: 'Enter', label: 'Enter', row: 4, col: 4, rowSpan: 2 },
  { token: '0', label: '0', row: 5, col: 1, colSpan: 2 },
  { token: '.', label: '.', row: 5, col: 3 },
];

export const ALL_TOKENS = KEYPAD.filter((k) => !k.inert).map((k) => k.token);

// 키 위치 익히기 레벨: 홈 행에서 시작해 점점 넓힌다
export const LEVELS = [
  { id: 1, name: '홈 행', desc: '4 5 6', tokens: ['4', '5', '6'] },
  { id: 2, name: '위·아래 행', desc: '+ 7 8 9 1 2 3', tokens: ['4', '5', '6', '7', '8', '9', '1', '2', '3'] },
  { id: 3, name: '0과 소수점', desc: '+ 0 .', tokens: ['4', '5', '6', '7', '8', '9', '1', '2', '3', '0', '.'] },
  { id: 4, name: '전체', desc: '+ / * − + Enter', tokens: ALL_TOKENS },
];

// 권장 손가락 배치 (오른손 기준)
export const FINGERS = {
  '7': '검지', '4': '검지', '1': '검지',
  '8': '중지', '5': '중지', '2': '중지', '/': '중지',
  '9': '약지', '6': '약지', '3': '약지', '.': '약지', '*': '약지',
  '-': '새끼', '+': '새끼', Enter: '새끼',
  '0': '엄지',
};

export function labelOf(token) {
  return KEYPAD.find((k) => k.token === token)?.label ?? token;
}
