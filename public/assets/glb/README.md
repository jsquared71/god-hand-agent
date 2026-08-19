# Meshy GLB drop-in folder

Put exported GLBs here. The game looks up `/assets/glb/<id>.glb`. If a file is missing (404), a low-poly procedural stand-in is used instead. Swapping art is a file copy — no code change.

## Filenames

| File | Subject |
|---|---|
| `agent.glb` | The humanoid agent |
| `berry.glb` | Berry cluster |
| `grain.glb` | Grain sheaf |
| `wood.glb` | Log |
| `stone.glb` | Stone chunk |
| `ore.glb` | Ore rock |
| `planks.glb` | Stack of planks |
| `ingot.glb` | Metal ingot |
| `bread.glb` | Loaf of bread |
| `hut.glb` | Hut / A-frame house |
| `workbench.glb` | Crafting table |

Do **not** drop files for tools; tools are a held buff, not a world mesh.

## Meshy export settings

Use **Meshy Smart Topology** and export as **GLB**.

Prompt / art direction that matches the game:

- **low poly, game asset, clean silhouette, no ground plane or stand, centered origin**
- Keep scale modest; the loader recenters and resizes to a per-id target.
- Prefer a single root with the mesh sitting on y = 0 (feet / base on the origin).
- Avoid extra cameras, lights, and huge empty transforms.
- If the agent is rigged, a still T-pose/A-pose is fine — the game will bob the whole model. Unrigged low-poly is also fine.

After export, copy the file into this folder using the exact id filename above and refresh the game.
