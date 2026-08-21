import * as THREE from 'three';
import {
  Brain,
  ACTION_NAMES,
  ACTION_LABELS,
  shouldForceIdle,
  encodeInputs,
} from './brain.js';
import {
  FOOD,
  PROCESS,
  BUILD,
  HUNGER_DRAIN,
  HUNGER_DRAIN_NEAR_HUT,
  HUT_RADIUS,
  WORKBENCH_RADIUS,
  FIRE_RADIUS,
  PICKUP_RADIUS,
  canAfford,
  canProcess,
  spend,
  processDuration,
  inventoryEmpty,
  emptyInventory,
  ALL_ITEM_TYPES,
} from './recipes.js';
import { nearestPickup, nearestBuilding, removePickup, spawnPickup, spawnBuilding, nearestForageSource, harvestForageSource, nearestHuntableFauna, nearestTendableFauna, huntFauna, tendFauna } from './resources.js';
import { playFootstep, playGather, playBuild, playEat, playProcess, playCombine } from './audio.js';
import { itemHasTag, TAGS, isFood, getGatherMult, getFoodValue, isMedicine, getHealthValue } from './discovery.js';
import { getBiomeAt } from './world.js';

const FORAGE_RADIUS = 1.2;
const HUNT_RADIUS = 1.5;
const TEND_RADIUS = 1.2;
const THINK_DT = 0.28;
const FOOD_TYPES = ['berry', 'grain', 'water', 'bread', 'stew', 'fish', 'cooked_fish', 'mushroom', 'fruit', 'herb', 'meat', 'egg', 'milk'];
const MATERIAL_TYPES = ['wood', 'ore', 'stone', 'planks', 'ingot', 'grain'];
const MATERIAL_CAP = 8;
const FOOD_CAP = 4;

