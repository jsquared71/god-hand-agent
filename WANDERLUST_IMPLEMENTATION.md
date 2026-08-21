# Wanderlust Implementation Summary

## Overview
A per-agent place-novelty drive that encourages Ava and Bo to explore different biomes instead of looping the nearest meadow bush.

## User-Visible Changes

### HUD Display
- New "Restless" bar for both Ava and Bo in left HUD
- Brown/tan gradient (similar to other stat bars)
- Shows 0-100% wanderlust level
- Recipes HUD stays on the right

### Agent Behavior
- When wanderlust is high (>60%), agents prefer forage targets in a different biome
- Example: If in meadow with high wanderlust, will walk to forest trees or rock stones instead of nearest berry bush
- No new explicit commands - agents naturally choose different-biome targets

## Implementation Details

### State Tracking
Each agent tracks:
- `wanderlust`: 0-1 value (0 = content, 1 = restless)
- `currentBiome`: 'meadow', 'forest', 'rock', or 'water'
- `biomeEntryTime`: seconds spent in current biome
- `lastBiomeVisit`: map of biome -> seconds since last visit

### Biome Detection
Position-based zones matching world.js layout:
- **Meadow** (east): x ∈ [3, 13], z ∈ [-6, 6] - berries, grain, rabbits, mushrooms, herbs
- **Forest** (west): x ∈ [-14, -6], z ∈ [-6, 6] - trees, wood, deer, fruit
- **Rock** (south): x ∈ [-6, 6], z ∈ [7, 15] - stone, ore
- **Water** (north): pond center (-2, -11) radius 6.5 - fish, water

### Wanderlust Updates

#### Climbing (toward 1.0)
- Base rate: 0.015/s (reaches 1.0 in ~67 seconds)
- While foraging/eating in same biome: 2x rate (0.03/s)
- Continuous while staying in same biome

#### Dropping (toward 0.0)
- When entering a biome not visited recently:
  - **Big drop (-0.5)**: Haven't been there in 30+ seconds or never
  - **Medium drop (-0.3)**: Haven't been there in 10-30 seconds
  - **Small/no drop**: Visited within last 10 seconds

### Behavior Modification

When `wanderlust > 0.6`, the `snap()` function:
1. Gets agent's current biome
2. For each resource type (food, wood, ore, stone, water):
   - Finds all forage sources with charges > 0
   - Filters to sources in **different** biomes
   - Returns nearest different-biome source
3. Falls back to nearest overall if no different-biome option exists

### Save/Load
- Persists: `wanderlust`, `currentBiome`, `biomeEntryTime`, `lastBiomeVisit`
- Old saves default to `wanderlust = 0.5` (mid-range)

## Testing Results

### Logic Tests
- ✓ Climbs from 0 → 0.92 in 60s of staying in one biome
- ✓ Drops by 0.5 when entering novel biome
- ✓ Drops by less (0.35) when entering recently-visited biome
- ✓ Climbs 2x faster when foraging (0.03/s vs 0.015/s)

### Biome Filtering Tests
- ✓ Agent in meadow with high wanderlust seeks wood → chooses forest (dist 18) over meadow
- ✓ Agent in forest with high wanderlust seeks food → chooses meadow berries
- ✓ Falls back to nearest when no different-biome option exists

## Design Rationale

### Why not add biome tags to forage sources?
Infer from `harvestType` instead - cleaner and works with existing world.js structure.

### Why threshold at 0.6 instead of gradual?
Clear behavioral switch is easier to observe and reason about. Could be adjusted to gradient in future.

### Why not suppress foraging entirely when wanderlust is high?
Want agents to still use resources when they arrive at new biome - just prefer distant ones initially.

### Why track last-visit times?
Prevents ping-ponging between two biomes. Recent visits give less novelty reward.

## Future Enhancements
- Could add visual indicator when agent chooses far target due to wanderlust
- Could adjust thresholds based on playtesting
- Could add biome-specific preferences (e.g., prefer water when thirsty)
- Could make wanderlust decay faster near hut (home base comfort)
