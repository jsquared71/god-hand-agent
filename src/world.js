import * as THREE from 'three';

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

function createBiomes(scene) {
  const fauna = [];
  
  // Meadow (center/east): grass, berries, rabbits
  const meadowMat = new THREE.MeshStandardMaterial({
    color: '#7a9a6a',
    roughness: 0.95,
    metalness: 0,
  });
  for (let i = 0; i < 25; i++) {
    const x = 3 + Math.random() * 10;
    const z = -6 + Math.random() * 12;
    const grass = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.35, 4),
      meadowMat
    );
    grass.position.set(x, 0.175, z);
    grass.rotation.y = Math.random() * Math.PI * 2;
    grass.castShadow = true;
    grass.receiveShadow = true;
    scene.add(grass);
  }
  
  // Berry bushes
  const berryBushMat = new THREE.MeshStandardMaterial({
    color: '#4a6a3a',
    roughness: 0.85,
  });
  for (let i = 0; i < 4; i++) {
    const x = 6 + Math.random() * 7;
    const z = -5 + Math.random() * 10;
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 6, 5),
      berryBushMat
    );
    bush.position.set(x, 0.2, z);
    bush.scale.set(1, 0.7, 1);
    bush.castShadow = true;
    bush.receiveShadow = true;
    scene.add(bush);
  }
  
  // Rabbits
  const rabbitMat = new THREE.MeshStandardMaterial({
    color: '#c4a890',
    roughness: 0.7,
  });
  for (let i = 0; i < 3; i++) {
    const x = 5 + Math.random() * 8;
    const z = -4 + Math.random() * 8;
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
      biome: 'meadow',
      bounds: { minX: 3, maxX: 13, minZ: -6, maxZ: 6 },
      speed: 0.4,
      dir: Math.random() * Math.PI * 2,
      hopPhase: Math.random() * Math.PI * 2,
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
  for (let i = 0; i < 12; i++) {
    const x = -14 + Math.random() * 8;
    const z = -6 + Math.random() * 12;
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
  }
  
  // Logs
  const logMat = new THREE.MeshStandardMaterial({
    color: '#6b4a2a',
    roughness: 0.95,
  });
  for (let i = 0; i < 3; i++) {
    const x = -13 + Math.random() * 6;
    const z = -4 + Math.random() * 8;
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 1.2, 8),
      logMat
    );
    log.position.set(x, 0.12, z);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = Math.random() * Math.PI;
    log.castShadow = true;
    log.receiveShadow = true;
    scene.add(log);
  }
  
  // Deer
  const deerMat = new THREE.MeshStandardMaterial({
    color: '#8a6a4a',
    roughness: 0.75,
  });
  for (let i = 0; i < 2; i++) {
    const x = -12 + Math.random() * 6;
    const z = -3 + Math.random() * 6;
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
      biome: 'forest',
      bounds: { minX: -14, maxX: -6, minZ: -6, maxZ: 6 },
      speed: 0.5,
      dir: Math.random() * Math.PI * 2,
      hopPhase: 0,
    });
  }
  
  // Rocky (south): boulders, rocks
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
  for (let i = 0; i < 15; i++) {
    const x = -6 + Math.random() * 12;
    const z = 7 + Math.random() * 8;
    const size = 0.3 + Math.random() * 0.6;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(size, 0),
      Math.random() < 0.3 ? oreMat : rockMat
    );
    rock.position.set(x, size * 0.6, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
  
  // Water biome (north): pond, reeds, fish
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
  pond.position.set(-2, 0.03, -11);
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
    const r = 4.8 + Math.random() * 0.8;
    const x = -2 + Math.cos(angle) * r;
    const z = -11 + Math.sin(angle) * r;
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.03, 0.8, 5),
      reedMat
    );
    reed.position.set(x, 0.4, z);
    reed.castShadow = true;
    reed.receiveShadow = true;
    scene.add(reed);
  }
  
  // Swimming fish
  const fishMat = new THREE.MeshStandardMaterial({
    color: '#78a8c4',
    roughness: 0.5,
    metalness: 0.2,
  });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.random();
    const r = 2 + Math.random() * 2.5;
    const x = -2 + Math.cos(angle) * r;
    const z = -11 + Math.sin(angle) * r;
    const fish = new THREE.Group();
    fish.position.set(x, 0.08, z);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.25, 4, 8), fishMat);
    body.rotation.z = Math.PI / 2;
    fish.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.15, 5), fishMat);
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.2;
    fish.add(tail);
    fish.castShadow = true;
    scene.add(fish);
    fauna.push({
      mesh: fish,
      biome: 'water',
      bounds: { minX: -7, maxX: 3, minZ: -16, maxZ: -6 },
      speed: 0.6,
      dir: Math.random() * Math.PI * 2,
      hopPhase: 0,
      swimPhase: Math.random() * Math.PI * 2,
    });
  }
  
  return { fauna };
}

export function createWorld(canvas) {
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
  scene.add(makeSky());

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

  // Biome setup - 4 distinct zones
  const biomes = createBiomes(scene);

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
    sun,
    render() {
      renderer.render(scene, camera);
    },
  };
}
