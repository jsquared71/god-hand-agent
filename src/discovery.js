/**
 * Open invention system: tag-based item discovery and combination.
 * No closed recipe list. Agents can combine any two items to discover new types.
 */

import { COLORS, LABELS } from './recipes.js';

/** Tag definitions for properties items can have */
export const TAGS = {
  FOOD: 'food',
  FUEL: 'fuel',
  SHARP: 'sharp',
  STRUCTURAL: 'structural',
  VESSEL: 'vessel',
  MOBILE: 'mobile',
  METAL: 'metal',
  FIBER: 'fiber',
  CONTAINER: 'container',
  LIGHT: 'light',
  WEAPON: 'weapon',
  VEHICLE: 'vehicle',
  LIQUID: 'liquid',
  PROCESSED: 'processed',
  RAW: 'raw',
};

/** Base item definitions with their tags and properties */
export const BASE_ITEMS = {
  // Raw materials
  berry: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.22, time: 2.8, color: '#c41e5a', label: 'Berry', bases: ['berry'] },
  grain: { tags: [TAGS.FOOD, TAGS.RAW, TAGS.FIBER], hunger: 0.38, time: 3.8, color: '#e8b923', label: 'Grain', bases: ['grain'] },
  wood: { tags: [TAGS.FUEL, TAGS.STRUCTURAL, TAGS.RAW], color: '#6b3f1d', label: 'Wood', bases: ['wood'] },
  stone: { tags: [TAGS.SHARP, TAGS.STRUCTURAL, TAGS.RAW], color: '#8a8f99', label: 'Stone', bases: ['stone'] },
  ore: { tags: [TAGS.METAL, TAGS.RAW], color: '#5a3228', label: 'Ore', bases: ['ore'] },
  water: { tags: [TAGS.LIQUID, TAGS.FOOD], hunger: 0.12, time: 2.0, color: '#4a9fc8', label: 'Water', bases: ['water'] },
  fish: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.25, time: 3.2, color: '#78a8c4', label: 'Fish', bases: ['fish'] },
  mushroom: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.2, time: 2.5, color: '#d4745a', label: 'Mushroom', bases: ['mushroom'] },
  fruit: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.24, time: 2.9, color: '#e85a4a', label: 'Fruit', bases: ['fruit'] },
  herb: { tags: [TAGS.FOOD, TAGS.RAW, TAGS.FIBER], hunger: 0.15, time: 2.2, color: '#6a8a4a', label: 'Herb', bases: ['herb'] },
  meat: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.35, time: 4.0, color: '#a84a3a', label: 'Meat', bases: ['meat'] },
  egg: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.28, time: 3.0, color: '#f0e8c0', label: 'Egg', bases: ['egg'] },
  milk: { tags: [TAGS.FOOD, TAGS.LIQUID], hunger: 0.22, time: 2.5, color: '#f8f4e0', label: 'Milk', bases: ['milk'] },
  
  // Processed basics
  planks: { tags: [TAGS.STRUCTURAL, TAGS.PROCESSED], color: '#d4a574', label: 'Planks', bases: ['wood'] },
  ingot: { tags: [TAGS.METAL, TAGS.PROCESSED], color: '#7b8792', label: 'Ingot', bases: ['ore'] },
  sticks: { tags: [TAGS.STRUCTURAL, TAGS.SHARP, TAGS.PROCESSED], color: '#8b6239', label: 'Sticks', bases: ['wood'] },
  
  // Cooked food
  bread: { tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.72, time: 5.0, color: '#c4843c', label: 'Bread', bases: ['grain', 'water'] },
  stew: { tags: [TAGS.FOOD, TAGS.PROCESSED, TAGS.VESSEL], hunger: 0.85, time: 6.0, color: '#d46c3a', label: 'Stew', bases: ['berry', 'water'] },
  cooked_fish: { tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.78, time: 5.2, color: '#c89870', label: 'Cooked Fish', bases: ['fish'] },
  
  // Buildings (not combinable, but in the system)
  workbench: { tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, color: '#5c4033', label: 'Workbench', bases: ['wood', 'stone'] },
  hut: { tags: [TAGS.STRUCTURAL], isBuilding: true, color: '#8b5a2b', label: 'Hut', bases: ['wood', 'stone'] },
  fire: { tags: [TAGS.LIGHT, TAGS.FUEL], isBuilding: true, color: '#e84c22', label: 'Campfire', bases: ['wood', 'stone'] },
  well: { tags: [TAGS.STRUCTURAL, TAGS.VESSEL], isBuilding: true, color: '#6a7a8a', label: 'Well', bases: ['stone', 'wood'] },
  chest: { tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, color: '#7a5a3a', label: 'Chest', bases: ['wood'] },
  
  // Special items
  tools: { tags: [TAGS.METAL, TAGS.SHARP, TAGS.WEAPON], gatherMult: 2.0, processSpeedMult: 0.62, isEquippable: true, color: '#6e7b85', label: 'Tools', bases: ['ore'] },
};

