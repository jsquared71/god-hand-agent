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

const agent = createAgent(world, assets);
const drop = setupDrop(world, assets, cam);
setupToolbar(drop);
setupRecipeHud();

// Restore world state if autosave was confirmed
if (autosave && worldSeed !== null) {
  deserializeWorld(autosave, world, agent, assets, world.camera);
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
    saveToFile(world, agent, world.camera);
  });
}

if (loadBtn) {
  loadBtn.addEventListener('click', async () => {
    try {
      await loadFromFile(world, agent, assets, world.camera);
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
    saveToFile(world, agent, world.camera);
  }
});

// Start autosave timer
startAutosave(world, agent, world.camera);

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  cam.update();
  updateWorldItems(world, dt);
  agent.update(dt);
  world.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
