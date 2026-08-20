import * as THREE from 'three';

let nextId = 1;

export function spawnPickup(world, assets, type, position, { falling = true, isWorldSpawned = false, spawnOrigin = null } = {}) {
  const mesh = assets.create(type);
  mesh.position.set(position.x, falling ? 1.15 : 0, position.z);
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
  mesh.position.set(position.x, 0, position.z);
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

export function updateWorldItems(world, dt) {
  for (const p of world.pickups) {
    const u = p.mesh.userData;
    if (!u.settled) {
      u.vy -= 18 * dt;
      p.mesh.position.y += u.vy * dt;
      if (p.mesh.position.y <= 0) {
        p.mesh.position.y = 0;
        if (u.vy < -1) u.vy *= -0.28;
        else {
          u.settled = true;
          u.vy = 0;
        }
      }
    } else {
      p.mesh.position.y = Math.sin(performance.now() * 0.003 + u.bobOff) * 0.04;
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
      if (creature.swimPhase !== undefined) {
        creature.swimPhase += dt * 3;
        creature.mesh.position.y = 0.08 + Math.sin(creature.swimPhase) * 0.03;
      } else {
        creature.mesh.position.y = Math.abs(Math.sin(creature.hopPhase)) * 0.08;
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
        creature.mesh.rotation.y = creature.dir;
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

export function harvestForageSource(world, assets, source, agentPos) {
  if (!source || source.charges <= 0) return null;
  source.charges -= 1;
  if (source.charges === 0) {
    source.cooldown = source.cooldownMax;
  }
  // Spawn pickup at agent's feet - mark as world-spawned since it came from a forage source
  spawnPickup(world, assets, source.harvestType, {
    x: agentPos.x,
    z: agentPos.z,
  }, { 
    falling: false, 
    isWorldSpawned: true,
    spawnOrigin: { x: agentPos.x, z: agentPos.z }
  });
  return source.harvestType;
}
