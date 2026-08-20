import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { COLORS } from './recipes.js';

const TARGET_SIZE = {
  agent: 1.7,
  berry: 0.32,
  grain: 0.5,
  wood: 0.7,
  stone: 0.42,
  ore: 0.42,
  water: 0.35,
  planks: 0.5,
  ingot: 0.42,
  bread: 0.32,
  stew: 0.35,
  dough: 0.28,
  fish: 0.4,
  cooked_fish: 0.4,
  sticks: 0.45,
  hut: 4.8,
  workbench: 1.35,
  fire: 1.8,
  well: 1.6,
  chest: 1.2,
};

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extra.roughness ?? 0.72,
    metalness: extra.metalness ?? 0.05,
    emissive: extra.emissive ?? 0x000000,
    emissiveIntensity: extra.emissiveIntensity ?? 0,
    flatShading: extra.flatShading ?? true,
    transparent: extra.transparent ?? false,
    opacity: extra.opacity ?? 1,
  });
}

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sitOnGround(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) root.position.y -= box.min.y;
  return root;
}

/* ---------- procedural stand-ins ---------- */

export function makeBerry() {
  const g = new THREE.Group();
  g.name = 'berry';
  const mat = std(COLORS.berry, { roughness: 0.45, emissive: 0x3a0010, emissiveIntensity: 0.12 });
  const leaf = std(0x3d7a3a);
  const offsets = [
    [0, 0.08, 0],
    [0.07, 0.04, 0.04],
    [-0.06, 0.05, 0.05],
    [0.02, 0.05, -0.07],
    [-0.05, 0.03, -0.04],
  ];
  for (const [x, y, z] of offsets) {
    const s = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), mat));
    s.position.set(x, y, z);
    g.add(s);
  }
  const l = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 5), leaf));
  l.position.set(0.02, 0.16, 0);
  l.rotation.z = 0.6;
  g.add(l);
  return sitOnGround(g);
}

export function makeGrain() {
  const g = new THREE.Group();
  g.name = 'grain';
  const stalk = std(0xc9a227);
  const head = std(COLORS.grain, { roughness: 0.55 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 0.5 - 0.4;
    const st = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, 0.03), stalk));
    st.position.set(Math.sin(a) * 0.05, 0.16, Math.cos(a) * 0.03);
    st.rotation.z = a * 0.35;
    g.add(st);
    const hd = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), head));
    hd.position.copy(st.position);
    hd.position.y += 0.2;
    hd.rotation.z = st.rotation.z;
    g.add(hd);
  }
  return sitOnGround(g);
}

export function makeWood() {
  const g = new THREE.Group();
  g.name = 'wood';
  const bark = std(COLORS.wood, { roughness: 0.9 });
  const rings = std(0xc4a574, { roughness: 0.7 });
  const log = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.62, 8), bark));
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.12;
  g.add(log);
  const capG = new THREE.CircleGeometry(0.1, 8);
  const c1 = shadow(new THREE.Mesh(capG, rings));
  c1.position.set(0.31, 0.12, 0);
  c1.rotation.y = Math.PI / 2;
  const c2 = shadow(new THREE.Mesh(capG, rings));
  c2.position.set(-0.31, 0.12, 0);
  c2.rotation.y = -Math.PI / 2;
  g.add(c1, c2);
  return sitOnGround(g);
}

export function makeStone() {
  const g = new THREE.Group();
  g.name = 'stone';
  const mat = std(COLORS.stone, { roughness: 0.95, flatShading: true });
  const m = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat));
  m.scale.set(1.15, 0.85, 1.0);
  m.position.y = 0.12;
  g.add(m);
  const m2 = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), mat));
  m2.position.set(0.1, 0.08, 0.04);
  g.add(m2);
  return sitOnGround(g);
}

export function makeOre() {
  const g = new THREE.Group();
  g.name = 'ore';
  const rock = std(0x3a2a28, { roughness: 0.92 });
  const fleck = std(0xc45c26, { metalness: 0.65, roughness: 0.35, emissive: 0x4a1800, emissiveIntensity: 0.2 });
  const core = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), rock));
  core.position.y = 0.14;
  g.add(core);
  for (const p of [
    [0.12, 0.16, 0.06],
    [-0.1, 0.14, 0.08],
    [0.02, 0.22, -0.1],
    [0.08, 0.1, -0.12],
  ]) {
    const f = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), fleck));
    f.position.set(...p);
    f.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(f);
  }
  return sitOnGround(g);
}

