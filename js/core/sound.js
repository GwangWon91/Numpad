// Web Audio 효과음 (음원 파일 없음). 첫 키 입력 이후에 오디오를 연다.
// 연속성은 음높이 상승이 아니라 리듬(4박 강세)과 악기 레이어로 표현한다.

let ctx = null;
let noiseBuf = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

// ── 순수 함수: 음 선택과 레이어 (테스트 대상) ──
const C5 = 523.25;
// 한 옥타브 펜타토닉을 올라갔다 내려오는 프레이즈 → 최고음은 C6로 고정
const PHRASE = [0, 2, 4, 7, 9, 12, 9, 7, 4, 2];
export const MAX_NOTE_HZ = C5 * 2;

/** 프레이즈 위치 → { freq, accent } */
export function noteFor(step) {
  const i = ((step % PHRASE.length) + PHRASE.length) % PHRASE.length;
  return { freq: C5 * 2 ** (PHRASE[i] / 12), accent: step % 4 === 0 };
}

/** 콤보 → 추가 레이어 */
export function layersFor(combo) {
  return {
    hat: combo >= 10,
    bass: combo >= 25,
    fifth: combo >= 50,
  };
}

// ── 오디오 ──
function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { at = 0, dur = 0.08, type = 'sine', gain = 0.08 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// 짧은 하이햇: 고역 통과 필터를 거친 노이즈
function hat(gain = 0.025) {
  const ac = audio();
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  const hp = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = noiseBuf;
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(hp).connect(g).connect(ac.destination);
  src.start(t);
}

export const sfx = {
  /**
   * 정타음. step: 프레이즈 위치(문항마다 0부터), combo: 레이어 결정
   * soft: 계산 모드 타이핑처럼 여리게
   */
  hit(step = 0, combo = 0, { soft = false } = {}) {
    const { freq, accent } = noteFor(step);
    const layers = layersFor(combo);
    const v = soft ? 0.5 : 1;
    tone(freq, { dur: accent ? 0.1 : 0.06, gain: (accent ? 0.07 : 0.04) * v });
    if (accent) tone(C5 / 2, { dur: 0.09, type: 'triangle', gain: 0.035 * v });
    if (layers.hat) hat(0.02 * v);
    if (layers.bass && accent) tone(C5 / 4, { dur: 0.16, type: 'triangle', gain: 0.07 * v });
    if (layers.fifth) tone(freq * 1.5 > MAX_NOTE_HZ ? freq * 0.75 : freq * 1.5, { dur: 0.06, gain: 0.02 * v });
  },
  miss() {
    tone(140, { dur: 0.12, type: 'square', gain: 0.04 });
  },
  item() {
    tone(784, { dur: 0.08, gain: 0.05 });
    tone(1046.5, { at: 0.06, dur: 0.12, gain: 0.05 });
  },
  milestone() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.05, dur: 0.12, type: 'triangle', gain: 0.06 }));
  },
  finish() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.22, type: 'triangle', gain: 0.07 }));
  },
};
