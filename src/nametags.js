import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Create CSS2D overlay renderer for in-world labels
 */
export function createLabelRenderer(canvas) {
  const renderer = new CSS2DRenderer();
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.pointerEvents = 'none';
  
  // Insert after the canvas
  canvas.parentElement.insertBefore(renderer.domElement, canvas.nextSibling);
  
  return renderer;
}

/**
 * Create a name tag with health bar for an agent
 */
export function createNameTag(agentName) {
  const container = document.createElement('div');
  container.className = 'name-tag';
  container.style.cssText = `
    pointer-events: none;
    user-select: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  `;
  
  // Name label
  const nameLabel = document.createElement('div');
  nameLabel.className = 'name-label';
  nameLabel.textContent = agentName;
  nameLabel.style.cssText = `
    background: rgba(20, 24, 28, 0.85);
    backdrop-filter: blur(4px);
    color: rgba(255, 255, 255, 0.92);
    padding: 3px 8px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
  `;
  
  // Health bar container
  const healthBarContainer = document.createElement('div');
  healthBarContainer.className = 'health-bar-container';
  healthBarContainer.style.cssText = `
    width: 42px;
    height: 5px;
    background: rgba(20, 24, 28, 0.7);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  `;
  
  // Health bar fill
  const healthBarFill = document.createElement('div');
  healthBarFill.className = 'health-bar-fill';
  healthBarFill.style.cssText = `
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
    transition: width 0.3s ease, background 0.3s ease;
  `;
  
  healthBarContainer.appendChild(healthBarFill);
  container.appendChild(nameLabel);
  container.appendChild(healthBarContainer);
  
  const label = new CSS2DObject(container);
  label.position.set(0, 2.3, 0); // Position above agent's head
  label.userData = { healthBarFill };
  
  return label;
}

/**
 * Update health bar color and width based on health value (0..1)
 */
export function updateHealthBar(label, health) {
  const healthBarFill = label.userData.healthBarFill;
  if (!healthBarFill) return;
  
  const healthPercent = Math.max(0, Math.min(100, health * 100));
  healthBarFill.style.width = `${healthPercent}%`;
  
  // Color interpolation: green -> yellow -> red
  if (health > 0.5) {
    // Green to yellow
    const t = (health - 0.5) * 2; // 0..1
    healthBarFill.style.background = `linear-gradient(90deg, 
      rgb(${74 + (180 - 74) * (1 - t)}, ${222 + (200 - 222) * (1 - t)}, ${128 + (50 - 128) * (1 - t)}) 0%, 
      rgb(${34 + (150 - 34) * (1 - t)}, ${197 + (170 - 197) * (1 - t)}, ${94 + (40 - 94) * (1 - t)}) 100%)`;
  } else {
    // Yellow to red
    const t = health * 2; // 0..1
    healthBarFill.style.background = `linear-gradient(90deg, 
      rgb(${239 - (239 - 180) * t}, ${68 + (200 - 68) * t}, ${68 - (68 - 50) * t}) 0%, 
      rgb(${220 - (220 - 150) * t}, ${38 + (170 - 38) * t}, ${38 - (38 - 40) * t}) 100%)`;
  }
}

/**
 * Handle window resize for label renderer
 */
export function resizeLabelRenderer(renderer, canvas) {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}
