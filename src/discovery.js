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
  berry: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.22, time: 2.8, color: '#c41e5a', label: 'Berry' },
  grain: { tags: [TAGS.FOOD, TAGS.RAW, TAGS.FIBER], hunger: 0.38, time: 3.8, color: '#e8b923', label: 'Grain' },
  wood: { tags: [TAGS.FUEL, TAGS.STRUCTURAL, TAGS.RAW], color: '#6b3f1d', label: 'Wood' },
  stone: { tags: [TAGS.SHARP, TAGS.STRUCTURAL, TAGS.RAW], color: '#8a8f99', label: 'Stone' },
  ore: { tags: [TAGS.METAL, TAGS.RAW], color: '#5a3228', label: 'Ore' },
  water: { tags: [TAGS.LIQUID, TAGS.FOOD], hunger: 0.12, time: 2.0, color: '#4a9fc8', label: 'Water' },
  fish: { tags: [TAGS.FOOD, TAGS.RAW], hunger: 0.25, time: 3.2, color: '#78a8c4', label: 'Fish' },
  
  // Processed basics
  planks: { tags: [TAGS.STRUCTURAL, TAGS.PROCESSED], color: '#d4a574', label: 'Planks' },
  ingot: { tags: [TAGS.METAL, TAGS.PROCESSED], color: '#7b8792', label: 'Ingot' },
  sticks: { tags: [TAGS.STRUCTURAL, TAGS.SHARP, TAGS.PROCESSED], color: '#8b6239', label: 'Sticks' },
  
  // Cooked food
  bread: { tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.72, time: 5.0, color: '#c4843c', label: 'Bread' },
  stew: { tags: [TAGS.FOOD, TAGS.PROCESSED, TAGS.VESSEL], hunger: 0.85, time: 6.0, color: '#d46c3a', label: 'Stew' },
  cooked_fish: { tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.78, time: 5.2, color: '#c89870', label: 'Cooked Fish' },
  
  // Buildings (not combinable, but in the system)
  workbench: { tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, color: '#5c4033', label: 'Workbench' },
  hut: { tags: [TAGS.STRUCTURAL], isBuilding: true, color: '#8b5a2b', label: 'Hut' },
  fire: { tags: [TAGS.LIGHT, TAGS.FUEL], isBuilding: true, color: '#e84c22', label: 'Campfire' },
  well: { tags: [TAGS.STRUCTURAL, TAGS.VESSEL], isBuilding: true, color: '#6a7a8a', label: 'Well' },
  chest: { tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, color: '#7a5a3a', label: 'Chest' },
  
  // Special items
  tools: { tags: [TAGS.METAL, TAGS.SHARP], gatherMult: 2.0, processSpeedMult: 0.62, isEquippable: true, color: '#6e7b85', label: 'Tools' },
};

/** Seed discovery rules: obvious combinations that work from the start */
const SEED_DISCOVERIES = [
  // Basic processing
  { inputs: ['wood', 'stone'], output: 'crude_tool', tags: [TAGS.SHARP, TAGS.STRUCTURAL], gatherMult: 1.5, label: 'Crude Tool' },
  { inputs: ['wood', 'wood'], output: 'sticks', tags: [TAGS.STRUCTURAL, TAGS.SHARP, TAGS.PROCESSED], label: 'Sticks' },
  { inputs: ['planks', 'planks'], output: 'chest', tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, label: 'Chest' },
  
  // Smelting
  { inputs: ['ore', 'fire'], output: 'ingot', tags: [TAGS.METAL, TAGS.PROCESSED], label: 'Ingot' },
  
  // Tools
  { inputs: ['ingot', 'wood'], output: 'metal_tool', tags: [TAGS.METAL, TAGS.SHARP], gatherMult: 2.5, damage: 3, label: 'Metal Tool' },
  { inputs: ['metal', 'wood'], output: 'axe', tags: [TAGS.WEAPON, TAGS.SHARP, TAGS.METAL], damage: 5, gatherMult: 2.0, label: 'Axe' },
  { inputs: ['ingot', 'ingot'], output: 'tools', tags: [TAGS.METAL, TAGS.SHARP], gatherMult: 2.0, processSpeedMult: 0.62, isEquippable: true, label: 'Tools' },
  
  // Cooking
  { inputs: ['grain', 'water'], output: 'bread', tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.72, label: 'Bread' },
  { inputs: ['berry', 'water'], output: 'stew', tags: [TAGS.FOOD, TAGS.PROCESSED, TAGS.VESSEL], hunger: 0.85, label: 'Stew' },
  { inputs: ['fish', 'fire'], output: 'cooked_fish', tags: [TAGS.FOOD, TAGS.PROCESSED], hunger: 0.78, label: 'Cooked Fish' },
  
  // Structures
  { inputs: ['structural', 'structural'], output: 'frame', tags: [TAGS.STRUCTURAL], isBuilding: true, label: 'Frame' },
  { inputs: ['planks', 'stone'], output: 'workbench', tags: [TAGS.STRUCTURAL, TAGS.CONTAINER], isBuilding: true, label: 'Workbench' },
  { inputs: ['structural', 'mobile'], output: 'cart', tags: [TAGS.VEHICLE, TAGS.STRUCTURAL, TAGS.MOBILE], speedBoost: 1.5, capacity: 2, label: 'Cart' },
  
  // Vehicles
  { inputs: ['structural', 'wheel'], output: 'wagon', tags: [TAGS.VEHICLE, TAGS.MOBILE], speedBoost: 2.0, capacity: 4, label: 'Wagon' },
  { inputs: ['wood', 'wheel'], output: 'cart', tags: [TAGS.VEHICLE, TAGS.MOBILE], speedBoost: 1.5, capacity: 2, label: 'Cart' },
  
  // Weapons
  { inputs: ['sharp', 'structural'], output: 'spear', tags: [TAGS.WEAPON, TAGS.SHARP], damage: 4, label: 'Spear' },
  { inputs: ['metal', 'sharp'], output: 'blade', tags: [TAGS.WEAPON, TAGS.SHARP, TAGS.METAL], damage: 6, label: 'Blade' },
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
    
    return { output: newRecipe.output, discovered: true, recipe: newRecipe };
  }
  
  _generateRecipe(item1, item2) {
    const info1 = this._getItemInfo(item1);
    const info2 = this._getItemInfo(item2);
    
    // Blend tags (union)
    const tags = [...new Set([...info1.tags, ...info2.tags])];
    
    // Generate output id
    const output = `${item1}-${item2}-${this.nextGeneratedId++}`;
    
    // Generate properties based on tags
    const props = {
      output,
      inputs: [item1, item2],
      tags,
      label: this._generateLabel(tags, item1, item2),
      color: this._blendColors(info1.color, info2.color),
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
  
  _generateLabel(tags, item1, item2) {
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
