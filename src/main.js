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
const world = createWorld(canvas);
const cam = setupControls(world);
const assets = new AssetLibrary();

await assets.preload();

// Store assets in world for well water spawning
world.userData = { assets };

const agent = createAgent(world, assets);
const drop = setupDrop(world, assets, cam);
setupToolbar(drop);
setupRecipeHud();

// Check for localStorage autosave and offer to restore
const autosave = loadFromLocalStorage();
if (autosave) {
  const restore = confirm(
    `Found autosave from ${new Date(autosave.timestamp).toLocaleString()}. Restore it?`
  );
  if (restore) {
    deserializeWorld(autosave, world, agent, assets, world.camera);
  } else {
    // Spawn initial food pickups if not restoring
    spawnInitialFood();
  }
} else {
  // Spawn initial food pickups
  spawnInitialFood();
}

function spawnInitialFood() {
  spawnPickup(world, assets, 'berry', { x: 7, z: 2 }, { falling: false });
  spawnPickup(world, assets, 'berry', { x: 9, z: -3 }, { falling: false });
  spawnPickup(world, assets, 'grain', { x: 5, z: 1 }, { falling: false });
  spawnPickup(world, assets, 'grain', { x: 8, z: -1 }, { falling: false });
  spawnPickup(world, assets, 'fish', { x: -1, z: -9 }, { falling: false });
  spawnPickup(world, assets, 'fish', { x: -3, z: -13 }, { falling: false });
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
