# God Hand — Agent Sandbox

A Three.js god-hand sandbox. You never steer the creature. You drop raw resources from a toolbar; a tiny neural-net agent eats, crafts, and builds with whatever you give it.

The world starts **empty**. If nothing has been dropped, the inventory is empty, and nothing has been built, the brain is skipped and the agent stays idle.

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

## Recipes

**Eat**

| Food | Time | Hunger | Notes |
|---|---|---|---|
| Water | quick | tiny | Light refreshment |
| Berry | quick | small | Raw food |
| Fish | medium | small | Raw fish |
| Grain | slower | medium | Raw grain |
| Bread | agent-made | high | Cooked grain + water |
| Cooked Fish | agent-made | high | Best near fire |
| Stew | agent-made | best | Berry + water, best near fire |

**Process** (agent; faster at a workbench, some faster near fire, faster still with tools)

- wood → planks
- ore → ingot
- grain + water → bread
- berry + water → stew (faster near fire)
- fish → cooked fish (faster near fire)
- planks → sticks (1 → 2)

**Build** (agent spends inventory)

- 2 planks → workbench (speeds processing)
- 3 planks + 2 stone → hut (hunger drains slower when the agent is near / inside)
- 2 wood + 1 stone → campfire (speeds cooking)
- 3 stone + 1 plank → well (slowly produces water pickups)
- 3 planks → chest (storage decoration)
- 2 ingots → tools (held buff: process speed)

Dropped world items are pickups. The agent walks to them, eats food in place, and carries materials.

## Biomes

The world contains four distinct biomes around the spawn point:

- **Meadow** (center/east): Grass tufts, berry bushes, grain stalks, wandering rabbits
- **Forest** (west): Low-poly trees, fallen logs, deer
- **Rocky** (south): Boulders, ore rocks, sparse vegetation
- **Water** (north): Pond with reeds and swimming fish (can be collected)

Flora and fauna are mostly decorative with some harvestable pickups (e.g., fish in the pond).

## Foraging

The agent can forage food and materials directly from biome sources instead of relying only on player-dropped pickups:

- **Berry bushes** (meadow) yield berries
- **Grain stalks** (meadow) yield grain
- **Trees and logs** (forest) yield wood
- **Stone boulders and ore rocks** (rocky) yield stone or ore
- **Swimming fish** (pond) yield fish

When hungry or short on materials, the agent will walk to the nearest harvestable source, perform a brief gathering animation, and collect the resource. Forage sources have charges and cooldowns—they don't vanish immediately but regenerate after being depleted, keeping the world sustainable. The agent seamlessly chooses between foraged sources and player-dropped pickups based on proximity and need.

## Agent brain

Plain JS MLP — **no TensorFlow**.

- 20 inputs (hunger, energy, inventory counts, nearest distances, building flags)
- 16 hidden units, `tanh`
- 6 outputs, softmax: `idle`, `seek_food`, `eat`, `seek_material`, `process`, `build`
- Forward pass a few times per second, not every frame
- Empty world + empty inventory + nothing built → force idle, skip the net
- Session-only REINFORCE weight nudges: +eat, −starve, +successful craft/build
- Hunger drains over time. At 0 the agent gets sluggish and collapses to an idle-hungry wait. No game-over screen.

## Swap in Meshy GLBs

The loader tries `public/assets/glb/<id>.glb` via `GLTFLoader`. On 404 it uses the procedural low-poly stand-in.

Ids: `agent`, `berry`, `grain`, `wood`, `stone`, `ore`, `water`, `planks`, `ingot`, `bread`, `stew`, `dough`, `fish`, `cooked_fish`, `sticks`, `hut`, `workbench`, `fire`, `well`, `chest`.

See `public/assets/glb/README.md` for Meshy Smart Topology export notes. Drop files in and refresh — no code rewrite.

## Stack

Vite + vanilla JS (ES modules) + three.js.