export function createAgent(world, assets, priors = null, notebook = null, name = 'Agent') {
  const group = assets.create('agent');
  const spawnY = world.heightAt ? world.heightAt(0, 0) + 2.4 : 2.4;
  group.position.set(0, spawnY, 0);
  world.scene.add(group);

  const parts = group.userData.parts || {};
  const brain = new Brain(priors);
  
  // Setup animation mixer if clips are available
  let mixer = null;
  let currentAction = null;
  const actions = {};
  
  if (group.userData.fromGltf && group.userData.animationClips) {
    mixer = new THREE.AnimationMixer(group);
    const clips = group.userData.animationClips;
    
    // Build actions for each available clip role
    for (const [role, clipArray] of Object.entries(clips)) {
      if (clipArray && clipArray.length > 0) {
        const action = mixer.clipAction(clipArray[0]);
        action.setLoop(THREE.LoopRepeat);
        actions[role] = action;
      }
    }
  }

  const state = {
    name,
    hunger: 0.62,
    energy: 1,
    health: 1.0, // Health stat (1 = full health, 0 = critical)
    entertainment: 1.0, // Mood/boredom stat (1 = engaged, 0 = bored)
    wanderlust: 0.0, // Place-novelty drive (0 = content, 1 = restless)
    comfort: 0.7, // Shelter/warmth drive (1 = settled, 0 = miserable)
    social: 0.55, // Companionship drive (1 = content, 0 = lonely)
    inventory: emptyInventory(),
    hasTools: false,
    bestGatherMult: 1.0,
    action: 'idle',
    actionIndex: 0,
    target: null,
    busy: null, // { kind, t, dur, extra }
    vy: 0,
    landed: false,
    facing: 0,
    walkPhase: 0,
    thinkAcc: 0,
    sluggish: false,
    wantBubble: 'Idle',
    notebook, // Reference to shared discovery notebook
    mixer,
    actions,
    currentAction: null,
    lastForageSource: null, // Track last forage source to encourage variety
    lastBusyKind: null, // Track last busy kind to avoid immediate repetition
    lastPosition: { x: 0, z: 0 }, // Track position for walk distance
    distanceTraveled: 0, // Track travel distance for entertainment
    currentBiome: null, // Current biome (meadow, forest, rock, water)
    biomeEntryTime: 0, // Time when entered current biome
    lastBiomeVisit: {}, // Map of biome -> time since visited (for novelty)
    itch: 0.25, // Property drive (0 = content, 1 = burning need)
    itchTag: 'sharp', // Which property they currently want
    itchBoostTimer: 0, // Timer for 1.5× itch gain after process/combine that didn't yield tag
    wanderTargetBiome: null, // Committed biome when wanderlust is high
    wanderTargetSourceKey: null, // Small key for wander target (harvestType for re-resolve)
    driveCommit: null, // Current committed drive (null, 'hunger', 'health', 'comfort', 'wanderlust', 'itch', 'mood', 'social', 'brain')
    driveCommitT: 0, // Time remaining on drive commitment (seconds)
  };

  const hud = {
    hungerFill: document.getElementById(`${name.toLowerCase()}-hunger-fill`),
    hungerVal: document.getElementById(`${name.toLowerCase()}-hunger-val`),
    energyFill: document.getElementById(`${name.toLowerCase()}-energy-fill`),
    energyVal: document.getElementById(`${name.toLowerCase()}-energy-val`),
    moodFill: document.getElementById(`${name.toLowerCase()}-mood-fill`),
    moodVal: document.getElementById(`${name.toLowerCase()}-mood-val`),
    wanderlustFill: document.getElementById(`${name.toLowerCase()}-wanderlust-fill`),
    wanderlustVal: document.getElementById(`${name.toLowerCase()}-wanderlust-val`),
    itchFill: document.getElementById(`${name.toLowerCase()}-itch-fill`),
    itchVal: document.getElementById(`${name.toLowerCase()}-itch-val`),
    itchTag: document.getElementById(`${name.toLowerCase()}-itch-tag`),
    comfortFill: document.getElementById(`${name.toLowerCase()}-comfort-fill`),
    comfortVal: document.getElementById(`${name.toLowerCase()}-comfort-val`),
    socialFill: document.getElementById(`${name.toLowerCase()}-social-fill`),
    socialVal: document.getElementById(`${name.toLowerCase()}-social-val`),
    action: document.getElementById(`${name.toLowerCase()}-mind`),
    inv: document.getElementById(`${name.toLowerCase()}-inv`),
  };

  function hutNear() {
    const { dist } = nearestBuilding(world, group.position, 'hut');
    return dist < HUT_RADIUS;
  }

  function benchNear() {
    const { item, dist } = nearestBuilding(world, group.position, 'workbench');
    return dist < WORKBENCH_RADIUS ? item : null;
  }

  function fireNear() {
    const { item, dist } = nearestBuilding(world, group.position, 'fire');
    return dist < FIRE_RADIUS ? item : null;
  }
  
  function hasProperty(tag) {
    if (!state.notebook) return false;
    
    // Check inventory
    for (const [itemId, count] of Object.entries(state.inventory)) {
      if (count > 0 && itemHasTag(itemId, tag, state.notebook)) {
        return true;
      }
    }
    
    // Check equipped tools (hasTools means they have metal+sharp+weapon)
    if (state.hasTools && (tag === TAGS.SHARP || tag === TAGS.METAL || tag === TAGS.WEAPON)) {
      return true;
    }
    
    // Check buildings treated as camp stock
    const buildings = world.buildings || [];
    for (const building of buildings) {
      if (itemHasTag(building.type, tag, state.notebook)) {
        return true;
      }
    }
    
    return false;
  }
  
  function pickMissingTag() {
    const itchableTags = [TAGS.SHARP, TAGS.VESSEL, TAGS.FUEL, TAGS.STRUCTURAL, TAGS.MOBILE];
    const missing = itchableTags.filter(tag => !hasProperty(tag));
    
    if (missing.length === 0) {
      return itchableTags[Math.floor(Math.random() * itchableTags.length)];
    }
    
    return missing[Math.floor(Math.random() * missing.length)];
  }
  
  function isMaterialType(itemType) {
    return ['wood', 'ore', 'stone', 'planks', 'ingot', 'sticks'].includes(itemType);
  }
  
  function isFoodType(itemType) {
    if (state.notebook) {
      return isFood(itemType, state.notebook) || isMedicine(itemType, state.notebook);
    }
    return FOOD_TYPES.includes(itemType);
  }
  
  function getMaterialCount() {
    let count = 0;
    for (const [itemType, qty] of Object.entries(state.inventory)) {
      if (isMaterialType(itemType) && qty > 0) {
        count += qty;
      }
    }
    return count;
  }
  
  function getFoodCount() {
    let count = 0;
    for (const [itemType, qty] of Object.entries(state.inventory)) {
      if (isFoodType(itemType) && qty > 0) {
        count += qty;
      }
    }
    return count;
  }
  
  function canAddMaterial(amount = 1) {
    return getMaterialCount() + amount <= MATERIAL_CAP;
  }
  
  function canAddFood(amount = 1) {
    return getFoodCount() + amount <= FOOD_CAP;
  }
  
  function itemCanYieldTag(itemId, tag) {
    if (!state.notebook) return false;
    
    // Check if the item itself has the tag
    if (itemHasTag(itemId, tag, state.notebook)) return true;
    
    // Check if known recipes using this item can produce the tag
    // (e.g., wood can make planks/sticks which are structural+sharp)
    const discoveries = state.notebook.getDiscovered();
    for (const recipe of discoveries) {
      if (recipe.inputs && recipe.inputs.includes(itemId)) {
        if (recipe.tags && recipe.tags.includes(tag)) {
          return true;
        }
      }
    }
    
    // Check BASE_ITEMS for common transforms
    // wood -> planks/sticks (structural+sharp), stone -> sharp, ore -> metal
    const itemInfo = state.notebook._getItemInfo(itemId);
    if (itemInfo && itemInfo.tags) {
      if (itemInfo.tags.includes(tag)) return true;
      
      // Infer potential: structural items + sharp items can make sharp structural things
      if (tag === TAGS.SHARP && (itemInfo.tags.includes(TAGS.STRUCTURAL) || itemId === 'stone')) return true;
      if (tag === TAGS.STRUCTURAL && itemInfo.tags.includes(TAGS.FUEL)) return true; // wood-like
      if (tag === TAGS.METAL && itemInfo.tags.includes(TAGS.METAL)) return true;
      if (tag === TAGS.VESSEL && (itemId === 'stone' || itemId === 'wood' || itemInfo.tags.includes(TAGS.STRUCTURAL))) return true;
    }
    
    return false;
  }

  
  function updateItch(dt) {
    // Initialize itchTag if still default and already have sharp
    if (state.itchTag === 'sharp' && state.itch === 0.25 && hasProperty(TAGS.SHARP)) {
      state.itchTag = pickMissingTag();
    }
    
    const hasCurrentTag = hasProperty(state.itchTag);
    
    if (hasCurrentTag) {
      // Drop itch quickly when we acquire the wanted property
      state.itch = Math.max(0, state.itch - 0.4);
      if (state.itch < 0.1) {
        state.itchTag = pickMissingTag();
        state.itch = 0;
      }
    } else {
      // Climb slowly when lacking the property
      const isNight = world.worldClock && world.worldClock.time >= 0.7;
      
      let itchGain = 0.012 * dt;
      
      if (isNight) {
        itchGain *= 1.3;
      }
      
      // Apply boost only if just finished process/combine (tracked by itchBoostTimer)
      if (state.itchBoostTimer && state.itchBoostTimer > 0) {
        itchGain *= 1.5;
        state.itchBoostTimer -= dt;
      }
      
      state.itch = Math.min(1, state.itch + itchGain);
    }
  }

  
  function updateComfort(dt) {
    const isNight = world.worldClock && world.worldClock.time >= 0.7;
    const nearHut = hutNear();
    const nearFire = !!fireNear();
    const nearBuilding = world.buildings.some((b) => {
      const dx = b.mesh.position.x - group.position.x;
      const dz = b.mesh.position.z - group.position.z;
      return Math.hypot(dx, dz) < 3.5;
    });
    
    // Check for furniture (chair/bed/table) if they exist
    const nearFurniture = world.buildings.some((b) => {
      if (!['chair', 'bed', 'table'].includes(b.type)) return false;
      const dx = b.mesh.position.x - group.position.x;
      const dz = b.mesh.position.z - group.position.z;
      return Math.hypot(dx, dz) < 2.5;
    });
    
    // Check if very close to hut (inside or very near)
    let veryCloseToHut = false;
    if (nearHut) {
      const hutBuilding = world.buildings.find((b) => b.type === 'hut');
      if (hutBuilding) {
        const dx = hutBuilding.mesh.position.x - group.position.x;
        const dz = hutBuilding.mesh.position.z - group.position.z;
        veryCloseToHut = Math.hypot(dx, dz) < 2.0;
      }
    }
    
    // Check if near other settler AND sheltered
    const distToOther = distanceToNearestAgent();
    const nearOtherAndSheltered = distToOther < 2.5 && (nearHut || nearFire);
    
    // Weather effects
    const isRain = world.weather && world.weather.current === 'rain';
    const isWind = world.weather && world.weather.current === 'wind';
    const inTheOpen = !nearHut && !nearFire && !nearBuilding;
    
    let comfortChange = 0;
    
    // Recovery conditions (priority order)
    if (veryCloseToHut) {
      // Inside or very close to hut: strong recovery
      comfortChange = 0.08 * dt;
    } else if (nearHut) {
      // Near hut: good recovery
      comfortChange = 0.05 * dt;
    } else if (nearFire) {
      // Near fire: moderate recovery
      comfortChange = 0.04 * dt;
    } else if (nearFurniture) {
      // Near furniture: small recovery
      comfortChange = 0.025 * dt;
    }
    
    // Bonus recovery when near other settler and sheltered
    if (nearOtherAndSheltered) {
      comfortChange += 0.015 * dt;
    }
    
    // Drain conditions
    if (isNight && !nearHut && !nearFire) {
      // Night in the open: significant drain
      if (!nearBuilding) {
        // No building nearby: faster drain
        comfortChange -= 0.025 * dt;
      } else {
        // Near some building but not hut/fire: slower drain
        comfortChange -= 0.02 * dt;
      }
      
      // Extra drain in rain at night
      if (isRain) {
        comfortChange -= 0.025 * dt;
      }
    } else if (!isNight && !nearHut && !nearFire && !nearBuilding) {
      // Day but completely in the open: very slow drain
      comfortChange -= 0.004 * dt;
    }
    
    // Weather effects during the day in the open
    if (!isNight && inTheOpen) {
      if (isRain) {
        // Rain: extra comfort drain
        comfortChange -= 0.018 * dt;
      } else if (isWind) {
        // Wind: slight comfort drain
        comfortChange -= 0.008 * dt;
      }
    }
    
    // Apply comfort change and clamp
    state.comfort = Math.max(0, Math.min(1, state.comfort + comfortChange));
  }

  
  function updateSocial(dt) {
    const isNight = world.worldClock && world.worldClock.time >= 0.7;
    const distToOther = distanceToNearestAgent();
    const nearHut = hutNear();
    const nearFire = !!fireNear();
    const sheltered = nearHut || nearFire;
    
    let socialChange = 0;
    
    // Recover when close to the other settler
    if (distToOther < 2.5) {
      // Base recovery rate when near
      socialChange = 0.035 * dt;
      
      // Bonus when both near and sheltered (company at camp)
      if (sheltered) {
        socialChange += 0.02 * dt;
      }
    } else {
      // Drain while apart
      let drainRate = 0.015 * dt; // Base drain by day
      
      // Check if committed to wanderlust and walking far
      const isWandering = state.driveCommit === 'wanderlust' && state.wanderlust > 0.6;
      
      if (isNight && !sheltered) {
        // Night alone in the open: lonely + cold = faster drain
        drainRate = 0.035 * dt;
      } else if (isNight) {
        // Night but sheltered: moderate drain
        drainRate = 0.022 * dt;
      } else if (isWandering) {
        // Wandering during the day: small drain (exploration is okay)
        drainRate = 0.008 * dt;
      }
      
      socialChange = -drainRate;
    }
    
    // Apply social change and clamp
    state.social = Math.max(0, Math.min(1, state.social + socialChange));
  }

  
  function distanceToNearestAgent() {
    if (!world.agents || world.agents.length <= 1) return Infinity;
    let minDist = Infinity;
    for (const other of world.agents) {
      if (other.group === group) continue;
      const dx = group.position.x - other.group.position.x;
      const dz = group.position.z - other.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }
  
  function distanceToNearestFire() {
    const { dist } = nearestBuilding(world, group.position, 'fire');
    return dist;
  }
  
  function getForageBiome(source) {
    // Infer biome from position or biome tag
    if (!source) return null;
    
    // Direct biome tag if available
    if (source.biome) return source.biome;
    
    // Infer from position (accurate place-novelty)
    if (source.mesh && source.mesh.position) {
      return getBiomeAt(source.mesh.position.x, source.mesh.position.z);
    }
    
    return null;
  }

  function pickWanderTarget(currentBiome) {
    // Pick a committed wander target: find stalest biome and a source there
    const allBiomes = ['meadow', 'forest', 'rock', 'water'];
    const otherBiomes = allBiomes.filter(b => b !== currentBiome);
    
    // Sort by staleness (longest lastBiomeVisit, or never visited)
    otherBiomes.sort((a, b) => {
      const timeA = state.lastBiomeVisit[a] ?? 999;
      const timeB = state.lastBiomeVisit[b] ?? 999;
      return timeB - timeA;
    });
    
    const targetBiome = otherBiomes[0];
    
    // Find any forage source in that biome
    const allForageSources = world.forageSources || [];
    const sources = allForageSources
      .filter(s => s.charges > 0)
      .map(s => ({
        source: s,
        biome: getForageBiome(s),
        dist: Math.hypot(s.mesh.position.x - group.position.x, s.mesh.position.z - group.position.z),
      }))
      .filter(opt => opt.biome === targetBiome)
      .sort((a, b) => a.dist - b.dist);
    
    if (sources.length > 0) {
      const src = sources[0].source;
      // Store only harvestType as key for re-resolve on load
      return { biome: targetBiome, sourceKey: src.harvestType };
    }
    
    return { biome: targetBiome, sourceKey: null };
  }

  function snap() {
    const food = nearestPickup(world, group.position, FOOD_TYPES);
    const wood = nearestPickup(world, group.position, ['wood']);
    const ore = nearestPickup(world, group.position, ['ore']);
    const stone = nearestPickup(world, group.position, ['stone']);
    const grain = nearestPickup(world, group.position, ['grain']);
    const wb = nearestBuilding(world, group.position, 'workbench');
    const hut = nearestBuilding(world, group.position, 'hut');
    
    const currentBiome = getBiomeAt(group.position.x, group.position.z);
    
    // Find forage sources, organized by biome if wanderlust is high
    const forageFood = nearestForageSource(world, group.position, ['berry', 'grain', 'fish', 'mushroom', 'fruit', 'herb']);
    const forageWood = nearestForageSource(world, group.position, ['wood']);
    const forageOre = nearestForageSource(world, group.position, ['ore']);
    const forageStone = nearestForageSource(world, group.position, ['stone']);
    const forageWater = nearestForageSource(world, group.position, ['water']);
    
    // If wanderlust is high (>0.6), prefer targets in committed biome
    let forageTargets = {
      food: forageFood,
      wood: forageWood,
      ore: forageOre,
      stone: forageStone,
      water: forageWater,
    };
    
    if (state.wanderlust > 0.6) {
      // Update committed target if needed
      if (!state.wanderTargetBiome || state.wanderTargetBiome === currentBiome) {
        const target = pickWanderTarget(currentBiome);
        state.wanderTargetBiome = target.biome;
        state.wanderTargetSourceKey = target.sourceKey;
      }
      
      // If we have a committed target, use sources from that biome
      if (state.wanderTargetBiome) {
        const allForageSources = world.forageSources || [];
        
        for (const [key, types] of [
          ['food', ['berry', 'grain', 'fish', 'mushroom', 'fruit', 'herb']],
          ['wood', ['wood']],
          ['ore', ['ore']],
          ['stone', ['stone']],
          ['water', ['water']],
        ]) {
          const alternatives = allForageSources
            .filter(s => types.includes(s.harvestType) && s.charges > 0)
            .map(s => ({
              source: s,
              biome: getForageBiome(s),
              dist: Math.hypot(s.mesh.position.x - group.position.x, s.mesh.position.z - group.position.z),
            }))
            .filter(opt => opt.biome === state.wanderTargetBiome)
            .sort((a, b) => a.dist - b.dist);
          
          if (alternatives.length > 0) {
            forageTargets[key] = { item: alternatives[0].source, dist: alternatives[0].dist };
          }
        }
      }
    }
    
    const huntable = nearestHuntableFauna(world, group.position);
    const tendable = nearestTendableFauna(world, group.position);
    
    return {
      food,
      wood,
      ore,
      stone,
      grain,
      wb,
      hut,
      forageFood: forageTargets.food,
      forageWood: forageTargets.wood,
      forageOre: forageTargets.ore,
      forageStone: forageTargets.stone,
      forageWater: forageTargets.water,
      huntable,
      tendable,
      hasHut: world.buildings.some((b) => b.type === 'hut'),
      hasWorkbench: world.buildings.some((b) => b.type === 'workbench'),
      hasForageSources: world.forageSources && world.forageSources.some((s) => s.charges > 0),
      hasPen: world.buildings.some((b) => b.type === 'pen'),
      hasTrough: world.buildings.some((b) => b.type === 'trough'),
      currentBiome,
    };
  }

  function pickDrive(s) {
    const isNight = world.worldClock && world.worldClock.time >= 0.7;
    const hasHutOrFire = s.hasHut || world.buildings.some((b) => b.type === 'fire');
    const hasHerbOrMushroom = (state.inventory.herb || 0) > 0 || (state.inventory.mushroom || 0) > 0;
    const canGatherMedicine = s.forageFood.item && (s.forageFood.item.harvestType === 'herb' || s.forageFood.item.harvestType === 'mushroom');
    
    const scores = {
      hunger: 0,
      health: 0,
      comfort: 0,
      wanderlust: 0,
      itch: 0,
      mood: 0,
      social: 0,
      brain: 0.25,
    };
    
    // Hunger: high when hunger is low, zero at 0.75+
    if (state.hunger < 0.75) {
      const normalized = 1 - (state.hunger / 0.75);
      scores.hunger = Math.pow(normalized, 1.5);
    }
    
    // Health: high when health is low, especially if medicine/herbs available
    if (state.health < 0.5) {
      const normalized = 1 - (state.health / 0.5);
      let healthScore = Math.pow(normalized, 1.3);
      
      if (state.health < 0.25) {
        healthScore = Math.max(healthScore, 0.95);
      }
      
      if (hasAnyMedicine(s) || hasHerbOrMushroom || canGatherMedicine) {
        healthScore *= 1.3;
      }
      
      scores.health = Math.min(1, healthScore);
    }
    
    // Comfort: high at night when low, near zero by day unless abysmal
    if (isNight && state.comfort < 0.55) {
      const normalized = 1 - (state.comfort / 0.55);
      scores.comfort = Math.pow(normalized, 1.2) * 0.95;
    } else if (state.comfort < 0.4) {
      const normalized = 1 - (state.comfort / 0.4);
      scores.comfort = Math.pow(normalized, 1.4) * 0.75;
    }
    
    // Comfort must beat wanderlust at night if hut/fire exists
    if (isNight && hasHutOrFire && state.comfort < 0.55) {
      scores.comfort = Math.max(scores.comfort, 0.85);
    }
    
    // Wanderlust: only counts when fed and (day or comfortable)
    if (state.hunger >= 0.5 && ((!isNight) || state.comfort >= 0.55)) {
      scores.wanderlust = state.wanderlust * 0.85;
    }
    
    // Itch: only when body is okay
    if (state.hunger >= 0.45 && state.health >= 0.4 && !(isNight && state.comfort < 0.55)) {
      scores.itch = state.itch * 0.8;
    }
    
    // Mood (boredom): only when body is okay
    const boredom = 1 - state.entertainment;
    if (state.hunger >= 0.45 && state.health >= 0.4 && !(isNight && state.comfort < 0.55)) {
      if (boredom > 0.65) {
        scores.mood = Math.pow(boredom, 1.5) * 0.7;
      }
    }
    
    // Social: only when body is okay
    if (state.hunger >= 0.45 && state.health >= 0.4 && !(isNight && state.comfort < 0.55)) {
      const loneliness = 1 - state.social;
      scores.social = Math.pow(loneliness, 1.3) * 0.75;
    } else if (state.hunger >= 0.45 && state.health >= 0.4 && isNight && state.comfort >= 0.55) {
      // At night but comfortable (at hut/fire): social can still count
      const loneliness = 1 - state.social;
      scores.social = Math.pow(loneliness, 1.3) * 0.75;
    }
    
    return scores;
  }
  
  function applyDrive(winner, s, brainAction, brainName) {
    let action = brainAction;
    let name = brainName;
    
    if (winner === 'hunger') {
      if (name === 'eat' || hasAnyFood(s)) {
        name = 'seek_food';
        action = ACTION_NAMES.indexOf('seek_food');
      }
    } else if (winner === 'health') {
      if (hasAnyMedicine(s)) {
        name = 'use_medicine';
        action = 0;
      } else {
        const hasHerbOrMushroom = (state.inventory.herb || 0) > 0 || (state.inventory.mushroom || 0) > 0;
        const canGatherHerb = s.forageFood.item && s.forageFood.item.harvestType === 'herb';
        const canGatherMushroom = s.forageFood.item && s.forageFood.item.harvestType === 'mushroom';
        
        if (hasHerbOrMushroom && canCombineAny()) {
          name = 'combine';
          action = ACTION_NAMES.indexOf('combine');
        } else if (canGatherHerb || canGatherMushroom) {
          name = 'seek_food';
          action = ACTION_NAMES.indexOf('seek_food');
        }
      }
    } else if (winner === 'comfort') {
      name = 'idle';
      action = ACTION_NAMES.indexOf('idle');
    } else if (winner === 'wanderlust') {
      const isIdleAction = (name === 'idle' || name === 'eat' || name === 'combine' || name === 'process');
      if (isIdleAction || (name === 'seek_food' && (state.inventory.berry || 0) > 0)) {
        const hasForageTargets = s.forageFood.item || s.forageWood.item || s.forageOre.item || s.forageStone.item;
        if (hasForageTargets) {
          if (s.forageFood.item) {
            name = 'seek_food';
            action = ACTION_NAMES.indexOf('seek_food');
          } else {
            name = 'seek_material';
            action = ACTION_NAMES.indexOf('seek_material');
          }
        }
      }
    } else if (winner === 'itch') {
      const canSeekMaterial = (s.wood.item || s.forageWood.item || s.ore.item || s.forageOre.item || s.stone.item || s.forageStone.item);
      const alternatives = [];
      
      if (canSeekMaterial) alternatives.push('seek_material');
      if (canProcessAny()) alternatives.push('process');
      if (canCombineAny()) alternatives.push('combine');
      if (nextBuild()) alternatives.push('build');
      
      if (alternatives.length > 0 && (name === 'eat' || name === 'seek_food' || name === 'idle')) {
        name = alternatives[Math.floor(Math.random() * alternatives.length)];
        action = ACTION_NAMES.indexOf(name);
      }
    } else if (winner === 'mood') {
      const isBoring = 
        (name === 'eat' && state.lastBusyKind === 'eat') ||
        (name === 'seek_food' && state.lastBusyKind === 'forage') ||
        (name === 'combine' && !canCombineAny());
      
      if (isBoring) {
        const alternatives = [];
        if (canProcessAny()) alternatives.push('process');
        if (nextBuild()) alternatives.push('build');
        if (canCombineAny()) alternatives.push('combine');
        alternatives.push('seek_material');
        
        const filtered = alternatives.filter(a => a !== state.lastBusyKind);
        if (filtered.length > 0) {
          name = filtered[Math.floor(Math.random() * filtered.length)];
          action = ACTION_NAMES.indexOf(name);
        }
      }
    } else if (winner === 'social') {
      // Remap idle/eat/combine/process/seek_food/seek_material/build to idle (will walk to other agent in act())
      if (name === 'idle' || name === 'eat' || name === 'combine' || name === 'process' || name === 'seek_food' || name === 'seek_material' || name === 'build') {
        name = 'idle';
        action = ACTION_NAMES.indexOf('idle');
      }
    }
    
    return { action, name };
  }

  function think() {
    const s = snap();
    const emptyInv = inventoryEmpty(state.inventory);
    const force = shouldForceIdle({
      pickupCount: world.pickups.length,
      inventoryEmpty: emptyInv,
      hasHut: s.hasHut,
      hasWorkbench: s.hasWorkbench,
      hasTools: state.hasTools,
      hasForageSources: s.hasForageSources,
    });

    if (force) {
      state.action = 'idle';
      state.actionIndex = 0;
      state.target = null;
      state.wantBubble = 'Idle';
      brain.last = null;
      return;
    }

    if (state.hunger <= 0 && !hasAnyFood(s)) {
      state.action = 'idle-hungry';
      state.actionIndex = 0;
      state.target = null;
      state.wantBubble = 'Starving';
      brain.reinforce(-0.2);
      return;
    }
    
    // Prioritize medicine when health is critically low
    if (state.health < 0.3 && hasAnyMedicine(s)) {
      state.action = 'use_medicine';
      state.actionIndex = 0;
      state.target = null;
      state.wantBubble = 'Healing';
      return;
    }

    // Compute tag flags
    let hasSharp = false;
    let hasMetal = false;
    let hasVehicle = false;
    
    if (state.notebook) {
      for (const [itemId, count] of Object.entries(state.inventory)) {
        if (count > 0) {
          if (itemHasTag(itemId, TAGS.SHARP, state.notebook)) hasSharp = true;
          if (itemHasTag(itemId, TAGS.METAL, state.notebook)) hasMetal = true;
          if (itemHasTag(itemId, TAGS.VEHICLE, state.notebook)) hasVehicle = true;
        }
      }
    }
    
    const input = encodeInputs({
      hunger: state.hunger,
      energy: state.energy,
      inventory: state.inventory,
      distFood: s.food.dist,
      distWood: s.wood.dist,
      distOre: s.ore.dist,
      distStone: s.stone.dist,
      distGrain: s.grain.dist,
      distWorkbench: s.wb.dist,
      distHut: s.hut.dist,
      hasHut: s.hasHut,
      hasWorkbench: s.hasWorkbench,
      hasTools: state.hasTools,
      starving: state.hunger < 0.18,
      distForageFood: s.forageFood.dist,
      distForageWood: s.forageWood.dist,
      distForageOre: s.forageOre.dist,
      distForageStone: s.forageStone.dist,
      hasSharp,
      hasMetal,
      hasVehicle,
    });

    let { action, name } = brain.act(input);
    
    // Satiety constraint: never eat if already full
    if (name === 'eat' && state.hunger >= 0.75) {
      name = 'seek_material';
      action = ACTION_NAMES.indexOf('seek_material');
    }
    
    // Building preference: if we can afford a plank building, prefer building over milling planks
    if (name === 'process') {
      const plankBuilding = nextBuild();
      if (plankBuilding && plankBuilding !== 'tools' && plankBuilding !== 'fire') {
        const rec = BUILD[plankBuilding];
        if (rec.cost.planks && canAfford(state.inventory, rec.cost)) {
          name = 'build';
          action = ACTION_NAMES.indexOf('build');
        }
      }
    }
    
    // Compute urgency scores for all drives
    const scores = pickDrive(s);
    
    // Find winner: argmax with hysteresis
    let winner = 'brain';
    let maxScore = scores.brain;
    
    for (const [drive, score] of Object.entries(scores)) {
      if (drive === state.driveCommit) {
        if (score + 0.08 > maxScore) {
          winner = drive;
          maxScore = score + 0.08;
        }
      } else if (score > maxScore) {
        winner = drive;
        maxScore = score;
      }
    }
    
    // Survive drives can override commit
    if (state.driveCommit && state.driveCommit !== winner && state.driveCommitT > 0) {
      const surviveWinner = ['hunger', 'health'];
      const surviveCommit = ['hunger', 'health', 'comfort'];
      
      // If new winner is hunger/health and score >= committed, always switch
      if (surviveWinner.includes(winner) && scores[winner] >= scores[state.driveCommit]) {
        winner = winner;
      }
      // If committed is survive and new winner is not hunger/health, require +0.2 to break
      else if (surviveCommit.includes(state.driveCommit) && !surviveWinner.includes(winner)) {
        if (scores[winner] > scores[state.driveCommit] + 0.2) {
          winner = winner;
        } else {
          winner = state.driveCommit;
        }
      }
    }
    
    // Commit to winner for 6-10 seconds
    if (state.driveCommit !== winner || state.driveCommitT <= 0) {
      state.driveCommit = winner;
      state.driveCommitT = 6 + Math.random() * 4;
    }
    
    // Apply drive to remap action
    const result = applyDrive(winner, s, action, name);
    action = result.action;
    name = result.name;
    
    state.actionIndex = action;
    state.action = name;
    
    // Update want bubble based on action and state
    updateWantBubble(s);

    // Minimal reinforcement shaping: needs-based only
    let shape = 0;
    if (state.hunger < 0.3) shape -= 0.15;
    if (name === 'eat' && hasAnyFood(s)) {
      if (state.hunger < 0.45) {
        shape += 0.08;
      } else if (state.hunger >= 0.75) {
        shape -= 0.15;
      }
    }
    if (name === 'process' && canProcessAny()) shape += 0.03;
    if (name === 'build' && nextBuild()) shape += 0.04;
    if (name === 'combine' && canCombineAny()) shape += 0.02;
    if (name === 'seek_material' && (s.wood.item || s.forageWood.item)) shape += 0.02;
    brain.reinforce(shape);
  }
  
  function updateWantBubble(s) {
    const isNight = world.worldClock && world.worldClock.time >= 0.7;
    const nearHut = hutNear();
    const nearFire = !!fireNear();
    
    if (state.wantBubble && state.wantBubble !== 'Idle') {
      return;
    }
    
    if (state.driveCommit === 'hunger') {
      state.wantBubble = 'Hungry';
    } else if (state.driveCommit === 'health') {
      state.wantBubble = 'Healing';
    } else if (state.driveCommit === 'comfort') {
      if (isNight && !nearHut && !nearFire) {
        state.wantBubble = 'Cold';
      } else {
        state.wantBubble = 'Shelter';
      }
    } else if (state.driveCommit === 'wanderlust') {
      state.wantBubble = 'Restless';
    } else if (state.driveCommit === 'itch') {
      state.wantBubble = 'Itch';
    } else if (state.driveCommit === 'mood') {
      state.wantBubble = 'Bored';
    } else if (state.driveCommit === 'social') {
      state.wantBubble = 'Lonely';
    } else if (state.hunger <= 0.3) {
      state.wantBubble = 'Hungry';
    } else if ((isNight && state.comfort < 0.55) || state.comfort < 0.4) {
      if (isNight && !nearHut && !nearFire) {
        state.wantBubble = 'Cold';
      } else {
        state.wantBubble = 'Shelter';
      }
    } else if (isNight && !nearHut && !nearFire) {
      state.wantBubble = 'Cold';
    } else if (!state.hasTools && state.inventory.ingot >= 2) {
      state.wantBubble = 'Wants tools';
    } else if (!s.hasWorkbench) {
      state.wantBubble = 'Wants workbench';
    } else if (!s.hasHut) {
      state.wantBubble = 'Wants hut';
    } else if (state.action === 'combine') {
      state.wantBubble = 'Inventing';
    } else if (state.action === 'seek_material' || state.action === 'seek_food') {
      state.wantBubble = 'Gathering';
    } else if (state.action === 'process') {
      state.wantBubble = 'Crafting';
    } else if (state.action === 'build') {
      state.wantBubble = 'Building';
    } else if (state.hunger > 0.8) {
      state.wantBubble = 'Content';
    } else {
      state.wantBubble = 'Idle';
    }
  }

  function hasAnyFood(s) {
    // Check inventory for food items
    if (state.notebook) {
      for (const [itemId, count] of Object.entries(state.inventory)) {
        if (count > 0 && isFood(itemId, state.notebook)) return true;
      }
    }
    // Fallback to known food types
    return (
      FOOD_TYPES.some((t) => (state.inventory[t] || 0) > 0) ||
      !!(s && s.food.item) ||
      !!(s && s.forageFood.item)
    );
  }
  
  function hasAnyMedicine(s) {
    // Check inventory for medicine items
    if (state.notebook) {
      for (const [itemId, count] of Object.entries(state.inventory)) {
        if (count > 0 && isMedicine(itemId, state.notebook)) return true;
      }
    }
    return false;
  }
  
  function bestInvMedicine() {
    if (!state.notebook) return null;
    
    let best = null;
    let bestHealth = 0;
    
    for (const [itemId, count] of Object.entries(state.inventory)) {
      if (count > 0 && isMedicine(itemId, state.notebook)) {
        const healthVal = getHealthValue(itemId, state.notebook);
        if (healthVal && healthVal.health > bestHealth) {
          best = itemId;
          bestHealth = healthVal.health;
        }
      }
    }
    
    return best;
  }
  
  function getItemBases(itemId) {
    if (!state.notebook) return [itemId];
    
    const info = state.notebook._getItemInfo(itemId);
    return info.bases || [itemId];
  }
  
  function hasWeapon() {
    // Check if agent has any weapon-tagged item
    if (!state.notebook) {
      return state.hasTools; // Fallback: tools count as weapons
    }
    
    for (const [itemId, count] of Object.entries(state.inventory)) {
      if (count > 0 && itemHasTag(itemId, TAGS.WEAPON, state.notebook)) {
        return true;
      }
    }
    
    return false;
  }
  
  function canCombineAny() {
    // Can combine if we have at least 2 different items with count > 0
    const items = Object.entries(state.inventory)
      .filter(([_, count]) => count > 0)
      .map(([id, _]) => id);
    
    if (items.length < 2) return false;
    
    // Check if we can find a valid pair
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const item1 = items[i];
        const item2 = items[j];
        
        if (!state.notebook) return true; // Fallback: allow any combination
        
        const isFood1 = isFood(item1, state.notebook);
        const isFood2 = isFood(item2, state.notebook);
        const isWater1 = item1 === 'water';
        const isWater2 = item2 === 'water';
        const isFire1 = item1 === 'fire';
        const isFire2 = item2 === 'fire';
        
        // If not both food, always valid
        if (!isFood1 || !isFood2) return true;
        
        // If one is water or fire, valid (cooking)
        if (isWater1 || isWater2 || isFire1 || isFire2) return true;
        
        // Both are food and no water/fire: check if merging bases would be new
        const bases1 = getItemBases(item1);
        const bases2 = getItemBases(item2);
        const merged = [...new Set([...bases1, ...bases2])].sort();
        
        // Check if a recipe with these exact bases already exists
        const existingRecipe = Array.from(state.notebook.recipes.values()).find(r => {
          if (!r.bases) return false;
          const rBases = [...r.bases].sort();
          return rBases.length === merged.length && rBases.every((b, idx) => b === merged[idx]);
        });
        
        // If no existing recipe with these bases, this is a valid new combo
        if (!existingRecipe) return true;
        
        // If the exact pair is already known, we can remake it
        const key = [item1, item2].sort().join('+');
        if (state.notebook.recipes.has(key)) return true;
      }
    }
    
    return false;
  }
  
  function pickTwoCombineItems() {
    // Pick two different items from inventory
    const items = Object.entries(state.inventory)
      .filter(([_, count]) => count > 0)
      .map(([id, _]) => id);
    
    if (items.length < 2) return null;
    
    if (!state.notebook) {
      // Fallback: pick any two
      const idx1 = Math.floor(Math.random() * items.length);
      let idx2 = Math.floor(Math.random() * items.length);
      while (idx2 === idx1 && items.length > 1) {
        idx2 = Math.floor(Math.random() * items.length);
      }
      return [items[idx1], items[idx2]];
    }
    
    // Try to find valid pairs
    const validPairs = [];
    
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const item1 = items[i];
        const item2 = items[j];
        
        const isFood1 = isFood(item1, state.notebook);
        const isFood2 = isFood(item2, state.notebook);
        const isWater1 = item1 === 'water';
        const isWater2 = item2 === 'water';
        const isFire1 = item1 === 'fire';
        const isFire2 = item2 === 'fire';
        
        // Not both food, or one is water/fire: valid
        if (!isFood1 || !isFood2 || isWater1 || isWater2 || isFire1 || isFire2) {
          validPairs.push([item1, item2]);
          continue;
        }
        
        // Both food: check if bases would be new or if exact pair is known
        const bases1 = getItemBases(item1);
        const bases2 = getItemBases(item2);
        const merged = [...new Set([...bases1, ...bases2])].sort();
        
        const existingRecipe = Array.from(state.notebook.recipes.values()).find(r => {
          if (!r.bases) return false;
          const rBases = [...r.bases].sort();
          return rBases.length === merged.length && rBases.every((b, idx) => b === merged[idx]);
        });
        
        if (!existingRecipe) {
          validPairs.push([item1, item2]);
          continue;
        }
        
        // Exact pair is a known recipe: allow remaking it
        const key = [item1, item2].sort().join('+');
        if (state.notebook.recipes.has(key)) {
          validPairs.push([item1, item2]);
        }
      }
    }
    
    if (validPairs.length > 0) {
      return validPairs[Math.floor(Math.random() * validPairs.length)];
    }
    
    return null;
  }
  
  function updateBestGatherMult() {
    if (!state.notebook) {
      state.bestGatherMult = state.hasTools ? 2.0 : 1.0;
      return;
    }
    
    let best = 1.0;
    
    for (const [itemId, count] of Object.entries(state.inventory)) {
      if (count > 0) {
        const mult = getGatherMult(itemId, state.notebook);
        if (mult > best) best = mult;
      }
    }
    
    state.bestGatherMult = best;
  }

  function canProcessInput(inputType) {
    return canProcess(inputType, state.inventory);
  }

  function canProcessAny() {
    return Object.keys(PROCESS).some((k) => canProcessWithoutStarvingBuildings(k));
  }

  function nextBuild() {
    if (!state.hasTools && canAfford(state.inventory, BUILD.tools.cost)) return 'tools';
    const hasWb = world.buildings.some((b) => b.type === 'workbench');
    const hasHut = world.buildings.some((b) => b.type === 'hut');
    const hasFire = world.buildings.some((b) => b.type === 'fire');
    const hasWell = world.buildings.some((b) => b.type === 'well');
    const hasChest = world.buildings.some((b) => b.type === 'chest');
    if (!hasWb && canAfford(state.inventory, BUILD.workbench.cost)) return 'workbench';
    if (!hasHut && canAfford(state.inventory, BUILD.hut.cost)) return 'hut';
    if (!hasFire && canAfford(state.inventory, BUILD.fire.cost)) return 'fire';
    if (!hasWell && canAfford(state.inventory, BUILD.well.cost)) return 'well';
    if (!hasChest && canAfford(state.inventory, BUILD.chest.cost)) return 'chest';
    return null;
  }
  
  function plankReserveForNextBuild() {
    const hasWb = world.buildings.some((b) => b.type === 'workbench');
    const hasHut = world.buildings.some((b) => b.type === 'hut');
    const hasFire = world.buildings.some((b) => b.type === 'fire');
    const hasWell = world.buildings.some((b) => b.type === 'well');
    const hasChest = world.buildings.some((b) => b.type === 'chest');
    
    if (!hasWb) return BUILD.workbench.cost.planks || 0;
    if (!hasHut) return BUILD.hut.cost.planks || 0;
    if (!hasFire) return 0;
    if (!hasWell) return BUILD.well.cost.planks || 0;
    if (!hasChest) return BUILD.chest.cost.planks || 0;
    
    return 0;
  }
  
  function canProcessWithoutStarvingBuildings(inputType) {
    if (inputType !== 'planks') return canProcessInput(inputType);
    
    const plankCount = state.inventory.planks || 0;
    const reserve = plankReserveForNextBuild();
    
    if (plankCount <= reserve) return false;
    
    return canProcessInput(inputType);
  }

  function bestInvFood() {
    // Prioritize known good foods first
    const knownOrder = ['stew', 'cooked_fish', 'bread', 'fish', 'berry', 'grain', 'water'];
    for (const foodId of knownOrder) {
      if ((state.inventory[foodId] || 0) > 0) return foodId;
    }
    
    // Check discovered food items
    if (state.notebook) {
      let best = null;
      let bestHunger = 0;
      
      for (const [itemId, count] of Object.entries(state.inventory)) {
        if (count > 0 && isFood(itemId, state.notebook)) {
          const foodVal = getFoodValue(itemId, state.notebook);
          if (foodVal && foodVal.hunger > bestHunger) {
            best = itemId;
            bestHunger = foodVal.hunger;
          }
        }
      }
      
      if (best) return best;
    }
    
    return null;
  }

  function separateFromOthers() {
    // Push this agent away from other agents to maintain personal space
    if (!world.agents) return;
    
    const MIN_DISTANCE = 0.95; // Minimum center distance on XZ plane
    
    for (const other of world.agents) {
      if (other.group === group) continue; // Skip self
      
      const dx = group.position.x - other.group.position.x;
      const dz = group.position.z - other.group.position.z;
      const dist = Math.hypot(dx, dz);
      
      if (dist < MIN_DISTANCE) {
        // Calculate push direction
        let pushX, pushZ;
        
        if (dist < 0.01) {
          // Nearly coincident - use stable offset based on name
          const offset = (state.name.charCodeAt(0) * 0.1) % (Math.PI * 2);
          pushX = Math.cos(offset);
          pushZ = Math.sin(offset);
        } else {
          // Push away from other agent
          pushX = dx / dist;
          pushZ = dz / dist;
        }
        
        // Soft push: move half the overlap distance this frame
        const overlap = MIN_DISTANCE - dist;
        const pushAmount = overlap * 0.5;
        
        group.position.x += pushX * pushAmount;
        group.position.z += pushZ * pushAmount;
      }
    }
  }
  
  function getSideSlotTarget(targetX, targetZ) {
    // Check if another agent is already at or heading to this target
    if (!world.agents) return { x: targetX, z: targetZ };
    
    for (const other of world.agents) {
      if (other.group === group) continue; // Skip self
      
      const otherDist = Math.hypot(other.group.position.x - targetX, other.group.position.z - targetZ);
      
      // If another agent is close to the target, offset to a side slot
      if (otherDist < 1.2) {
        // Calculate approach vector from this agent to target
        const approachDx = targetX - group.position.x;
        const approachDz = targetZ - group.position.z;
        const approachDist = Math.hypot(approachDx, approachDz);
        
        if (approachDist > 0.1) {
          // Perpendicular offset (rotate approach vector by 90 degrees)
          const perpX = -approachDz / approachDist;
          const perpZ = approachDx / approachDist;
          
          // Decide which side based on agent name for stability
          const side = (state.name.charCodeAt(0) % 2) === 0 ? 1 : -1;
          const offsetDistance = 0.8;
          
          return {
            x: targetX + perpX * offsetDistance * side,
            z: targetZ + perpZ * offsetDistance * side,
          };
        }
      }
    }
    
    return { x: targetX, z: targetZ };
  }

  function walkToward(x, z, dt, speed) {
    const dx = x - group.position.x;
    const dz = z - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return 0;
    
    // Apply weather effect on speed
    const isWind = world.weather && world.weather.current === 'wind';
    let actualSpeed = speed;
    if (isWind) {
      actualSpeed *= 0.85; // Slow down 15% in wind
    }
    
    const step = Math.min(dist, actualSpeed * dt);
    group.position.x += (dx / dist) * step;
    group.position.z += (dz / dist) * step;
    
    // Update Y position to follow terrain (feet on ground)
    if (world.heightAt) {
      group.position.y = world.heightAt(group.position.x, group.position.z);
    }
    
    const yaw = Math.atan2(dx, dz);
    state.facing = yaw;
    group.rotation.y = yaw;
    state.walkPhase += dt * 9 * (speed / 2.2);
    
    // Track distance traveled for entertainment
    state.distanceTraveled += step;
    
    // Apply separation after movement
    separateFromOthers();
    
    return dist - step;
  }

  function animate(dt, walking) {
    if (!state.landed) return;
    const root = parts.root;
    const t = performance.now() * 0.001;
    
    // Footstep sound with biome awareness
    if (walking && root) {
      const phase = Math.sin(state.walkPhase);
      if (phase > 0.9 && !state.lastFootstep) {
        const currentBiome = getBiomeAt(group.position.x, group.position.z);
        playFootstep(state.name, currentBiome);
        state.lastFootstep = true;
      } else if (phase < 0) {
        state.lastFootstep = false;
      }
    }
    
    // If using animation mixer with clips, drive animation with mixer
    if (state.mixer && Object.keys(state.actions).length > 0) {
      state.mixer.update(dt);
      
      // Determine which clip to play based on state
      let desiredAction = null;
      
      if (walking) {
        desiredAction = 'walk';
      } else if (state.busy) {
        // Check if busy task is a "working" action
        const workingTasks = ['eat', 'process', 'build', 'combine', 'forage', 'hunt', 'tend'];
        if (workingTasks.includes(state.busy.kind)) {
          desiredAction = 'work';
        } else {
          desiredAction = 'idle';
        }
      } else {
        desiredAction = 'idle';
      }
      
      // Fallback if desired action not available
      if (!state.actions[desiredAction]) {
        if (state.actions.idle) desiredAction = 'idle';
        else if (state.actions.walk) desiredAction = 'walk';
        else desiredAction = Object.keys(state.actions)[0];
      }
      
      // Fade to new action if changed
      if (desiredAction && state.currentAction !== desiredAction && state.actions[desiredAction]) {
        const fadeTime = 0.15;
        
        if (state.currentAction && state.actions[state.currentAction]) {
          state.actions[state.currentAction].fadeOut(fadeTime);
        }
        
        const newAction = state.actions[desiredAction];
        newAction.reset().fadeIn(fadeTime).play();
        state.currentAction = desiredAction;
      }
      
      return;
    }
    
    // Procedural fallback animation (original code)
    // Note: Do not overwrite group.position.y here; it's managed by walkToward/update
    if (!root) {
      return;
    }
    if (walking) {
      root.position.y = Math.abs(Math.sin(state.walkPhase)) * 0.06;
      const swing = Math.sin(state.walkPhase) * 0.55;
      if (parts.armL) parts.armL.rotation.x = swing;
      if (parts.armR) parts.armR.rotation.x = -swing;
      if (parts.legL) parts.legL.rotation.x = -swing * 0.7;
      if (parts.legR) parts.legR.rotation.x = swing * 0.7;
    } else if (state.busy) {
      root.position.y = Math.abs(Math.sin(t * 8)) * 0.03;
      if (parts.armL) parts.armL.rotation.x = -0.6 + Math.sin(t * 10) * 0.4;
      if (parts.armR) parts.armR.rotation.x = -0.4 + Math.sin(t * 10 + 1) * 0.35;
      if (parts.legL) parts.legL.rotation.x = 0;
      if (parts.legR) parts.legR.rotation.x = 0;
    } else {
      root.position.y = Math.sin(t * 2.2) * 0.02;
      if (parts.armL) parts.armL.rotation.x = Math.sin(t * 2.2) * 0.04;
      if (parts.armR) parts.armR.rotation.x = Math.sin(t * 2.2 + 0.4) * 0.04;
      if (parts.legL) parts.legL.rotation.x = 0;
      if (parts.legR) parts.legR.rotation.x = 0;
    }
    if (parts.tool) parts.tool.visible = state.hasTools;
  }

  function startEat(type, fromWorldItem) {
    // Don't eat if already full (satiety check)
    if (state.hunger >= 0.75) {
      return;
    }
    
    let rec = FOOD[type];
    
    // If not in base FOOD, check discovered items
    if (!rec && state.notebook) {
      const foodVal = getFoodValue(type, state.notebook);
      if (foodVal) {
        rec = foodVal;
      }
    }
    
    if (!rec) {
      // Fallback
      rec = { hunger: 0.1, time: 2.5, energy: 0.02 };
    }
    
    // Play soft eating sound
    playEat();
    
    state.busy = { kind: 'eat', t: 0, dur: rec.time, type, fromWorldItem };
  }
  
  function startUseMedicine(type, fromWorldItem) {
    let rec = null;
    
    if (state.notebook) {
      const healthVal = getHealthValue(type, state.notebook);
      if (healthVal) {
        rec = healthVal;
      }
    }
    
    if (!rec) {
      // Fallback for medicine
      rec = { health: 0.3, time: 2.5 };
    }
    
    state.busy = { kind: 'use_medicine', t: 0, dur: rec.time, type, fromWorldItem };
  }

  function startProcess(inputType) {
    const atBench = !!benchNear();
    const nearFire = !!fireNear();
    const dur = processDuration(inputType, { atBench, hasTools: state.hasTools, nearFire });
    
    // Play processing sound
    playProcess();
    
    state.busy = { kind: 'process', t: 0, dur, inputType, atBench, nearFire };
  }

  function startBuild(what) {
    const rec = BUILD[what];
    state.busy = { kind: 'build', t: 0, dur: rec.time, what };
  }

  function startForage(source) {
    // Duration based on harvest type
    const harvestType = source.harvestType || 'default';
    let dur = 4.0; // default
    
    switch (harvestType) {
      case 'water':
        dur = 2.5;
        break;
      case 'berry':
        dur = 3.5;
        break;
      case 'grain':
        dur = 4.0;
        break;
      case 'fish':
        dur = 6.0;
        break;
      case 'wood':
        dur = 7.0;
        break;
      case 'stone':
        dur = 7.0;
        break;
      case 'ore':
        dur = 9.0;
        break;
      case 'mushroom':
        dur = 3.5;
        break;
      case 'fruit':
        dur = 3.8;
        break;
      case 'herb':
        dur = 3.0;
        break;
    }
    
    // Tools reduce forage time to 75%
    if (state.hasTools) {
      dur *= 0.75;
    }
    
    // Rain slows forage slightly
    const isRain = world.weather && world.weather.current === 'rain';
    if (isRain) {
      dur *= 1.15; // 15% slower in rain
    }
    
    // Play gather sound with harvest type
    playGather(harvestType);
    
    state.busy = { kind: 'forage', t: 0, dur, source, hasTools: state.hasTools };
  }
  
  function startHunt(creature) {
    // Hunting duration ~6s
    state.busy = { kind: 'hunt', t: 0, dur: 6.0, creature };
  }
  
  function startTend(creature) {
    // Tending duration ~8s
    state.busy = { kind: 'tend', t: 0, dur: 8.0, creature };
  }
  
  function startCombine(item1, item2) {
    // Play combine sound (will be louder if discovered=true)
    playCombine(false);
    
    state.busy = { kind: 'combine', t: 0, dur: 5.0, item1, item2 };
  }

  function finishBusy() {
    const b = state.busy;
    
    // Record last busy kind and forage source for variety
    if (b) {
      const wasRepeating = 
        (b.kind === state.lastBusyKind) && 
        ((b.kind === 'forage' && b.source === state.lastForageSource) || 
         b.kind === 'eat');
      
      state.lastBusyKind = b.kind;
      if (b.kind === 'forage' && b.source) {
        state.lastForageSource = b.source;
      }
      
      // Update entertainment for forage/eat repetition (combine handled separately)
      if (b.kind === 'forage' || b.kind === 'eat') {
        if (wasRepeating) {
          // Repeating same forage or eat: drain entertainment faster
          state.entertainment = Math.max(0, state.entertainment - 0.06);
        }
      }
    }
    
    state.busy = null;
    if (!b) return;
    if (b.kind === 'eat') {
      let rec = FOOD[b.type];
      
      // Check discovered food
      if (!rec && state.notebook) {
        const foodVal = getFoodValue(b.type, state.notebook);
        if (foodVal) rec = foodVal;
      }
      
      if (!rec) rec = { hunger: 0.1, energy: 0.02 };
      
      state.hunger = Math.min(1, state.hunger + rec.hunger);
      state.energy = Math.min(1, state.energy + rec.energy);
      // Eating also restores some health (more if medicine tag)
      const isMed = state.notebook && isMedicine(b.type, state.notebook);
      const healthBoost = isMed ? (rec.health || rec.hunger * 0.5) : (rec.hunger * 0.2);
      state.health = Math.min(1, state.health + healthBoost);
      if (b.fromWorldItem && world.pickups.includes(b.fromWorldItem)) {
        removePickup(world, b.fromWorldItem);
      } else {
        state.inventory[b.type] = Math.max(0, state.inventory[b.type] - 1);
      }
      brain.reinforce(0.9 + rec.hunger);
    } else if (b.kind === 'process') {
      const rec = PROCESS[b.inputType];
      const outCount = rec.outCount || 1;
      const isOutputMat = isMaterialType(rec.out);
      
      if (isOutputMat) {
        let materialInputCount = 0;
        if (rec.inputs) {
          for (const [inputType, count] of Object.entries(rec.inputs)) {
            if (isMaterialType(inputType)) {
              materialInputCount += count;
            }
          }
        } else {
          if (isMaterialType(b.inputType)) {
            materialInputCount = 1;
          }
        }
        
        const netMaterialChange = outCount - materialInputCount;
        if (netMaterialChange > 0 && !canAddMaterial(netMaterialChange)) {
          return;
        }
      }
      
      if (rec.inputs) {
        if (canAfford(state.inventory, rec.inputs)) {
          state.inventory = spend(state.inventory, rec.inputs);
          state.inventory[rec.out] = (state.inventory[rec.out] || 0) + outCount;
          
          if (state.notebook && !itemHasTag(rec.out, state.itchTag, state.notebook)) {
            state.itchBoostTimer = 10.0;
          }
          
          brain.reinforce(0.85);
        }
      } else if ((state.inventory[b.inputType] || 0) > 0) {
        state.inventory[b.inputType] -= 1;
        state.inventory[rec.out] = (state.inventory[rec.out] || 0) + outCount;
        
        if (state.notebook && !itemHasTag(rec.out, state.itchTag, state.notebook)) {
          state.itchBoostTimer = 10.0;
        }
        
        brain.reinforce(0.85);
      }
    } else if (b.kind === 'build') {
      const rec = BUILD[b.what];
      if (!canAfford(state.inventory, rec.cost)) return;
      state.inventory = spend(state.inventory, rec.cost);
      if (b.what === 'tools') {
        state.hasTools = true;
      } else {
        const ahead = new THREE.Vector3(Math.sin(state.facing), 0, Math.cos(state.facing));
        spawnBuilding(world, assets, b.what, {
          x: group.position.x + ahead.x * 1.4,
          z: group.position.z + ahead.z * 1.4,
        });
      }
      playBuild();
      brain.reinforce(1.15);
    } else if (b.kind === 'forage') {
      const harvested = harvestForageSource(world, assets, b.source, group.position, b.hasTools || false);
      if (harvested) {
        brain.reinforce(0.6);
      }
    } else if (b.kind === 'combine') {
      if ((state.inventory[b.item1] || 0) > 0 && (state.inventory[b.item2] || 0) > 0) {
        if (state.notebook) {
          const result = state.notebook.combine(b.item1, b.item2);
          
          state.inventory[b.item1] -= 1;
          state.inventory[b.item2] -= 1;
          
          const outputId = result.output;
          const isMat = isMaterialType(outputId);
          
          if (isMat && !canAddMaterial(1)) {
            const ahead = new THREE.Vector3(Math.sin(state.facing), 0, Math.cos(state.facing));
            spawnPickup(world, assets, outputId, {
              x: group.position.x + ahead.x * 0.5,
              z: group.position.z + ahead.z * 0.5,
            }, { falling: false });
          } else {
            state.inventory[outputId] = (state.inventory[outputId] || 0) + 1;
          }
          
          if (!itemHasTag(outputId, state.itchTag, state.notebook)) {
            state.itchBoostTimer = 10.0;
          }
          
          if (result.discovered) {
            playCombine(true);
          }
          
          if (result.discovered) {
            state.entertainment = Math.min(1, state.entertainment + 0.25);
          } else if (state.lastBusyKind === 'combine') {
            state.entertainment = Math.max(0, state.entertainment - 0.08);
          }
          
          let reward = 0.7;
          if (result.discovered) {
            reward += 0.4;
          }
          
          brain.reinforce(reward);
          
          updateBestGatherMult();
          
          if (outputId === 'tools' || (result.recipe.isEquippable && result.recipe.gatherMult >= 2.0)) {
            state.hasTools = true;
          }
        }
      }
    } else if (b.kind === 'hunt') {
      const hunted = huntFauna(world, assets, b.creature, group.position);
      if (hunted) {
        brain.reinforce(0.8);
      }
    } else if (b.kind === 'tend') {
      const tended = tendFauna(world, b.creature);
      if (tended) {
        brain.reinforce(0.7);
      }
    } else if (b.kind === 'use_medicine') {
      let rec = null;
      
      if (state.notebook) {
        const healthVal = getHealthValue(b.type, state.notebook);
        if (healthVal) rec = healthVal;
      }
      
      if (!rec) rec = { health: 0.3 };
      
      state.health = Math.min(1, state.health + rec.health);
      if (b.fromWorldItem && world.pickups.includes(b.fromWorldItem)) {
        removePickup(world, b.fromWorldItem);
      } else {
        state.inventory[b.type] = Math.max(0, state.inventory[b.type] - 1);
      }
      brain.reinforce(0.85);
    }
  }

  function pickupIfClose(types) {
    const n = nearestPickup(world, group.position, types);
    if (n.item && n.dist < PICKUP_RADIUS) {
      const itemType = n.item.type;
      const isMat = isMaterialType(itemType);
      const isFood = isFoodType(itemType);
      
      if (isMat && !canAddMaterial(1)) {
        return null;
      }
      if (isFood && !canAddFood(1)) {
        return null;
      }
      
      state.inventory[itemType] = (state.inventory[itemType] || 0) + 1;
      removePickup(world, n.item);
      return n.item;
    }
    return null;
  }

  function act(dt) {
    if (state.busy) {
      state.busy.t += dt;
      if (state.busy.t >= state.busy.dur) finishBusy();
      return false;
    }

    const speed = (state.sluggish ? 0.7 : 1.55) * (0.35 + 0.65 * state.energy);
    const s = snap();
    const actName = state.action;

    if (actName === 'idle' || actName === 'idle-hungry') {
      // Check if we should walk toward the other settler for social
      if (state.driveCommit === 'social' && world.agents && world.agents.length > 1) {
        const distToOther = distanceToNearestAgent();
        
        // Walk toward the other settler if not already close
        if (distToOther > 1.3) {
          // Find the other agent
          let otherAgent = null;
          for (const other of world.agents) {
            if (other.group !== group) {
              otherAgent = other;
              break;
            }
          }
          
          if (otherAgent) {
            // Use getSideSlotTarget to maintain personal space
            const target = getSideSlotTarget(otherAgent.group.position.x, otherAgent.group.position.z);
            const remain = walkToward(target.x, target.z, dt, speed);
            
            // Stop at personal space (~1.1-1.4 XZ)
            if (remain < 1.4) {
              return false; // Arrived, linger
            }
            return true; // Still walking
          }
        }
      }
      
      // Check if we should seek shelter for comfort (only when comfort drive, not social)
      const isNight = world.worldClock && world.worldClock.time >= 0.7;
      const needsShelter = (isNight && state.comfort < 0.55) || state.comfort < 0.4;
      
      if (needsShelter && state.hunger > 0.45 && !state.sluggish && state.driveCommit !== 'social') {
        // Try to walk to nearest hut or fire
        const hutBuilding = world.buildings.find((b) => b.type === 'hut');
        const fireBuilding = world.buildings.find((b) => b.type === 'fire');
        
        let targetBuilding = null;
        let targetDist = Infinity;
        
        // Prefer hut at night, otherwise closest shelter
        if (isNight && hutBuilding) {
          const dx = hutBuilding.mesh.position.x - group.position.x;
          const dz = hutBuilding.mesh.position.z - group.position.z;
          targetDist = Math.hypot(dx, dz);
          targetBuilding = hutBuilding;
        } else {
          // Find closest shelter
          if (hutBuilding) {
            const dx = hutBuilding.mesh.position.x - group.position.x;
            const dz = hutBuilding.mesh.position.z - group.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < targetDist) {
              targetDist = dist;
              targetBuilding = hutBuilding;
            }
          }
          if (fireBuilding) {
            const dx = fireBuilding.mesh.position.x - group.position.x;
            const dz = fireBuilding.mesh.position.z - group.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < targetDist) {
              targetDist = dist;
              targetBuilding = fireBuilding;
            }
          }
        }
        
        if (targetBuilding && targetDist > 2.0) {
          // Walk to shelter
          const target = getSideSlotTarget(targetBuilding.mesh.position.x, targetBuilding.mesh.position.z);
          const remain = walkToward(target.x, target.z, dt, speed);
          return remain >= 0.5;
        }
      }
      
      return false;
    }

    if (actName === 'seek_food') {
      const food = s.food.item;
      const forageFood = s.forageFood.item;
      const huntable = s.huntable.item;
      const tendable = s.tendable.item;
      
      // Build list of options with distances
      const options = [];
      
      // If wanderlust is high, ignore same-biome pickups if other-biome forage exists
      if (state.wanderlust > 0.6 && forageFood) {
        const forageBiome = getForageBiome(forageFood);
        if (forageBiome && forageBiome !== s.currentBiome) {
          // Skip same-biome pickup, prefer other-biome forage
        } else {
          if (food) options.push({ type: 'pickup', item: food, dist: s.food.dist });
        }
      } else {
        if (food) options.push({ type: 'pickup', item: food, dist: s.food.dist });
      }
      
      if (forageFood) options.push({ type: 'forage', item: forageFood, dist: s.forageFood.dist });
      if (huntable && hasWeapon()) options.push({ type: 'hunt', item: huntable, dist: s.huntable.dist });
      if (tendable && s.hasPen && s.hasTrough) options.push({ type: 'tend', item: tendable, dist: s.tendable.dist });
      
      // Sort by distance
      options.sort((a, b) => a.dist - b.dist);
      
      // Prefer variety: if last action was forage at the same source, try 2nd nearest forage
      let best = options[0];
      if (state.lastBusyKind === 'forage' && best && best.type === 'forage' && best.item === state.lastForageSource && options.length > 1) {
        // Find next different forage source or different activity
        for (let i = 1; i < options.length; i++) {
          if (options[i].type !== 'forage' || options[i].item !== state.lastForageSource) {
            best = options[i];
            break;
          }
        }
      }
      
      if (best) {
        if (best.type === 'forage') {
          const target = getSideSlotTarget(best.item.mesh.position.x, best.item.mesh.position.z);
          const remain = walkToward(target.x, target.z, dt, speed);
          if (remain < FORAGE_RADIUS) {
            startForage(best.item);
            return false;
          }
          return true;
        } else if (best.type === 'hunt') {
          const target = getSideSlotTarget(best.item.mesh.position.x, best.item.mesh.position.z);
          const remain = walkToward(target.x, target.z, dt, speed);
          if (remain < HUNT_RADIUS) {
            startHunt(best.item);
            return false;
          }
          return true;
        } else if (best.type === 'tend') {
          const target = getSideSlotTarget(best.item.mesh.position.x, best.item.mesh.position.z);
          const remain = walkToward(target.x, target.z, dt, speed);
          if (remain < TEND_RADIUS) {
            startTend(best.item);
            return false;
          }
          return true;
        } else {
          // pickup
          const target = getSideSlotTarget(best.item.mesh.position.x, best.item.mesh.position.z);
          const remain = walkToward(target.x, target.z, dt, speed);
          if (remain < PICKUP_RADIUS) {
            // If full, pick up food into inventory instead of eating
            if (state.hunger >= 0.75) {
              pickupIfClose([best.item.type]);
            } else {
              startEat(best.item.type, best.item);
            }
            return false;
          }
          return true;
        }
      } else {
        const inv = bestInvFood();
        if (inv && state.hunger < 0.75) startEat(inv, null);
        return false;
      }
    }

    if (actName === 'eat') {
      // Discourage eating immediately after forage/combine unless actually hungry
      const justForagedOrCombined = state.lastBusyKind === 'forage' || state.lastBusyKind === 'combine';
      if (justForagedOrCombined && state.hunger >= 0.55) {
        // Not hungry enough to eat immediately after gathering/inventing
        brain.reinforce(-0.04);
        return false;
      }
      
      const inv = bestInvFood();
      if (inv && state.hunger < 0.75) {
        startEat(inv, null);
        return false;
      }
      if (s.food.item) {
        const target = getSideSlotTarget(s.food.item.mesh.position.x, s.food.item.mesh.position.z);
        const remain = walkToward(target.x, target.z, dt, speed);
        if (remain < PICKUP_RADIUS) {
          // If full, pick up instead of eating
          if (state.hunger >= 0.75) {
            pickupIfClose([s.food.item.type]);
          } else {
            startEat(s.food.item.type, s.food.item);
          }
        }
        return remain >= PICKUP_RADIUS;
      }
      brain.reinforce(-0.05);
      return false;
    }

    if (actName === 'seek_material') {
      if (!canAddMaterial(1)) {
        return false;
      }
      
      const targets = [];
      if (state.hunger > 0.35) targets.push('grain');
      targets.push('wood', 'ore', 'stone', 'planks', 'ingot');
      const n = nearestPickup(world, group.position, targets);
      
      // Check forage sources for materials
      const forageWood = s.forageWood.item;
      const forageOre = s.forageOre.item;
      const forageStone = s.forageStone.item;
      
      // Find all options (pickup or forage)
      const options = [];
      
      // If wanderlust is high, ignore same-biome pickups if other-biome forage exists
      const hasOtherBiomeForage = [forageWood, forageOre, forageStone].some(f => {
        if (!f) return false;
        const biomef = getForageBiome(f);
        return biomef && biomef !== s.currentBiome;
      });
      
      if (state.wanderlust > 0.6 && hasOtherBiomeForage) {
        // Skip same-biome pickup, prefer other-biome forage
      } else {
        if (n.item) options.push({ target: n.item, dist: n.dist, isForage: false, type: n.item.type });
      }
      
      if (forageWood) options.push({ target: forageWood, dist: s.forageWood.dist, isForage: true, type: forageWood.harvestType });
      if (forageOre) options.push({ target: forageOre, dist: s.forageOre.dist, isForage: true, type: forageOre.harvestType });
      if (forageStone) options.push({ target: forageStone, dist: s.forageStone.dist, isForage: true, type: forageStone.harvestType });
      
      if (options.length === 0) {
        brain.reinforce(-0.03);
        return false;
      }
      
      // Tag-biased scoring when itch is high
      if (state.itch > 0.55 && state.notebook) {
        for (const opt of options) {
          opt.itchScore = itemCanYieldTag(opt.type, state.itchTag) ? 0 : 1;
        }
        options.sort((a, b) => {
          if (a.itchScore !== b.itchScore) return a.itchScore - b.itchScore;
          return a.dist - b.dist;
        });
      } else {
        // Sort by distance
        options.sort((a, b) => a.dist - b.dist);
      }
      
      // Prefer variety: avoid same forage source if just foraged there
      let choice = options[0];
      if (state.lastBusyKind === 'forage' && choice.isForage && choice.target === state.lastForageSource && options.length > 1) {
        for (let i = 1; i < options.length; i++) {
          if (!options[i].isForage || options[i].target !== state.lastForageSource) {
            choice = options[i];
            break;
          }
        }
      }
      
      const bestTarget = choice.target;
      const isForage = choice.isForage;
      
      const target = getSideSlotTarget(bestTarget.mesh.position.x, bestTarget.mesh.position.z);
      const remain = walkToward(target.x, target.z, dt, speed);
      if (isForage) {
        if (remain < FORAGE_RADIUS) {
          const harvestType = bestTarget.harvestType;
          const isMat = isMaterialType(harvestType);
          if (!isMat || canAddMaterial(1)) {
            startForage(bestTarget);
          }
        }
      } else {
        if (remain < PICKUP_RADIUS) pickupIfClose([bestTarget.type]);
      }
      return remain >= (isForage ? FORAGE_RADIUS : PICKUP_RADIUS);
    }

    if (actName === 'process') {
      const inputToProcess = Object.keys(PROCESS).find((k) => canProcessWithoutStarvingBuildings(k));
      if (inputToProcess) {
        const rec = PROCESS[inputToProcess];
        const outCount = rec.outCount || 1;
        const isOutputMat = isMaterialType(rec.out);
        
        if (isOutputMat) {
          let materialInputCount = 0;
          if (rec.inputs) {
            for (const [inputType, count] of Object.entries(rec.inputs)) {
              if (isMaterialType(inputType)) {
                materialInputCount += count;
              }
            }
          } else {
            if (isMaterialType(inputToProcess)) {
              materialInputCount = 1;
            }
          }
          
          const netMaterialChange = outCount - materialInputCount;
          if (netMaterialChange > 0 && !canAddMaterial(netMaterialChange)) {
            return false;
          }
        }
      }
      
      if (!canProcessAny()) {
        const n = nearestPickup(world, group.position, ['wood', 'ore', 'grain', 'berry', 'water', 'fish']);
        const forageWood = s.forageWood.item;
        const forageGrain = nearestForageSource(world, group.position, ['grain']).item;
        const forageFood = s.forageFood.item;
        const forageWater = s.forageWater.item;
        
        // Build list of options
        const options = [];
        
        if (n.item) options.push({ target: n.item, dist: n.dist, isForage: false, type: n.item.type });
        if (forageWood) options.push({ target: forageWood, dist: s.forageWood.dist, isForage: true, type: forageWood.harvestType });
        if (forageGrain) options.push({ target: forageGrain, dist: nearestForageSource(world, group.position, ['grain']).dist, isForage: true, type: 'grain' });
        if (forageFood) options.push({ target: forageFood, dist: s.forageFood.dist, isForage: true, type: forageFood.harvestType });
        if (forageWater) options.push({ target: forageWater, dist: s.forageWater.dist, isForage: true, type: 'water' });
        
        if (options.length === 0) {
          brain.reinforce(-0.04);
          return false;
        }
        
        // Tag-biased scoring when itch is high
        if (state.itch > 0.55 && state.notebook) {
          for (const opt of options) {
            opt.itchScore = itemCanYieldTag(opt.type, state.itchTag) ? 0 : 1;
          }
          options.sort((a, b) => {
            if (a.itchScore !== b.itchScore) return a.itchScore - b.itchScore;
            return a.dist - b.dist;
          });
        } else {
          // Sort by distance
          options.sort((a, b) => a.dist - b.dist);
        }
        
        // Prefer variety: avoid same forage source if just foraged there
        let choice = options[0];
        if (state.lastBusyKind === 'forage' && choice.isForage && choice.target === state.lastForageSource && options.length > 1) {
          for (let i = 1; i < options.length; i++) {
            if (!options[i].isForage || options[i].target !== state.lastForageSource) {
              choice = options[i];
              break;
            }
          }
        }
        
        const bestTarget = choice.target;
        const isForage = choice.isForage;
        
        const target = getSideSlotTarget(bestTarget.mesh.position.x, bestTarget.mesh.position.z);
        const remain = walkToward(target.x, target.z, dt, speed);
        if (isForage) {
          if (remain < FORAGE_RADIUS) {
            const harvestType = bestTarget.harvestType;
            const isMat = isMaterialType(harvestType);
            if (!isMat || canAddMaterial(1)) {
              startForage(bestTarget);
            }
          }
        } else {
          if (remain < PICKUP_RADIUS) pickupIfClose(['wood', 'ore', 'grain', 'berry', 'water', 'fish']);
        }
        return remain >= (isForage ? FORAGE_RADIUS : PICKUP_RADIUS);
      }
      const wb = nearestBuilding(world, group.position, 'workbench');
      const fire = nearestBuilding(world, group.position, 'fire');
      const bestDist = Math.min(wb.dist, fire.dist);
      const bestTarget = wb.dist < fire.dist ? wb : fire;
      if (bestTarget.item && bestDist > Math.max(WORKBENCH_RADIUS, FIRE_RADIUS) * 0.8) {
        const target = getSideSlotTarget(bestTarget.item.mesh.position.x, bestTarget.item.mesh.position.z);
        walkToward(target.x, target.z, dt, speed);
        return true;
      }
      const input = Object.keys(PROCESS).find((k) => canProcessWithoutStarvingBuildings(k));
      if (input) startProcess(input);
      return false;
    }

    if (actName === 'build') {
      const what = nextBuild();
      if (!what) {
        const need = [];
        if (!world.buildings.some((b) => b.type === 'workbench')) need.push('wood', 'planks');
        else if (!world.buildings.some((b) => b.type === 'hut')) need.push('wood', 'planks', 'stone');
        else if (!world.buildings.some((b) => b.type === 'fire')) need.push('wood', 'stone');
        else if (!world.buildings.some((b) => b.type === 'well')) need.push('stone', 'planks');
        else if (!world.buildings.some((b) => b.type === 'chest')) need.push('wood', 'planks');
        else if (!state.hasTools) need.push('ore', 'ingot');
        
        const n = nearestPickup(world, group.position, need.length ? need : MATERIAL_TYPES);
        
        // Build list of options
        const options = [];
        
        if (n.item) options.push({ target: n.item, dist: n.dist, isForage: false, type: n.item.type });
        if (need.includes('wood') || need.length === 0) {
          const forageWood = s.forageWood.item;
          if (forageWood) options.push({ target: forageWood, dist: s.forageWood.dist, isForage: true, type: 'wood' });
        }
        if (need.includes('stone') || need.length === 0) {
          const forageStone = s.forageStone.item;
          if (forageStone) options.push({ target: forageStone, dist: s.forageStone.dist, isForage: true, type: 'stone' });
        }
        if (need.includes('ore') || need.length === 0) {
          const forageOre = s.forageOre.item;
          if (forageOre) options.push({ target: forageOre, dist: s.forageOre.dist, isForage: true, type: 'ore' });
        }
        
        if (options.length === 0) {
          brain.reinforce(-0.04);
          return false;
        }
        
        // Tag-biased scoring when itch is high
        if (state.itch > 0.55 && state.notebook) {
          for (const opt of options) {
            opt.itchScore = itemCanYieldTag(opt.type, state.itchTag) ? 0 : 1;
          }
          options.sort((a, b) => {
            if (a.itchScore !== b.itchScore) return a.itchScore - b.itchScore;
            return a.dist - b.dist;
          });
        } else {
          // Sort by distance
          options.sort((a, b) => a.dist - b.dist);
        }
        
        // Prefer variety: avoid same forage source if just foraged there
        let choice = options[0];
        if (state.lastBusyKind === 'forage' && choice.isForage && choice.target === state.lastForageSource && options.length > 1) {
          for (let i = 1; i < options.length; i++) {
            if (!options[i].isForage || options[i].target !== state.lastForageSource) {
              choice = options[i];
              break;
            }
          }
        }
        
        const bestTarget = choice.target;
        const isForage = choice.isForage;
        
        const target = getSideSlotTarget(bestTarget.mesh.position.x, bestTarget.mesh.position.z);
        const remain = walkToward(target.x, target.z, dt, speed);
        if (isForage) {
          if (remain < FORAGE_RADIUS) {
            const harvestType = bestTarget.harvestType;
            const isMat = isMaterialType(harvestType);
            if (!isMat || canAddMaterial(1)) {
              startForage(bestTarget);
            }
          }
        } else {
          if (remain < PICKUP_RADIUS) pickupIfClose([bestTarget.type]);
        }
        return remain >= (isForage ? FORAGE_RADIUS : PICKUP_RADIUS);
      }
      startBuild(what);
      return false;
    }

    if (actName === 'combine') {
      // Discourage instant combine after forage unless we have good reason
      // (e.g., many diverse items, or enough time has passed)
      const justForaged = state.lastBusyKind === 'forage';
      const itemCount = Object.values(state.inventory).filter(c => c > 0).length;
      
      // If just foraged and only have 2-3 items, prefer to gather more first
      if (justForaged && itemCount <= 3) {
        // Skip combine and let next think cycle pick a different action
        brain.reinforce(-0.02);
        return false;
      }
      
      if (!canCombineAny()) {
        brain.reinforce(-0.03);
        return false;
      }
      
      const items = pickTwoCombineItems();
      if (items) {
        startCombine(items[0], items[1]);
      }
      return false;
    }
    
    if (actName === 'use_medicine') {
      const medicine = bestInvMedicine();
      if (medicine) {
        startUseMedicine(medicine, null);
        return false;
      }
      brain.reinforce(-0.05);
      return false;
    }

    return false;
  }

  function updateHud() {
    const h = Math.round(state.hunger * 100);
    const e = Math.round(state.energy * 100);
    const m = Math.round(state.entertainment * 100);
    const w = Math.round(state.wanderlust * 100);
    const i = Math.round(state.itch * 100);
    const c = Math.round(state.comfort * 100);
    const so = Math.round(state.social * 100);
    if (hud.hungerFill) hud.hungerFill.style.width = `${h}%`;
    if (hud.hungerVal) hud.hungerVal.textContent = `${h}%`;
    if (hud.energyFill) hud.energyFill.style.width = `${e}%`;
    if (hud.energyVal) hud.energyVal.textContent = `${e}%`;
    if (hud.moodFill) hud.moodFill.style.width = `${m}%`;
    if (hud.moodVal) hud.moodVal.textContent = `${m}%`;
    if (hud.wanderlustFill) hud.wanderlustFill.style.width = `${w}%`;
    
    // Show wander target biome if wanderlust is high
    let wanderText = `${w}%`;
    if (state.wanderTargetBiome && state.wanderlust > 0.6) {
      wanderText += ` → ${state.wanderTargetBiome}`;
    }
    if (hud.wanderlustVal) hud.wanderlustVal.textContent = wanderText;
    
    if (hud.itchFill) hud.itchFill.style.width = `${i}%`;
    if (hud.itchVal) hud.itchVal.textContent = `${i}%`;
    if (hud.itchTag) hud.itchTag.textContent = state.itchTag || 'sharp';
    
    if (hud.comfortFill) hud.comfortFill.style.width = `${c}%`;
    if (hud.comfortVal) hud.comfortVal.textContent = `${c}%`;
    
    if (hud.socialFill) hud.socialFill.style.width = `${so}%`;
    if (hud.socialVal) hud.socialVal.textContent = `${so}%`;
    
    // Update this agent's mind status
    if (hud.action) {
      const busy = state.busy?.kind === 'eat'
        ? 'Eating'
        : state.busy?.kind === 'use_medicine'
          ? 'Healing'
          : state.busy?.kind === 'process'
            ? 'Crafting'
            : state.busy?.kind === 'build'
              ? 'Building'
              : state.busy?.kind === 'combine'
                ? 'Inventing'
                : state.busy?.kind === 'forage'
                  ? 'Gathering'
                  : state.action === 'seek_food'
                    ? 'Seeking food'
                    : state.action === 'seek_material'
                      ? 'Gathering'
                      : state.action === 'idle-hungry'
                        ? 'Starving'
                        : state.action === 'use_medicine'
                          ? 'Healing'
                          : state.action === 'process'
                            ? 'Crafting'
                            : state.action === 'build'
                              ? 'Building'
                              : state.action === 'combine'
                                ? 'Inventing'
                                : 'Idle';
      hud.action.textContent = busy;
    }
    
    if (hud.inv) {
      const materialCount = getMaterialCount();
      const packStatus = `<span class="inv-chip pack-status">Pack ${materialCount}/${MATERIAL_CAP}</span>`;
      
      const bits = ALL_ITEM_TYPES.map((t) => {
        const n = state.inventory[t] || 0;
        const colors = {
          berry: '#c41e5a',
          grain: '#e8b923',
          wood: '#6b3f1d',
          stone: '#8a8f99',
          ore: '#5a3228',
          water: '#4a9fc8',
          planks: '#d4a574',
          ingot: '#7b8792',
          bread: '#c4843c',
          stew: '#d46c3a',
          dough: '#e8d8a4',
          fish: '#78a8c4',
          cooked_fish: '#c89870',
          sticks: '#8b6239',
        };
        return `<span class="inv-chip ${n ? '' : 'empty'}"><span class="dot" style="background:${colors[t]}"></span>${t} ×${n}</span>`;
      });
      if (state.hasTools) bits.push(`<span class="inv-chip"><span class="dot" style="background:#6e7b85"></span>tools</span>`);
      hud.inv.innerHTML = packStatus + bits.join('');
    }
  }

  function update(dt) {
    if (!state.landed) {
      state.vy -= 18 * dt;
      group.position.y += state.vy * dt;
      const groundY = world.heightAt ? world.heightAt(group.position.x, group.position.z) : 0;
      if (group.position.y <= groundY) {
        group.position.y = groundY;
        if (state.vy < -2) state.vy *= -0.25;
        else {
          state.landed = true;
          state.vy = 0;
          group.position.y = groundY;
        }
      }
      animate(dt, false);
      updateHud();
      return;
    }

    // Hunger drain: check if it's night and if agent is protected
    const isNight = world.worldClock && world.worldClock.time >= 0.7;
    const nearHut = hutNear();
    const nearFire = !!fireNear();
    const isProtected = nearHut || nearFire;
    
    let hungerDrain = HUNGER_DRAIN;
    if (isNight && !isProtected) {
      // Cold at night: 3× faster hunger drain if not near hut or fire
      hungerDrain = HUNGER_DRAIN * 3.0;
    } else if (nearHut) {
      hungerDrain = HUNGER_DRAIN_NEAR_HUT;
    }
    
    state.hunger = Math.max(0, state.hunger - hungerDrain * dt);
    if (state.hunger <= 0) {
      state.energy = Math.max(0.15, state.energy - 0.12 * dt);
      state.sluggish = true;
    } else {
      state.sluggish = false;
      state.energy = Math.min(1, state.energy + 0.015 * dt);
    }
    
    // Health updates
    let healthDrain = 0;
    let healthRegen = 0;
    
    // Weather effects
    const isRain = world.weather && world.weather.current === 'rain';
    const inTheOpen = !isProtected && !world.buildings.some((b) => {
      const dx = b.mesh.position.x - group.position.x;
      const dz = b.mesh.position.z - group.position.z;
      return Math.hypot(dx, dz) < 3.5;
    });
    
    // Drain health when starving
    if (state.hunger < 0.1) {
      healthDrain += 0.02 * dt;
    }
    
    // Drain health when very low energy
    if (state.energy < 0.2) {
      healthDrain += 0.015 * dt;
    }
    
    // Drain health at night if not near hut or fire
    if (isNight && !isProtected) {
      healthDrain += 0.018 * dt;
    }
    
    // Rain in the open: health drain
    if (isRain && inTheOpen) {
      healthDrain += 0.012 * dt;
      
      // Extra drain at night
      if (isNight) {
        healthDrain += 0.015 * dt;
      }
    }
    
    // Recover health when conditions are good
    if (state.hunger > 0.4 && isProtected) {
      healthRegen += 0.04 * dt;
    } else if (state.hunger > 0.4 && nearFire) {
      healthRegen += 0.03 * dt;
    }
    
    // Apply health changes
    state.health = Math.max(0, Math.min(1, state.health - healthDrain + healthRegen));
    
    // Make agent sluggish when health is low
    if (state.health < 0.25) {
      state.sluggish = true;
    }
    
    // Entertainment updates
    // Passive slow drain
    const baseDrain = 0.01 * dt;
    let entertainmentDrain = baseDrain;
    
    // Extra drain at night if not near hut or fire
    if (isNight && !isProtected) {
      entertainmentDrain += 0.015 * dt;
    }
    
    // Recovery from walking meaningful distances
    if (state.distanceTraveled > 8.0) {
      state.entertainment = Math.min(1, state.entertainment + 0.12);
      state.distanceTraveled = 0;
    }
    
    // Recovery from being near other settlers
    const distToOther = distanceToNearestAgent();
    if (distToOther < 2.5) {
      state.entertainment = Math.min(1, state.entertainment + 0.02 * dt);
    }
    
    // Recovery from being near fire
    const distToFire = distanceToNearestFire();
    if (distToFire < FIRE_RADIUS) {
      state.entertainment = Math.min(1, state.entertainment + 0.015 * dt);
    }
    
    // Apply entertainment drain
    state.entertainment = Math.max(0, state.entertainment - entertainmentDrain);
    
    // Wanderlust updates
    const currentBiome = getBiomeAt(group.position.x, group.position.z);
    
    // Detect biome change
    if (currentBiome !== state.currentBiome) {
      // Entered a new biome
      const timeSinceLastVisit = state.lastBiomeVisit[currentBiome] || 999;
      
      // Drop wanderlust if entering a novel or not-recently-visited biome
      if (timeSinceLastVisit > 30) {
        // Haven't been here in 30+ seconds or never: big drop
        state.wanderlust = Math.max(0, state.wanderlust - 0.5);
      } else if (timeSinceLastVisit > 10) {
        // Haven't been here in 10+ seconds: medium drop
        state.wanderlust = Math.max(0, state.wanderlust - 0.3);
      }
      
      // Clear wander target if we entered it
      if (state.wanderTargetBiome === currentBiome) {
        state.wanderTargetBiome = null;
        state.wanderTargetSourceKey = null;
      }
      
      // Update biome tracking
      if (state.currentBiome) {
        state.lastBiomeVisit[state.currentBiome] = 0; // Just left this biome
      }
      state.currentBiome = currentBiome;
      state.biomeEntryTime = 0;
    }
    
    // Increment biome time
    if (state.currentBiome) {
      state.biomeEntryTime += dt;
      
      // Increment time-since-visit for other biomes
      for (const biome in state.lastBiomeVisit) {
        if (biome !== state.currentBiome) {
          state.lastBiomeVisit[biome] += dt;
        }
      }
    }
    
    // Wanderlust climbs while staying in same biome
    // Base rate: 0.015/s (reaches 1.0 in ~67 seconds in same biome)
    let wanderlustGain = 0.015 * dt;
    
    // Faster climb if foraging/eating in same biome
    if (state.busy && (state.busy.kind === 'forage' || state.busy.kind === 'eat')) {
      wanderlustGain *= 2.0; // Double rate when actively using resources here
    }
    
    state.wanderlust = Math.min(1, state.wanderlust + wanderlustGain);
    
    // Clear wander target if wanderlust drops below threshold
    if (state.wanderlust < 0.4) {
      state.wanderTargetBiome = null;
      state.wanderTargetSourceKey = null;
    }
    
    // Itch updates
    updateItch(dt);
    
    // Comfort updates
    updateComfort(dt);
    
    // Social updates
    updateSocial(dt);
    
    // Drive commitment timer
    if (state.driveCommitT > 0) {
      state.driveCommitT -= dt;
    }

    if (!state.busy) {
      state.thinkAcc += dt;
      if (state.thinkAcc >= THINK_DT) {
        state.thinkAcc = 0;
        think();
      }
    }

    const walking = act(dt);
    animate(dt, walking);
    updateHud();
    
    // Apply separation even when standing still
    separateFromOthers();
  }

  return { group, state, brain, update };
}
