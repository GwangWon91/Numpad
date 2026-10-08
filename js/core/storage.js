// localStorage 저장소. 저장소가 막혀 있어도 메모리로 계속 동작한다.

export const STORAGE_KEY = 'numpad.v1';
export const MAX_SESSIONS = 500;

export function defaultState() {
  return {
    version: 1,
    settings: { sound: true, theme: 'auto', showKeypad: true, lengthType: 'count', difficulty: 'normal', level: 1, topRow: false },
    sessions: [],
  };
}

function migrate(data) {
  const base = defaultState();
  if (!data || typeof data !== 'object' || data.version !== 1) return base;
  return {
    version: 1,
    settings: { ...base.settings, ...(data.settings ?? {}) },
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
  };
}

/** @param {Storage | undefined} backend */
export function createStorage(backend = globalThis.localStorage) {
  let state;
  try {
    state = migrate(JSON.parse(backend?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    state = defaultState();
  }

  function persist() {
    try {
      backend?.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  return {
    get settings() {
      return state.settings;
    },
    get sessions() {
      return state.sessions;
    },
    addSession(record) {
      const withId = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...record };
      state.sessions.push(withId);
      if (state.sessions.length > MAX_SESSIONS) state.sessions.splice(0, state.sessions.length - MAX_SESSIONS);
      persist();
      return withId;
    },
    updateSettings(patch) {
      Object.assign(state.settings, patch);
      persist();
    },
    clearSessions() {
      state.sessions = [];
      persist();
    },
    exportJSON() {
      return JSON.stringify(state, null, 2);
    },
  };
}
