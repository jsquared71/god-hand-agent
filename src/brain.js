/**
 * Tiny MLP brain in plain JS. No TensorFlow.
 * 20 inputs → 16 tanh hidden → 6 softmax actions.
 * Session-only REINFORCE weight nudges.
 */

export const ACTION_NAMES = [
  'idle',
  'seek_food',
  'eat',
  'seek_material',
  'process',
  'build',
  'combine',
];

export const ACTION_LABELS = {
  idle: 'Idle',
  seek_food: 'Seeking food',
  eat: 'Eating',
  seek_material: 'Gathering',
  process: 'Crafting',
  build: 'Building',
  combine: 'Inventing',
  'idle-hungry': 'Starving',
};

export const INPUT_SIZE = 22;
export const HIDDEN_SIZE = 16;
export const OUTPUT_SIZE = 7;

function zeros(n) {
  return new Float64Array(n);
}

function randn(rows, cols, scale) {
  const m = new Float64Array(rows * cols);
  for (let i = 0; i < m.length; i++) {
    // Box-Muller
    const u = Math.max(1e-9, Math.random());
    const v = Math.random();
    m[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale;
  }
  return m;
}

function softmax(logits, temperature = 1.15) {
  const n = logits.length;
  let max = -Infinity;
  for (let i = 0; i < n; i++) if (logits[i] > max) max = logits[i];
  const exps = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    exps[i] = Math.exp((logits[i] - max) / temperature);
    sum += exps[i];
  }
  for (let i = 0; i < n; i++) exps[i] /= sum;
  return exps;
}

function sample(probs) {
  let r = Math.random();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1;
}

export function shouldForceIdle({ pickupCount, inventoryEmpty, hasHut, hasWorkbench, hasTools, hasForageSources }) {
  return pickupCount === 0 && inventoryEmpty && !hasHut && !hasWorkbench && !hasTools && !hasForageSources;
}

export class Brain {
  constructor(priors = null) {
    this.inputSize = INPUT_SIZE;
    this.hiddenSize = HIDDEN_SIZE;
    this.outputSize = OUTPUT_SIZE;
    const s1 = Math.sqrt(2 / INPUT_SIZE);
    const s2 = Math.sqrt(2 / HIDDEN_SIZE);
    this.W1 = randn(HIDDEN_SIZE, INPUT_SIZE, s1);
    this.b1 = zeros(HIDDEN_SIZE);
    this.W2 = randn(OUTPUT_SIZE, HIDDEN_SIZE, s2);
    this.b2 = zeros(OUTPUT_SIZE);
    
    // Apply priors (for multiple agents with different biases)
    if (priors) {
      if (priors.b2) {
        for (let i = 0; i < OUTPUT_SIZE; i++) {
          if (priors.b2[i] !== undefined) {
            this.b2[i] = priors.b2[i];
          }
        }
      }
    } else {
      // Default priors so the first minutes aren't pure noise.
      this.b2[0] = 0.15; // idle
      this.b2[1] = 0.08; // seek_food (reduced from 0.1)
      this.b2[2] = 0.0; // eat (reduced from 0.05)
      this.b2[3] = 0.4; // seek_material (increased from 0.35)
      this.b2[4] = 0.1; // process (increased from 0.08)
      this.b2[5] = -0.05; // build
      this.b2[6] = 0.15; // combine (increased from 0.12)
    }
    
    this.last = null;
    this.lr = 0.018;
  }

  forward(input) {
    const { W1, b1, W2, b2, hiddenSize, outputSize, inputSize } = this;
    const hiddenPre = new Float64Array(hiddenSize);
    const hidden = new Float64Array(hiddenSize);
    for (let i = 0; i < hiddenSize; i++) {
      let s = b1[i];
      const row = i * inputSize;
      for (let j = 0; j < inputSize; j++) s += W1[row + j] * input[j];
      hiddenPre[i] = s;
      hidden[i] = Math.tanh(s);
    }
    const logits = new Float64Array(outputSize);
    for (let i = 0; i < outputSize; i++) {
      let s = b2[i];
      const row = i * hiddenSize;
      for (let j = 0; j < hiddenSize; j++) s += W2[row + j] * hidden[j];
      logits[i] = s;
    }
    const probs = softmax(logits);
    return { hidden, hiddenPre, logits, probs };
  }

