/** Resource recipes and timings for the god-hand sandbox. */

export const RAW_TYPES = ['berry', 'grain', 'wood', 'stone', 'ore'];

export const ALL_ITEM_TYPES = [
  'berry',
  'grain',
  'wood',
  'stone',
  'ore',
  'planks',
  'ingot',
  'bread',
];

export const BUILDING_TYPES = ['workbench', 'hut'];

export const COLORS = {
  berry: '#c41e5a',
  grain: '#e8b923',
  wood: '#6b3f1d',
  stone: '#8a8f99',
  ore: '#5a3228',
  planks: '#d4a574',
  ingot: '#7b8792',
  bread: '#c4843c',
  hut: '#8b5a2b',
  workbench: '#5c4033',
  agent: '#2a9d8f',
};

export const LABELS = {
  berry: 'Berry',
  grain: 'Grain',
  wood: 'Wood',
  stone: 'Stone',
  ore: 'Ore',
  planks: 'Planks',
  ingot: 'Ingot',
  bread: 'Bread',
  hut: 'Hut',
  workbench: 'Workbench',
  tools: 'Tools',
};

/** Food-only items. Grain is dual-use (eat or mill into bread). */
export const FOOD = {
  berry: { hunger: 0.22, time: 0.55, energy: 0.04 },
  grain: { hunger: 0.38, time: 1.35, energy: 0.06 },
  bread: { hunger: 0.72, time: 0.9, energy: 0.12 },
};

export const PROCESS = {
  wood: { out: 'planks', time: 4.0, benchTime: 1.6 },
  ore: { out: 'ingot', time: 5.5, benchTime: 2.0 },
  grain: { out: 'bread', time: 3.5, benchTime: 1.4 },
};

export const BUILD = {
  workbench: { cost: { planks: 2 }, time: 2.2 },
  hut: { cost: { planks: 3, stone: 2 }, time: 3.4 },
  tools: { cost: { ingot: 2 }, time: 1.6 },
};

export const TOOLS_PROCESS_MULT = 0.62;

export const HUNGER_DRAIN = 0.0035;
export const HUNGER_DRAIN_NEAR_HUT = 0.0014;
export const HUT_RADIUS = 2.4;
export const WORKBENCH_RADIUS = 1.7;
export const PICKUP_RADIUS = 0.85;

export function canAfford(inventory, cost) {
  return Object.entries(cost).every(([k, n]) => (inventory[k] || 0) >= n);
}

export function spend(inventory, cost) {
  const next = { ...inventory };
  for (const [k, n] of Object.entries(cost)) next[k] = (next[k] || 0) - n;
  return next;
}

export function processDuration(inputType, { atBench, hasTools }) {
  const rec = PROCESS[inputType];
  if (!rec) return 0;
  let t = atBench ? rec.benchTime : rec.time;
  if (hasTools) t *= TOOLS_PROCESS_MULT;
  return t;
}

export function inventoryEmpty(inv) {
  return ALL_ITEM_TYPES.every((t) => (inv[t] || 0) <= 0);
}

export function emptyInventory() {
  return Object.fromEntries(ALL_ITEM_TYPES.map((t) => [t, 0]));
}

function formatCost(costObj) {
  return Object.entries(costObj)
    .map(([material, count]) => {
      const label = LABELS[material] || material;
      const color = COLORS[material] || '#888';
      return `<span class="recipe-cost-item"><span class="recipe-cost-dot" style="background:${color}"></span>${count} ${label.toLowerCase()}</span>`;
    })
    .join(' + ');
}

export function setupRecipeHud() {
  const recipesList = document.getElementById('recipes-list');
  if (!recipesList) return;

  let html = '';

  html += '<div class="recipe-section">';
  html += '<div class="recipe-section-title">Process</div>';
  
  Object.entries(PROCESS).forEach(([input, recipe]) => {
    const inputLabel = LABELS[input] || input;
    const outputLabel = LABELS[recipe.out] || recipe.out;
    const inputColor = COLORS[input] || '#888';
    
    html += '<div class="recipe-item">';
    html += `<span class="recipe-output">${outputLabel}</span>`;
    html += '<span class="recipe-cost">';
    html += `<span class="recipe-cost-item"><span class="recipe-cost-dot" style="background:${inputColor}"></span>1 ${inputLabel.toLowerCase()}</span>`;
    html += '</span>';
    html += '</div>';
  });

  html += '</div>';

  html += '<div class="recipe-section">';
  html += '<div class="recipe-section-title">Build</div>';
  
  Object.entries(BUILD).forEach(([buildType, recipe]) => {
    const label = LABELS[buildType] || buildType;
    
    html += '<div class="recipe-item">';
    html += `<span class="recipe-output">${label}</span>`;
    html += `<span class="recipe-cost">${formatCost(recipe.cost)}</span>`;
    html += '</div>';
  });

  html += '</div>';

  recipesList.innerHTML = html;
}
