import * as THREE from 'three';

let nextId = 1;

export function spawnPickup(world, assets, type, position, { falling = true, isWorldSpawned = false, spawnOrigin = null } = {}) {
  const mesh = assets.create(type);
  const y = falling ? 1.15 : (world.heightAt ? world.heightAt(position.x, position.z) : 0);
  mesh.position.set(position.x, y, position.z);
  mesh.userData = {
    ...mesh.userData,
    type,
    id: nextId++,
    kind: 'pickup',
    vy: 0,
    settled: !falling,
    bobOff: Math.random() * Math.PI * 2,
  };
  world.scene.add(mesh);
  const item = { 
    id: mesh.userData.id, 
    type, 
    mesh,
    isWorldSpawned,
    spawnOrigin: spawnOrigin || { x: position.x, z: position.z },
    respawnTimer: 0,
    respawnDelay: 45.0, // 45s respawn delay for world pickups
  };
  world.pickups.push(item);
  return item;
}

export function removePickup(world, item) {
  const i = world.pickups.indexOf(item);
  if (i >= 0) world.pickups.splice(i, 1);
  world.scene.remove(item.mesh);
  item.mesh.traverse((o) => {
    if (o.geometry) o.geometry.dispose?.();
  });
  
  // If this was a world-spawned pickup, track it for respawn
  if (item.isWorldSpawned && item.spawnOrigin) {
    if (!world.pendingRespawns) world.pendingRespawns = [];
    world.pendingRespawns.push({
      type: item.type,
      origin: item.spawnOrigin,
      timer: 0,
      delay: item.respawnDelay,
    });
  }
}

export function spawnBuilding(world, assets, type, position) {
  const mesh = assets.create(type);
  
  // Find a free position near the requested position to avoid overlaps
  const finalPosition = findFreeBuildingPosition(world, type, position);
  if (!finalPosition) {
    // No free position found, skip the build
    console.warn(`No free position found for ${type}, skipping build`);
    mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
    });
    return null;
  }
  
  const y = world.heightAt ? world.heightAt(finalPosition.x, finalPosition.z) : 0;
  mesh.position.set(finalPosition.x, y, finalPosition.z);
  mesh.scale.setScalar(0.15);
  mesh.userData = { ...mesh.userData, type, kind: 'building', grow: 0 };
  if (type === 'well') {
    mesh.userData.wellTimer = 0;
    mesh.userData.wellInterval = 12;
  }
  world.scene.add(mesh);
  const b = { type, mesh, position: mesh.position };
  world.buildings.push(b);
  return b;
}

/**
 * Find a free position for a building near the requested position.
 * Returns null if no free position is found.
 */
function findFreeBuildingPosition(world, type, requestedPos) {
  // Building footprint radii (approximate clear radius needed)
  const buildingRadius = {
    hut: 2.8,
    workbench: 1.0,
    fire: 1.2,
    well: 1.2,
    chest: 0.9,
  };
  
  const radius = buildingRadius[type] || 1.0;
  
  // Check if a position is free (no overlapping buildings)
  function isFree(x, z) {
    for (const existing of world.buildings) {
      const existingRadius = buildingRadius[existing.type] || 1.0;
      const dx = existing.mesh.position.x - x;
      const dz = existing.mesh.position.z - z;
      const dist = Math.hypot(dx, dz);
      const minDist = radius + existingRadius;
      if (dist < minDist) {
        return false;
      }
    }
    return true;
  }
  
  // First try the requested position
  if (isFree(requestedPos.x, requestedPos.z)) {
    return { x: requestedPos.x, z: requestedPos.z };
  }
  
  // Try positions in a ring around the requested position
  // Start with positions close by, in front first
  const searchOffsets = [
    // Close front positions
    { x: 0, z: 0.5 },
    { x: 0.4, z: 0.4 },
    { x: -0.4, z: 0.4 },
    { x: 0.6, z: 0 },
    { x: -0.6, z: 0 },
    // Ring positions
    { x: 0.8, z: 0.8 },
    { x: -0.8, z: 0.8 },
    { x: 0.8, z: -0.8 },
    { x: -0.8, z: -0.8 },
    { x: 0, z: 1.0 },
    { x: 0, z: -1.0 },
    { x: 1.0, z: 0 },
    { x: -1.0, z: 0 },
    // Farther ring
    { x: 1.4, z: 1.4 },
    { x: -1.4, z: 1.4 },
    { x: 1.4, z: -1.4 },
    { x: -1.4, z: -1.4 },
    { x: 0, z: 2.0 },
    { x: 0, z: -2.0 },
    { x: 2.0, z: 0 },
    { x: -2.0, z: 0 },
  ];
  
  for (const offset of searchOffsets) {
    const testX = requestedPos.x + offset.x;
    const testZ = requestedPos.z + offset.z;
    if (isFree(testX, testZ)) {
      return { x: testX, z: testZ };
    }
  }
  
  // No free position found
  return null;
}