/** Seed discovery rules: obvious combinations that work from the start */
const SEED_DISCOVERIES = [
  // Basic processing
  { inputs: ['wood', 'stone'], output: 'crude_tool', tags: [TAGS.SHARP, TAGS.STRUCTURAL], gatherMult: 1.5, label: 'Crude Tool', bases: ['wood', 'stone'] },
  { inputs: ['wood', 'wood'], output: 'sticks', tags: [TAGS.STRUCTURAL, TAGS.SHARP, TAGS.PROCESSED], label: 'Sticks', bases: ['wood'] },
  { inputs: ['planks', 'planks'], output: 'chest', tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, label: 'Chest', bases: ['wood'] },
  
  // Smelting
  { inputs: ['ore', 'fire'], output: 'ingot', tags: [TAGS.METAL, TAGS.PROCESSED], label: 'Ingot', bases: ['ore'] },
  
  // Tools & Weapons
  { inputs: ['ingot', 'wood'], output: 'metal_tool', tags: [TAGS.METAL, TAGS.SHARP, TAGS.WEAPON], gatherMult: 2.5, damage: 3, label: 'Metal Tool', bases: ['ore', 'wood'] },
  { inputs: ['metal', 'wood'], output: 'axe', tags: [TAGS.WEAPON, TAGS.SHARP, TAGS.METAL], damage: 5, gatherMult: 2.0, label: 'Axe', bases: ['ore', 'wood'] },
  { inputs: ['ingot', 'ingot'], output: 'tools', tags: [TAGS.METAL, TAGS.SHARP, TAGS.WEAPON], gatherMult: 2.0, processSpeedMult: 0.62, isEquippable: true, label: 'Tools', bases: ['ore'] },
  { inputs: ['sharp', 'structural'], output: 'spear', tags: [TAGS.WEAPON, TAGS.SHARP], damage: 4, label: 'Spear', bases: ['wood', 'stone'] },
  { inputs: ['metal', 'sharp'], output: 'blade', tags: [TAGS.WEAPON, TAGS.SHARP, TAGS.METAL], damage: 6, label: 'Blade', bases: ['ore', 'wood'] },
  
  // Cooking
  { inputs: ['grain', 'water'], output: 'bread', tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.72, time: 5.0, label: 'Bread', bases: ['grain', 'water'] },
  { inputs: ['berry', 'water'], output: 'stew', tags: [TAGS.FOOD, TAGS.PROCESSED, TAGS.VESSEL], hunger: 0.85, time: 6.0, label: 'Stew', bases: ['berry', 'water'] },
  { inputs: ['fish', 'fire'], output: 'cooked_fish', tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.78, time: 5.2, label: 'Cooked Fish', bases: ['fish'] },
  { inputs: ['grain', 'berry'], output: 'mash', tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.55, time: 3.5, label: 'Berry Grain', bases: ['grain', 'berry'] },
  { inputs: ['bread', 'berry'], output: 'berry_bread', tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.85, time: 5.2, label: 'Berry Bread', bases: ['grain', 'water', 'berry'] },
  { inputs: ['fish', 'berry'], output: 'fish_berry', tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.52, time: 4.0, label: 'Fish with Berries', bases: ['fish', 'berry'] },
  
  // Structures
  { inputs: ['structural', 'structural'], output: 'frame', tags: [TAGS.STRUCTURAL], isBuilding: true, label: 'Frame', bases: ['wood'] },
  { inputs: ['planks', 'stone'], output: 'workbench', tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, label: 'Workbench', bases: ['wood', 'stone'] },
  { inputs: ['structural', 'mobile'], output: 'cart', tags: [TAGS.VEHICLE, TAGS.STRUCTURAL, TAGS.MOBILE], speedBoost: 1.5, capacity: 2, label: 'Cart', bases: ['wood'] },
  
  // Furniture
  { inputs: ['planks', 'sticks'], output: 'chair', tags: [TAGS.STRUCTURAL], isBuilding: true, label: 'Chair', bases: ['wood'] },
  { inputs: ['planks', 'planks'], output: 'table', tags: [TAGS.STRUCTURAL], isBuilding: true, label: 'Table', bases: ['wood'] },
  { inputs: ['planks', 'grain'], output: 'bed', tags: [TAGS.STRUCTURAL], isBuilding: true, label: 'Bed', bases: ['wood', 'grain'] },
  
  // Animal care
  { inputs: ['planks', 'grain'], output: 'trough', tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, label: 'Trough', bases: ['wood', 'grain'] },
  { inputs: ['planks', 'sticks'], output: 'pen', tags: [TAGS.STRUCTURAL], isBuilding: true, label: 'Pen', bases: ['wood'] },
  { inputs: ['grain', 'water'], output: 'feed', tags: [TAGS.FOOD], hunger: 0.0, label: 'Animal Feed', bases: ['grain', 'water'] },
  
  // Vehicles
  { inputs: ['structural', 'wheel'], output: 'wagon', tags: [TAGS.VEHICLE, TAGS.MOBILE], speedBoost: 2.0, capacity: 4, label: 'Wagon', bases: ['wood'] },
  { inputs: ['wood', 'wheel'], output: 'cart', tags: [TAGS.VEHICLE, TAGS.MOBILE], speedBoost: 1.5, capacity: 2, label: 'Cart', bases: ['wood'] },
];

