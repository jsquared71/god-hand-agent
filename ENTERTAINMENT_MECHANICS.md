# Entertainment/Mood System

## Overview
A per-agent boredom stat that prevents repetitive forage → eat → combine loops without adding entertainment buildings or scripted "play" jobs.

## Display
- **Location**: Left HUD, inside each settler card (Ava/Bo)
- **Label**: "Mood"
- **Visual**: Purple gradient bar (0-100%)
- **Position**: Below Energy, above Mind status

## Scale
- `1.0` (100%): Fully engaged
- `0.0` (0%): Completely bored

## Drain Mechanics

### Repetition Penalties
- **Same forage source**: -6% per completion
- **Repeated eating**: -6% per completion  
- **Known combine** (no discovery): -8% per completion
- Tracked via existing `lastForageSource` and `lastBusyKind` memory

### Passive Drain
- **Base rate**: -1% per second
- **Night penalty**: Additional -1.5%/s when not near hut or fire
- Prevents agents from staying at 100% indefinitely

## Recovery Mechanics

### Active Recovery
- **New invention**: +25% (significant boost for discovery)
- **Walking distance**: +12% per 8 units traveled
- Encourages exploration and innovation

### Proximity Recovery (per second)
- **Near other agent** (< 2.5 units): +2%/s
- **Near fire** (< FIRE_RADIUS): +1.5%/s
- Passive social/comfort rewards

## Behavior Impact

### Low Entertainment Threshold: < 35%
When bored, agents avoid repeating the same activity:
- If brain suggests `eat` after just eating → switch to variety
- If brain suggests `seek_food` after just foraging → switch to variety
- If brain suggests `combine` but can't invent → switch to variety

### Variety Alternatives
Agents randomly pick from available options:
- `seek_material` (always available)
- `process` (if can process anything)
- `build` (if can afford a building)
- `combine` (if can create something new)

Filters out the last busy kind to ensure variety.

## Design Constraints Preserved

### Sacred Rules Maintained
- **No entertainment buildings** (no chairs, toys, game objects)
- **No closed "fun activities" list** (open-ended variety)
- **Satiety rule preserved**: Never eat if hunger ≥ 0.75
- **Open invention system**: Combine logic unchanged
- **Personal space**: Agent collision avoidance still works

### Integration Approach
- Uses existing `lastForageSource`/`lastBusyKind` tracking
- No new brain neuron (7-way softmax unchanged)
- Post-processes brain decisions when entertainment is low
- Simple 0-1 meter + conditional action override

## Save/Load Support
Entertainment persists in save files:
- Serialized with agent state
- Defaults to 1.0 for old saves
- No migration needed

## Implementation Notes
- Walking distance tracked incrementally in `walkToward()`
- Entertainment updated in main `update()` loop (per frame)
- HUD updates via existing `updateHud()` function
- Zero impact on world physics or rendering
