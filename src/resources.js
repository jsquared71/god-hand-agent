import * as THREE from 'three';

let nextId = 1;

export function spawnPickup(world, assets, type, position, { falling = true } = {}) {
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
  const item = { id: mesh.userData.id, type, mesh };
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
}

export function spawnBuilding(world, assets, type, position) {
  const mesh = assets.create(type);
  mesh.position.set(position.x, 0, position.z);
  mesh.scale.setScalar(0.15);
  mesh.userData = { ...mesh.userData, type, kind: 'building', grow: 0 };
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
