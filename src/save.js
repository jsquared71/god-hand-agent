/**
 * Save/Load system for God Hand world state.
 * Serializes agent, pickups, buildings, forage sources, and brain weights to JSON.
 */

const SAVE_VERSION = 1;
const AUTOSAVE_KEY = 'god-hand-autosave';
const AUTOSAVE_INTERVAL_MS = 15000; // 15 seconds

let autosaveTimer = null;

export function serializeWorld(world, agents, camera, gameState, notebook = null) {
  const state = {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    seed: world.seed || Date.now(),
    worldClock: {
      time: world.worldClock?.time || 0,
      dayIndex: world.worldClock?.dayIndex || 0,
    },
    gameState: {
      favor: gameState.favor,
      favorMax: gameState.favorMax,
      favorRegenRate: gameState.favorRegenRate,
    },
    notebook: notebook ? notebook.serialize() : null,
    agents: agents.map(agent => ({
      position: { x: agent.group.position.x, y: agent.group.position.y, z: agent.group.position.z },
      facing: agent.state.facing,
      hunger: agent.state.hunger,
      energy: agent.state.energy,
      health: agent.state.health || 1.0,
      entertainment: agent.state.entertainment,
      wanderlust: agent.state.wanderlust || 0,
      itch: agent.state.itch || 0.25,
      itchTag: agent.state.itchTag || 'sharp',
      currentBiome: agent.state.currentBiome || null,
      biomeEntryTime: agent.state.biomeEntryTime || 0,
      lastBiomeVisit: agent.state.lastBiomeVisit || {},
      inventory: { ...agent.state.inventory },
      hasTools: agent.state.hasTools,
      action: agent.state.action,
      actionIndex: agent.state.actionIndex,
      sluggish: agent.state.sluggish,
      wantBubble: agent.state.wantBubble || 'Idle',
      brain: {
        W1: Array.from(agent.brain.W1),
        b1: Array.from(agent.brain.b1),
        W2: Array.from(agent.brain.W2),
        b2: Array.from(agent.brain.b2),
        lr: agent.brain.lr,
      },
    })),
    pickups: world.pickups.map((p) => ({
      type: p.type,
      position: { x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z },
      isWorldSpawned: p.isWorldSpawned || false,
      spawnOrigin: p.spawnOrigin || null,
      respawnDelay: p.respawnDelay || 45.0,
    })),
    buildings: world.buildings.map((b) => ({
      type: b.type,
      position: { x: b.mesh.position.x, y: b.mesh.position.y, z: b.mesh.position.z },
      wellTimer: b.mesh.userData.wellTimer,
      wellInterval: b.mesh.userData.wellInterval,
    })),
    forageSources: world.forageSources ? world.forageSources.map((s) => ({
      type: s.type,
      harvestType: s.harvestType,
      charges: s.charges,
      cooldown: s.cooldown,
      cooldownMax: s.cooldownMax,
      chargesMax: s.chargesMax,
      position: { x: s.mesh.position.x, y: s.mesh.position.y, z: s.mesh.position.z },
    })) : [],
    fauna: world.fauna ? world.fauna.map((c) => ({
      species: c.species,
      biome: c.biome,
      domestic: c.domestic || false,
      productionTimer: c.productionTimer || 0,
      productionInterval: c.productionInterval || 60.0,
      position: { x: c.mesh.position.x, y: c.mesh.position.y, z: c.mesh.position.z },
    })) : [],
    pendingRespawns: world.pendingRespawns || [],
    camera: {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      targetX: camera.userData?.targetX ?? 0,
      targetZ: camera.userData?.targetZ ?? 0,
    },
  };
  return state;
}

