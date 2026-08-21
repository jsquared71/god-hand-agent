# Wanderlust Feature Verification Checklist

## Visual/HUD Verification
- [x] Ava has "Restless" bar in left HUD
- [x] Bo has "Restless" bar in left HUD  
- [x] Bar has brown/tan gradient styling
- [x] Bar shows percentage value (0-100%)
- [x] Recipes HUD remains on the right side

## Functional Verification (Manual Testing)

### Wanderlust Climbing
- [ ] Bar climbs slowly when agent stays in same biome
- [ ] Bar climbs faster when agent is foraging/eating
- [ ] Bar reaches ~60-100% after staying in meadow for 60+ seconds

### Wanderlust Dropping
- [ ] Bar drops when agent walks from meadow to forest
- [ ] Bar drops when agent walks from meadow to rock area
- [ ] Bar drops when agent walks from meadow to pond/water
- [ ] Smaller drop when returning to recently-visited biome

### Behavior Changes
- [ ] Low wanderlust (<60%): agent picks nearest berry bush in meadow
- [ ] High wanderlust (>60%): agent walks to forest/rock/water instead of nearest meadow resource
- [ ] Agent successfully walks to and harvests from distant biome
- [ ] After harvesting in new biome, wanderlust drops

### Edge Cases
- [ ] Wanderlust never goes below 0
- [ ] Wanderlust never goes above 1.0 (100%)
- [ ] Falls back to nearest resource if no different-biome option exists
- [ ] Save/load preserves wanderlust state
- [ ] Old saves without wanderlust load successfully (default 0.5)

## Code Quality
- [x] No console errors on page load
- [x] Dev server runs without errors
- [x] All automated tests pass
- [x] Biome detection logic tested
- [x] Wanderlust climbing/dropping logic tested
- [x] Biome filtering logic tested

## Performance
- [ ] No noticeable frame rate drop
- [ ] Agent pathfinding works smoothly to distant biomes
- [ ] HUD updates smoothly (no jitter)

## Sacred Constraints Preserved
- [x] No WASD steering added
- [x] No hardcoded "go explore" job names
- [x] Mouse controls unchanged (left-drag drops, orbit, pan, zoom)
- [x] Recipes HUD stays on right
- [x] Toolbar stays at bottom
- [x] A-frame hut unchanged
- [x] No new buildings added
- [x] No stacked buildings
- [x] No `confirm()`/`alert()` added
- [x] No `require()` in browser ESM
- [x] World boots without GLBs
