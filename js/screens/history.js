// 기록 화면: 추이 그래프, 모드별 최고 기록, 누적 약한 키, 최근 세션, 내보내기
import { MODES } from '../core/session.js';
import { bestByMode, weakKeys, series, streakDays, formatDuration, formatPercent } from '../core/stats.js';
import { h } from '../ui/dom.js';
import { lineChart } from '../ui/chart.js';
import { createKeypad } from '../ui/keypad.js';

const FILTERS = [
  { id: null, name: '전체', key: '0' },
  { id: 'keys', name: MODES.keys.short, key: '1' },
  { id: 'number', name: MODES.number.short, key: '2' },
  { id: 'expr', name: MODES.expr.short, key: '3' },
  { id: 'calc', name: MODES.calc.short, key: '4' },
];

export function historyScreen(ctx) {
  const { storage } = ctx;
  let filter = null;

  const tabs = h('div.segment', { role: 'group', 'aria-label': '모드 필터' });
  const body = h('div.history__body');

  function render() {
    tabs.replaceChildren(
      ...FILTERS.map((f) =>
        h('button', { type: 'button', 'aria-pressed': String(f.id === filter), onclick: () => setFilter(f.id) }, f.name),
      ),
    );
    const all = storage.sessions;
    const list = filter ? all.filter((s) => s.mode === filter) : all;

    if (all.length === 0) {
      body.replaceChildren(
        h('div.empty.card', h('div.empty__emoji', '🗒️'), h('p', '아직 기록이 없어요.'), h('p.empty__sub', '홈에서 연습을 시작하면 여기에 쌓입니다.'),
          h('button.btn.btn--primary', { type: 'button', onclick: () => ctx.navigate('/') }, '연습하러 가기')),
      );
      return;
    }

    const points = series(all, filter, 30);
    const chartCard = h(
      'section.card',
      h('div.history__chart-head', h('h2.card__title', `최근 ${points.length}세션 추이`), h('div.legend', h('span', '타/분'), h('span.is-acc', '정확도'))),
      points.length ? lineChart(points) : h('p.empty__sub', '이 모드의 기록이 아직 없어요.'),
    );

    const bests = bestByMode(all);
    const bestCards = h(
      'section.history__bests',
      Object.values(MODES).map((m) => {
        const b = bests[m.id];
        return h(
          `div.best-card${filter === m.id ? '.is-active' : ''}`,
          h('span.best-card__name', m.name),
          b
            ? [h('span.best-card__kpm.mono', String(b.kpm), h('small', ' 타/분')), h('span.best-card__meta', `정확도 ${formatPercent(b.accuracy)} · 콤보 ${b.maxCombo} · ${b.count}회`)]
            : h('span.best-card__meta', '기록 없음'),
        );
      }),
    );

    const strict = list.filter((s) => MODES[s.mode]?.strict);
    const weak = weakKeys(strict, 5);
    const heatCard = strict.length
      ? h(
          'section.card.history__heat',
          h('h2.card__title', '누적 약한 키'),
          createKeypad({ size: 'sm', heat: Object.fromEntries(weak.map((w) => [w.token, w.rate])) }).el,
          h('p.empty__sub', weak.find((w) => w.misses > 0) ? `가장 약한 키: ${weak[0].token} (오타율 ${Math.round(weak[0].rate * 100)}%)` : '약한 키가 없어요!'),
        )
      : null;

    const recent = h(
      'section.card.history__recent',
      h('h2.card__title', '최근 세션'),
      h(
        'table.sessions',
        h('thead', h('tr', ['날짜', '모드', '타/분', '정확도', '콤보', '시간'].map((t) => h('th', t)))),
        h(
          'tbody',
          list.slice(-12).reverse().map((s) =>
            h(
              'tr',
              h('td', new Date(s.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
              h('td', MODES[s.mode]?.short ?? s.mode),
              h('td.mono', String(s.kpm)),
              h('td.mono', formatPercent(s.accuracy)),
              h('td.mono', String(s.maxCombo)),
              h('td.mono', formatDuration(s.durationMs)),
            ),
          ),
        ),
      ),
    );

    body.replaceChildren(chartCard, bestCards, h('div.history__grid', heatCard, recent));
  }

  function setFilter(id) {
    filter = id;
    render();
  }

  function exportJson() {
    const blob = new Blob([storage.exportJSON()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `numpad-dojo-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function reset() {
    if (confirm('모든 연습 기록을 지울까요? 되돌릴 수 없습니다.')) {
      storage.clearSessions();
      render();
    }
  }

  const streak = streakDays(storage.sessions);
  const el = h(
    'div.screen.history',
    h(
      'div.history__head',
      h('div', h('h1.page-title', '기록'), h('p.page-sub', `총 ${storage.sessions.length}세션 · 🔥 연속 ${streak}일`)),
      tabs,
    ),
    body,
    h(
      'div.history__tools',
      h('button.btn.btn--ghost', { type: 'button', onclick: exportJson }, 'JSON 내보내기'),
      h('button.btn.btn--ghost.btn--danger', { type: 'button', onclick: reset }, '기록 초기화'),
    ),
  );
  render();

  return {
    el,
    name: 'history',
    onKey(input) {
      if (input.kind === 'escape') return ctx.navigate('/');
      const f = FILTERS.find((x) => x.key === input.token);
      if (f) setFilter(f.id);
      else if (input.token === 'Enter' || input.token === '.') ctx.navigate('/');
    },
  };
}
