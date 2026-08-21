import { createWorld, dressWorld } from './world.js';
import { setupControls } from './controls.js';
import { setupDrop } from './drop.js';
import { setupToolbar } from './toolbar.js';
import { createAgent } from './agent.js';
import { AssetLibrary } from './assets.js';
import { updateWorldItems, spawnPickup } from './resources.js';
import { setupRecipeHud, updateRecipeHud } from './recipes.js';
import {
  saveToFile,
  loadFromFile,
  loadFromLocalStorage,
  startAutosave,
  deserializeWorld,
} from './save.js';
import { startFireCrackle, stopFireCrackle } from './audio.js';
import { DiscoveryNotebook } from './discovery.js';
import { createLabelRenderer, createNameTag, updateHealthBar, resizeLabelRenderer } from './nametags.js';

const canvas = document.getElementById('game');

// Check for localStorage autosave and use its seed if restoring
const autosave = loadFromLocalStorage();
let worldSeed = null;
let pendingRestore = null;

const world = createWorld(canvas, worldSeed);
const cam = setupControls(world);
const labelRenderer = createLabelRenderer(canvas);
const assets = new AssetLibrary();

await assets.preload();

dressWorld(world, assets);

// Store assets in world for well water spawning
world.userData = { assets };

// Global game state: Favor system
const gameState = {
  favor: 10, // Start with 10 Favor
  favorMax: 20,
  favorRegenRate: 0.05, // Base regen per second
};

// Create discovery notebook (shared between agents)
const notebook = new DiscoveryNotebook();

// Create two agents with slightly different priors
const agent1 = createAgent(world, assets, {
  b2: [0.15, 0.05, 0.0, 0.42, 0.1, -0.05, 0.15], // Ava: lower seek_food/eat, higher seek_material
}, notebook, 'Ava');
const spawn1Y = world.heightAt(0, 0);
agent1.group.position.set(0, spawn1Y, 0);

const agent2 = createAgent(world, assets, {
  b2: [0.1, 0.08, 0.0, 0.38, 0.08, -0.1, 0.18], // Bo: similar adjustments, more experimental
}, notebook, 'Bo');
const spawn2Y = world.heightAt(1.5, 0.8);
agent2.group.position.set(1.5, spawn2Y, 0.8);

const agents = [agent1, agent2];

// Add name tags to agents
const nameTag1 = createNameTag('Ava');
agent1.group.add(nameTag1);
agent1.nameTag = nameTag1;

const nameTag2 = createNameTag('Bo');
agent2.group.add(nameTag2);
agent2.nameTag = nameTag2;

// Register agents on world so they can see each other for collision
world.agents = agents;

const drop = setupDrop(world, assets, cam, gameState);
setupToolbar(drop, gameState);
setupRecipeHud(notebook);

// Setup wheel event handler for recipes HUD to prevent world zoom when scrolling
const recipesHud = document.getElementById('recipes-hud');
if (recipesHud) {
  recipesHud.addEventListener('wheel', (e) => {
    const canScroll = recipesHud.scrollHeight > recipesHud.clientHeight;
    if (canScroll) {
      e.stopPropagation();
      e.preventDefault();
      recipesHud.scrollTop += e.deltaY;
    }
  }, { passive: false });
}

// Setup autosave restore HUD if autosave exists
if (autosave) {
  pendingRestore = autosave;
  showRestoreHud(autosave);
} else {
  // Spawn initial food pickups for new world
  spawnInitialFood();
}

