/**
 * Natural camp/world audio using Web Audio API synthesis.
 * No external dependencies, just layered noise and filtered tones.
 */

let audioContext = null;
let enabled = true;
let noiseBuffer = null;
let pinkNoiseBuffer = null;
let lastFootstepTime = {};

function getContext() {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    audioContext = new AudioContext();
    
    // Resume on first user interaction (browsers start suspended)
    const resume = () => {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    };
    
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }
  return audioContext;
}

function createNoiseBuffer(ctx, duration = 0.5, pink = false) {
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  
  if (pink) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
  }
  
  return buffer;
}

function ensureNoiseBuffers() {
  const ctx = getContext();
  if (!ctx) return;
  if (!noiseBuffer) noiseBuffer = createNoiseBuffer(ctx, 0.3, false);
  if (!pinkNoiseBuffer) pinkNoiseBuffer = createNoiseBuffer(ctx, 0.5, true);
}

export function setAudioEnabled(val) {
  enabled = val;
}

export function playFootstep(agentId = 'default', biome = 'meadow') {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  // Rate-limit per agent (prevent machine-gun steps)
  const now = ctx.currentTime;
  if (lastFootstepTime[agentId] && (now - lastFootstepTime[agentId]) < 0.15) {
    return;
  }
  lastFootstepTime[agentId] = now;
  
  // Randomize pitch and gain for variety
  const pitchVar = 0.85 + Math.random() * 0.3;
  const gainVar = 0.8 + Math.random() * 0.4;
  
  // Filtered noise burst (dirt/grass crunch)
  const noise = ctx.createBufferSource();
  noise.buffer = pinkNoiseBuffer;
  
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = biome === 'rock' ? 'highpass' : 'bandpass';
  noiseFilter.frequency.value = (biome === 'rock' ? 800 : 400) * pitchVar;
  noiseFilter.Q.value = biome === 'rock' ? 2.0 : 1.5;
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime((biome === 'meadow' ? 0.04 : 0.05) * gainVar, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noise.start(now);
  noise.stop(now + 0.1);
  
  // Low thump (weight)
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(90 * pitchVar, now);
  thump.frequency.exponentialRampToValueAtTime(35 * pitchVar, now + 0.06);
  
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.025 * gainVar, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  
  thump.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  
  thump.start(now);
  thump.stop(now + 0.1);
}

export function playGather(harvestType = 'berry') {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  const now = ctx.currentTime;
  const pitchVar = 0.9 + Math.random() * 0.2;
  const gainVar = 0.85 + Math.random() * 0.3;
  
  // Different sounds for different harvest types
  const isWood = harvestType === 'wood';
  const isStone = harvestType === 'stone' || harvestType === 'ore';
  const isSoft = harvestType === 'berry' || harvestType === 'grain';
  
  if (isWood || isStone) {
    // Knock/tap: filtered noise + low tone
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (isStone ? 1200 : 600) * pitchVar;
    filter.Q.value = 2.5;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime((isStone ? 0.06 : 0.05) * gainVar, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(now);
    noise.stop(now + 0.15);
    
    // Low knock
    const knock = ctx.createOscillator();
    knock.type = 'sine';
    knock.frequency.setValueAtTime((isStone ? 280 : 180) * pitchVar, now);
    knock.frequency.exponentialRampToValueAtTime((isStone ? 200 : 120) * pitchVar, now + 0.08);
    
    const knockGain = ctx.createGain();
    knockGain.gain.setValueAtTime(0.02 * gainVar, now);
    knockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    knock.connect(knockGain);
    knockGain.connect(ctx.destination);
    
    knock.start(now);
    knock.stop(now + 0.12);
    
  } else {
    // Soft rustle: high-frequency filtered noise
    const noise = ctx.createBufferSource();
    noise.buffer = pinkNoiseBuffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800 * pitchVar;
    filter.Q.value = 1.0;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03 * gainVar, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(now);
    noise.stop(now + 0.12);
  }
}

export function playBuild() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  const now = ctx.currentTime;
  const pitchVar = 0.95 + Math.random() * 0.1;
  
  // Two wood knocks
  for (let i = 0; i < 2; i++) {
    const delay = i * 0.12;
    
    // Filtered noise (wood texture)
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700 * pitchVar;
    filter.Q.value = 2.0;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.04, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(now + delay);
    noise.stop(now + delay + 0.12);
    
    // Low knock tone
    const knock = ctx.createOscillator();
    knock.type = 'sine';
    knock.frequency.setValueAtTime(150 * pitchVar, now + delay);
    knock.frequency.exponentialRampToValueAtTime(90 * pitchVar, now + delay + 0.08);
    
    const knockGain = ctx.createGain();
    knockGain.gain.setValueAtTime(0.018, now + delay);
    knockGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
    
    knock.connect(knockGain);
    knockGain.connect(ctx.destination);
    
    knock.start(now + delay);
    knock.stop(now + delay + 0.12);
  }
}

export function playEat() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const pitchVar = 0.9 + Math.random() * 0.2;
  
  // Very short soft bite (almost inaudible)
  const click = ctx.createOscillator();
  click.type = 'sine';
  click.frequency.value = 400 * pitchVar;
  
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.008, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  
  click.start(now);
  click.stop(now + 0.05);
}

export function playProcess() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  const now = ctx.currentTime;
  
  // Quiet scrape/chop sound
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 900;
  filter.Q.value = 1.5;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.025, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noise.start(now);
  noise.stop(now + 0.18);
}