export function makePlanks() {
  const g = new THREE.Group();
  g.name = 'planks';
  const mat = std(COLORS.planks, { roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const p = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.12), mat));
    p.position.set(0, 0.03 + i * 0.05, (i - 1) * 0.02);
    p.rotation.y = (i - 1) * 0.08;
    g.add(p);
  }
  return sitOnGround(g);
}

export function makeIngot() {
  const g = new THREE.Group();
  g.name = 'ingot';
  const mat = std(COLORS.ingot, { metalness: 0.7, roughness: 0.38, flatShading: true });
  const shape = new THREE.BoxGeometry(0.34, 0.08, 0.16);
  const m = shadow(new THREE.Mesh(shape, mat));
  m.position.y = 0.05;
  g.add(m);
  const top = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.12), mat));
  top.position.y = 0.1;
  g.add(top);
  return sitOnGround(g);
}

export function makeBread() {
  const g = new THREE.Group();
  g.name = 'bread';
  const crust = std(COLORS.bread, { roughness: 0.8 });
  const loaf = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.16, 4, 8), crust));
  loaf.rotation.z = Math.PI / 2;
  loaf.position.y = 0.08;
  loaf.scale.set(1, 0.85, 1.1);
  g.add(loaf);
  const slit = std(0xe8c48a, { roughness: 0.7 });
  const s = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.02), slit));
  s.position.set(0, 0.14, 0);
  g.add(s);
  return sitOnGround(g);
}

export function makeHut() {
  const g = new THREE.Group();
  g.name = 'hut';
  const wall = std(0x8b5a2b, { roughness: 0.85 });
  const roof = std(0x5c3317, { roughness: 0.9 });
  const floor = std(0x6b4a2b, { roughness: 0.95 });
  const dark = std(0x3a2414, { roughness: 0.95 });
  
  const wallThick = 0.15;
  const width = 3.2;
  const depth = 2.6;
  const height = 1.8;
  const doorWidth = 1.0;
  
  const floorMesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), floor));
  floorMesh.position.y = 0.04;
  g.add(floorMesh);
  
  const backWall = shadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), wall));
  backWall.position.set(0, height / 2, -depth / 2 + wallThick / 2);
  g.add(backWall);
  
  const leftWallFull = shadow(new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), wall));
  leftWallFull.position.set(-width / 2 + wallThick / 2, height / 2, 0);
  g.add(leftWallFull);
  
  const rightWallFull = shadow(new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), wall));
  rightWallFull.position.set(width / 2 - wallThick / 2, height / 2, 0);
  g.add(rightWallFull);
  
  const frontLeftWidth = (width - doorWidth) / 2 - wallThick;
  const frontLeft = shadow(new THREE.Mesh(new THREE.BoxGeometry(frontLeftWidth, height, wallThick), wall));
  frontLeft.position.set(-width / 2 + frontLeftWidth / 2 + wallThick, height / 2, depth / 2 - wallThick / 2);
  g.add(frontLeft);
  
  const frontRight = shadow(new THREE.Mesh(new THREE.BoxGeometry(frontLeftWidth, height, wallThick), wall));
  frontRight.position.set(width / 2 - frontLeftWidth / 2 - wallThick, height / 2, depth / 2 - wallThick / 2);
  g.add(frontRight);
  
  const lintelHeight = 0.25;
  const lintel = shadow(new THREE.Mesh(new THREE.BoxGeometry(doorWidth + wallThick * 2, lintelHeight, wallThick), wall));
  lintel.position.set(0, height - lintelHeight / 2, depth / 2 - wallThick / 2);
  g.add(lintel);
  
  const doorFrameInner = shadow(new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.08, height - lintelHeight - 0.08, wallThick * 0.5), dark));
  doorFrameInner.position.set(0, (height - lintelHeight) / 2, depth / 2 - wallThick / 4);
  g.add(doorFrameInner);
  
  // Gable/A-frame roof: ridge along +X at center, slopes in ±Z
  // Ridge is ABOVE walls, eaves sit on wall tops with overhang
  const roofOverhang = 0.3;
  const roofWidth = width + roofOverhang * 2; // along X (ridge direction)
  const roofRise = 1.1; // height from wall top to ridge peak
  const halfDepth = depth / 2 + roofOverhang; // distance from center to eave in Z
  
  // Eaves are at wall top height
  const eaveHeight = height;
  // Ridge is above that
  const ridgeHeight = height + roofRise;
  
  // Each roof plane: thin box from ridge (high) to eave (low)
  const slopeLength = Math.hypot(roofRise, halfDepth);
  const slopeAngle = Math.atan2(roofRise, halfDepth); // angle from horizontal
  
  // Back roof plane (negative Z side)
  // Midpoint between ridge (0, ridgeHeight, 0) and back eave (0, eaveHeight, -halfDepth)
  const backMidY = (ridgeHeight + eaveHeight) / 2;
  const backMidZ = -halfDepth / 2;
  const backPlane = shadow(new THREE.Mesh(new THREE.BoxGeometry(roofWidth, 0.12, slopeLength), roof));
  backPlane.position.set(0, backMidY, backMidZ);
  // Rotate around X so the far edge (negative Z) is lower and near edge (toward center) is higher
  backPlane.rotation.x = slopeAngle;
  g.add(backPlane);
  
  // Front roof plane (positive Z side)
  // Midpoint between ridge (0, ridgeHeight, 0) and front eave (0, eaveHeight, +halfDepth)
  const frontMidY = (ridgeHeight + eaveHeight) / 2;
  const frontMidZ = halfDepth / 2;
  const frontPlane = shadow(new THREE.Mesh(new THREE.BoxGeometry(roofWidth, 0.12, slopeLength), roof));
  frontPlane.position.set(0, frontMidY, frontMidZ);
  // Rotate around X so the far edge (positive Z) is lower and near edge (toward center) is higher
  frontPlane.rotation.x = -slopeAngle;
  g.add(frontPlane);
  
  // Ridge beam at the peak
  const ridgeBeam = shadow(new THREE.Mesh(new THREE.BoxGeometry(roofWidth + 0.1, 0.15, 0.15), roof));
  ridgeBeam.position.y = ridgeHeight;
  g.add(ridgeBeam);
  
  return sitOnGround(g);
}

