# God Hand — Agent Sandbox

A Three.js god-hand sandbox with **open-ended invention**. You never steer the creatures. You drop raw resources from a toolbar using **Favor**; two tiny neural-net agents eat, craft, and build with whatever you give them.

## Design Philosophy

**As few rules as possible.** Agents figure out tasks through need-based rewards (hunger, warmth, faster gathering) — not scripted "if hungry, do X" logic. 

**Unbounded technology.** No closed recipe list. Agents combine any two items to discover new types with procedurally derived properties. Tools, weapons, devices, and vehicles emerge from tag-based combinations with no designer ceiling on what can exist.

The world starts **empty**. If nothing has been dropped, the inventory is empty, and nothing has been built, the brain is skipped and agents stay idle.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

Headless brain check (no browser):

```bash
npm run brain-check
```

## Gameplay

### Day & Night Cycle

A full day lasts **4-5 minutes** real time (70% day, 30% night). Watch the sky shift from warm daylight through dusk to dark night with moonlight. At night:

- **Cold penalizes unprotected agents**: Hunger drains 3× faster if agents are not near a **hut** or a lit **campfire**
- **Survival strategy**: Build a hut and campfire to keep your settlers warm and fed through the night
- The campfire emits real light that illuminates the world at night

The day/night cycle creates a rhythm: gather and build during the day, survive the cold nights with shelter and fire.

### Favor System

Player drops cost **Favor** — your divine intervention has limits:

- Start with **10 Favor**, maximum 20
- Each toolbar drop (berry, grain, wood, stone, ore, water) costs **1 Favor**
- Favor regenerates slowly over time
- **Bonus regeneration** when your camp is thriving:
  - Agents are well-fed (hunger > 75%)
  - Hut is built
  - Tools have been crafted
  - Chest pantry is stocked

If Favor reaches 0, you cannot drop more resources until it regenerates. Plan your offerings wisely!

### Camp Status

The HUD shows four camp indicators:

- **Fed**: All agents have hunger > 75%
- **Housed**: A hut has been built (provides warmth at night)
- **Tooled**: Agents have crafted tools (faster gathering)
- **Stocked**: The chest pantry contains food

These indicators turn green when active and boost Favor regeneration.

### Two Settlers

Two agents inhabit the world, each with independent:

- Neural network brains with slightly different action priors (one more builder-biased, one more forager-biased)
- Hunger, energy, and inventory
- Learned behavior through REINFORCE weight updates

Both agents share the camp's buildings and work together to survive. Watch their **want bubbles** to see what each agent is thinking:

- **Hungry** — needs food
- **Cold** — unprotected at night
- **Wants workbench** — planning to build
- **Wants hut** — seeking shelter
- **Wants tools** — ready to craft tools
- **Gathering** — collecting materials
- **Crafting** — processing items
- **Building** — constructing a structure
- **Content** — well-fed and satisfied

### Chest Pantry

The chest is no longer just decoration. When built, agents:

- **Deposit** extra food (berry, grain, bread, stew, fish, cooked fish, water) into the chest instead of hoarding it
- **Withdraw** food from the chest when their own hunger drops to ≤75%

A stocked chest contributes to camp thriving and Favor regeneration. Think of it as a shared pantry for the colony.

### Audio Feedback

Simple, tasteful sounds using WebAudio oscillators (no external audio files):

- **Footsteps** — soft ticks when agents walk
- **Gathering** — chop/spark when harvesting
- **Building completes** — small chime
- **Fire crackle** — quiet ambient loop when a campfire exists
- **Nightfall** — ambient sound when night begins

## Mouse mapping

**Toolbar** (bottom strip — berry, grain, wood, stone, ore):

- Left-press an icon to start a drag. The camera does **not** move during this drag.
- A translucent 3D ghost follows the ground under the cursor.
- Release over the ground to drop the resource.
- Release over the toolbar or off the ground to cancel.

**World** (when you are not dragging a resource):

- Left-drag: orbit (rotate)
- Right-drag: pan
- Wheel: zoom

This is Three.js `OrbitControls` (left = rotate, right = pan, wheel = dolly). Rotate/pan/zoom are disabled while a toolbar drag is active so the two left-clicks never fight. The canvas blocks the browser context menu so right-click pan works.

There is no WASD / keyboard camera.

## Discovery & Combination

Agents can **combine any two inventory items** to create new objects. The system never returns "invalid recipe" — every combination produces something, though usefulness varies.

**Discovered recipes persist** in the world's notebook (saved with your game). The Recipes HUD (right side) lists only what has been discovered, starting nearly empty. Watch it grow as agents experiment.

**Seed recipes** work from the start (e.g., wood + stone → crude tool, grain + water → bread, ore + fire → ingot, ingot + wood → better tools). After that, unknown pairs still produce *something* with blended tags and procedural properties.

**Item properties come from tags:**
- Food, fuel, sharp, structural, vessel, mobile, metal, fiber, container, light, weapon, vehicle
- Tags determine behavior: gatherMult (faster harvesting), damage, speed boost, capacity, hunger value
- Tools/weapons/devices/vehicles are just items with those tags — no hard categories

