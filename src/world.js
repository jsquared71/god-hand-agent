import * as THREE from 'three';

// Seeded RNG (simple LCG)
class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  
  range(min, max) {
    return min + this.next() * (max - min);
  }
  
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

function makeSky() {
  const geo = new THREE.SphereGeometry(180, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#6d86a0') },
      bottomColor: { value: new THREE.Color('#e2d3b4') },
      offset: { value: 0.12 },
      exponent: { value: 1.15 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        float t = clamp(pow(max(h + offset, 0.0), exponent), 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.frustumCulled = false;
  return sky;
}

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a5844';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    const p = (i / 16) * 512;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 70 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v}, ${v + 12}, ${v - 8}, 0.12)`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBiomes(scene, seed = Date.now()) {
  const rng = new SeededRandom(seed);
  const fauna = [];
  const forageSources = [];
  
  // Meadow (center/east): grass, berries, rabbits
  const meadowMat = new THREE.MeshStandardMaterial({
    color: '#7a9a6a',
    roughness: 0.95,
    metalness: 0,
  });
  const meadowCount = rng.int(20, 30);
  for (let i = 0; i < meadowCount; i++) {
    const x = rng.range(3, 13);
    const z = rng.range(-6, 6);
    const grass = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.35, 4),
      meadowMat
    );
    grass.position.set(x, 0.175, z);
    grass.rotation.y = rng.next() * Math.PI * 2;
    grass.castShadow = true;
    grass.receiveShadow = true;
    scene.add(grass);
  }
  
  // Berry bushes (harvestable) - now with visible red berries
  const berryBushMat = new THREE.MeshStandardMaterial({
    color: '#4a6a3a',
    roughness: 0.85,
  });
  const berryMat = new THREE.MeshStandardMaterial({
    color: '#c41e5a',
    roughness: 0.4,
    emissive: '#3a0010',
    emissiveIntensity: 0.15,
  });
  const berryCount = rng.int(6, 10);
  for (let i = 0; i < berryCount; i++) {
    const x = rng.range(5, 14);
    const z = rng.range(-5, 5);
    const bushGroup = new THREE.Group();
    bushGroup.position.set(x, 0, z);
    
    // Green foliage base
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      berryBushMat
    );
    bush.position.y = 0.22;
    bush.scale.set(1.1, 0.75, 1.1);
    bush.castShadow = true;
    bush.receiveShadow = true;
    bushGroup.add(bush);
    
    // Clustered red berries on top
    for (let j = 0; j < 8; j++) {
      const angle = (j / 8) * Math.PI * 2 + rng.next() * 0.3;
      const radius = 0.15 + rng.next() * 0.15;
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 5),
        berryMat
      );
      berry.position.set(
        Math.cos(angle) * radius,
        0.25 + rng.next() * 0.1,
        Math.sin(angle) * radius
      );
      berry.castShadow = true;
      bushGroup.add(berry);
    }
    
    scene.add(bushGroup);
    forageSources.push({
      mesh: bushGroup,
      type: 'berry',
      harvestType: 'berry',
      cooldown: 0,
      cooldownMax: 30.0, // 30s per charge regeneration
      charges: 3,
      chargesMax: 3,
    });
  }
  
  // Grain stalks (harvestable) - larger golden wheat patches
  const grainMat = new THREE.MeshStandardMaterial({
    color: '#e8b923',
    roughness: 0.85,
  });
  const grainStalkMat = new THREE.MeshStandardMaterial({
    color: '#c9a227',
    roughness: 0.9,
  });
  const grainCount = rng.int(4, 7);
  for (let i = 0; i < grainCount; i++) {
    const centerX = rng.range(4, 12);
    const centerZ = rng.range(-4, 4);
    const patchGroup = new THREE.Group();
    patchGroup.position.set(centerX, 0, centerZ);
    
    // Create a small wheat patch (cluster of stalks)
    for (let j = 0; j < 10; j++) {
      const offsetX = (rng.next() - 0.5) * 0.8;
      const offsetZ = (rng.next() - 0.5) * 0.8;
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.03, 0.65, 5),
        grainStalkMat
      );
      stalk.position.set(offsetX, 0.32, offsetZ);
      stalk.castShadow = true;
      patchGroup.add(stalk);
      
      // Golden grain head on top
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 5, 4),
        grainMat
      );
      head.position.set(offsetX, 0.68, offsetZ);
      head.scale.set(1, 1.3, 1);
      head.castShadow = true;
      patchGroup.add(head);
    }
    
    scene.add(patchGroup);
    forageSources.push({
      mesh: patchGroup,
      type: 'grain',
      harvestType: 'grain',
      cooldown: 0,
      cooldownMax: 35.0, // 35s per charge regeneration
      charges: 2,
      chargesMax: 2,
    });
  }
  
  // Mushroom clusters in meadow edges (harvestable food)
  const mushroomCapMat = new THREE.MeshStandardMaterial({
    color: '#d4745a',
    roughness: 0.7,
  });
  const mushroomStemMat = new THREE.MeshStandardMaterial({
    color: '#e8d8c4',
    roughness: 0.8,
  });
  const mushroomCount = rng.int(3, 6);
  for (let i = 0; i < mushroomCount; i++) {
    const x = rng.range(3, 13);
    const z = rng.range(-6, 6);
    const cluster = new THREE.Group();
    cluster.position.set(x, 0, z);
    
    for (let j = 0; j < 3; j++) {
      const offsetX = (rng.next() - 0.5) * 0.3;
      const offsetZ = (rng.next() - 0.5) * 0.3;
      const size = 0.08 + rng.next() * 0.04;
      
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.4, size * 0.5, size * 2, 6),
        mushroomStemMat
      );
      stem.position.set(offsetX, size, offsetZ);
      stem.castShadow = true;
      cluster.add(stem);
      
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.4, 8, 6),
        mushroomCapMat
      );
      cap.position.set(offsetX, size * 2.2, offsetZ);
      cap.scale.set(1, 0.6, 1);
      cap.castShadow = true;
      cluster.add(cap);
    }
    
    scene.add(cluster);
    forageSources.push({
      mesh: cluster,
      type: 'mushroom',
      harvestType: 'mushroom',
      cooldown: 0,
      cooldownMax: 40.0, // 40s per charge regeneration
      charges: 2,
      chargesMax: 2,
    });
  }
  
  // Forest fruit bushes (harvestable food) - apples/berries on trees
  const fruitMat = new THREE.MeshStandardMaterial({
    color: '#e85a4a',
    roughness: 0.5,
    emissive: '#4a1a10',
    emissiveIntensity: 0.12,
  });
  const fruitBushMat = new THREE.MeshStandardMaterial({
    color: '#5a7a4a',
    roughness: 0.8,
  });
  const fruitCount = rng.int(3, 6);
  for (let i = 0; i < fruitCount; i++) {
    const x = rng.range(-13, -7);
    const z = rng.range(-5, 5);
    const bush = new THREE.Group();
    bush.position.set(x, 0, z);
    
    // Green foliage
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      fruitBushMat
    );
    foliage.position.y = 0.3;
    foliage.scale.set(1, 0.8, 1);
    foliage.castShadow = true;
    bush.add(foliage);
    
    // Red/orange fruits
    for (let j = 0; j < 6; j++) {
      const angle = (j / 6) * Math.PI * 2 + rng.next() * 0.5;
      const radius = 0.2 + rng.next() * 0.15;
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 6, 5),
        fruitMat
      );
      fruit.position.set(
        Math.cos(angle) * radius,
        0.35 + rng.next() * 0.15,
        Math.sin(angle) * radius
      );
      fruit.castShadow = true;
      bush.add(fruit);
    }
    
    scene.add(bush);
    forageSources.push({
      mesh: bush,
      type: 'fruit_bush',
      harvestType: 'fruit',
      cooldown: 0,
      cooldownMax: 35.0,
      charges: 2,
      chargesMax: 2,
    });
  }
  
  // Meadow herbs (harvestable food) - small green plants
  const herbMat = new THREE.MeshStandardMaterial({
    color: '#6a8a4a',
    roughness: 0.85,
  });
  const herbCount = rng.int(4, 7);
  for (let i = 0; i < herbCount; i++) {
    const x = rng.range(4, 12);
    const z = rng.range(-5, 5);
    const herbPatch = new THREE.Group();
    herbPatch.position.set(x, 0, z);
    
    for (let j = 0; j < 5; j++) {
      const offsetX = (rng.next() - 0.5) * 0.4;
      const offsetZ = (rng.next() - 0.5) * 0.4;
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.25, 4),
        herbMat
      );
      leaf.position.set(offsetX, 0.125, offsetZ);
      leaf.rotation.y = rng.next() * Math.PI * 2;
      leaf.castShadow = true;
      herbPatch.add(leaf);
    }
    
    scene.add(herbPatch);
    forageSources.push({
      mesh: herbPatch,
      type: 'herb_patch',
      harvestType: 'herb',
      cooldown: 0,
      cooldownMax: 30.0,
      charges: 2,
      chargesMax: 2,
    });
  }
  
  // Rabbits
  const rabbitMat = new THREE.MeshStandardMaterial({
    color: '#c4a890',
    roughness: 0.7,
  });
  const rabbitCount = rng.int(2, 4);
  for (let i = 0; i < rabbitCount; i++) {
    const x = rng.range(5, 13);
    const z = rng.range(-4, 4);
    const rabbit = new THREE.Group();
    rabbit.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.18, 4, 8), rabbitMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.15;
    rabbit.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), rabbitMat);
    head.position.set(0.18, 0.18, 0);
    rabbit.add(head);
    rabbit.castShadow = true;
    rabbit.receiveShadow = true;
    scene.add(rabbit);
    fauna.push({
      mesh: rabbit,
      species: 'rabbit',
      biome: 'meadow',
      bounds: { minX: 3, maxX: 13, minZ: -6, maxZ: 6 },
      speed: 0.4,
      dir: rng.next() * Math.PI * 2,
      hopPhase: rng.next() * Math.PI * 2,
      domestic: false,
      productionTimer: 0,
      productionInterval: 60.0, // 60s to produce egg/meat
    });
  }
  
  // Forest (west/northwest): trees, logs
  const treeMat = new THREE.MeshStandardMaterial({
    color: '#5a4a2a',
    roughness: 0.9,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#3a6a3a',
    roughness: 0.8,
  });
  const treeCount = rng.int(10, 15);
  for (let i = 0; i < treeCount; i++) {
    const x = rng.range(-14, -6);
    const z = rng.range(-6, 6);
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 2.5, 8),
      treeMat
    );
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.8, 7),
      leafMat
    );
    foliage.position.y = 3.0;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    tree.add(foliage);
    scene.add(tree);
    forageSources.push({
      mesh: tree,
      type: 'tree',
      harvestType: 'wood',
      cooldown: 0,
      cooldownMax: 35.0, // 35s per charge regeneration
      charges: 3,
      chargesMax: 3,
    });
  }
  
  // Logs (harvestable)
  const logMat = new THREE.MeshStandardMaterial({
    color: '#6b4a2a',
    roughness: 0.95,
  });
  const logCount = rng.int(2, 4);
  for (let i = 0; i < logCount; i++) {
    const x = rng.range(-13, -7);
    const z = rng.range(-4, 4);
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 1.2, 8),
      logMat
    );
    log.position.set(x, 0.12, z);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rng.next() * Math.PI;
    log.castShadow = true;
    log.receiveShadow = true;
    scene.add(log);
    forageSources.push({
      mesh: log,
      type: 'log',
      harvestType: 'wood',
      cooldown: 0,
      cooldownMax: 25.0, // 25s per charge regeneration
      charges: 2,
      chargesMax: 2,
    });
  }
  
  // Deer
  const deerMat = new THREE.MeshStandardMaterial({
    color: '#8a6a4a',
    roughness: 0.75,
  });
  const deerCount = rng.int(1, 3);
  for (let i = 0; i < deerCount; i++) {
    const x = rng.range(-12, -6);
    const z = rng.range(-3, 3);
    const deer = new THREE.Group();
    deer.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 4, 8), deerMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.35;
    deer.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6), deerMat);
    neck.position.set(0.3, 0.5, 0);
    neck.rotation.z = -0.5;
    deer.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.1), deerMat);
    head.position.set(0.42, 0.65, 0);
    deer.add(head);
    deer.castShadow = true;
    deer.receiveShadow = true;
    scene.add(deer);
    fauna.push({
      mesh: deer,
      species: 'deer',
      biome: 'forest',
      bounds: { minX: -14, maxX: -6, minZ: -6, maxZ: 6 },
      speed: 0.5,
      dir: rng.next() * Math.PI * 2,
      hopPhase: 0,
      domestic: false,
      productionTimer: 0,
      productionInterval: 80.0, // 80s to produce milk
    });
  }
  
  // Rocky (south): boulders, rocks (harvestable)
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#7a7a7a',
    roughness: 0.98,
    flatShading: true,
  });
  const oreMat = new THREE.MeshStandardMaterial({
    color: '#5a3a28',
    roughness: 0.95,
    flatShading: true,
  });
  const rockCount = rng.int(12, 18);
  for (let i = 0; i < rockCount; i++) {
    const x = rng.range(-6, 6);
    const z = rng.range(7, 15);
    const size = rng.range(0.3, 0.9);
    const isOre = rng.next() < 0.3;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(size, 0),
      isOre ? oreMat : rockMat
    );
    rock.position.set(x, size * 0.6, z);
    rock.rotation.set(rng.next(), rng.next(), rng.next());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    forageSources.push({
      mesh: rock,
      type: isOre ? 'ore_rock' : 'stone_rock',
      harvestType: isOre ? 'ore' : 'stone',
      cooldown: 0,
      cooldownMax: 45.0, // 45s per charge regeneration (slower for minerals)
      charges: 2,
      chargesMax: 2,
    });
  }
  
  // Water biome (north): pond, reeds, fish
  const pondX = rng.range(-3, -1);
  const pondZ = rng.range(-12, -10);
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#4a7aa8',
    roughness: 0.15,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 24),
    waterMat
  );
  pond.position.set(pondX, 0.03, pondZ);
  pond.rotation.x = -Math.PI / 2;
  pond.receiveShadow = true;
  scene.add(pond);
  
  // Reeds
  const reedMat = new THREE.MeshStandardMaterial({
    color: '#5a7a4a',
    roughness: 0.9,
  });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 4.8 + rng.next() * 0.8;
    const x = pondX + Math.cos(angle) * r;
    const z = pondZ + Math.sin(angle) * r;
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.03, 0.8, 5),
      reedMat
    );
    reed.position.set(x, 0.4, z);
    reed.castShadow = true;
    reed.receiveShadow = true;
    scene.add(reed);
  }
  
  // Swimming fish (harvestable fauna) - more visible and colorful
  const fishMat = new THREE.MeshStandardMaterial({
    color: '#78a8c4',
    roughness: 0.5,
    metalness: 0.2,
  });
  const fishAccentMat = new THREE.MeshStandardMaterial({
    color: '#e89838',
    roughness: 0.6,
  });
  const fishCount = rng.int(5, 8);
  for (let i = 0; i < fishCount; i++) {
    const angle = (i / fishCount) * Math.PI * 2 + rng.next();
    const r = 2 + rng.next() * 2.5;
    const x = pondX + Math.cos(angle) * r;
    const z = pondZ + Math.sin(angle) * r;
    const fish = new THREE.Group();
    fish.position.set(x, 0.12, z);
    
    // Larger, more visible body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 4, 8), fishMat);
    body.rotation.z = Math.PI / 2;
    fish.add(body);
    
    // Orange/yellow tail for visibility
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 5), fishAccentMat);
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.25;
    fish.add(tail);
    
    // Dorsal fin
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 4), fishAccentMat);
    fin.position.y = 0.12;
    fin.rotation.x = Math.PI;
    fish.add(fin);
    
    fish.castShadow = true;
    scene.add(fish);
    const fishFauna = {
      mesh: fish,
      biome: 'water',
      bounds: { minX: pondX - 5, maxX: pondX + 5, minZ: pondZ - 5, maxZ: pondZ + 5 },
      speed: 0.6,
      dir: rng.next() * Math.PI * 2,
      hopPhase: 0,
      swimPhase: rng.next() * Math.PI * 2,
    };
    fauna.push(fishFauna);
    forageSources.push({
      mesh: fish,
      type: 'fish',
      harvestType: 'fish',
      cooldown: 0,
      cooldownMax: 60.0, // 60s per charge regeneration (slowest - fish take time to "respawn")
      charges: 1,
      chargesMax: 1,
      fauna: fishFauna,
    });
  }
  
  // Water gathering points around pond edge
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const r = 4.2; // Just inside the reeds
    const x = pondX + Math.cos(angle) * r;
    const z = pondZ + Math.sin(angle) * r;
    // Invisible marker for water gathering
    const waterNode = new THREE.Group();
    waterNode.position.set(x, 0, z);
    scene.add(waterNode);
    forageSources.push({
      mesh: waterNode,
      type: 'water_source',
      harvestType: 'water',
      cooldown: 0,
      cooldownMax: 25.0, // 25s per charge regeneration
      charges: 3,
      chargesMax: 3,
    });
  }
  
  return { fauna, forageSources, seed };
}

