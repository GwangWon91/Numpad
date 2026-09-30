// KeyboardEvent → 넘패드 토큰 정규화 (순수 함수)
// code를 기준으로 판정해 상단 숫자키(Digit5)와 넘패드(Numpad5)를 구분한다.

const NUMPAD_CODES = {
  Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
  Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9',
  NumpadDecimal: '.',
  NumpadAdd: '+',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadEnter: 'Enter',
  Backspace: 'Back',
};

// 넘패드 대신 쓰기 쉬운 메인 키보드 키
const MAIN_CODES = {
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  Period: '.', Minus: '-', Slash: '/', Enter: 'Enter',
};

// NumLock이 켜져 있으면 숫자·소수점 키가 문자를 낸다
const NUMLOCK_SENSITIVE = /^Numpad[0-9]$|^NumpadDecimal$/;
const NUMLOCK_ON_KEYS = /^[0-9.,]$/;

/**
 * @param {{code: string, key: string, repeat?: boolean, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean}} e
 * @returns {{kind: 'key'|'notNumpad'|'numLockOff'|'numLockToggle'|'ignore', token?: string}}
 */
export function normalizeKey(e) {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return { kind: 'ignore' };
  if (e.code === 'NumLock') return { kind: 'numLockToggle' };

  const token = NUMPAD_CODES[e.code];
  if (token) {
    if (NUMLOCK_SENSITIVE.test(e.code) && !NUMLOCK_ON_KEYS.test(e.key)) {
      return { kind: 'numLockOff', token };
    }
    return { kind: 'key', token };
  }

  const main = MAIN_CODES[e.code];
  if (main) return { kind: 'notNumpad', token: main };
  return { kind: 'ignore' };
}