**Buildings** remain discrete (hut, workbench, fire, well, chest) but can also be discovered through structural + container or structural + mobile combinations.

**Agents learn through needs:** hunger reduction, warmth at night, successful combinations (small curiosity bonus on first discovery), faster gathering with better tools. No "you must build X next" scripts.

## Biomes

The world contains four distinct biomes around the spawn point. **Each world is randomly generated** — biome layouts, resource positions, and counts vary on every fresh start, but the same seed produces the same world:

- **Meadow** (center/east): Grass tufts, berry bushes, grain stalks, wandering rabbits
- **Forest** (west): Low-poly trees, fallen logs, deer
- **Rocky** (south): Boulders, ore rocks, sparse vegetation
- **Water** (north): Pond with reeds and swimming fish (can be collected); agent can gather water from pond edge

Flora and fauna are mostly decorative with some harvestable pickups (e.g., fish in the pond).

## Foraging

The agent can forage food and materials directly from biome sources instead of relying only on player-dropped pickups:

- **Berry bushes** (meadow) yield berries — green bushes with clusters of visible red berries
- **Grain patches** (meadow) yield grain — golden wheat stalks in small patches
- **Mushroom clusters** (meadow edges) yield food — orange-capped mushrooms
- **Trees and logs** (forest) yield wood — **tools provide 2× yield and faster gathering**
- **Stone boulders and ore rocks** (rocky) yield stone or ore — **tools provide 2× yield; without tools gathering costs 2 charges for 1 item**
- **Swimming fish** (pond) yield fish — blue and orange fish swimming in the water
- **Pond water** — agent can gather water directly from the pond's edge; no well required (wells remain as a convenience)

When hungry or short on materials, the agent will walk to the nearest harvestable source, perform a brief gathering animation, and collect the resource. Forage sources have charges and cooldowns—they don't vanish immediately but regenerate after being depleted, keeping the world sustainable. The agent seamlessly chooses between foraged sources and player-dropped pickups based on proximity and need.

Food sources are visually distinct and recognizable: berry bushes have red berries, grain patches are golden, mushrooms have orange caps, and fish are colorful and visible in the pond. A few food pickups spawn on the ground at world start so food is immediately visible.

**Crafting tools (2 ingots) gives the agent faster gathering and better yields from trees, rocks, and ore.**

## Agent brain

Plain JS MLP — **no TensorFlow**.

- 22 inputs (hunger, energy, inventory counts, nearest distances, building flags, tag presence flags)
- 16 hidden units, `tanh`
- 7 outputs, softmax: `idle`, `seek_food`, `eat`, `seek_material`, `process`, `build`, `combine`
- Forward pass a few times per second, not every frame
- Empty world + empty inventory + nothing built → force idle, skip the net
- Session-only REINFORCE weight nudges: hunger reduction, successful craft/build, curiosity bonus for first-time discoveries
- **Minimal policy:** No hardcoded "must eat when hunger > X" or "cannot make sticks until Y buildings exist." Needs (hunger, cold, faster gathering) drive behavior through rewards, not code gates.
- Hunger drains over time. At 0 the agent gets sluggish and collapses to an idle-hungry wait. No game-over screen.
- **Cold at night**: Hunger drains 3× faster if the agent is not near a hut or campfire
- **Two settlers** with slightly different action priors: one more builder-focused, one more experimental. Both share the discovered-recipe notebook.
- **World resources regenerate slowly** — forage sources (bushes, trees, rocks, fish) regain charges one at a time after harvest, and initial ground pickups respawn at their origin after collection. Player-dropped items do not regenerate.

## Swap in Meshy GLBs

The loader tries `public/assets/glb/<id>.glb` via `GLTFLoader`. On 404 it uses the procedural low-poly stand-in.

Ids: `agent`, `berry`, `grain`, `wood`, `stone`, `ore`, `water`, `planks`, `ingot`, `bread`, `stew`, `dough`, `fish`, `cooked_fish`, `sticks`, `hut`, `workbench`, `fire`, `well`, `chest`.

See `public/assets/glb/README.md` for Meshy Smart Topology export notes. Drop files in and refresh — no code rewrite.

## Save & Load

The game includes a full save/load system to preserve your world and the agents' learned behavior.

### Saving
- Click the **Save** button in the HUD (top-left panel)
- A file save dialog will open (or download will start)
- Saves to `god-hand-save-<timestamp>.json`
- Keyboard shortcut: `Ctrl+S`
- **Autosave**: Every 15 seconds to localStorage (survives page refresh)

### Loading
- Click the **Load** button in the HUD
- Select a previously saved `.json` file
- World state is instantly restored

### What's Saved
- Both agents' positions, stats (hunger, energy), inventories, and brain weights (learned behavior)
- All dropped pickups (type + position)
- All built structures (hut, fire, workbench, well, chest)
- Forage source charges and cooldowns
- Camera position
- World seed (for consistent world layout on reload)
- Day/night cycle (time of day, day index)
- Favor amount and game state
- Chest pantry contents
- Format version for future compatibility

On page load, if an autosave exists in localStorage, you'll be prompted to restore it. Otherwise, the world starts fresh with a few food pickups scattered on the ground.

## Stack

Vite + vanilla JS (ES modules) + three.js.
