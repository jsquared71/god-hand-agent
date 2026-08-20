import { RAW_TYPES, LABELS, COLORS } from './recipes.js';

const ICONS = {
  berry: (c) => `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12" cy="18" r="6" fill="${c}"/>
      <circle cx="20" cy="17" r="6" fill="${c}"/>
      <circle cx="16" cy="12" r="5.5" fill="${c}"/>
      <path d="M16 7 C16 7 20 4 22 8" stroke="#3d7a3a" stroke-width="2" fill="none"/>
    </svg>`,
  grain: (c) => `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 28 L16 10" stroke="${c}" stroke-width="2"/>
      <ellipse cx="16" cy="8" rx="4" ry="6" fill="${c}"/>
      <ellipse cx="11" cy="12" rx="3" ry="5" fill="${c}" transform="rotate(-25 11 12)"/>
      <ellipse cx="21" cy="12" rx="3" ry="5" fill="${c}" transform="rotate(25 21 12)"/>
    </svg>`,
  wood: (c) => `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="12" width="24" height="10" rx="5" fill="${c}"/>
      <circle cx="8" cy="17" r="3" fill="#c4a574"/>
      <circle cx="24" cy="17" r="3" fill="#c4a574"/>
    </svg>`,
  stone: (c) => `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <polygon points="8,22 6,14 14,8 24,10 26,20 18,26" fill="${c}"/>
    </svg>`,
  ore: (c) => `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <polygon points="7,22 8,12 16,7 25,13 24,23 14,27" fill="${c}"/>
      <rect x="12" y="13" width="5" height="4" fill="#c45c26" transform="rotate(20 14 15)"/>
      <rect x="18" y="16" width="4" height="3" fill="#c45c26"/>
    </svg>`,
  water: (c) => `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="20" rx="10" ry="6" fill="${c}" opacity="0.7"/>
      <circle cx="12" cy="12" r="3" fill="${c}"/>
      <circle cx="18" cy="14" r="3.5" fill="${c}"/>
      <circle cx="16" cy="18" r="2.5" fill="${c}"/>
    </svg>`,
};

export function setupToolbar(drop, gameState) {
  const root = document.getElementById('tools');
  root.innerHTML = '';
  for (const type of RAW_TYPES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool';
    btn.dataset.type = type;
    btn.setAttribute('aria-label', `Drag ${LABELS[type]}`);
    btn.innerHTML = `
      <span class="icon" style="background:${COLORS[type]}">${ICONS[type](shade(COLORS[type]))}</span>
      <span class="label">${LABELS[type]}</span>
    `;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drop.startDrag(type, e, btn);
      btn.setPointerCapture?.(e.pointerId);
    });
    btn.addEventListener('dragstart', (e) => e.preventDefault());
    root.appendChild(btn);
  }
  
  // Update Favor display
  function updateFavorDisplay() {
    const favorEl = document.getElementById('favor-value');
    const favorFillEl = document.getElementById('favor-fill');
    if (favorEl) {
      favorEl.textContent = Math.floor(gameState.favor);
    }
    if (favorFillEl) {
      const pct = (gameState.favor / gameState.favorMax) * 100;
      favorFillEl.style.width = `${pct}%`;
    }
    requestAnimationFrame(updateFavorDisplay);
  }
  updateFavorDisplay();
}

function shade(hex) {
  return '#fff6e8';
}
