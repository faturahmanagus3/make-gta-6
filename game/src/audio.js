// audio.js - every sound in Neon Harbor is synthesized with WebAudio:
// engine hum, police siren, gunshots, pickups, impacts and UI clicks.
// No audio files, no network. Press M to mute.

export function createAudio() {
  return { ctx: null, muted: false, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null, sirenOn: false };
}

export function ensureAudio(audio) {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineGain = audio.ctx.createGain();
    audio.engineOsc.type = 'sawtooth'; audio.engineOsc.frequency.value = 55;
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineGain).connect(audio.ctx.destination);
    audio.engineOsc.start();
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenOsc.type = 'triangle'; audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain).connect(audio.ctx.destination);
    audio.sirenOsc.start();
  } catch { audio.ctx = null; }
}

function tone(audio, freq, dur, type = 'square', vol = 0.12, slideTo = 0) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator(), gain = audio.ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(audio.ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noiseBurst(audio, dur, vol, filterFreq) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource(); src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterFreq;
  const gain = audio.ctx.createGain(); gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(audio.ctx.destination);
  src.start(t);
}

export function playGunshot(audio) { noiseBurst(audio, 0.14, 0.30, 2600); tone(audio, 160, 0.08, 'square', 0.10, 50); }
export function playPickup(audio) { tone(audio, 660, 0.09, 'sine', 0.14); setTimeout(() => tone(audio, 990, 0.13, 'sine', 0.14), 70); }
export function playCash(audio) { tone(audio, 880, 0.08, 'triangle', 0.16); setTimeout(() => tone(audio, 1320, 0.16, 'triangle', 0.16), 80); }
export function playCrash(audio) { noiseBurst(audio, 0.22, 0.24, 700); }
export function playUiClick(audio) { tone(audio, 520, 0.05, 'sine', 0.10); }
export function playWasted(audio) { tone(audio, 220, 0.7, 'sawtooth', 0.14, 55); }
export function playMissionDone(audio) { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(audio, f, 0.16, 'triangle', 0.15), i * 95)); }

export function updateAudio(audio, { driving, speedRatio, wanted, dt }) {
  if (!audio.ctx) return;
  const target = audio.muted ? 0 : driving ? 0.028 + speedRatio * 0.05 : 0;
  audio.engineGain.gain.value += (target - audio.engineGain.gain.value) * Math.min(1, dt * 8);
  audio.engineOsc.frequency.value = 52 + speedRatio * 95;
  const sirenWanted = wanted > 0 && !audio.muted;
  if (sirenWanted) {
    audio.sirenGain.gain.value = 0.016;
    audio.sirenOsc.frequency.value = 720 + Math.sin(performance.now() / 210) * 190;
  } else audio.sirenGain.gain.value = 0;
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.engineGain) audio.engineGain.gain.value = 0;
  if (audio.sirenGain) audio.sirenGain.gain.value = 0;
  return audio.muted;
}