export function dressWorld(world, assets) {
  const forageTypeMap = {
    tree: 'tree',
    berry: 'bush',
    grain: 'grain',
    mushroom: 'mushroom',
    fruit_bush: 'fruit',
    herb_patch: 'herb',
    fish: 'fish',
  };
  
  const faunaBiomeMap = {
    meadow: 'rabbit',
    forest: 'deer',
    water: 'fish',
  };
  
  for (const forage of world.forageSources) {
    const glbId = forageTypeMap[forage.type];
    if (glbId && assets.usingGlb(glbId)) {
      const oldMesh = forage.mesh;
      const pos = oldMesh.position.clone();
      const yaw = oldMesh.rotation.y;
      
      world.scene.remove(oldMesh);
      
      const newMesh = assets.create(glbId);
      newMesh.position.copy(pos);
      newMesh.rotation.y = yaw;
      world.scene.add(newMesh);
      
      forage.mesh = newMesh;
      
      if (forage.fauna) {
        forage.fauna.mesh = newMesh;
      }
    }
  }
  
  for (const animal of world.fauna) {
    const glbId = faunaBiomeMap[animal.biome];
    if (glbId && assets.usingGlb(glbId)) {
      const oldMesh = animal.mesh;
      const pos = oldMesh.position.clone();
      const dx = Math.cos(animal.dir);
      const dz = Math.sin(animal.dir);
      const yaw = Math.atan2(dx, dz) - Math.PI / 2;
      
      world.scene.remove(oldMesh);
      
      const newMesh = assets.create(glbId);
      newMesh.position.copy(pos);
      newMesh.rotation.y = yaw;
      world.scene.add(newMesh);
      
      animal.mesh = newMesh;
    }
  }
}