  act(input) {
    const fwd = this.forward(input);
    const action = sample(fwd.probs);
    this.last = { input: Float64Array.from(input), ...fwd, action };
    return { action, name: ACTION_NAMES[action], probs: fwd.probs };
  }

  /** Nudge weights along ∇ log π(a) * reward (REINFORCE). */
  reinforce(reward) {
    if (!this.last || !reward) return;
    const r = Math.max(-1.6, Math.min(1.6, reward));
    const { input, hidden, probs, action } = this.last;
    const { W1, b1, W2, b2, hiddenSize, outputSize, inputSize, lr } = this;

    const dLogits = new Float64Array(outputSize);
    for (let i = 0; i < outputSize; i++) {
      dLogits[i] = ((i === action ? 1 : 0) - probs[i]) * r;
    }

    const dHidden = new Float64Array(hiddenSize);
    for (let i = 0; i < outputSize; i++) {
      const row = i * hiddenSize;
      const g = dLogits[i];
      for (let j = 0; j < hiddenSize; j++) {
        dHidden[j] += g * W2[row + j];
      }
      b2[i] += lr * g;
      for (let j = 0; j < hiddenSize; j++) {
        W2[row + j] += lr * g * hidden[j];
      }
    }

    for (let i = 0; i < hiddenSize; i++) {
      const deriv = (1 - hidden[i] * hidden[i]) * dHidden[i];
      b1[i] += lr * deriv;
      const row = i * inputSize;
      for (let j = 0; j < inputSize; j++) {
        W1[row + j] += lr * deriv * input[j];
      }
    }

    this._clip();
  }

  _clip() {
    const cap = 5;
    for (const arr of [this.W1, this.b1, this.W2, this.b2]) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > cap) arr[i] = cap;
        else if (arr[i] < -cap) arr[i] = -cap;
      }
    }
  }
}

/**
 * Pack world/agent snapshot into the 22-D observation vector.
 * Distances are mapped through 1/(1+d) so nearer = larger.
 */
export function encodeInputs({
  hunger,
  energy,
  inventory,
  distFood,
  distWood,
  distOre,
  distStone,
  distGrain,
  distWorkbench,
  distHut,
  hasHut,
  hasWorkbench,
  hasTools,
  starving,
  distForageFood = Infinity,
  distForageWood = Infinity,
  distForageOre = Infinity,
  distForageStone = Infinity,
  hasSharp = false,
  hasMetal = false,
  hasVehicle = false,
}) {
  const inv = (k) => Math.min(1, (inventory[k] || 0) / 4);
  const nd = (d) => (d == null || d === Infinity ? 0 : 1 / (1 + d));
  // Combine pickup and forage distances (use closer of the two)
  const foodDist = Math.min(distFood, distForageFood);
  const woodDist = Math.min(distWood, distForageWood);
  const oreDist = Math.min(distOre, distForageOre);
  const stoneDist = Math.min(distStone, distForageStone);
  
  return [
    hunger,
    energy,
    inv('berry'),
    inv('grain'),
    inv('wood'),
    inv('stone'),
    inv('ore'),
    inv('planks'),
    inv('ingot'),
    inv('bread'),
    nd(foodDist),
    nd(woodDist),
    nd(oreDist),
    nd(stoneDist),
    nd(distGrain),
    nd(distWorkbench),
    nd(distHut),
    hasHut ? 1 : 0,
    hasWorkbench ? 1 : 0,
    (hasTools ? 1 : 0) * 0.7 + (starving ? 0.3 : 0),
    hasSharp ? 1 : 0,
    hasMetal ? 1 : 0,
  ];
}
