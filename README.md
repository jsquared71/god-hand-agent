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

| Food | Time | Hunger |
|---|---|---|
| Berry | quick | small |
| Grain | slower | medium |
| Bread | agent-made | best |

**Process** (agent; faster at a workbench, faster still with tools)

- wood → planks
- ore → ingot
- grain → bread

**Build** (agent spends inventory)

- planks → workbench
- planks + stone → hut (hunger drains slower when the agent is near / inside)
- ingots → tools (held buff: process speed)

Dropped world items are pickups. The agent walks to them, eats food in place, and carries materials.

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

Ids: `agent`, `berry`, `grain`, `wood`, `stone`, `ore`, `planks`, `ingot`, `bread`, `hut`, `workbench`.

See `public/assets/glb/README.md` for Meshy Smart Topology export notes. Drop files in and refresh — no code rewrite.

## Stack

Vite + vanilla JS (ES modules) + three.js.
