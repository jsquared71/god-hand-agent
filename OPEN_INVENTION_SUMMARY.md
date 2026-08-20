# Open Invention System — Implementation Summary

**Branch:** `cursor/open-invention-system-ac48`  
**PR:** [#10](https://github.com/jsquared71/god-hand-agent/pull/10)  
**Status:** ✅ Build passing, brain-check passing

## What Changed

### Design Goal
**As few rules as possible.** Let agents figure out tasks through need-based rewards (hunger, warmth, faster gathering) instead of hardcoded "do this" scripts. No designer cap on tools, weapons, devices, or vehicles.

### Core Implementation

#### 1. Removed Hardcoded Policy Gates ❌
**Before:**
- Force-ignored food when hunger > 0.75
- Blocked planks→sticks until workbench, hut, well, and chest all existed
- Reinforcement shaping with penalties for eating when "full"

**After:**
- Hunger in observation; REINFORCE learns when to eat
- Sticks remain combinable; the net learns opportunity cost
- Minimal shaping: needs-based only (hunger < 0.3 penalty, successful actions get small bonus)

#### 2. Tag-Based Discovery System ✨
**New file:** `src/discovery.js`

**Item Tags:**
- `food`, `fuel`, `sharp`, `structural`, `vessel`, `mobile`, `metal`, `fiber`, `container`, `light`, `weapon`, `vehicle`, `liquid`, `processed`, `raw`

**How It Works:**
1. Agents have new `combine` action (7th brain output)
2. Pick two inventory items and combine them
3. System **always** returns a result (never "invalid recipe")
4. First discovery of a pair adds to shared notebook
5. Properties derived from tags:
   - `gatherMult` (sharp + metal = faster harvesting)
   - `damage` (weapon + sharp + metal = higher damage)
   - `speedBoost` & `capacity` (vehicle + mobile)
   - `hunger` (food tag items)

**Seed Recipes:**
- wood + stone → crude_tool
- wood + wood → sticks
- ore + fire → ingot
- ingot + ingot → tools
- grain + water → bread
- berry + water → stew
- fish + fire → cooked_fish
- structural + mobile → cart/vehicle
- And more...

**Unknown Pairs:**
Generate new items with procedural properties:
- `output: "wood-ore-1"` (generated id)
- `label: "Metal Sharp"` (derived from tags)
- `color: #blend` (color interpolation)
- Stats from tag combinations

#### 3. Brain Updates 🧠
**Inputs:** 20 → 22
- Added: `hasSharp`, `hasMetal`, `hasVehicle` flags

**Outputs:** 6 → 7
- Added: `combine` action

**Priors adjusted:**
- Lower food-seeking bias (let hunger drive it)
- Higher combine prior (encourage experimentation)
- Default: `[0.15, 0.1, 0.05, 0.35, 0.08, -0.05, 0.12]`

**Reinforcement:**
- Minimal shaping: hunger penalty when low, small bonuses for successful actions
- **Curiosity bonus:** +0.4 reward for first-time recipe discovery (only once per pair)
- No forced overrides or action blocking

#### 4. UI Changes 🎨
**Recipes HUD:**
- **Moved from left to right side** of screen
- `right: 18px; left: auto`
- Added `max-height: calc(100vh - 200px)` + scroll
- Shows **only discovered recipes** (starts nearly empty)
- Grows as agents experiment
- Section: "Discovered Recipes"

**Want Bubble:**
- Added "Inventing" state during combine action

#### 5. Save/Load 💾
- `DiscoveryNotebook` serializes to save.json
- Both agents share notebook reference
- Load restores all discovered recipes
- Updated autosave to include notebook

### File Changes
```
modified:   README.md               # Philosophy + discovery docs
modified:   scripts/brain-sanity.mjs  # Updated for 7 actions, 22 inputs
modified:   src/agent.js            # Remove gates, add combine action
modified:   src/brain.js            # 7 outputs, 22 inputs
new file:   src/discovery.js        # Tag system + recipe generation
modified:   src/main.js             # Create notebook, pass to agents
modified:   src/recipes.js          # Show discovered recipes only
modified:   src/save.js             # Serialize/deserialize notebook
modified:   src/style.css           # Recipes HUD right-side + scroll
```

## How It Plays

### Session Start
1. Recipes HUD shows: _"Combine items to discover recipes..."_
2. Agents gather materials (wood, stone, ore, berries)
3. Brain outputs `combine` action
4. Agent picks two items (e.g., wood + stone)
5. **Discovery!** → crude_tool added to notebook + inventory
6. Recipes HUD updates with new entry
7. Curiosity bonus (+0.4) reinforces experimentation

### Learning Curve
- No forced eating threshold → agent learns to eat before collapsing
- No sticks gate → agent can make sticks anytime (learns when it's useful)
- Combine action → agent discovers better tools, tries food combos, experiments with structural items

### Emergent Possibilities
- Better tools from metal combos (higher gatherMult)
- Weapons from sharp + metal (damage stat)
- Vehicles from structural + mobile (speedBoost)
- Food experiments (berry + grain + water?)
- Unknown combos generate unique items with blended tags

## Testing

```bash
npm install
npm run build        # ✅ Passes
npm run brain-check  # ✅ Passes
```

**Brain sanity output:**
```
brain-sanity: ok
  MLP 22 → 16 tanh → 7 softmax
  actions: idle, seek_food, eat, seek_material, process, build, combine
  empty-world idle gate: pass
  forward + REINFORCE nudge: pass
```

## Philosophy Achieved

✅ **Few rules:** Removed hunger override, sticks gate  
✅ **Need-based rewards:** Hunger, cold, gathering speed drive learning  
✅ **Open invention:** Any two items combine, unbounded types  
✅ **No designer cap:** Generated IDs, procedural properties, emergent tech  
✅ **Shared discovery:** Both agents learn from each other's experiments  

## What's NOT Changed

- Physics/world facts: night cold, forage regen, collision, A-frame hut
- Fauna yaw behavior
- Favor system (player's scarce verb)
- Mouse mapping
- Day/night cycle
- Existing buildings (hut, workbench, fire, well, chest)

## Next Session Ideas

1. **Visual variety:** Tint procedural meshes based on tags
2. **Vehicle mechanics:** Actually apply speedBoost from equipped vehicles
3. **Weapon usage:** Fauna interaction (optional, not required)
4. **More seed recipes:** Interesting vehicle/weapon combos
5. **Building discovery:** More structural + X combos → new building types
6. **Capacity system:** Vehicles increase inventory carry limit

## Player Request Fulfilled

> "On jsquared71/god-hand-agent (default branch master). Design goal from the player: as FEW rules as possible telling agents what to do. Agents should figure out tasks and keep inventing technology with no designer cap on tools, weapons, devices, or vehicles."

✅ **Done.** Hardcoded policies removed, open combination system implemented, unbounded tech tree, need-based learning only.

> "move the Recipes HUD to the RIGHT side of the screen."

✅ **Done.** Recipes HUD now at `right: 18px` with scroll support.
