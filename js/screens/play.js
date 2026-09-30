// 연습 화면: 문제 표시, 판정 피드백, 콤보, HUD, 경고
import { createSession, MODES, TIME_ATTACK_MS } from '../core/session.js';
import { FINGERS, LEVELS, labelOf } from '../core/keys.js';
import { personalBests, formatDuration, formatPercent } from '../core/stats.js';
import { sfx } from '../core/sound.js';
import { h, replay } from '../ui/dom.js';
import { createKeypad } from '../ui/keypad.js';

const MILESTONES = new Set([10, 25, 50, 75, 100, 150, 200, 300, 500]);
const DIFF_NAME = { easy: '쉬움', normal: '보통', hard: '어려움' };

export function playScreen(ctx, modeId) {
  const { storage } = ctx;
  const st = storage.settings;
  const mode = MODES[modeId];
  const length = st.lengthType === 'time' ? { type: 'time', value: TIME_ATTACK_MS } : { type: 'count', value: mode.defaultCount };
  const session = createSession({ mode: modeId, level: st.level, difficulty: st.difficulty, length, seed: Date.now() });
  const s = session.state;
  const now = () => Date.now();

  // ── HUD ──
  const timerEl = h('strong.mono', length.type === 'time' ? formatDuration(length.value) : '0:00');
  const accEl = h('strong.mono', '—');
  const scoreEl = h('strong.mono', '0');
  const speedEl = h('strong.mono', '—');
  const speedUnit = mode.strict ? '타/분' : '초/문제';
  const progEl = h('strong.mono', length.type === 'count' ? `0/${length.value}` : '');
  const bar = h('div.progress__fill');
  const detail = modeId === 'keys' ? `L${st.level} ${LEVELS.find((l) => l.id === st.level)?.name ?? ''}` : DIFF_NAME[st.difficulty];
  const hud = h(
    'div.hud',
    h('button.btn.btn--ghost', { type: 'button', onclick: () => ctx.navigate('/') }, '← ', h('span.kbd', 'Esc')),
    h('div.hud__title', h('strong', mode.name), h('span.chip', detail), length.type === 'time' ? h('span.chip', '⏱ 타임어택') : null),
    h(
      'div.hud__stats',
      h('span.hud__score', { title: '점수 = 정타마다 기본점 × 속도 × 콤보 배율' }, scoreEl, h('small', '점')),
      h('span.hud__stat', '⏱ ', timerEl),
      h('span.hud__stat', { title: mode.strict ? '맞힌 키 / 분' : '문제당 평균 시간' }, '⚡ ', speedEl, h('small', ` ${speedUnit}`)),
      h('span.hud__stat', '✓ ', accEl),
      length.type === 'count' ? h('span.hud__stat', progEl) : null,
    ),
  );
  const progress = h('div.progress', bar);

  // ── 무대 ──
  const prompt = h('div.prompt');
  const comboEl = h('div.combo', { 'aria-live': 'off' });
  const burst = h('div.burst', { 'aria-hidden': 'true' });
  const gain = h('div.gain', { 'aria-hidden': 'true' });
  const hint = h('p.play__hint', '첫 키를 누르면 시작합니다 · 타이머는 첫 키부터');
  const banner = h('div.play__banner', { role: 'status', 'aria-live': 'polite' });
  const keypad = st.showKeypad ? createKeypad() : null;
  if (keypad && modeId === 'keys') keypad.setPool(LEVELS.find((l) => l.id === st.level)?.tokens);

  const el = h(
    `div.screen.play.play--${modeId}`,
    hud,
    progress,
    h('div.stage', prompt, h('div.combo-wrap', gain, comboEl, burst)),
    banner,
    keypad ? h('div.play__keypad', keypad.el) : null,
    hint,
  );

  // ── 문제 렌더링 ──
  let chars = [];
  let answerEl = null;
  let finished = false;
  let phraseStep = 0; // 효과음 프레이즈 위치: 문항마다 처음부터

  function renderItem() {
    const item = s.item;
    phraseStep = 0;
    prompt.replaceChildren();
    if (modeId === 'keys') {
      const t = item.target[0];
      prompt.append(
        h('div.prompt__key.mono', labelOf(t)),
        h('div.prompt__finger', FINGERS[t] ? `${FINGERS[t]}` : ''),
      );
    } else if (modeId === 'calc') {
      answerEl = h('span.answer.mono', { dataset: { empty: 'true' } });
      prompt.append(h('div.prompt__calc.mono', h('span', item.display), h('span.prompt__eq', '='), answerEl));
    } else {
      chars = item.target.map((t) =>
        h(`span.char${/[0-9.]/.test(t) ? '' : '.is-op'}${t === 'Enter' ? '.is-enter' : ''}`, t === 'Enter' ? '⏎' : labelOf(t)),
      );
      prompt.append(h('div.prompt__line.mono', chars));
      markCursor();
    }
    replay(prompt, 'is-new');
    updateTarget();
  }

  function markCursor() {
    const pos = s.item.pos;
    chars.forEach((c, i) => {
      c.classList.toggle('is-done', i < pos);
      c.classList.toggle('is-current', i === pos);
    });
  }

  function updateTarget() {
    if (!keypad) return;
    if (modeId === 'calc') keypad.setTarget(null);
    else keypad.setTarget(s.item.target[s.item.pos]);
  }

  // ── HUD 갱신 ──
  function updateHud() {
    const t = now();
    timerEl.textContent = formatDuration(length.type === 'time' ? session.remaining(t) : session.elapsed(t));
    const judged = mode.strict ? s.hits + s.misses : s.submitted;
    accEl.textContent = judged ? formatPercent(mode.strict ? s.hits / judged : s.solved / judged) : '—';
    scoreEl.textContent = s.score.toLocaleString('ko-KR');
    const minutes = session.elapsed(t) / 60_000;
    if (mode.strict) speedEl.textContent = s.hits && minutes > 0.02 ? String(Math.round(s.hits / minutes)) : '—';
    else speedEl.textContent = s.submitted ? (session.elapsed(t) / s.submitted / 1000).toFixed(1) : '—';
    if (length.type === 'count') {
      progEl.textContent = `${s.itemsDone}/${length.value}`;
      bar.style.transform = `scaleX(${s.itemsDone / length.value})`;
    } else {
      bar.style.transform = `scaleX(${session.elapsed(t) / length.value})`;
      timerEl.parentElement.classList.toggle('is-urgent', session.remaining(t) <= 10_000 && s.startedAt !== null);
    }
  }

  function updateCombo(combo) {
    if (combo < 2) {
      comboEl.className = 'combo';
      comboEl.textContent = '';
      return;
    }
    comboEl.replaceChildren(h('span.combo__fire', '🔥'), h('span.combo__n.mono', String(combo)), h('span.combo__label', '콤보'));
    comboEl.className = `combo is-on${combo >= 25 ? ' is-hot' : ''}${combo >= 50 ? ' is-blazing' : ''}`;
    replay(comboEl, 'is-pop');
    if (MILESTONES.has(combo)) {
      sfx.milestone();
      burst.textContent = `${combo} COMBO!`;
      replay(burst, 'is-on');
      replay(progress, 'is-flash');
    }
  }

  // 정타 점수 팝업: 콤보 왼쪽에 +점수, 목표보다 훨씬 빠르면 ⚡
  function showGain(ev) {
    if (!ev.points) return;
    gain.textContent = `+${ev.points}${ev.speed >= 1.5 ? ' ⚡' : ''}`;
    gain.classList.toggle('is-fast', ev.speed >= 1.5);
    replay(gain, 'is-on');
    replay(scoreEl, 'is-bump');
  }

  let bannerTimer;
  function warn(text) {
    banner.replaceChildren(h('div.banner', '⚠ ', text));
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.replaceChildren(), 2600);
  }

  // ── 종료 ──
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(ticker);
    if (s.startedAt === null) {
      ctx.navigate('/');
      return;
    }
    const record = session.summary();
    const pbs = personalBests(storage.sessions, record);
    const saved = storage.addSession(record);
    ctx.lastResult = { record: saved, pbs };
    sfx.finish();
    el.classList.add('is-finished');
    setTimeout(() => ctx.navigate('/result'), 350);
  }

  const ticker = setInterval(() => {
    if (session.tick(now())) finish();
    updateHud();
  }, 100);

  function handle(ev, token) {
    switch (ev.type) {
      case 'hit':
        keypad?.press(token, 'good');
        sfx.hit(phraseStep++, ev.combo);
        markCursor();
        updateTarget();
        updateCombo(ev.combo);
        showGain(ev);
        break;
      case 'miss':
        keypad?.press(token, 'bad');
        sfx.miss();
        replay(prompt, 'is-miss');
        chars[s.item.pos]?.classList.add('is-wrong');
        updateCombo(0);
        break;
      case 'item':
        keypad?.press(token, 'good');
        // 키 위치 모드는 한 키가 한 문항이라 콤보로 프레이즈를 이어 간다(음은 한 옥타브 안에서 순환)
        if (modeId === 'keys') sfx.hit(ev.combo - 1, ev.combo);
        else sfx.item();
        updateCombo(ev.combo);
        showGain(ev);
        if (ev.end) finish();
        else renderItem();
        break;
      case 'typed':
        keypad?.press(token);
        if (token !== 'Back') sfx.hit(phraseStep++, s.combo, { soft: true });
        answerEl.textContent = ev.typed;
        answerEl.dataset.empty = String(ev.typed === '');
        break;
      case 'solved':
      case 'wrong': {
        const ok = ev.type === 'solved';
        keypad?.press('Enter', ok ? 'good' : 'bad');
        ok ? sfx.item() : sfx.miss();
        updateCombo(ev.combo);
        showGain(ev);
        // 판정 결과를 잠깐 보여 준 뒤 다음 문제
        answerEl.classList.add(ok ? 'is-good' : 'is-bad');
        if (!ok) answerEl.after(h('span.answer__correct.mono', `정답 ${ev.answer}`));
        if (ok) prompt.firstChild.classList.add('is-leaving');
        if (ev.end) finish();
        else {
          lock = true;
          setTimeout(() => {
            lock = false;
            if (!finished) renderItem();
          }, ok ? 180 : 650);
        }
        break;
      }
      case 'end':
        finish();
        break;
    }
    hint.classList.add('is-hidden');
    updateHud();
  }

  let lock = false;
  renderItem();
  updateHud();

  return {
    el,
    name: 'play',
    onKey(input) {
      if (finished) return;
      if (input.kind === 'escape') return ctx.navigate('/');
      if (input.kind === 'numLockOff') return warn('NumLock이 꺼져 있어요. NumLock 키를 눌러 켜 주세요');
      if (input.kind === 'notNumpad') return warn('상단 숫자키 대신 오른쪽 넘패드로 입력해 주세요');
      if (input.kind === 'numLockToggle') return banner.replaceChildren();
      if (input.kind !== 'key' || lock) return;
      handle(session.press(input.token, now()), input.token);
    },
    destroy() {
      clearInterval(ticker);
      clearTimeout(bannerTimer);
    },
  };
}