/** Discovery state: recipes found during play */
export class DiscoveryNotebook {
  constructor() {
    // Map of "item1+item2" -> discovered recipe
    this.recipes = new Map();
    this.nextGeneratedId = 1;
    
    // Initialize seed recipes
    this._initSeeds();
  }
  
  _initSeeds() {
    for (const seed of SEED_DISCOVERIES) {
      const key = this._makeKey(seed.inputs[0], seed.inputs[1]);
      this.recipes.set(key, seed);
    }
  }
  
  _makeKey(item1, item2) {
    // Normalize order so "wood+stone" === "stone+wood"
    return [item1, item2].sort().join('+');
  }
  
  /**
   * Combine two items. Always returns a result (never "invalid").
   * First discovery of a new pair gets a small curiosity bonus.
   */
  combine(item1, item2) {
    const key = this._makeKey(item1, item2);
    
    // Check if already discovered
    if (this.recipes.has(key)) {
      const recipe = this.recipes.get(key);
      return { output: recipe.output, discovered: false, recipe };
    }
    
    // New combination: generate a result
    const newRecipe = this._generateRecipe(item1, item2);
    this.recipes.set(key, newRecipe);
    
    // Return the discovered flag from the recipe (may be false for repeated food-food combos)
    return { output: newRecipe.output, discovered: newRecipe.discovered !== false, recipe: newRecipe };
  }
  