export function deserializeWorld(state, world, agents, assets, camera, gameState, notebook = null) {
  if (state.version !== SAVE_VERSION) {
    console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${state.version}`);
  }
  
  // Restore world clock
  if (state.worldClock && world.worldClock) {
    world.worldClock.time = state.worldClock.time || 0;
    world.worldClock.dayIndex = state.worldClock.dayIndex || 0;
  }
  
  // Restore game state
  if (state.gameState && gameState) {
    gameState.favor = state.gameState.favor ?? 10;
    gameState.favorMax = state.gameState.favorMax ?? 20;
    gameState.favorRegenRate = state.gameState.favorRegenRate ?? 0.05;
  }
  
  // Restore notebook
  if (notebook && state.notebook) {
    notebook.deserialize(state.notebook);
  }

  // Restore agents
  const savedAgents = state.agents || (state.agent ? [state.agent] : []);
  for (let i = 0; i < Math.min(agents.length, savedAgents.length); i++) {
    const agentData = savedAgents[i];
    const agent = agents[i];
    
    agent.group.position.set(agentData.position.x, agentData.position.y, agentData.position.z);
    agent.state.facing = agentData.facing ?? 0;
    agent.state.hunger = agentData.hunger ?? 0.62;
    agent.state.energy = agentData.energy ?? 1;
    agent.state.health = agentData.health ?? 1.0;
    agent.state.entertainment = agentData.entertainment ?? 1.0;
    agent.state.wanderlust = agentData.wanderlust ?? 0.5;
    agent.state.itch = agentData.itch ?? 0.25;
    agent.state.itchTag = agentData.itchTag ?? 'sharp';
    agent.state.currentBiome = agentData.currentBiome ?? null;
    agent.state.biomeEntryTime = agentData.biomeEntryTime ?? 0;
    agent.state.lastBiomeVisit = agentData.lastBiomeVisit ?? {};
    agent.state.inventory = { ...agentData.inventory };
    agent.state.hasTools = agentData.hasTools ?? false;
    agent.state.action = agentData.action ?? 'idle';
    agent.state.actionIndex = agentData.actionIndex ?? 0;
    agent.state.sluggish = agentData.sluggish ?? false;
    agent.state.wantBubble = agentData.wantBubble || 'Idle';
    agent.state.landed = true;
    agent.state.vy = 0;
    agent.group.rotation.y = agent.state.facing;

    // Restore brain weights
    if (agentData.brain) {
      agent.brain.W1.set(agentData.brain.W1);
      agent.brain.b1.set(agentData.brain.b1);
      agent.brain.W2.set(agentData.brain.W2);
      agent.brain.b2.set(agentData.brain.b2);
      agent.brain.lr = agentData.brain.lr ?? 0.018;
    }
  }

  // Clear and restore pickups
  for (const p of [...world.pickups]) {
    world.scene.remove(p.mesh);
    p.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
    });
  }
  world.pickups.length = 0;

  for (const pData of state.pickups) {
    const mesh = assets.create(pData.type);
    mesh.position.set(pData.position.x, pData.position.y, pData.position.z);
    mesh.userData = {
      ...mesh.userData,
      type: pData.type,
      id: world.pickups.length + 1,
      kind: 'pickup',
      vy: 0,
      settled: true,
      bobOff: Math.random() * Math.PI * 2,
    };
    world.scene.add(mesh);
    world.pickups.push({ 
      id: mesh.userData.id, 
      type: pData.type, 
      mesh,
      isWorldSpawned: pData.isWorldSpawned || false,
      spawnOrigin: pData.spawnOrigin || null,
      respawnTimer: 0,
      respawnDelay: pData.respawnDelay || 45.0,
    });
  }

  // Clear and restore buildings
  for (const b of [...world.buildings]) {
    world.scene.remove(b.mesh);
  }
  world.buildings.length = 0;

  for (const bData of state.buildings) {
    const mesh = assets.create(bData.type);
    mesh.position.set(bData.position.x, bData.position.y, bData.position.z);
    mesh.scale.setScalar(1);
    mesh.userData = {
      ...mesh.userData,
      type: bData.type,
      kind: 'building',
      grow: 1,
    };
    if (bData.type === 'well') {
      mesh.userData.wellTimer = bData.wellTimer ?? 0;
      mesh.userData.wellInterval = bData.wellInterval ?? 12;
    }
    world.scene.add(mesh);
    world.buildings.push({ type: bData.type, mesh, position: mesh.position });
  }

  // Restore forage source charges/cooldowns
  if (state.forageSources && world.forageSources) {
    for (let i = 0; i < Math.min(state.forageSources.length, world.forageSources.length); i++) {
      const saved = state.forageSources[i];
      const current = world.forageSources[i];
      if (saved && current && saved.type === current.type) {
        current.charges = saved.charges ?? current.chargesMax;
        current.cooldown = saved.cooldown ?? 0;
        current.cooldownMax = saved.cooldownMax ?? current.cooldownMax;
        current.chargesMax = saved.chargesMax ?? current.chargesMax;
        // Apply visual feedback if depleted
        if (current.charges === 0 && current.cooldown > 0) {
          const alpha = 0.4 + 0.6 * (current.charges / current.chargesMax);
          current.mesh.traverse((child) => {
            if (child.material) {
              child.material.opacity = alpha;
              child.material.transparent = true;
            }
          });
        } else if (current.charges < current.chargesMax) {
          const alpha = 0.4 + 0.6 * (current.charges / current.chargesMax);
          current.mesh.traverse((child) => {
            if (child.material) {
              child.material.opacity = alpha;
              child.material.transparent = true;
            }
          });
        } else {
          current.mesh.traverse((child) => {
            if (child.material) {
              child.material.opacity = 1.0;
              child.material.transparent = false;
            }
          });
        }
      }
    }
  }
  
  // Restore fauna domestication state
  if (state.fauna && world.fauna) {
    for (let i = 0; i < Math.min(state.fauna.length, world.fauna.length); i++) {
      const saved = state.fauna[i];
      const current = world.fauna[i];
      if (saved && current && saved.species === current.species) {
        current.domestic = saved.domestic || false;
        current.productionTimer = saved.productionTimer || 0;
        current.productionInterval = saved.productionInterval || 60.0;
      }
    }
  }
  
  // Restore pending respawns
  world.pendingRespawns = state.pendingRespawns || [];

  // Restore camera
  if (state.camera) {
    camera.position.set(state.camera.position.x, state.camera.position.y, state.camera.position.z);
    if (camera.userData) {
      camera.userData.targetX = state.camera.targetX ?? 0;
      camera.userData.targetZ = state.camera.targetZ ?? 0;
    }
  }

  console.log('World loaded successfully');
}

export function saveToFile(world, agents, camera, gameState, notebook = null) {
  const state = serializeWorld(world, agents, camera, gameState, notebook);
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `god-hand-save-${Date.now()}.json`;

  // Try File System Access API first (modern browsers)
  if ('showSaveFilePicker' in window) {
    window.showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: 'God Hand Save File',
        accept: { 'application/json': ['.json'] },
      }],
    }).then(async (handle) => {
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      console.log('Saved via File System Access API');
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        console.warn('File System Access API failed, falling back to download:', err);
        downloadBlob(blob, filename);
      }
    });
  } else {
    // Fallback: trigger download
    downloadBlob(blob, filename);
  }

  // Also autosave to localStorage
  saveToLocalStorage(state);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('Saved via download');
}

export function loadFromFile(world, agents, assets, camera, gameState, notebook = null) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      try {
        const text = await file.text();
        const state = JSON.parse(text);
        deserializeWorld(state, world, agents, assets, camera, gameState, notebook);
        resolve(state);
      } catch (err) {
        console.error('Failed to load file:', err);
        reject(err);
      }
    };
    input.click();
  });
}

export function saveToLocalStorage(state) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
    console.log('Autosaved to localStorage');
  } catch (err) {
    console.warn('Failed to autosave to localStorage:', err);
  }
}

export function loadFromLocalStorage() {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) return null;
    return JSON.parse(json);
  } catch (err) {
    console.warn('Failed to load from localStorage:', err);
    return null;
  }
}

export function clearLocalStorage() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    console.log('Cleared localStorage autosave');
  } catch (err) {
    console.warn('Failed to clear localStorage:', err);
  }
}

export function startAutosave(world, agents, camera, gameState, notebook = null) {
  stopAutosave();
  autosaveTimer = setInterval(() => {
    const state = serializeWorld(world, agents, camera, gameState, notebook);
    saveToLocalStorage(state);
  }, AUTOSAVE_INTERVAL_MS);
  console.log(`Autosave enabled (every ${AUTOSAVE_INTERVAL_MS / 1000}s)`);
}

export function stopAutosave() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}
