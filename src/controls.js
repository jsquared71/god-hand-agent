import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function setupControls(world) {
  const { camera, renderer } = world;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.minDistance = 4;
  controls.maxDistance = 42;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.target.set(0, 0.85, 0);
  controls.update();

  renderer.domElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  renderer.domElement.style.touchAction = 'none';

  let dragLock = false;

  const api = {
    controls,
    update() {
      if (!dragLock && controls.enabled) controls.update();
    },
    setResourceDrag(active) {
      dragLock = active;
      controls.enabled = !active;
      controls.enableRotate = !active;
      controls.enablePan = !active;
      controls.enableZoom = !active;
      controls.enableDamping = !active;
    },
  };

  // Reset drag lock on global pointer events to prevent stuck camera
  window.addEventListener('pointerup', () => api.setResourceDrag(false));
  window.addEventListener('pointercancel', () => api.setResourceDrag(false));
  window.addEventListener('blur', () => api.setResourceDrag(false));

  return api;
}
