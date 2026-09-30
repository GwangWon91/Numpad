// 결과 화면: 지표, 최고 기록 연출, 약한 키 히트맵, 다음 행동
import { MODES } from '../core/session.js';
import { FINGERS, labelOf } from '../core/keys.js';
import { weakKeys, formatDuration, formatPercent } from '../core/stats.js';
import { sfx } from '../core/sound.js';
import { h } from '../ui/dom.js';
import { createKeypad } from '../ui/keypad.js';
import { confetti } from '../ui/confetti.js';

const INPUT_GUARD_MS = 700; // 마지막 Enter 연타로 바로 재시작되지 않게

function headline(record, pbs) {
  if (pbs.includes('first')) return { emoji: '🌱', title: '첫 기록 완료!', sub: '이제부터 이 기록을 넘어서 봐요.' };
  if (pbs.includes('kpm')) return { emoji: '🎉', title: '최고 속도 갱신!', sub: '손이 넘패드를 기억하기 시작했어요.' };
  if (pbs.includes('maxCombo')) return { emoji: '🔥', title: '최고 콤보 갱신!', sub: '흐름을 끊지 않는 힘이 붙고 있어요.' };
  if (pbs.includes('accuracy')) return { emoji: '🎯', title: '최고 정확도 갱신!', sub: '정확함이 곧 속도가 됩니다.' };
  const a = record.accuracy;
  if (a >= 0.98) return { emoji: '✨', title: '거의 완벽해요', sub: '이제 속도를 조금 더 올려 봐요.' };
  if (a >= 0.93) return { emoji: '👍', title: '좋아요, 정확합니다', sub: '같은 리듬으로 한 번 더!' };
  if (a >= 0.85) return { emoji: '🙂', title: '조금만 더 정확하게', sub: '속도보다 정확도를 먼저 챙겨 봐요.' };
  return { emoji: '🐢', title: '천천히, 정확하게', sub: '키를 보지 말고 5번 돌기를 기준으로 찾아요.' };
}

// 정확도 등급: 속도보다 정확도를 먼저 챙기도록
export function gradeOf(accuracy) {
  if (accuracy >= 0.99) return 'S';
  if (accuracy >= 0.96) return 'A';
  if (accuracy >= 0.9) return 'B';
  return 'C';
}

export function resultScreen(ctx) {
  const { record, pbs } = ctx.lastResult;
  const mode = MODES[record.mode];
  const head = headline(record, pbs);
  const celebrate = pbs.length > 0 && !pbs.includes('first');

  const tile = (value, label, key) => h(`div.stat${pbs.includes(key) ? '.is-best' : ''}`, h('span.stat__value', value), h('span.stat__label', label));
  const tiles = h(
    'div.result__tiles',
    tile(String(record.kpm), '타/분', 'kpm'),
    tile(formatPercent(record.accuracy), mode.strict ? '정확도' : '정답률', 'accuracy'),
    tile(formatDuration(record.durationMs), '시간', null),
    tile(String(record.maxCombo), '최고 콤보', 'maxCombo'),
    mode.strict ? null : tile(`${record.solved}/${record.items}`, '맞힌 문제', null),
  );

  let weakSection = null;
  if (mode.strict) {
    const weak = weakKeys(record, 2);
    const heat = Object.fromEntries(weak.map((w) => [w.token, w.rate]));
    const worst = weak.filter((w) => w.misses > 0).slice(0, 3);
    weakSection = h(
      'section.card.result__weak',
      h('h2.card__title', '자주 틀린 키'),
      h(
        'div.result__weak-body',
        createKeypad({ size: 'sm', heat }).el,
        worst.length
          ? h(
              'ul.weak-list',
              worst.map((w) =>
                h(
                  'li',
                  h('span.kbd.weak-list__key', labelOf(w.token)),
                  h('span', FINGERS[w.token] ? `${FINGERS[w.token]} · ` : '', `오타율 ${Math.round(w.rate * 100)}%`),
                  h('span.weak-list__count', `${w.misses}/${w.attempts}`),
                ),
              ),
            )
          : h('p.result__clean', '틀린 키가 없어요. 깔끔합니다! ✨'),
      ),
    );
  }

  const retryBtn = h('button.btn.btn--primary.btn--lg', { type: 'button', onclick: retry }, '다시 하기', h('span.kbd', 'Enter'));
  const homeBtn = h('button.btn.btn--lg', { type: 'button', onclick: () => ctx.navigate('/') }, '홈', h('span.kbd', '0'));
  const histBtn = h('button.btn.btn--ghost.btn--lg', { type: 'button', onclick: () => ctx.navigate('/history') }, '기록 보기', h('span.kbd', '.'));

  const el = h(
    'div.screen.result',
    h(
      'section.result__head',
      h('div.result__emoji', head.emoji),
      h(`div.grade.grade--${gradeOf(record.accuracy)}`, { title: '정확도 등급 (S 99% · A 96% · B 90%)' }, gradeOf(record.accuracy)),
      h('h1.result__title', head.title),
      h('p.result__sub', `${mode.name} · ${head.sub}`),
    ),
    tiles,
    weakSection,
    h('div.result__actions', retryBtn, homeBtn, histBtn),
  );

  function retry() {
    ctx.navigate(`/play/${record.mode}`);
  }

  const openedAt = Date.now();
  if (celebrate) {
    setTimeout(() => {
      confetti();
      sfx.milestone();
    }, 250);
  }

  return {
    el,
    name: 'result',
    onKey(input) {
      if (Date.now() - openedAt < INPUT_GUARD_MS) return;
      if (input.kind === 'escape') return ctx.navigate('/');
      const t = input.token;
      if (t === 'Enter') retry();
      else if (t === '0') ctx.navigate('/');
      else if (t === '.') ctx.navigate('/history');
    },
  };
}