  _generateRecipe(item1, item2) {
    const info1 = this._getItemInfo(item1);
    const info2 = this._getItemInfo(item2);
    
    // Blend tags (union)
    const tags = [...new Set([...info1.tags, ...info2.tags])];
    
    // Compute merged bases
    const bases1 = info1.bases || [item1];
    const bases2 = info2.bases || [item2];
    const mergedBases = [...new Set([...bases1, ...bases2])].sort();
    
    // Check if both inputs are FOOD
    const bothFood = info1.tags.includes(TAGS.FOOD) && info2.tags.includes(TAGS.FOOD);
    const hasWater = item1 === 'water' || item2 === 'water';
    const hasFire = item1 === 'fire' || item2 === 'fire';
    
    let output;
    let discovered = true;
    let label;
    
    // If both are food and not a cooking recipe (no water/fire)
    if (bothFood && !hasWater && !hasFire) {
      // Check if a recipe with these exact bases already exists
      const existingRecipe = Array.from(this.recipes.values()).find(r => {
        if (!r.bases) return false;
        const rBases = [...r.bases].sort();
        return rBases.length === mergedBases.length && rBases.every((b, i) => b === mergedBases[i]);
      });
      
      if (existingRecipe) {
        // Reuse existing recipe with same bases (more of the same)
        output = existingRecipe.output;
        discovered = false;
        label = existingRecipe.label;
      } else {
        // New unique food mix: generate a proper name
        output = `food-${this.nextGeneratedId++}`;
        label = this._generateFoodLabel(mergedBases, item1, item2);
      }
    } else {
      // Non-food-food combination
      output = `${item1}-${item2}-${this.nextGeneratedId++}`;
      label = this._generateLabel(tags, item1, item2, output);
    }
    
    // Generate properties based on tags
    const props = {
      output,
      inputs: [item1, item2],
      tags,
      bases: mergedBases,
      label: label || this._generateLabel(tags, item1, item2, output),
      color: this._blendColors(info1.color, info2.color),
      discovered,
    };
    
    // Derive stats from tags
    if (tags.includes(TAGS.FOOD)) {
      props.hunger = ((info1.hunger || 0) + (info2.hunger || 0)) * 0.7;
      // Cooked/processed food takes longer to eat (5s), simple combinations take medium time (3s)
      props.time = tags.includes(TAGS.PROCESSED) ? 5.0 : 3.0;
    }
    
    if (tags.includes(TAGS.SHARP) || tags.includes(TAGS.METAL)) {
      props.gatherMult = 1.2 + (tags.includes(TAGS.METAL) ? 0.5 : 0);
      props.damage = 2 + (tags.includes(TAGS.METAL) ? 2 : 0);
    }
    
    if (tags.includes(TAGS.VEHICLE) || tags.includes(TAGS.MOBILE)) {
      props.speedBoost = 1.3;
      props.capacity = tags.includes(TAGS.CONTAINER) ? 3 : 1;
    }
    
    if (tags.includes(TAGS.STRUCTURAL) && tags.length > 2) {
      props.isBuilding = true;
    }
    
    if (tags.includes(TAGS.WEAPON)) {
      props.damage = 3 + (tags.includes(TAGS.SHARP) ? 2 : 0) + (tags.includes(TAGS.METAL) ? 2 : 0);
    }
    
    return props;
  }
  
  _generateFoodLabel(bases, item1, item2) {
    // Generate readable names for food combinations
    const baseLabels = bases.map(b => {
      const info = BASE_ITEMS[b];
      return info ? info.label : b.charAt(0).toUpperCase() + b.slice(1);
    });
    
    if (baseLabels.length === 2) {
      return `${baseLabels[0]} ${baseLabels[1]}`;
    } else if (baseLabels.length === 3) {
      return `${baseLabels[0]} ${baseLabels[1]} ${baseLabels[2]}`;
    } else {
      return baseLabels.join(' ');
    }
  }
  
  _getItemInfo(itemId) {
    // Check base items first
    if (BASE_ITEMS[itemId]) {
      return BASE_ITEMS[itemId];
    }
    
    // Check discovered recipes
    for (const recipe of this.recipes.values()) {
      if (recipe.output === itemId) {
        return recipe;
      }
    }
    
    // Fallback
    return { tags: [], color: '#888888', label: itemId };
  }
  