export function makeWorkbench() {
  const g = new THREE.Group();
  g.name = 'workbench';
  const wood = std(0x5c4033, { roughness: 0.8 });
  const topM = std(0xa67c52, { roughness: 0.65 });
  const top = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), topM));
  top.position.y = 0.62;
  g.add(top);
  const legs = [
    [-0.5, 0.3, -0.26],
    [0.5, 0.3, -0.26],
    [-0.5, 0.3, 0.26],
    [0.5, 0.3, 0.26],
  ];
  for (const [x, y, z] of legs) {
    const lg = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), wood));
    lg.position.set(x, y, z);
    g.add(lg);
  }
  const vise = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.18), std(0x6e7b85, { metalness: 0.6, roughness: 0.4 })));
  vise.position.set(0.38, 0.7, 0.12);
  g.add(vise);
  return sitOnGround(g);
}

export function makeWater() {
  const g = new THREE.Group();
  g.name = 'water';
  const mat = std(COLORS.water, { roughness: 0.25, metalness: 0.15, emissive: 0x1a4a5c, emissiveIntensity: 0.18, transparent: true, opacity: 0.85 });
  const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.08, 8), mat));
  base.position.y = 0.04;
  g.add(base);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const drop = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat));
    drop.position.set(Math.cos(a) * 0.08, 0.1, Math.sin(a) * 0.08);
    drop.scale.set(1, 1.3, 1);
    g.add(drop);
  }
  return sitOnGround(g);
}

export function makeFire() {
  const g = new THREE.Group();
  g.name = 'fire';
  const stone = std(0x6a6a6a, { roughness: 0.95 });
  const fire = std(0xe84c22, { roughness: 0.4, emissive: 0xff3300, emissiveIntensity: 1.2 });
  const fire2 = std(0xffaa22, { roughness: 0.3, emissive: 0xffaa00, emissiveIntensity: 1.5 });
  
  const rocks = [
    [0.32, 0.08, 0.18, 0.16, 0.12, 0.14],
    [-0.3, 0.07, 0.22, 0.15, 0.11, 0.13],
    [0.15, 0.09, -0.35, 0.18, 0.13, 0.16],
    [-0.18, 0.08, -0.32, 0.16, 0.12, 0.15],
    [0.05, 0.06, 0.38, 0.12, 0.09, 0.11],
  ];
  for (const [x, y, z, sx, sy, sz] of rocks) {
    const r = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), stone));
    r.position.set(x, y, z);
    r.scale.set(sx / 0.1, sy / 0.1, sz / 0.1);
    g.add(r);
  }
  
  const flame1 = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), fire));
  flame1.position.y = 0.28;
  g.add(flame1);
  const flame2 = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), fire2));
  flame2.position.set(0.08, 0.32, 0.06);
  g.add(flame2);
  const flame3 = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 5), fire2));
  flame3.position.set(-0.06, 0.26, -0.04);
  g.add(flame3);
  
  const light = new THREE.PointLight(0xff6622, 1.8, 6);
  light.position.y = 0.3;
  light.castShadow = false;
  g.add(light);
  g.userData.light = light;
  
  return sitOnGround(g);
}

