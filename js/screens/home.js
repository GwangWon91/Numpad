// 홈: 개인 최고, 모드 선택, 옵션, 워밍업 넘패드
import { MODES } from '../core/session.js';
import { LEVELS } from '../core/keys.js';
import { bestByMode, todaySummary, officialBest } from '../core/stats.js';
import { h } from '../ui/dom.js';
import { icon, badge } from '../ui/icons.js';
import { createKeypad } from '../ui/keypad.js';

const MODE_ORDER = ['keys', 'number', 'expr', 'calc'];
const MODE_CARD = {
  keys: { glyph: '5', desc: '강조된 키를 눌러 위치를 몸에 익혀요' },
  number: { glyph: '38.5', desc: '숫자를 정확히 치고 Enter' },
  expr: { glyph: '7*8+', desc: '연산자까지 수식 그대로 입력' },
  calc: { glyph: '=?', desc: '암산한 답을 바로 입력' },
};
const DIFFICULTIES = [
  { id: 'easy', name: '쉬움' },
  { id: 'normal', name: '보통' },
  { id: 'hard', name: '어려움' },
];

export function homeScreen(ctx) {
  const { storage } = ctx;
  let selected = MODE_ORDER.includes(storage.settings.lastMode) ? storage.settings.lastMode : 'keys';
  const bests = bestByMode(storage.sessions);
  const today = todaySummary(storage.sessions);
  const official = officialBest(storage.sessions);

  // ── 히어로 ──
  const warmup = createKeypad({ size: 'sm' });
  const warmupHint = h('p.warmup__hint', '넘패드를 눌러 보세요');
  const hero = h(
    'section.hero',
    h(
      'div.hero__text',
      h('h1.hero__title', '넘패드,', h('br'), h('span.hero__accent', '보지 않고 빠르게.')),
      h('p.hero__sub', '키 위치부터 빠른 계산까지.'),
      // 오늘 세션 수·연속 출석은 사용자 요청으로 숨김 (todaySummary·streakDays는 stats.js에 남아 있음)
      h(
        'div.hero__chips',
        h(
          `div.pb-card${official ? '' : '.is-empty'}`,
          { title: '개인 기록 기준: 수식 · 어려움 · 60초 타임어택 · 넘패드 숨김' },
          badge('medal', 'accent', 'pb-card__badge'),
          h('span.pb-card__text', h('span.pb-card__label', '개인 최고'), h('span.pb-card__rule', '수식 · 어려움 · 60초 · 넘패드 숨김')),
          official
            ? h('span.pb-card__score', h('strong.mono', (official.score ?? 0).toLocaleString('ko-KR')), '점')
            : h('span.pb-card__empty', '기록 도전으로 첫 기록을 남겨 보세요'),
        ),
        today.maxCombo ? h('span.chip', '오늘 최고 콤보 ', h('strong', `${today.maxCombo}`)) : null,
      ),
    ),
    h('div.warmup', warmup.el, warmupHint),
  );

  // ── 모드 카드 ──
  const cards = MODE_ORDER.map((id, i) => {
    const m = MODES[id];
    const best = bests[id];
    return h(
      'button.mode-card',
      { type: 'button', dataset: { mode: id }, onclick: () => (selected === id ? start() : select(id)) },
      h('span.mode-card__key.kbd', String(i + 1)),
      h('span.mode-card__glyph.mono', MODE_CARD[id].glyph),
      h('span.mode-card__name', m.name),
      h('span.mode-card__desc', MODE_CARD[id].desc),
      h('span.mode-card__best', best ? `연습 최고 ${best.kpm}타/분 · 콤보 ${best.maxCombo}` : '아직 기록 없음'),
    );
  });

  // ── 옵션 ──
  const optionRow = h('div.options__row');
  const lengthRow = h('div.options__row');
  const keypadRow = h('div.options__row');
  const topRowRow = h('div.options__row');
  const options = h('section.options.card', optionRow, lengthRow, keypadRow, topRowRow);

  function segment(label, hint, items, current, onPick) {
    return [
      h('span.options__label', label, hint ? h('span.options__hint', hint) : null),
      h(
        'div.segment',
        { role: 'group', 'aria-label': label },
        items.map((it) => h('button', { type: 'button', 'aria-pressed': String(it.id === current), onclick: () => onPick(it.id) }, it.name)),
      ),
    ];
  }

  function renderOptions() {
    const st = storage.settings;
    const m = MODES[selected];
    if (selected === 'keys') {
      optionRow.replaceChildren(
        ...segment('레벨', '+ −', LEVELS.map((l) => ({ id: l.id, name: `L${l.id} ${l.name}` })), st.level, (id) => update({ level: id })),
      );
      warmup.setPool(LEVELS.find((l) => l.id === st.level)?.tokens);
    } else {
      optionRow.replaceChildren(...segment('난이도', '+ −', DIFFICULTIES, st.difficulty, (id) => update({ difficulty: id })));
      warmup.setPool(null);
    }
    lengthRow.replaceChildren(
      ...segment('길이', '*', [
        { id: 'count', name: `${m.defaultCount}${m.unit}` },
        { id: 'time', name: '60초 타임어택' },
      ], st.lengthType, (id) => update({ lengthType: id })),
    );
    keypadRow.replaceChildren(
      ...segment('화면 넘패드', '/', [
        { id: true, name: '보기' },
        { id: false, name: '숨기기 (도전)' },
      ], st.showKeypad, (id) => update({ showKeypad: id })),
    );
    topRowRow.replaceChildren(
      ...segment('상단 숫자키', '.', [
        { id: false, name: '끄기' },
        { id: true, name: '켜기 (넘패드 없는 키보드)' },
      ], st.topRow, (id) => update({ topRow: id })),
    );
    for (const c of cards) c.classList.toggle('is-selected', c.dataset.mode === selected);
  }

  function update(patch) {
    storage.updateSettings(patch);
    renderOptions();
  }

  function select(id) {
    selected = id;
    storage.updateSettings({ lastMode: id });
    renderOptions();
  }

  function step(dir) {
    const st = storage.settings;
    if (selected === 'keys') {
      update({ level: Math.min(LEVELS.length, Math.max(1, st.level + dir)) });
    } else {
      const i = DIFFICULTIES.findIndex((d) => d.id === st.difficulty);
      update({ difficulty: DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, Math.max(0, i + dir))].id });
    }
  }

  function start() {
    storage.updateSettings({ lastMode: selected });
    ctx.navigate(`/play/${selected}`);
  }

  const startBtn = h('button.btn.btn--primary.btn--lg', { type: 'button', onclick: start }, '시작하기', h('span.kbd', 'Enter'));
  const challengeBtn = h('button.btn.btn--lg.home__challenge', { type: 'button', title: '수식 · 어려움 · 60초 · 넘패드 숨김', onclick: () => ctx.navigate('/challenge') }, '기록 도전');
  const legend = h(
    'p.home__legend',
    h('span.kbd', '1'), '–', h('span.kbd', '4'), ' 모드 ',
    h('span.kbd', '+'), h('span.kbd', '−'), ' 레벨·난이도 ',
    h('span.kbd', '*'), ' 길이 ',
    h('span.kbd', '/'), ' 넘패드 표시 ',
    h('span.kbd', '.'), ' 상단 숫자키 ',
    h('span.kbd', '0'), ' 기록',
  );

  const el = h(
    'div.screen.home',
    h('div.banner.touch-note', icon('keyboard'), '넘패드가 있는 키보드에서 연습하도록 만들어졌어요'),
    hero,
    h('section.modes', cards),
    options,
    h('div.home__start', h('div.home__buttons', startBtn, challengeBtn), legend),
  );
  renderOptions();

  let hintTimer;
  function warm(text, cls) {
    warmupHint.textContent = text;
    warmupHint.className = `warmup__hint ${cls ?? ''}`;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      warmupHint.textContent = '넘패드를 눌러 보세요';
      warmupHint.className = 'warmup__hint';
    }, 2200);
  }

  return {
    el,
    name: 'home',
    onKey(input) {
      if (input.kind === 'numLockOff') return warm('NumLock이 꺼져 있어요', 'is-warn');
      if (input.kind === 'notNumpad') {
        if (input.token === 'Enter') return start();
        return warm('오른쪽 넘패드로 눌러 주세요', 'is-warn');
      }
      if (input.kind !== 'key') return;
      const t = input.token;
      warmup.press(t, 'good');
      warm('좋아요! 넘패드 인식됨', 'is-good');
      if (/^[1-4]$/.test(t)) select(MODE_ORDER[Number(t) - 1]);
      else if (t === '+') step(1);
      else if (t === '-') step(-1);
      else if (t === '*') update({ lengthType: storage.settings.lengthType === 'time' ? 'count' : 'time' });
      else if (t === '/') update({ showKeypad: !storage.settings.showKeypad });
      else if (t === '.') update({ topRow: !storage.settings.topRow });
      else if (t === '0') ctx.navigate('/history');
      else if (t === 'Enter') start();
    },
    destroy() {
      clearTimeout(hintTimer);
    },
  };
}