  _generateLabel(tags, item1, item2, output = null) {
    // Special case for mash
    if (output === 'mash') {
      return 'Mash';
    }
    
    const parts = [];
    if (tags.includes(TAGS.METAL)) parts.push('Metal');
    if (tags.includes(TAGS.SHARP)) parts.push('Sharp');
    if (tags.includes(TAGS.VEHICLE)) parts.push('Vehicle');
    if (tags.includes(TAGS.WEAPON)) parts.push('Weapon');
    if (tags.includes(TAGS.FOOD)) parts.push('Food');
    if (tags.includes(TAGS.STRUCTURAL) && tags.includes(TAGS.CONTAINER)) parts.push('Storage');
    else if (tags.includes(TAGS.STRUCTURAL)) parts.push('Structure');
    
    if (parts.length === 0) parts.push('Composite');
    
    return parts.join(' ');
  }
  
  _blendColors(color1, color2) {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;
    
    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;
    
    const r = Math.floor((r1 + r2) / 2);
    const g = Math.floor((g1 + g2) / 2);
    const b = Math.floor((b1 + b2) / 2);
    
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
  
  /**
   * Get all discovered recipes as a list
   */
  getDiscovered() {
    return Array.from(this.recipes.values());
  }
  
  /**
   * Serialize for save/load
   */
  serialize() {
    return {
      recipes: Array.from(this.recipes.entries()),
      nextGeneratedId: this.nextGeneratedId,
    };
  }
  
  /**
   * Deserialize from save
   */
  deserialize(data) {
    if (!data) return;
    this.recipes.clear();
    for (const [key, recipe] of data.recipes) {
      this.recipes.set(key, recipe);
    }
    this.nextGeneratedId = data.nextGeneratedId || 1;
  }
}

// Extend COLORS and LABELS with dynamic discovery support
export function getItemColor(itemId, notebook) {
  if (COLORS[itemId]) return COLORS[itemId];
  if (BASE_ITEMS[itemId]) return BASE_ITEMS[itemId].color;
  
  // Check discovered recipes
  for (const recipe of notebook.recipes.values()) {
    if (recipe.output === itemId) return recipe.color || '#888888';
  }
  
  return '#888888';
}

export function getItemLabel(itemId, notebook) {
  if (LABELS[itemId]) return LABELS[itemId];
  if (BASE_ITEMS[itemId]) return BASE_ITEMS[itemId].label;
  
  // Check discovered recipes
  for (const recipe of notebook.recipes.values()) {
    if (recipe.output === itemId) return recipe.label || itemId;
  }
  
  return itemId;
}

/**
 * Check if item has a specific tag (including discovered items)
 */
export function itemHasTag(itemId, tag, notebook) {
  const info = BASE_ITEMS[itemId];
  if (info && info.tags.includes(tag)) return true;
  
  for (const recipe of notebook.recipes.values()) {
    if (recipe.output === itemId && recipe.tags && recipe.tags.includes(tag)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get gather multiplier for an item
 */
export function getGatherMult(itemId, notebook) {
  if (BASE_ITEMS[itemId]?.gatherMult) return BASE_ITEMS[itemId].gatherMult;
  
  for (const recipe of notebook.recipes.values()) {
    if (recipe.output === itemId && recipe.gatherMult) {
      return recipe.gatherMult;
    }
  }
  
  return 1.0;
}

/**
 * Check if item is food
 */
export function isFood(itemId, notebook) {
  return itemHasTag(itemId, TAGS.FOOD, notebook);
}

/**
 * Get hunger value for food item
 */
export function getFoodValue(itemId, notebook) {
  if (BASE_ITEMS[itemId]?.hunger) return BASE_ITEMS[itemId];
  
  for (const recipe of notebook.recipes.values()) {
    if (recipe.output === itemId && recipe.hunger) {
      return { hunger: recipe.hunger, time: recipe.time || 2.5, energy: 0.05 };
    }
  }
  
  return null;
}
