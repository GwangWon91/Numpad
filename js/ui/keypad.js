// 화면 넘패드: 입체 키캡, 누름·정답·오타 피드백, 목표 키 강조, 히트맵
import { KEYPAD } from '../core/keys.js';
import { h, replay } from './dom.js';

/**
 * @param {{size?: 'md'|'sm', heat?: Record<string, number>}} [opts]
 */
export function createKeypad(opts = {}) {
  const keys = new Map();
  const el = h(`div.keypad.keypad--${opts.size ?? 'md'}`, { role: 'img', 'aria-label': '넘패드' });

  for (const k of KEYPAD) {
    const cap = h(
      'div.keycap',
      {
        dataset: { token: k.token },
        style: {
          gridRow: `${k.row} / span ${k.rowSpan ?? 1}`,
          gridColumn: `${k.col} / span ${k.colSpan ?? 1}`,
        },
        class: [k.inert && 'is-inert', k.home && 'is-home', k.token === 'Enter' && 'is-small'].filter(Boolean).join(' '),
      },
      h('span.keycap__label', k.label),
    );
    keys.set(k.token, cap);
    el.append(cap);
  }

  const api = {
    el,
    /** 키가 눌린 모양 + 결과 색 */
    press(token, result = 'neutral') {
      const cap = keys.get(token);
      if (!cap) return;
      cap.classList.remove('is-good', 'is-bad');
      if (result !== 'neutral') cap.classList.add(result === 'good' ? 'is-good' : 'is-bad');
      replay(cap, 'is-pressed');
      clearTimeout(cap._t);
      cap._t = setTimeout(() => cap.classList.remove('is-pressed', 'is-good', 'is-bad'), 180);
    },
    /** 목표 키 강조 (없으면 해제) */
    setTarget(token) {
      for (const [t, cap] of keys) cap.classList.toggle('is-target', t === token);
    },
    /** 연습 범위 밖 키를 흐리게 */
    setPool(tokens) {
      for (const [t, cap] of keys) {
        if (t === 'NumLock') continue;
        cap.classList.toggle('is-dim', Boolean(tokens) && !tokens.includes(t));
      }
    },
    /** 히트맵: token → 0~1 오타율 */
    setHeat(heat) {
      for (const [t, cap] of keys) {
        const v = heat?.[t];
        cap.classList.toggle('has-heat', v !== undefined);
        cap.style.setProperty('--heat', v === undefined ? 0 : Math.min(1, v * 2.5).toFixed(3));
        cap.title = v === undefined ? '' : `오타율 ${(v * 100).toFixed(0)}%`;
      }
    },
  };
  if (opts.heat) api.setHeat(opts.heat);
  return api;
}