function showRestoreHud(saveData) {
  const restoreHud = document.createElement('div');
  restoreHud.id = 'restore-hud';
  restoreHud.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    background: var(--panel);
    border: 2px solid var(--accent);
    border-radius: var(--radius);
    padding: 20px 24px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
    min-width: 320px;
    text-align: center;
  `;
  
  restoreHud.innerHTML = `
    <div style="font-size: 16px; font-weight: 700; color: var(--accent); margin-bottom: 8px;">
      Autosave Found
    </div>
    <div style="font-size: 13px; color: var(--muted); margin-bottom: 16px;">
      ${new Date(saveData.timestamp).toLocaleString()}
    </div>
    <div style="display: flex; gap: 10px; justify-content: center;">
      <button id="restore-btn" style="
        appearance: none;
        border: 1px solid rgba(106, 196, 184, 0.4);
        background: linear-gradient(180deg, rgba(106, 196, 184, 0.2), rgba(106, 196, 184, 0.08));
        color: var(--energy);
        padding: 10px 20px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        font-family: var(--font);
        transition: all 0.15s ease;
      ">Restore</button>
      <button id="new-world-btn" style="
        appearance: none;
        border: 1px solid rgba(212, 160, 23, 0.4);
        background: linear-gradient(180deg, rgba(212, 160, 23, 0.15), rgba(212, 160, 23, 0.05));
        color: var(--accent);
        padding: 10px 20px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        font-family: var(--font);
        transition: all 0.15s ease;
      ">New World</button>
    </div>
  `;
  
  document.body.appendChild(restoreHud);
  
  document.getElementById('restore-btn').addEventListener('click', () => {
    deserializeWorld(saveData, world, agents, assets, world.camera, gameState, notebook);
    updateRecipeHud(notebook);
    restoreHud.remove();
    pendingRestore = null;
  });
  
  document.getElementById('new-world-btn').addEventListener('click', () => {
    spawnInitialFood();
    restoreHud.remove();
    pendingRestore = null;
  });
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
    saveToFile(world, agents, world.camera, gameState, notebook);
  });
}

if (loadBtn) {
  loadBtn.addEventListener('click', async () => {
    try {
      await loadFromFile(world, agents, assets, world.camera, gameState, notebook);
      updateRecipeHud(notebook);
    } catch (err) {
      if (err.message !== 'No file selected') {
        showNotification('Failed to load save file. Check console for details.', 'error');
        console.error('Load error:', err);
      }
    }
  });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 200;
    background: ${type === 'error' ? 'rgba(212, 78, 32, 0.95)' : 'var(--panel)'};
    border: 1px solid ${type === 'error' ? 'rgba(212, 78, 32, 1)' : 'var(--panel-border)'};
    border-radius: 12px;
    padding: 14px 18px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    max-width: 300px;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveToFile(world, agents, world.camera, gameState, notebook);
  }
});

// Start autosave timer (need to update this function signature)
startAutosave(world, agents, world.camera, gameState, notebook);

// Handle window resize for label renderer
window.addEventListener('resize', () => {
  resizeLabelRenderer(labelRenderer, canvas);
});

let last = performance.now();
let frameErrorLogged = false;

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
  
  // Update world status indicators
  const isNight = world.worldClock && world.worldClock.time >= 0.7;
  const worldDayEl = document.getElementById('world-day');
  const worldWeatherEl = document.getElementById('world-weather');
  
  if (worldDayEl) {
    worldDayEl.textContent = isNight ? 'Night' : 'Day';
  }
  
  if (worldWeatherEl && world.weather) {
    const weatherText = world.weather.current.charAt(0).toUpperCase() + world.weather.current.slice(1);
    worldWeatherEl.textContent = weatherText;
  }
}

function frame(now) {
  try {
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
      try {
        agent.update(dt);
        // Update health bar
        if (agent.nameTag) {
          updateHealthBar(agent.nameTag, agent.state.health);
        }
      } catch (agentError) {
        console.error('Agent update error:', agentError);
      }
    }
    
    // Update recipe HUD periodically (every ~60 frames)
    if (Math.random() < 0.016) {
      updateRecipeHud(notebook);
    }
    
    world.render();
    labelRenderer.render(world.scene, world.camera);
  } catch (error) {
    if (!frameErrorLogged) {
      console.error('Frame loop error:', error);
      showNotification('Game error occurred. Check console for details.', 'error');
      frameErrorLogged = true;
    }
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