export function makeWell() {
  const g = new THREE.Group();
  g.name = 'well';
  const stone = std(0x8a8f99, { roughness: 0.9 });
  const wood = std(0x6b3f1d, { roughness: 0.85 });
  const rope = std(0x9a8a7a, { roughness: 0.95 });
  
  const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.55, 10), stone));
  base.position.y = 0.28;
  g.add(base);
  
  const post1 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.08), wood));
  post1.position.set(-0.35, 0.52, 0);
  g.add(post1);
  const post2 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.08), wood));
  post2.position.set(0.35, 0.52, 0);
  g.add(post2);
  
  const crossbar = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), wood));
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.y = 0.92;
  g.add(crossbar);
  
  const bucket = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 8), wood));
  bucket.position.set(0.15, 0.35, 0);
  g.add(bucket);
  
  const ropeM = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), rope));
  ropeM.position.set(0.15, 0.65, 0);
  g.add(ropeM);
  
  return sitOnGround(g);
}

export function makeChest() {
  const g = new THREE.Group();
  g.name = 'chest';
  const wood = std(0x7a5a3a, { roughness: 0.8 });
  const metal = std(0x6e7b85, { metalness: 0.6, roughness: 0.4 });
  
  const base = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.45), wood));
  base.position.y = 0.2;
  g.add(base);
  
  const lid = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.47), wood));
  lid.position.y = 0.46;
  g.add(lid);
  
  const latch = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.08), metal));
  latch.position.set(0, 0.28, 0.24);
  g.add(latch);
  
  return sitOnGround(g);
}

export function makeStew() {
  const g = new THREE.Group();
  g.name = 'stew';
  const bowl = std(0xa67c52, { roughness: 0.75 });
  const liquid = std(COLORS.stew, { roughness: 0.4, emissive: 0x3a1a00, emissiveIntensity: 0.1 });
  
  const b = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.1, 12), bowl));
  b.position.y = 0.05;
  g.add(b);
  
  const l = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), liquid));
  l.position.y = 0.12;
  g.add(l);
  
  return sitOnGround(g);
}

export function makeDough() {
  const g = new THREE.Group();
  g.name = 'dough';
  const mat = std(COLORS.dough, { roughness: 0.85 });
  
  const blob = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat));
  blob.position.y = 0.08;
  blob.scale.set(1.2, 0.7, 1.1);
  g.add(blob);
  
  return sitOnGround(g);
}

export function makeFish() {
  const g = new THREE.Group();
  g.name = 'fish';
  const body = std(COLORS.fish, { roughness: 0.5, metalness: 0.15 });
  const fin = std(0x5a8aa4, { roughness: 0.6 });
  
  const b = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), body));
  b.rotation.z = Math.PI / 2;
  b.position.set(0, 0.08, 0);
  g.add(b);
  
  const tail = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 5), fin));
  tail.rotation.z = -Math.PI / 2;
  tail.position.set(-0.18, 0.08, 0);
  g.add(tail);
  
  const topFin = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), fin));
  topFin.position.set(0, 0.14, 0);
  topFin.rotation.x = 0.3;
  g.add(topFin);
  
  return sitOnGround(g);
}

export function makeCookedFish() {
  const g = new THREE.Group();
  g.name = 'cooked_fish';
  const body = std(COLORS.cooked_fish, { roughness: 0.7 });
  const accent = std(0xb08060, { roughness: 0.75 });
  
  const b = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), body));
  b.rotation.z = Math.PI / 2;
  b.position.set(0, 0.08, 0);
  g.add(b);
  
  const tail = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 5), body));
  tail.rotation.z = -Math.PI / 2;
  tail.position.set(-0.18, 0.08, 0);
  g.add(tail);
  
  const stripe1 = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.14), accent));
  stripe1.position.set(0.04, 0.08, 0);
  g.add(stripe1);
  
  return sitOnGround(g);
}

export function makeSticks() {
  const g = new THREE.Group();
  g.name = 'sticks';
  const mat = std(COLORS.sticks, { roughness: 0.9 });
  
  for (let i = 0; i < 3; i++) {
    const s = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), mat));
    s.position.set((i - 1) * 0.08, 0.06, (i - 1) * 0.03);
    s.rotation.set(0.2, (i - 1) * 0.4, 0.1);
    g.add(s);
  }
  
  return sitOnGround(g);
}

