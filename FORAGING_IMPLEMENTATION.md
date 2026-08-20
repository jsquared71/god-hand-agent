# Foraging System Implementation

## Overview
The agent can now autonomously gather food and materials directly from biome sources instead of relying solely on player-dropped pickups.

## Harvestable Sources

| Biome | Source | Yields | Charges | Cooldown |
|-------|--------|--------|---------|----------|
| Meadow | Berry bushes (4) | berry | 3 | 8s |
| Meadow | Grain stalks (6) | grain | 2 | 10s |
| Forest | Trees (12) | wood | 3 | 12s |
| Forest | Logs (3) | wood | 2 | 8s |
| Rocky | Stone boulders | stone | 2 | 15s |
| Rocky | Ore rocks | ore | 2 | 15s |
| Water | Swimming fish (4) | fish | 1 | 20s |

## Technical Implementation

### Files Modified
1. **world.js**: Added forageSources tracking with charge/cooldown system
2. **resources.js**: Added nearestForageSource(), harvestForageSource(), cooldown updates
3. **brain.js**: Extended inputs to include forage source distances, updated shouldForceIdle()
4. **agent.js**: Added foraging busy state, updated all seek actions to consider forage sources
5. **main.js**: Removed hardcoded fish pickups

### Brain Inputs (20D)
- Original 14: hunger, energy, 8 inventory counts, 4 pickup distances, 2 building distances
- Added 4: distForageFood, distForageWood, distForageOre, distForageStone
- Brain chooses closer option between pickups and forage sources

### Agent Behavior
- `FORAGE_RADIUS = 1.2` (slightly larger than PICKUP_RADIUS)
- Foraging takes 1.2s gathering animation
- Resource spawns at agent's feet after gathering
- Visual feedback: depleted sources dim to ~40% opacity during cooldown

## Reinforcement Shaping
Enhanced hunger-based rewards to prioritize food-seeking:
- Base: `(hunger - 0.5) * 0.08`
- Strong penalty when hunger < 30%: `-0.15`
- Boost for seek_food when food available and hungry: `+0.08`
- Penalty for seek_material when very hungry: `-0.1`

## Testing Results

### Test 1: Core Mechanics ✅
- Foraging animation works correctly
- Inventory updates properly
- Resources persist after harvesting
- Trees successfully harvested multiple times
- Crafting integration works (wood → planks → sticks)

### Test 2: Food Prioritization 🔄
- Issue identified: Agent over-prioritized wood gathering even when hungry (19%)
- Fix applied: Improved reinforcement shaping and hasAnyFood() to include forage sources
- Retesting in progress

## Future Improvements
- Consider adding grain field patches for more abundant grain
- Add visual growth stages for depleted sources
- Tune individual source cooldowns based on gameplay testing
- Add particle effects for gathering animation