export function updateWorldItems(world, dt) {
  for (const p of world.pickups) {
    const u = p.mesh.userData;
    if (!u.settled) {
      u.vy -= 18 * dt;
      p.mesh.position.y += u.vy * dt;
      const groundY = world.heightAt ? world.heightAt(p.mesh.position.x, p.mesh.position.z) : 0;
      if (p.mesh.position.y <= groundY) {
        p.mesh.position.y = groundY;
        if (u.vy < -1) u.vy *= -0.28;
        else {
          u.settled = true;
          u.vy = 0;
        }
      }
    } else {
      const groundY = world.heightAt ? world.heightAt(p.mesh.position.x, p.mesh.position.z) : 0;
      p.mesh.position.y = groundY + Math.sin(performance.now() * 0.003 + u.bobOff) * 0.04;
      p.mesh.rotation.y += dt * 0.4;
    }
  }
  for (const b of world.buildings) {
    const u = b.mesh.userData;
    if (u.grow < 1) {
      u.grow = Math.min(1, u.grow + dt * 2.4);
      const s = 1 - Math.pow(1 - u.grow, 3);
      b.mesh.scale.setScalar(s);
    }
    
    // Wells produce water periodically
    if (b.type === 'well' && u.grow >= 1) {
      if (u.wellTimer === undefined) u.wellTimer = 0;
      u.wellTimer += dt;
      if (u.wellTimer >= (u.wellInterval || 12)) {
        u.wellTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.8 + Math.random() * 0.6;
        const offsetX = Math.cos(angle) * dist;
        const offsetZ = Math.sin(angle) * dist;
        // Check if world.pickups exists and has the spawnPickup function available
        if (world.pickups && typeof spawnPickup === 'function') {
          const assets = world.userData?.assets;
          if (assets) {
            // Well water is NOT world-spawned (it's building-produced)
            spawnPickup(world, assets, 'water', {
              x: b.mesh.position.x + offsetX,
              z: b.mesh.position.z + offsetZ,
            }, { falling: false, isWorldSpawned: false });
          }
        }
      }
    }
  }
  
  // Update forage sources cooldowns and slow charge regeneration
  if (world.forageSources) {
    for (const source of world.forageSources) {
      if (source.cooldown > 0) {
        source.cooldown = Math.max(0, source.cooldown - dt);
        
        // When cooldown reaches 0, regenerate ONE charge (not full refill)
        if (source.cooldown === 0 && source.charges < source.chargesMax) {
          source.charges += 1;
          
          // If still not at max, set cooldown for next charge
          if (source.charges < source.chargesMax) {
            source.cooldown = source.cooldownMax;
          }
          
          // Visual feedback: restore opacity as charges return
          const alpha = 0.4 + 0.6 * (source.charges / source.chargesMax);
          source.mesh.traverse((child) => {
            if (child.material) {
              if (source.charges === source.chargesMax) {
                child.material.opacity = 1.0;
                child.material.transparent = false;
              } else {
                child.material.opacity = alpha;
                child.material.transparent = true;
              }
            }
          });
        }
      }
      
      // Visual feedback: dim when depleted
      if (source.charges === 0 && source.cooldown === 0) {
        // Just depleted, start cooldown
        source.cooldown = source.cooldownMax;
        source.mesh.traverse((child) => {
          if (child.material) {
            child.material.opacity = 0.4;
            child.material.transparent = true;
          }
        });
      }
    }
  }
  
  // Handle pickup respawns
  if (!world.pendingRespawns) world.pendingRespawns = [];
  for (let i = world.pendingRespawns.length - 1; i >= 0; i--) {
    const respawn = world.pendingRespawns[i];
    respawn.timer += dt;
    if (respawn.timer >= respawn.delay) {
      // Respawn the pickup at its origin
      const assets = world.userData?.assets;
      if (assets) {
        spawnPickup(world, assets, respawn.type, {
          x: respawn.origin.x,
          z: respawn.origin.z,
        }, { falling: false, isWorldSpawned: true, spawnOrigin: respawn.origin });
      }
      world.pendingRespawns.splice(i, 1);
    }
  }
  
  // Animate fauna
  if (world.fauna) {
    for (const creature of world.fauna) {
      creature.hopPhase += dt * 4;
      
      // Update Y position for terrain following
      const groundY = world.heightAt ? world.heightAt(creature.mesh.position.x, creature.mesh.position.z) : 0;
      
      if (creature.swimPhase !== undefined) {
        // Fish: swim slightly above pond floor with gentle bob
        creature.swimPhase += dt * 3;
        creature.mesh.position.y = groundY + Math.sin(creature.swimPhase) * 0.04;
      } else {
        // Land animals: hop on the ground
        creature.mesh.position.y = groundY + Math.abs(Math.sin(creature.hopPhase)) * 0.08;
      }
      
      // Domestic animals produce resources periodically
      if (creature.domestic) {
        creature.productionTimer = (creature.productionTimer || 0) + dt;
        
        // Check if pen and trough exist nearby
        const hasPen = world.buildings && world.buildings.some(b => b.type === 'pen');
        const hasTrough = world.buildings && world.buildings.some(b => b.type === 'trough');
        
        if (hasPen && hasTrough && creature.productionTimer >= creature.productionInterval) {
          creature.productionTimer = 0;
          
          // Spawn product based on species
          const assets = world.userData?.assets;
          if (assets) {
            let product = 'egg';
            if (creature.species === 'deer') product = 'milk';
            else if (creature.species === 'rabbit') product = 'egg'; // Small egg/offspring
            
            const offsetX = (Math.random() - 0.5) * 0.6;
            const offsetZ = (Math.random() - 0.5) * 0.6;
            spawnPickup(world, assets, product, {
              x: creature.mesh.position.x + offsetX,
              z: creature.mesh.position.z + offsetZ,
            }, { falling: false, isWorldSpawned: false });
          }
        }
        
        // Domestic animals stay near pen (if it exists)
        const pen = world.buildings && world.buildings.find(b => b.type === 'pen');
        if (pen) {
          // Constrain bounds to near pen
          const penX = pen.mesh.position.x;
          const penZ = pen.mesh.position.z;
          const penRadius = 4.0;
          creature.bounds = {
            minX: penX - penRadius,
            maxX: penX + penRadius,
            minZ: penZ - penRadius,
            maxZ: penZ + penRadius,
          };
        }
      }
      
      // Wander within bounds
      if (Math.random() < dt * 0.5) {
        creature.dir += (Math.random() - 0.5) * 1.5;
      }
      
      const dx = Math.sin(creature.dir) * creature.speed * dt;
      const dz = Math.cos(creature.dir) * creature.speed * dt;
      const nextX = creature.mesh.position.x + dx;
      const nextZ = creature.mesh.position.z + dz;
      
      const b = creature.bounds;
      if (nextX >= b.minX && nextX <= b.maxX && nextZ >= b.minZ && nextZ <= b.maxZ) {
        creature.mesh.position.x = nextX;
        creature.mesh.position.z = nextZ;
        
        // Orient mesh to face movement direction only when actually moving
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
          // Check if this creature is using a GLB model
          const isGlb = creature.mesh.userData?.fromGltf || false;
          
          if (isGlb) {
            // GLB models (rabbit, deer, fish) face +Z, so no offset needed
            creature.mesh.rotation.y = Math.atan2(dx, dz);
          } else {
            // Procedural models face +X, so offset by -π/2
            creature.mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
          }
        }
      } else {
        creature.dir += Math.PI;
      }
    }
  }
}