export function makeAgent() {
  const g = new THREE.Group();
  g.name = 'agent';
  const bodyM = std(COLORS.agent, { roughness: 0.55, flatShading: true });
  const headM = std(0x3db8a8, { roughness: 0.5, flatShading: true });
  const limbM = std(0x1f7a72, { roughness: 0.6, flatShading: true });
  const dark = std(0x143d3a);

  const root = new THREE.Group();
  root.name = 'root';
  g.add(root);

  const torso = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.26), bodyM));
  torso.position.y = 0.95;
  torso.name = 'torso';
  root.add(torso);

  const head = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), headM));
  head.position.y = 1.4;
  head.name = 'head';
  root.add(head);
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), dark);
  eyeL.position.set(-0.07, 1.43, 0.15);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;
  root.add(eyeL, eyeR);

  const armL = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.1), limbM));
  armL.position.set(-0.28, 0.92, 0);
  armL.name = 'armL';
  const armR = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.1), limbM));
  armR.position.set(0.28, 0.92, 0);
  armR.name = 'armR';
  root.add(armL, armR);

  const legL = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), limbM));
  legL.position.set(-0.12, 0.32, 0);
  legL.name = 'legL';
  const legR = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), limbM));
  legR.position.set(0.12, 0.32, 0);
  legR.name = 'legR';
  root.add(legL, legR);

  const tool = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), std(0x6e7b85, { metalness: 0.55 })));
  tool.position.set(0.34, 0.72, 0.08);
  tool.rotation.z = -0.5;
  tool.name = 'heldTool';
  tool.visible = false;
  root.add(tool);

  sitOnGround(g);
  g.userData.parts = { root, torso, head, armL, armR, legL, legR, tool };
  return g;
}

const PROCEDURAL = {
  agent: makeAgent,
  berry: makeBerry,
  grain: makeGrain,
  wood: makeWood,
  stone: makeStone,
  ore: makeOre,
  water: makeWater,
  planks: makePlanks,
  ingot: makeIngot,
  bread: makeBread,
  stew: makeStew,
  dough: makeDough,
  fish: makeFish,
  cooked_fish: makeCookedFish,
  sticks: makeSticks,
  hut: makeHut,
  workbench: makeWorkbench,
  fire: makeFire,
  well: makeWell,
  chest: makeChest,
};

function centerAndScale(root, id) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const target = TARGET_SIZE[id] ?? 1;
  root.scale.multiplyScalar(target / maxDim);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box2.min.y)) root.position.y -= box2.min.y;
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

function ghostify(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = 0.42;
        c.depthWrite = false;
        if (c.emissive) {
          c.emissive = new THREE.Color(0xffffff);
          c.emissiveIntensity = 0.15;
        }
        return c;
      });
      o.material = Array.isArray(o.material) ? next : next[0];
    }
  });
  return root;
}

export class AssetLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.source = new Map();
  }

  async preload(ids = Object.keys(PROCEDURAL)) {
    await Promise.all(ids.map((id) => this.load(id)));
  }

  async load(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const url = `/assets/glb/${id}.glb`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('no-glb');
      const buf = await res.arrayBuffer();
      const gltf = await this.loader.parseAsync(buf, '/assets/glb/');
      const root = gltf.scene || gltf.scenes[0];
      centerAndScale(root, id);
      root.userData.fromGltf = true;
      this.cache.set(id, root);
      this.source.set(id, 'glb');
      return root;
    } catch {
      const fn = PROCEDURAL[id];
      if (!fn) throw new Error(`No stand-in for ${id}`);
      const mesh = fn();
      this.cache.set(id, mesh);
      this.source.set(id, 'procedural');
      return mesh;
    }
  }

  create(id, { ghost = false } = {}) {
    const proto = this.cache.get(id);
    if (!proto) {
      const fn = PROCEDURAL[id];
      const fresh = fn();
      return ghost ? ghostify(fresh) : fresh;
    }
    const clone = proto.clone(true);
    if (proto.userData.parts && !proto.userData.fromGltf) {
      clone.userData.parts = {
        root: clone.getObjectByName('root'),
        torso: clone.getObjectByName('torso'),
        head: clone.getObjectByName('head'),
        armL: clone.getObjectByName('armL'),
        armR: clone.getObjectByName('armR'),
        legL: clone.getObjectByName('legL'),
        legR: clone.getObjectByName('legR'),
        tool: clone.getObjectByName('heldTool'),
      };
    }
    clone.userData.fromGltf = !!proto.userData.fromGltf;
    return ghost ? ghostify(clone) : clone;
  }

  usingGlb(id) {
    return this.source.get(id) === 'glb';
  }
}
