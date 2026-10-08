// 앱 시작점: 공통 헤더, 해시 라우터, 전역 키 입력 분배
import { normalizeKey } from './core/input.js';
import { createStorage } from './core/storage.js';
import { setSoundEnabled } from './core/sound.js';
import { MODES } from './core/session.js';
import { h } from './ui/dom.js';
import { homeScreen } from './screens/home.js';
import { playScreen } from './screens/play.js';
import { resultScreen } from './screens/result.js';
import { historyScreen } from './screens/history.js';

const app = document.getElementById('app');
const storage = createStorage();
const THEMES = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };
const THEME_NAME = { auto: '시스템', light: '라이트', dark: '다크' };

const ctx = {
  storage,
  lastResult: null,
  navigate(path) {
    if (location.hash === `#${path}`) render();
    else location.hash = path;
  },
};

// ── 헤더 ───────────────────────────────
const soundBtn = h('button.btn.btn--ghost.btn--icon', { type: 'button', onclick: toggleSound });
const themeBtn = h('button.btn.btn--ghost.btn--icon', { type: 'button', onclick: cycleTheme });
const header = h(
  'header.topbar',
  h('a.brand', { href: '#/' }, h('span.brand__mark', { 'aria-hidden': 'true' }, Array.from({ length: 9 }, () => h('i'))), 'Numpad Dojo'),
  h('nav.topbar__actions', h('a.btn.btn--ghost', { href: '#/history' }, '기록'), soundBtn, themeBtn),
);
const view = h('div.view');
app.append(header, view);

function applySettings() {
  const { sound, theme } = storage.settings;
  setSoundEnabled(sound);
  soundBtn.textContent = sound ? '🔊' : '🔇';
  soundBtn.title = soundBtn.ariaLabel = sound ? '효과음 끄기' : '효과음 켜기';
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
  themeBtn.textContent = THEME_ICON[theme];
  themeBtn.title = themeBtn.ariaLabel = `테마: ${THEME_NAME[theme]}`;
}

function toggleSound() {
  storage.updateSettings({ sound: !storage.settings.sound });
  applySettings();
}

function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(storage.settings.theme) + 1) % THEMES.length];
  storage.updateSettings({ theme: next });
  applySettings();
}

// ── 라우터 ─────────────────────────────
let current = null;

function resolve(path) {
  const play = path.match(/^\/play\/(\w+)$/);
  if (play && MODES[play[1]]) return () => playScreen(ctx, play[1]);
  if (path === '/result' && ctx.lastResult) return () => resultScreen(ctx);
  if (path === '/history') return () => historyScreen(ctx);
  return () => homeScreen(ctx);
}

function render() {
  current?.destroy?.();
  document.querySelectorAll('.confetti').forEach((c) => c.remove());
  const path = location.hash.replace(/^#/, '') || '/';
  current = resolve(path)();
  view.replaceChildren(current.el);
  document.body.dataset.screen = current.name ?? '';
  document.activeElement?.blur?.();
  window.scrollTo(0, 0);
}

// ── 키 입력 ────────────────────────────
window.addEventListener('keydown', (e) => {
  const input = e.code === 'Escape' ? { kind: 'escape' } : normalizeKey(e, { topRow: storage.settings.topRow });
  if (input.kind === 'ignore') return;
  // 넘패드 키가 포커스된 버튼을 누르거나 브라우저 단축키(/ 빠른 찾기 등)를 실행하지 않도록 막는다
  if (input.kind !== 'escape') e.preventDefault();
  current?.onKey?.(input);
});

window.addEventListener('hashchange', render);
applySettings();
render();
