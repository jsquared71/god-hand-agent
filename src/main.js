import { createWorld } from './world.js';
import { setupControls } from './controls.js';
import { setupDrop } from './drop.js';
import { setupToolbar } from './toolbar.js';
import { createAgent } from './agent.js';
import { AssetLibrary } from './assets.js';
import { updateWorldItems, spawnPickup } from './resources.js';
import { setupRecipeHud } from './recipes.js';

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
