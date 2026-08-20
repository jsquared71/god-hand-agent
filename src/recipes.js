/** Resource recipes and timings for the god-hand sandbox. */

export const RAW_TYPES = ['berry', 'grain', 'wood', 'stone', 'ore', 'water'];

export const ALL_ITEM_TYPES = [
  'berry',
  'grain',
  'wood',
  'stone',
  'ore',
  'water',
  'planks',
  'ingot',
  'bread',
  'stew',
  'dough',
  'cooked_fish',
  'fish',
  'sticks',
];

export const BUILDING_TYPES = ['workbench', 'hut', 'fire', 'well', 'chest'];

export const COLORS = {
  berry: '#c41e5a',
  grain: '#e8b923',
  wood: '#6b3f1d',
  stone: '#8a8f99',
  ore: '#5a3228',
  water: '#4a9fc8',
  planks: '#d4a574',
  ingot: '#7b8792',
  bread: '#c4843c',
  stew: '#d46c3a',
  dough: '#e8d8a4',
  fish: '#78a8c4',
  cooked_fish: '#c89870',
  sticks: '#8b6239',
  hut: '#8b5a2b',
  workbench: '#5c4033',
  fire: '#e84c22',
  well: '#6a7a8a',
  chest: '#7a5a3a',
  agent: '#2a9d8f',
};

export const LABELS = {
  berry: 'Berry',
  grain: 'Grain',
  wood: 'Wood',
  stone: 'Stone',
  ore: 'Ore',
  water: 'Water',
  planks: 'Planks',
  ingot: 'Ingot',
  bread: 'Bread',
  stew: 'Stew',
  dough: 'Dough',
  fish: 'Fish',
  cooked_fish: 'Cooked Fish',
  sticks: 'Sticks',
  hut: 'Hut',
  workbench: 'Workbench',
  fire: 'Campfire',
  well: 'Well',
  chest: 'Chest',
  tools: 'Tools',
};

/** Food-only items. Grain is dual-use (eat or mill into bread). */
export const FOOD = {
  berry: { hunger: 0.22, time: 0.55, energy: 0.04 },
  grain: { hunger: 0.38, time: 1.35, energy: 0.06 },
  water: { hunger: 0.12, time: 0.4, energy: 0.03 },
  bread: { hunger: 0.72, time: 0.9, energy: 0.12 },
  stew: { hunger: 0.85, time: 1.1, energy: 0.15 },
  fish: { hunger: 0.25, time: 0.7, energy: 0.05 },
  cooked_fish: { hunger: 0.78, time: 0.85, energy: 0.14 },
};

export const PROCESS = {
  wood: { out: 'planks', time: 4.0, benchTime: 1.6 },
  ore: { out: 'ingot', time: 5.5, benchTime: 2.0 },
  grain: { out: 'bread', time: 3.5, benchTime: 1.4, inputs: { grain: 1, water: 1 } },
  berry: { out: 'stew', time: 4.2, benchTime: 1.8, cookTime: 1.2, inputs: { berry: 1, water: 1 } },
  fish: { out: 'cooked_fish', time: 6.0, benchTime: 2.5, cookTime: 1.5 },
  planks: { out: 'sticks', outCount: 2, time: 2.5, benchTime: 1.0 },
};

export const BUILD = {
  workbench: { cost: { planks: 2 }, time: 2.2 },
  hut: { cost: { planks: 3, stone: 2 }, time: 3.4 },
  fire: { cost: { wood: 2, stone: 1 }, time: 2.8 },
  well: { cost: { stone: 3, planks: 1 }, time: 3.2 },
  chest: { cost: { planks: 3 }, time: 2.5 },
  tools: { cost: { ingot: 2 }, time: 1.6 },
};

export const TOOLS_PROCESS_MULT = 0.62;
export const FIRE_PROCESS_MULT = 0.68;

export const HUNGER_DRAIN = 0.0035;
export const HUNGER_DRAIN_NEAR_HUT = 0.0014;
export const HUT_RADIUS = 4.2;
export const WORKBENCH_RADIUS = 1.7;
export const FIRE_RADIUS = 2.4;
export const PICKUP_RADIUS = 0.85;

export function canAfford(inventory, cost) {
  return Object.entries(cost).every(([k, n]) => (inventory[k] || 0) >= n);
}

export function canProcess(inputType, inventory) {
  const rec = PROCESS[inputType];
  if (!rec) return false;
  if (rec.inputs) {
    return canAfford(inventory, rec.inputs);
  }
  return (inventory[inputType] || 0) > 0;
}

export function spend(inventory, cost) {
  const next = { ...inventory };
  for (const [k, n] of Object.entries(cost)) next[k] = (next[k] || 0) - n;
  return next;
}

export function processDuration(inputType, { atBench, hasTools, nearFire }) {
  const rec = PROCESS[inputType];
  if (!rec) return 0;
  let t = rec.time;
  if (atBench && rec.benchTime) t = rec.benchTime;
  if (nearFire && rec.cookTime) t = rec.cookTime;
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
    const outputLabel = LABELS[recipe.out] || recipe.out;
    
    html += '<div class="recipe-item">';
    html += `<span class="recipe-output">${outputLabel}</span>`;
    html += '<span class="recipe-cost">';
    
    if (recipe.inputs) {
      const parts = Object.entries(recipe.inputs).map(([material, count]) => {
        const label = LABELS[material] || material;
        const color = COLORS[material] || '#888';
        return `<span class="recipe-cost-item"><span class="recipe-cost-dot" style="background:${color}"></span>${count} ${label.toLowerCase()}</span>`;
      });
      html += parts.join(' + ');
    } else {
      const inputLabel = LABELS[input] || input;
      const inputColor = COLORS[input] || '#888';
      html += `<span class="recipe-cost-item"><span class="recipe-cost-dot" style="background:${inputColor}"></span>1 ${inputLabel.toLowerCase()}</span>`;
    }
    
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
