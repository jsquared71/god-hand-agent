# Verification

Project: `/workspace/2026-08-19-agent-game`

## Run command

```bash
cd /workspace/2026-08-19-agent-game
npm install
npm run dev
```

Open `http://localhost:5173/`.

Build: `npm run build`  
Brain check: `npm run brain-check`

## What was verified (2026-08-19)

- `npm install` succeeded (three@0.170.0, vite@6.4.3).
- `npm run build` succeeded in 1.20s. Vite noted a >500 kB chunk warning from bundled three.js; that is not a build failure.
- `npm run dev` on port 5173:
  - `GET /` → 200 HTML (`God Hand — Agent Sandbox`)
  - `GET /src/style.css` with `Accept: text/css` → 200 `text/css`
  - `GET /src/main.js` → 200 ESM
  - `GET /src/brain.js`, `/src/agent.js` → 200
  - `GET /@vite/client` → 200
  - `GET /node_modules/three/build/three.module.js` → 200
- `npm run brain-check` (`scripts/brain-sanity.mjs`):
  - Instantiates the MLP (20 → 16 tanh → 6 softmax)
  - Forward pass: softmax sums to 1
  - REINFORCE nudges weights
  - Empty-world idle gate: skip net when no pickups, empty inventory, nothing built
  - Gate lifts if a pickup or hut exists

## Stand-in vs Meshy status

No Meshy GLBs are present. `public/assets/glb/` contains only a README.

The loader fetches `/assets/glb/<id>.glb` and, on 404, uses procedural low-poly stand-ins for: agent, berry, grain, wood, stone, ore, planks, ingot, bread, hut, workbench.

Browser network 404s for those GLBs are expected until files are copied in. They are caught; the game falls back. Drop Meshy Smart Topology GLBs into `public/assets/glb/` using those ids — no code change.

## Known notes

- Dev server was started on `http://localhost:5173/` during verification.
- Agent art is box/capsule humanoid (teal) until `agent.glb` is added.
- Session learning is on-policy REINFORCE; early behavior is exploratory until rewards accumulate.