export function createWorld(canvas, seed = null) {
  // Generate or use provided seed
  const worldSeed = seed ?? Date.now();
  
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#c9bea6', 28, 78);
  const sky = makeSky();
  scene.add(sky);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(11.5, 9.2, 12.5);

  const hemi = new THREE.HemisphereLight('#d7e6f2', '#7d6b4e', 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff1d0', 1.35);
  sun.position.set(18, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  
  // Moon light for night
  const moon = new THREE.DirectionalLight('#a0b8d8', 0);
  moon.position.set(-18, 20, -12);
  moon.castShadow = false;
  scene.add(moon);

  const groundMat = new THREE.MeshStandardMaterial({
    map: makeGroundTexture(),
    color: '#8a9a7a',
    roughness: 0.95,
    metalness: 0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  const grid = new THREE.GridHelper(90, 36, 0x9aa88c, 0x6d7864);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);

  // Biome setup - 4 distinct zones with seeded randomization
  const biomes = createBiomes(scene, worldSeed);

  // Dedicated invisible plane so drops always raycast, even if grid/ground change.
  const dropPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  dropPlane.rotation.x = -Math.PI / 2;
  dropPlane.position.y = 0.02;
  dropPlane.name = 'dropPlane';
  dropPlane.renderOrder = 1;
  scene.add(dropPlane);

  const pickups = [];
  const buildings = [];
  const fauna = biomes.fauna;
  const forageSources = biomes.forageSources;
  
  // Day/night cycle (4-5 minutes real time: 70% day, 30% night)
  const DAY_LENGTH = 270; // seconds total (4.5 minutes)
  const NIGHT_START = 0.7; // 70% through the day
  const worldClock = {
    time: 0.25, // Start at morning (25% through day)
    dayIndex: 0,
    lastIsNight: false,
  };
  
  function updateDayNight(dt) {
    worldClock.time += dt / DAY_LENGTH;
    if (worldClock.time >= 1) {
      worldClock.time -= 1;
      worldClock.dayIndex++;
    }
    
    const t = worldClock.time;
    const isNight = t >= NIGHT_START;
    const dayT = t / NIGHT_START; // 0-1 through day
    const nightT = (t - NIGHT_START) / (1 - NIGHT_START); // 0-1 through night
    
    // Trigger nightfall sound once per night
    if (isNight && !worldClock.lastIsNight) {
      import('./audio.js').then(({ playNightfall }) => playNightfall());
    }
    worldClock.lastIsNight = isNight;
    
    // Sky colors
    const skyMat = sky.material;
    if (isNight) {
      // Night: dark blue sky
      const nightBlend = Math.min(1, nightT * 3); // Quick transition into night
      skyMat.uniforms.topColor.value.lerp(new THREE.Color('#1a2440'), nightBlend * 0.3);
      skyMat.uniforms.bottomColor.value.lerp(new THREE.Color('#2a3550'), nightBlend * 0.3);
    } else if (dayT > 0.85) {
      // Dusk
      const duskT = (dayT - 0.85) / 0.15;
      skyMat.uniforms.topColor.value.lerpColors(
        new THREE.Color('#6d86a0'),
        new THREE.Color('#8a5a4a'),
        duskT
      );
      skyMat.uniforms.bottomColor.value.lerpColors(
        new THREE.Color('#e2d3b4'),
        new THREE.Color('#d4845a'),
        duskT
      );
    } else {
      // Day
      skyMat.uniforms.topColor.value.lerp(new THREE.Color('#6d86a0'), 0.1);
      skyMat.uniforms.bottomColor.value.lerp(new THREE.Color('#e2d3b4'), 0.1);
    }
    
    // Fog colors
    if (isNight) {
      scene.fog.color.lerp(new THREE.Color('#1a2030'), 0.05);
    } else if (dayT > 0.85) {
      const duskT = (dayT - 0.85) / 0.15;
      scene.fog.color.lerpColors(
        new THREE.Color('#c9bea6'),
        new THREE.Color('#7a5a4a'),
        duskT
      );
    } else {
      scene.fog.color.lerp(new THREE.Color('#c9bea6'), 0.05);
    }
    
    // Sun and moon
    if (isNight) {
      sun.intensity = Math.max(0, 1.35 * (1 - nightT * 2));
      moon.intensity = Math.min(0.25, nightT * 0.5);
      hemi.intensity = Math.max(0.2, 0.85 - nightT * 0.65);
    } else if (dayT > 0.85) {
      const duskT = (dayT - 0.85) / 0.15;
      sun.intensity = 1.35 * (1 - duskT * 0.6);
      moon.intensity = 0;
      hemi.intensity = 0.85 - duskT * 0.3;
    } else {
      sun.intensity = 1.35;
      moon.intensity = 0;
      hemi.intensity = 0.85;
    }
    
    renderer.toneMappingExposure = isNight ? 0.7 : 1.05;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    renderer,
    scene,
    camera,
    dropPlane,
    ground,
    pickups,
    buildings,
    fauna,
    forageSources,
    sun,
    moon,
    hemi,
    sky,
    seed: worldSeed,
    worldClock,
    updateDayNight,
    render() {
      renderer.render(scene, camera);
    },
  };
}
