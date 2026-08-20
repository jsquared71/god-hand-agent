import { createWorld } from './world.js';
import { setupControls } from './controls.js';
import { setupDrop } from './drop.js';
import { setupToolbar } from './toolbar.js';
import { createAgent } from './agent.js';
import { AssetLibrary } from './assets.js';
import { updateWorldItems, spawnPickup } from './resources.js';
import { setupRecipeHud } from './recipes.js';
import {
  saveToFile,
  loadFromFile,
  loadFromLocalStorage,
  startAutosave,
  deserializeWorld,
} from './save.js';
import { startFireCrackle, stopFireCrackle } from './audio.js';

const canvas = document.getElementById('game');

// Check for localStorage autosave and use its seed if restoring
const autosave = loadFromLocalStorage();
let worldSeed = null;
if (autosave) {
  const restore = confirm(
    `Found autosave from ${new Date(autosave.timestamp).toLocaleString()}. Restore it?`
  );
  if (restore) {
    worldSeed = autosave.seed || null; // Use saved seed
  }
}

const world = createWorld(canvas, worldSeed);
const cam = setupControls(world);
const assets = new AssetLibrary();

await assets.preload();

// Store assets in world for well water spawning
world.userData = { assets };

// Global game state: Favor system
const gameState = {
  favor: 10, // Start with 10 Favor
  favorMax: 20,
  favorRegenRate: 0.05, // Base regen per second
};

// Create two agents with slightly different priors
const agent1 = createAgent(world, assets, {
  b2: [0.15, 0.15, 0.05, 0.35, 0.08, 0.05], // Slightly more builder-biased
});
agent1.group.position.set(0, 2.4, 0);

const agent2 = createAgent(world, assets, {
  b2: [0.1, 0.2, 0.08, 0.4, 0.05, -0.1], // More forager-biased
});
agent2.group.position.set(1.5, 2.4, 0.8);

const agents = [agent1, agent2];

const drop = setupDrop(world, assets, cam, gameState);
setupToolbar(drop, gameState);
setupRecipeHud();

// Restore world state if autosave was confirmed
if (autosave && worldSeed !== null) {
  deserializeWorld(autosave, world, agents, assets, world.camera, gameState);
} else {
  // Spawn initial food pickups for new world
  spawnInitialFood();
}

function spawnInitialFood() {
  const foodSpawns = [
    { type: 'berry', x: 7, z: 2 },
    { type: 'berry', x: 9, z: -3 },
    { type: 'grain', x: 5, z: 1 },
    { type: 'grain', x: 8, z: -1 },
    { type: 'fish', x: -1, z: -9 },
    { type: 'fish', x: -3, z: -13 },
  ];
  
  for (const spawn of foodSpawns) {
    spawnPickup(world, assets, spawn.type, { x: spawn.x, z: spawn.z }, { 
      falling: false, 
      isWorldSpawned: true,
      spawnOrigin: { x: spawn.x, z: spawn.z }
    });
  }
}

// Setup save/load buttons
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');

if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    saveToFile(world, agents, world.camera, gameState);
  });
}

if (loadBtn) {
  loadBtn.addEventListener('click', async () => {
    try {
      await loadFromFile(world, agents, assets, world.camera, gameState);
    } catch (err) {
      if (err.message !== 'No file selected') {
        alert('Failed to load save file. Check console for details.');
      }
    }
  });
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveToFile(world, agents, world.camera, gameState);
  }
});

// Start autosave timer
startAutosave(world, agents, world.camera, gameState);

let last = performance.now();

function updateFavor(dt) {
  // Base regen
  let regen = gameState.favorRegenRate * dt;
  
  // Bonus regen when camp is thriving
  const agentsFed = agents.filter(a => a.state.hunger > 0.75).length;
  const hasHut = world.buildings.some(b => b.type === 'hut');
  const hasTools = agents.some(a => a.state.hasTools);
  const hasChest = world.buildings.some(b => b.type === 'chest');
  const chestStocked = hasChest; // For now, chest existence = stocked
  
  if (agentsFed > 0) regen += 0.02 * dt * agentsFed;
  if (hasHut) regen += 0.03 * dt;
  if (hasTools) regen += 0.02 * dt;
  if (chestStocked) regen += 0.02 * dt;
  
  gameState.favor = Math.min(gameState.favorMax, gameState.favor + regen);
  
  // Update camp status indicators
  const campStatus = {
    fed: document.getElementById('camp-fed'),
    housed: document.getElementById('camp-housed'),
    tooled: document.getElementById('camp-tooled'),
    stocked: document.getElementById('camp-stocked'),
  };
  
  if (campStatus.fed) {
    campStatus.fed.classList.toggle('active', agentsFed === agents.length);
  }
  if (campStatus.housed) {
    campStatus.housed.classList.toggle('active', hasHut);
  }
  if (campStatus.tooled) {
    campStatus.tooled.classList.toggle('active', hasTools);
  }
  if (campStatus.stocked) {
    campStatus.stocked.classList.toggle('active', chestStocked);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  cam.update();
  world.updateDayNight(dt);
  updateWorldItems(world, dt);
  updateFavor(dt);
  
  // Fire crackle loop
  const hasFire = world.buildings.some(b => b.type === 'fire');
  if (hasFire && !gameState.fireCrackleActive) {
    startFireCrackle();
    gameState.fireCrackleActive = true;
  } else if (!hasFire && gameState.fireCrackleActive) {
    stopFireCrackle();
    gameState.fireCrackleActive = false;
  }
  
  for (const agent of agents) {
    agent.update(dt);
  }
  world.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
