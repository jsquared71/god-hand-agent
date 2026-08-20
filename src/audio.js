/**
 * Simple audio feedback using Web Audio API oscillators.
 * No external dependencies, just tasteful generated sounds.
 */

let audioContext = null;
let enabled = true;

function getContext() {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function setAudioEnabled(val) {
  enabled = val;
}

export function playFootstep() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);
  
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

export function playGather() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
  
  gain.gain.setValueAtTime(0.04, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

export function playBuild() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(523, ctx.currentTime);
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
  
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

let fireCrackle = null;

export function startFireCrackle() {
  if (!enabled) return;
  stopFireCrackle();
  
  const ctx = getContext();
  if (!ctx) return;
  
  // Soft low-frequency noise loop
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  
  const gain = ctx.createGain();
  gain.gain.value = 0.015;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  source.start();
  fireCrackle = { source, gain };
}

export function stopFireCrackle() {
  if (fireCrackle) {
    try {
      fireCrackle.source.stop();
    } catch (e) {
      // Already stopped
    }
    fireCrackle = null;
  }
}

export function playNightfall() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.8);
  
  gain.gain.setValueAtTime(0.04, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.8);
}
