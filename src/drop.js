import * as THREE from 'three';
import { spawnPickup } from './resources.js';

export function setupDrop(world, assets, camControls, gameState) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvas = world.renderer.domElement;
  const chip = document.getElementById('drag-chip');

  let dragging = null;

  function toNdc(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function hitGround(event) {
    toNdc(event);
    raycaster.setFromCamera(ndc, world.camera);
    const hits = raycaster.intersectObject(world.dropPlane, false);
    return hits[0] || null;
  }

  function overToolbar(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    return !!(el && el.closest('#toolbar'));
  }

  function clearGhost() {
    if (dragging?.ghost) {
      world.scene.remove(dragging.ghost);
      dragging.ghost = null;
    }
    if (chip) chip.hidden = true;
    document.body.classList.remove('dragging-resource');
  }

  function cancel() {
    if (!dragging) return;
    clearGhost();
    dragging.tool?.classList.remove('dragging');
    dragging = null;
    camControls.setResourceDrag(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  function onMove(event) {
    if (!dragging) return;
    if (chip) {
      chip.style.left = `${event.clientX}px`;
      chip.style.top = `${event.clientY}px`;
      chip.hidden = false;
    }
    const hit = hitGround(event);
    const blocked = overToolbar(event);
    if (hit && !blocked) {
      if (!dragging.ghost) {
        dragging.ghost = assets.create(dragging.type, { ghost: true });
        world.scene.add(dragging.ghost);
      }
      dragging.ghost.visible = true;
      dragging.ghost.position.set(hit.point.x, 0.04, hit.point.z);
    } else if (dragging.ghost) {
      dragging.ghost.visible = false;
    }
  }

  function onUp(event) {
    if (!dragging) return;
    const type = dragging.type;
    const blocked = overToolbar(event);
    const hit = blocked ? null : hitGround(event);
    dragging.tool?.classList.remove('dragging');
    clearGhost();
    dragging = null;
    camControls.setResourceDrag(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    if (hit) {
      // Check Favor cost
      if (gameState.favor < 1) {
        // Not enough Favor! Show brief hint
        showFavorHint();
        return;
      }
      
      // Spend Favor
      gameState.favor -= 1;
      
      // Player-dropped resources are NOT world-spawned
      spawnPickup(world, assets, type, hit.point, { falling: true, isWorldSpawned: false });
    }
  }
  
  function showFavorHint() {
    const hintEl = document.getElementById('favor-hint');
    if (!hintEl) return;
    hintEl.textContent = 'Not enough Favor!';
    hintEl.classList.add('show');
    setTimeout(() => {
      hintEl.classList.remove('show');
    }, 1500);
  }

  function startDrag(type, event, toolEl) {
    if (dragging) cancel();
    event.preventDefault();
    event.stopPropagation();
    dragging = { type, ghost: null, tool: toolEl };
    toolEl?.classList.add('dragging');
    document.body.classList.add('dragging-resource');
    camControls.setResourceDrag(true);
    if (chip) {
      chip.style.background = getComputedStyle(toolEl.querySelector('.icon')).background || '#888';
      chip.hidden = false;
      chip.style.left = `${event.clientX}px`;
      chip.style.top = `${event.clientY}px`;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    onMove(event);
  }

  return { startDrag, cancel, get dragging() { return dragging; } };
}