export function playCombine(discovered = false) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const volume = discovered ? 0.03 : 0.015;
  
  // Small bright chime (sine + triangle layered)
  const sine = ctx.createOscillator();
  sine.type = 'sine';
  sine.frequency.value = 880;
  
  const triangle = ctx.createOscillator();
  triangle.type = 'triangle';
  triangle.frequency.value = 1320;
  
  const sineGain = ctx.createGain();
  sineGain.gain.setValueAtTime(volume * 0.6, now);
  sineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  
  const triGain = ctx.createGain();
  triGain.gain.setValueAtTime(volume * 0.4, now);
  triGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  
  sine.connect(sineGain);
  triangle.connect(triGain);
  sineGain.connect(ctx.destination);
  triGain.connect(ctx.destination);
  
  sine.start(now);
  triangle.start(now);
  sine.stop(now + 0.4);
  triangle.stop(now + 0.35);
}

export function playDrop() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  const now = ctx.currentTime;
  
  // Soft placed-object thunk
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 1.0;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.025, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noise.start(now);
  noise.stop(now + 0.12);
  
  // Low thump
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(80, now);
  thump.frequency.exponentialRampToValueAtTime(40, now + 0.08);
  
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.015, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  
  thump.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  
  thump.start(now);
  thump.stop(now + 0.12);
}

let fireCrackle = null;
let fireCracklePopInterval = null;

export function startFireCrackle() {
  if (!enabled) return;
  stopFireCrackle();
  
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  // Continuous warm loop
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.25;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 450;
  filter.Q.value = 1.5;
  
  const gain = ctx.createGain();
  gain.gain.value = 0;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  source.start();
  
  // Fade in
  gain.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 0.5);
  
  fireCrackle = { source, gain };
  
  // Occasional crackle pops
  function schedulePop() {
    if (!fireCrackle) return;
    
    const delay = 0.4 + Math.random() * 1.4;
    fireCracklePopInterval = setTimeout(() => {
      if (!fireCrackle) return;
      
      const popNoise = ctx.createBufferSource();
      popNoise.buffer = noiseBuffer;
      
      const popFilter = ctx.createBiquadFilter();
      popFilter.type = 'highpass';
      popFilter.frequency.value = 1200 + Math.random() * 600;
      popFilter.Q.value = 2.0;
      
      const popGain = ctx.createGain();
      const popVolume = 0.015 + Math.random() * 0.015;
      popGain.gain.setValueAtTime(popVolume, ctx.currentTime);
      popGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      
      popNoise.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(ctx.destination);
      
      popNoise.start();
      popNoise.stop(ctx.currentTime + 0.1);
      
      schedulePop();
    }, delay * 1000);
  }
  
  schedulePop();
}

export function stopFireCrackle() {
  if (fireCrackle) {
    const ctx = getContext();
    if (ctx && fireCrackle.gain) {
      // Fade out
      fireCrackle.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      
      setTimeout(() => {
        if (fireCrackle?.source) {
          try {
            fireCrackle.source.stop();
          } catch (e) {
            // Already stopped
          }
        }
        fireCrackle = null;
      }, 600);
    } else {
      try {
        fireCrackle.source.stop();
      } catch (e) {
        // Already stopped
      }
      fireCrackle = null;
    }
  }
  
  if (fireCracklePopInterval) {
    clearTimeout(fireCracklePopInterval);
    fireCracklePopInterval = null;
  }
}

export function playNightfall() {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  
  // Longer, quieter low pad (not a cartoon slide-whistle)
  const pad = ctx.createOscillator();
  pad.type = 'sine';
  pad.frequency.setValueAtTime(180, now);
  pad.frequency.exponentialRampToValueAtTime(90, now + 1.2);
  
  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0.018, now);
  padGain.gain.linearRampToValueAtTime(0.022, now + 0.3);
  padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  
  pad.connect(padGain);
  padGain.connect(ctx.destination);
  
  pad.start(now);
  pad.stop(now + 1.3);
}

// Optional weather loops (exported but not required by weather.js)
let rainLoop = null;
let windLoop = null;

export function startRain() {
  if (!enabled) return;
  stopRain();
  
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  const bufferSize = ctx.sampleRate * 1.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.8;
  
  const gain = ctx.createGain();
  gain.gain.value = 0;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  source.start();
  gain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 1.0);
  
  rainLoop = { source, gain };
}

export function stopRain() {
  if (rainLoop) {
    const ctx = getContext();
    if (ctx && rainLoop.gain) {
      rainLoop.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
      setTimeout(() => {
        if (rainLoop?.source) {
          try {
            rainLoop.source.stop();
          } catch (e) {
            // Already stopped
          }
        }
        rainLoop = null;
      }, 1100);
    } else {
      try {
        rainLoop.source.stop();
      } catch (e) {
        // Already stopped
      }
      rainLoop = null;
    }
  }
}

export function startWind() {
  if (!enabled) return;
  stopWind();
  
  const ctx = getContext();
  if (!ctx) return;
  
  ensureNoiseBuffers();
  
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.2;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 1.0;
  
  const gain = ctx.createGain();
  gain.gain.value = 0;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  source.start();
  gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1.5);
  
  windLoop = { source, gain };
}

export function stopWind() {
  if (windLoop) {
    const ctx = getContext();
    if (ctx && windLoop.gain) {
      windLoop.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      setTimeout(() => {
        if (windLoop?.source) {
          try {
            windLoop.source.stop();
          } catch (e) {
            // Already stopped
          }
        }
        windLoop = null;
      }, 1600);
    } else {
      try {
        windLoop.source.stop();
      } catch (e) {
        // Already stopped
      }
      windLoop = null;
    }
  }
}
