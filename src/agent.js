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
import { nearestPickup, nearestBuilding, removePickup, spawnBuilding, nearestForageSource, harvestForageSource } from './resources.js';

const FOOD_TYPES = ['berry', 'grain', 'water', 'bread', 'stew', 'fish', 'cooked_fish'];
const MATERIAL_TYPES = ['wood', 'stone', 'ore', 'planks', 'ingot', 'grain', 'water', 'fish', 'dough', 'sticks'];
const FORAGE_RADIUS = 1.2;
const THINK_DT = 0.28;

export function createAgent(world, assets) {
  const group = assets.create('agent');
  group.position.set(0, 2.4, 0);
  world.scene.add(group);

  const parts = group.userData.parts || {};
  const brain = new Brain();

  const state = {
    hunger: 0.62,
    energy: 1,
    inventory: emptyInventory(),
    hasTools: false,
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
  };

  const hud = {
    hungerFill: document.getElementById('hunger-fill'),
    hungerVal: document.getElementById('hunger-val'),
    energyFill: document.getElementById('energy-fill'),
    energyVal: document.getElementById('energy-val'),
    action: document.getElementById('brain-action'),
    inv: document.getElementById('inventory'),
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

  function snap() {
    const food = nearestPickup(world, group.position, FOOD_TYPES);
    const wood = nearestPickup(world, group.position, ['wood']);
    const ore = nearestPickup(world, group.position, ['ore']);
    const stone = nearestPickup(world, group.position, ['stone']);
    const grain = nearestPickup(world, group.position, ['grain']);
    const wb = nearestBuilding(world, group.position, 'workbench');
    const hut = nearestBuilding(world, group.position, 'hut');
    
    const forageFood = nearestForageSource(world, group.position, ['berry', 'grain', 'fish']);
    const forageWood = nearestForageSource(world, group.position, ['wood']);
    const forageOre = nearestForageSource(world, group.position, ['ore']);
    const forageStone = nearestForageSource(world, group.position, ['stone']);
    
    return {
      food,
      wood,
      ore,
      stone,
      grain,
      wb,
      hut,
      forageFood,
      forageWood,
      forageOre,
      forageStone,
      hasHut: world.buildings.some((b) => b.type === 'hut'),
      hasWorkbench: world.buildings.some((b) => b.type === 'workbench'),
      hasForageSources: world.forageSources && world.forageSources.some((s) => s.charges > 0),
    };
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
      brain.last = null;
      return;
    }

    if (state.hunger <= 0 && !hasAnyFood(s)) {
      state.action = 'idle-hungry';
      state.actionIndex = 0;
      state.target = null;
      brain.reinforce(-0.2);
      return;
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
    });

    const { action, name } = brain.act(input);
    state.actionIndex = action;
    state.action = name;

    let shape = (state.hunger - 0.5) * 0.08;
    if (state.hunger < 0.3) shape -= 0.15; // Strong penalty for being very hungry and not seeking food
    if (name === 'seek_food' && (s.food.item || s.forageFood.item) && state.hunger < 0.7) shape += 0.08;
    if (name === 'idle' && state.hunger < 0.3 && (s.food.item || s.forageFood.item)) shape -= 0.18;
    if (name === 'eat' && hasAnyFood(s)) shape += 0.05;
    if (name === 'process' && canProcessAny()) shape += 0.03;
    if (name === 'build' && nextBuild()) shape += 0.04;
    if (name === 'seek_material' && (s.wood.item || s.forageWood.item)) shape += 0.02;
    if (name === 'seek_material' && state.hunger < 0.3) shape -= 0.1; // Penalty for gathering materials when very hungry
    brain.reinforce(shape);
  }

  function hasAnyFood(s) {
    return (
      FOOD_TYPES.some((t) => (state.inventory[t] || 0) > 0) ||
      !!(s && s.food.item) ||
      !!(s && s.forageFood.item)
    );
  }

  function canProcessAny() {
    return Object.keys(PROCESS).some((k) => canProcess(k, state.inventory));
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

  function bestInvFood() {
    if (state.inventory.stew > 0) return 'stew';
    if (state.inventory.cooked_fish > 0) return 'cooked_fish';
    if (state.inventory.bread > 0) return 'bread';
    if (state.inventory.fish > 0) return 'fish';
    if (state.inventory.berry > 0) return 'berry';
    if (state.inventory.grain > 0 && state.hunger < 0.4) return 'grain';
    if (state.inventory.grain > 0) return 'grain';
    if (state.inventory.water > 0) return 'water';
    return null;
  }

  function walkToward(x, z, dt, speed) {
    const dx = x - group.position.x;
    const dz = z - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return 0;
    const step = Math.min(dist, speed * dt);
    group.position.x += (dx / dist) * step;
    group.position.z += (dz / dist) * step;
    const yaw = Math.atan2(dx, dz);
    state.facing = yaw;
    group.rotation.y = yaw;
    state.walkPhase += dt * 9 * (speed / 2.2);
    return dist - step;
  }

  function animate(dt, walking) {
    if (!state.landed) return;
    const root = parts.root;
    const t = performance.now() * 0.001;
    if (!root) {
      group.position.y = walking
        ? Math.abs(Math.sin(state.walkPhase)) * 0.05
        : Math.sin(t * 2.2) * 0.02;
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
    const rec = FOOD[type];
    state.busy = { kind: 'eat', t: 0, dur: rec.time, type, fromWorldItem };
  }

  function startProcess(inputType) {
    const atBench = !!benchNear();
    const nearFire = !!fireNear();
    const dur = processDuration(inputType, { atBench, hasTools: state.hasTools, nearFire });
    state.busy = { kind: 'process', t: 0, dur, inputType, atBench, nearFire };
  }

  function startBuild(what) {
    const rec = BUILD[what];
    state.busy = { kind: 'build', t: 0, dur: rec.time, what };
  }

  function startForage(source) {
    state.busy = { kind: 'forage', t: 0, dur: 1.2, source };
  }

  function finishBusy() {
    const b = state.busy;
    state.busy = null;
    if (!b) return;
    if (b.kind === 'eat') {
      const rec = FOOD[b.type];
      state.hunger = Math.min(1, state.hunger + rec.hunger);
      state.energy = Math.min(1, state.energy + rec.energy);
      if (b.fromWorldItem && world.pickups.includes(b.fromWorldItem)) {
        removePickup(world, b.fromWorldItem);
      } else {
        state.inventory[b.type] = Math.max(0, state.inventory[b.type] - 1);
      }
      brain.reinforce(0.9 + rec.hunger);
    } else if (b.kind === 'process') {
      const rec = PROCESS[b.inputType];
      if (rec.inputs) {
        if (canAfford(state.inventory, rec.inputs)) {
          state.inventory = spend(state.inventory, rec.inputs);
          const outCount = rec.outCount || 1;
          state.inventory[rec.out] = (state.inventory[rec.out] || 0) + outCount;
          brain.reinforce(0.85);
        }
      } else if ((state.inventory[b.inputType] || 0) > 0) {
        state.inventory[b.inputType] -= 1;
        const outCount = rec.outCount || 1;
        state.inventory[rec.out] = (state.inventory[rec.out] || 0) + outCount;
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
      brain.reinforce(1.15);
    } else if (b.kind === 'forage') {
      const harvested = harvestForageSource(world, assets, b.source, group.position);
      if (harvested) {
        brain.reinforce(0.6);
      }
    }
  }

  function pickupIfClose(types) {
    const n = nearestPickup(world, group.position, types);
    if (n.item && n.dist < PICKUP_RADIUS) {
      state.inventory[n.item.type] = (state.inventory[n.item.type] || 0) + 1;
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

    const speed = (state.sluggish ? 0.7 : 2.35) * (0.35 + 0.65 * state.energy);
    const s = snap();
    const actName = state.action;

    if (actName === 'idle' || actName === 'idle-hungry') {
      return false;
    }

    if (actName === 'seek_food') {
      const food = s.food.item;
      const forageFood = s.forageFood.item;
      
      // Choose closer option: pickup or forage source
      const useForage = !food || (forageFood && s.forageFood.dist < s.food.dist);
      
      if (useForage && forageFood) {
        const remain = walkToward(forageFood.mesh.position.x, forageFood.mesh.position.z, dt, speed);
        if (remain < FORAGE_RADIUS) {
          startForage(forageFood);
          return false;
        }
        return true;
      } else if (food) {
        const remain = walkToward(food.mesh.position.x, food.mesh.position.z, dt, speed);
        if (remain < PICKUP_RADIUS) {
          startEat(food.type, food);
          return false;
        }
        return true;
      } else {
        const inv = bestInvFood();
        if (inv) startEat(inv, null);
        return false;
      }
    }

    if (actName === 'eat') {
      const inv = bestInvFood();
      if (inv) {
        startEat(inv, null);
        return false;
      }
      if (s.food.item) {
        const remain = walkToward(s.food.item.mesh.position.x, s.food.item.mesh.position.z, dt, speed);
        if (remain < PICKUP_RADIUS) startEat(s.food.item.type, s.food.item);
        return remain >= PICKUP_RADIUS;
      }
      brain.reinforce(-0.05);
      return false;
    }

    if (actName === 'seek_material') {
      const targets = [];
      if (state.hunger > 0.35) targets.push('grain');
      targets.push('wood', 'ore', 'stone', 'planks', 'ingot');
      const n = nearestPickup(world, group.position, targets);
      
      // Check forage sources for materials
      const forageWood = s.forageWood.item;
      const forageOre = s.forageOre.item;
      const forageStone = s.forageStone.item;
      
      // Find best option (pickup or forage)
      let bestTarget = null;
      let bestDist = Infinity;
      let isForage = false;
      
      if (n.item && n.dist < bestDist) {
        bestTarget = n.item;
        bestDist = n.dist;
        isForage = false;
      }
      if (forageWood && s.forageWood.dist < bestDist) {
        bestTarget = forageWood;
        bestDist = s.forageWood.dist;
        isForage = true;
      }
      if (forageOre && s.forageOre.dist < bestDist) {
        bestTarget = forageOre;
        bestDist = s.forageOre.dist;
        isForage = true;
      }
      if (forageStone && s.forageStone.dist < bestDist) {
        bestTarget = forageStone;
        bestDist = s.forageStone.dist;
        isForage = true;
      }
      
      if (!bestTarget) {
        brain.reinforce(-0.03);
        return false;
      }
      
      const remain = walkToward(bestTarget.mesh.position.x, bestTarget.mesh.position.z, dt, speed);
      if (isForage) {
        if (remain < FORAGE_RADIUS) startForage(bestTarget);
      } else {
        if (remain < PICKUP_RADIUS) pickupIfClose([bestTarget.type]);
      }
      return remain >= (isForage ? FORAGE_RADIUS : PICKUP_RADIUS);
    }

    if (actName === 'process') {
      if (!canProcessAny()) {
        const n = nearestPickup(world, group.position, ['wood', 'ore', 'grain', 'berry', 'water', 'fish']);
        const forageWood = s.forageWood.item;
        const forageGrain = nearestForageSource(world, group.position, ['grain']).item;
        const forageFood = s.forageFood.item;
        
        let bestTarget = null;
        let bestDist = Infinity;
        let isForage = false;
        
        if (n.item && n.dist < bestDist) {
          bestTarget = n.item;
          bestDist = n.dist;
          isForage = false;
        }
        if (forageWood && s.forageWood.dist < bestDist) {
          bestTarget = forageWood;
          bestDist = s.forageWood.dist;
          isForage = true;
        }
        if (forageGrain && nearestForageSource(world, group.position, ['grain']).dist < bestDist) {
          bestTarget = forageGrain;
          bestDist = nearestForageSource(world, group.position, ['grain']).dist;
          isForage = true;
        }
        if (forageFood && s.forageFood.dist < bestDist) {
          bestTarget = forageFood;
          bestDist = s.forageFood.dist;
          isForage = true;
        }
        
        if (bestTarget) {
          const remain = walkToward(bestTarget.mesh.position.x, bestTarget.mesh.position.z, dt, speed);
          if (isForage) {
            if (remain < FORAGE_RADIUS) startForage(bestTarget);
          } else {
            if (remain < PICKUP_RADIUS) pickupIfClose(['wood', 'ore', 'grain', 'berry', 'water', 'fish']);
          }
          return remain >= (isForage ? FORAGE_RADIUS : PICKUP_RADIUS);
        }
        brain.reinforce(-0.04);
        return false;
      }
      const wb = nearestBuilding(world, group.position, 'workbench');
      const fire = nearestBuilding(world, group.position, 'fire');
      const bestDist = Math.min(wb.dist, fire.dist);
      const bestTarget = wb.dist < fire.dist ? wb : fire;
      if (bestTarget.item && bestDist > Math.max(WORKBENCH_RADIUS, FIRE_RADIUS) * 0.8) {
        walkToward(bestTarget.item.mesh.position.x, bestTarget.item.mesh.position.z, dt, speed);
        return true;
      }
      const input = Object.keys(PROCESS).find((k) => canProcess(k, state.inventory));
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
        
        // Check forage sources for needed materials
        let bestTarget = null;
        let bestDist = Infinity;
        let isForage = false;
        
        if (n.item && n.dist < bestDist) {
          bestTarget = n.item;
          bestDist = n.dist;
          isForage = false;
        }
        if (need.includes('wood') || need.length === 0) {
          const forageWood = s.forageWood.item;
          if (forageWood && s.forageWood.dist < bestDist) {
            bestTarget = forageWood;
            bestDist = s.forageWood.dist;
            isForage = true;
          }
        }
        if (need.includes('stone') || need.length === 0) {
          const forageStone = s.forageStone.item;
          if (forageStone && s.forageStone.dist < bestDist) {
            bestTarget = forageStone;
            bestDist = s.forageStone.dist;
            isForage = true;
          }
        }
        if (need.includes('ore') || need.length === 0) {
          const forageOre = s.forageOre.item;
          if (forageOre && s.forageOre.dist < bestDist) {
            bestTarget = forageOre;
            bestDist = s.forageOre.dist;
            isForage = true;
          }
        }
        
        if (bestTarget) {
          const remain = walkToward(bestTarget.mesh.position.x, bestTarget.mesh.position.z, dt, speed);
          if (isForage) {
            if (remain < FORAGE_RADIUS) startForage(bestTarget);
          } else {
            if (remain < PICKUP_RADIUS) pickupIfClose([bestTarget.type]);
          }
          return remain >= (isForage ? FORAGE_RADIUS : PICKUP_RADIUS);
        }
        brain.reinforce(-0.04);
        return false;
      }
      startBuild(what);
      return false;
    }

    return false;
  }

  function updateHud() {
    const h = Math.round(state.hunger * 100);
    const e = Math.round(state.energy * 100);
    if (hud.hungerFill) hud.hungerFill.style.width = `${h}%`;
    if (hud.hungerVal) hud.hungerVal.textContent = `${h}%`;
    if (hud.energyFill) hud.energyFill.style.width = `${e}%`;
    if (hud.energyVal) hud.energyVal.textContent = `${e}%`;
    if (hud.action) {
      const busyBit =
        state.busy?.kind === 'eat'
          ? 'Eating'
          : state.busy?.kind === 'process'
            ? 'Crafting'
            : state.busy?.kind === 'build'
              ? 'Building'
              : state.busy?.kind === 'forage'
                ? 'Gathering'
                : ACTION_LABELS[state.action] || 'Idle';
      hud.action.textContent = busyBit;
    }
    if (hud.inv) {
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
      hud.inv.innerHTML = bits.join('');
    }
  }

  function update(dt) {
    if (!state.landed) {
      state.vy -= 18 * dt;
      group.position.y += state.vy * dt;
      if (group.position.y <= 0) {
        group.position.y = 0;
        if (state.vy < -2) state.vy *= -0.25;
        else {
          state.landed = true;
          state.vy = 0;
          group.position.y = 0;
        }
      }
      animate(dt, false);
      updateHud();
      return;
    }

    const drain = hutNear() ? HUNGER_DRAIN_NEAR_HUT : HUNGER_DRAIN;
    state.hunger = Math.max(0, state.hunger - drain * dt);
    if (state.hunger <= 0) {
      state.energy = Math.max(0.15, state.energy - 0.12 * dt);
      state.sluggish = true;
    } else {
      state.sluggish = false;
      state.energy = Math.min(1, state.energy + 0.015 * dt);
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
  }

  return { group, state, brain, update };
}
