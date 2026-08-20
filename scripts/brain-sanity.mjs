import {
  Brain,
  ACTION_NAMES,
  shouldForceIdle,
  encodeInputs,
  INPUT_SIZE,
  HIDDEN_SIZE,
  OUTPUT_SIZE,
} from '../src/brain.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const brain = new Brain();
assert(brain.inputSize === INPUT_SIZE, 'input size');
assert(brain.hiddenSize === HIDDEN_SIZE, 'hidden size');
assert(brain.outputSize === OUTPUT_SIZE, 'output size');
assert(ACTION_NAMES.length === 7, 'seven actions (added combine)');

const zeros = new Array(INPUT_SIZE).fill(0);
const fwd = brain.forward(zeros);
assert(fwd.probs.length === 7, 'softmax length');
const sum = [...fwd.probs].reduce((a, b) => a + b, 0);
assert(Math.abs(sum - 1) < 1e-6, `softmax sums to 1 (got ${sum})`);
assert([...fwd.probs].every((p) => p >= 0 && p <= 1), 'probs in [0,1]');

const { action, name } = brain.act(zeros);
assert(ACTION_NAMES.includes(name), 'sampled action name');
assert(action >= 0 && action < 7, 'action index');

const before = brain.W2[action * HIDDEN_SIZE];
brain.reinforce(1.0);
const after = brain.W2[action * HIDDEN_SIZE];
assert(after !== before || fwd.hidden[0] === 0, 'reinforce nudges W2');

const emptyGate = shouldForceIdle({
  pickupCount: 0,
  inventoryEmpty: true,
  hasHut: false,
  hasWorkbench: false,
  hasTools: false,
  hasForageSources: false,
});
assert(emptyGate === true, 'empty world forces idle');

const notEmpty = shouldForceIdle({
  pickupCount: 1,
  inventoryEmpty: true,
  hasHut: false,
  hasWorkbench: false,
  hasTools: false,
  hasForageSources: false,
});
assert(notEmpty === false, 'a pickup un-gates the net');

const built = shouldForceIdle({
  pickupCount: 0,
  inventoryEmpty: true,
  hasHut: true,
  hasWorkbench: false,
  hasTools: false,
  hasForageSources: false,
});
assert(built === false, 'a hut un-gates the net');

const withForage = shouldForceIdle({
  pickupCount: 0,
  inventoryEmpty: true,
  hasHut: false,
  hasWorkbench: false,
  hasTools: false,
  hasForageSources: true,
});
assert(withForage === false, 'forage sources un-gate the net');

const inv = {
  berry: 0, grain: 0, wood: 0, stone: 0, ore: 0, planks: 0, ingot: 0, bread: 0,
};
const obs = encodeInputs({
  hunger: 0.5,
  energy: 1,
  inventory: inv,
  distFood: Infinity,
  distWood: Infinity,
  distOre: Infinity,
  distStone: Infinity,
  distGrain: Infinity,
  distWorkbench: Infinity,
  distHut: Infinity,
  hasHut: false,
  hasWorkbench: false,
  hasTools: false,
  starving: false,
  hasSharp: false,
  hasMetal: false,
  hasVehicle: false,
});
assert(obs.length === 22, '22 inputs (added tag flags)');
assert(obs.every((x) => typeof x === 'number' && Number.isFinite(x)), 'finite inputs');

console.log('brain-sanity: ok');
console.log('  MLP', INPUT_SIZE, '→', HIDDEN_SIZE, 'tanh →', OUTPUT_SIZE, 'softmax');
console.log('  actions:', ACTION_NAMES.join(', '));
console.log('  empty-world idle gate: pass');
console.log('  forward + REINFORCE nudge: pass');
