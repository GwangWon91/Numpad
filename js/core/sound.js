// Web Audio 효과음 (음원 파일 없음). 첫 키 입력 이후에 오디오를 연다.

let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

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

// 펜타토닉 음계: 콤보가 오를수록 음이 올라간다
const SCALE = [0, 2, 4, 7, 9];
function comboFreq(combo) {
  const step = Math.min(combo, 24);
  const octave = Math.floor(step / SCALE.length);
  const semis = SCALE[step % SCALE.length] + octave * 12;
  return 523.25 * 2 ** (semis / 12);
}

export const sfx = {
  hit(combo = 0) {
    tone(comboFreq(combo), { dur: 0.06, gain: 0.05 });
  },
  miss() {
    tone(140, { dur: 0.12, type: 'square', gain: 0.04 });
  },
  item() {
    tone(784, { dur: 0.08, gain: 0.05 });
    tone(1046.5, { at: 0.06, dur: 0.12, gain: 0.05 });
  },
  milestone() {
    [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, { at: i * 0.05, dur: 0.12, type: 'triangle', gain: 0.06 }));
  },
  finish() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.22, type: 'triangle', gain: 0.07 }));
  },
};