export function nearestPickup(world, origin, types) {
  let best = null;
  let bestD = Infinity;
  const ox = origin.x;
  const oz = origin.z;
  for (const p of world.pickups) {
    if (types && !types.includes(p.type)) continue;
    const dx = p.mesh.position.x - ox;
    const dz = p.mesh.position.z - oz;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best ? { item: best, dist: bestD } : { item: null, dist: Infinity };
}

export function nearestBuilding(world, origin, type) {
  let best = null;
  let bestD = Infinity;
  for (const b of world.buildings) {
    if (type && b.type !== type) continue;
    const d = Math.hypot(b.mesh.position.x - origin.x, b.mesh.position.z - origin.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best ? { item: best, dist: bestD } : { item: null, dist: Infinity };
}

export function nearestForageSource(world, origin, harvestTypes) {
  if (!world.forageSources) return { item: null, dist: Infinity };
  let best = null;
  let bestD = Infinity;
  const ox = origin.x;
  const oz = origin.z;
  for (const source of world.forageSources) {
    if (harvestTypes && !harvestTypes.includes(source.harvestType)) continue;
    if (source.charges <= 0) continue;
    const dx = source.mesh.position.x - ox;
    const dz = source.mesh.position.z - oz;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = source;
    }
  }
  return best ? { item: best, dist: bestD } : { item: null, dist: Infinity };
}

export function harvestForageSource(world, assets, source, agentPos, hasTools = false) {
  if (!source || source.charges <= 0) return null;
  
  const harvestType = source.harvestType;
  const isWoodOrStone = ['wood', 'stone', 'ore'].includes(harvestType);
  
  // Tools provide benefits for wood/stone/ore gathering
  let chargesCost = 1;
  let yieldMultiplier = 1;
  
  if (isWoodOrStone && hasTools) {
    // With tools: harvest is more efficient
    yieldMultiplier = 2; // Get 2 items instead of 1
  } else if (isWoodOrStone && !hasTools) {
    // Without tools: gathering wood/stone/ore is slower (costs 2 charges for 1 item)
    // This makes the agent want to craft tools
    chargesCost = Math.min(2, source.charges); // Take up to 2 charges
  }
  
  source.charges = Math.max(0, source.charges - chargesCost);
  if (source.charges === 0) {
    source.cooldown = source.cooldownMax;
  }
  
  // Spawn pickup(s) at agent's feet - mark as world-spawned since it came from a forage source
  for (let i = 0; i < yieldMultiplier; i++) {
    const offsetX = (Math.random() - 0.5) * 0.3;
    const offsetZ = (Math.random() - 0.5) * 0.3;
    spawnPickup(world, assets, harvestType, {
      x: agentPos.x + offsetX,
      z: agentPos.z + offsetZ,
    }, { 
      falling: false, 
      isWorldSpawned: true,
      spawnOrigin: { x: agentPos.x + offsetX, z: agentPos.z + offsetZ }
    });
  }
  
  return harvestType;
}

export function nearestHuntableFauna(world, origin) {
  if (!world.fauna) return { item: null, dist: Infinity };
  let best = null;
  let bestD = Infinity;
  const ox = origin.x;
  const oz = origin.z;
  for (const creature of world.fauna) {
    // Can only hunt wild (non-domestic) land animals
    if (creature.domestic) continue;
    if (creature.biome === 'water') continue; // Fish stay forage-only
    
    const dx = creature.mesh.position.x - ox;
    const dz = creature.mesh.position.z - oz;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = creature;
    }
  }
  return best ? { item: best, dist: bestD } : { item: null, dist: Infinity };
}

export function nearestTendableFauna(world, origin) {
  if (!world.fauna) return { item: null, dist: Infinity };
  
  // Check if pen and trough exist
  const hasPen = world.buildings && world.buildings.some(b => b.type === 'pen');
  const hasTrough = world.buildings && world.buildings.some(b => b.type === 'trough');
  
  if (!hasPen || !hasTrough) return { item: null, dist: Infinity };
  
  let best = null;
  let bestD = Infinity;
  const ox = origin.x;
  const oz = origin.z;
  for (const creature of world.fauna) {
    // Can only tend wild land animals
    if (creature.domestic) continue;
    if (creature.biome === 'water') continue;
    
    const dx = creature.mesh.position.x - ox;
    const dz = creature.mesh.position.z - oz;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = creature;
    }
  }
  return best ? { item: best, dist: bestD } : { item: null, dist: Infinity };
}

export function huntFauna(world, assets, creature, agentPos) {
  if (!creature || creature.domestic) return null;
  
  // Remove creature from world
  const idx = world.fauna.indexOf(creature);
  if (idx >= 0) {
    world.fauna.splice(idx, 1);
    world.scene.remove(creature.mesh);
  }
  
  // Spawn meat at agent position
  spawnPickup(world, assets, 'meat', {
    x: agentPos.x,
    z: agentPos.z,
  }, { falling: false, isWorldSpawned: false });
  
  return 'meat';
}

export function tendFauna(world, creature) {
  if (!creature || creature.domestic) return false;
  
  // Domesticate the creature
  creature.domestic = true;
  creature.productionTimer = 0;
  
  return true;
}
