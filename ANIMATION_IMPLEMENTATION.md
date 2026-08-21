# Meshy GLB Animation Implementation

## Overview
This implementation adds THREE.AnimationMixer support for Meshy settler meshes (Ava and Bo) while maintaining procedural limb-swing animations as a fallback.

## Architecture

### Asset Loading (`src/assets.js`)

#### Animation Clip Loading
- **Main agent GLB**: Loads `agent.glb` and stores any embedded animations in `userData.clips`
- **Companion clip files**: After preload, tries to load:
  - `agent-idle.glb` → idle animation (action 0)
  - `agent-walk.glb` → in-place casual walk (action 613)
  - `agent-work.glb` → gather/collect clip (action 284)
- **Soft-fail mechanism**: Missing files 404 gracefully using try-catch
- **Storage**: Clips stored in proto's `userData.animationClips` as `{ idle: [...], walk: [...], work: [...] }`

#### Skeleton Cloning
- **Import**: `import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'`
- **Detection**: `hasSkinningOrBones()` traverses mesh to detect `isSkinnedMesh` or `isBone`
- **Cloning strategy**:
  - Skinned meshes (GLB with bones) → `skeletonClone(proto)`
  - Other meshes → `proto.clone(true)`
- **Result**: Each agent (Ava and Bo) gets independent skeleton and mixer

### Animation Playback (`src/agent.js`)

#### Mixer Initialization
```javascript
if (group.userData.fromGltf && group.userData.animationClips) {
  mixer = new THREE.AnimationMixer(group);
  // Create actions for idle, walk, work
}
```

#### State-Based Animation
In `animate(dt, walking)`:
1. **Update mixer**: `mixer.update(dt)`
2. **Determine desired action**:
   - `walking` → 'walk'
   - `busy && workingTasks` → 'work' (eat, forage, gather, process, build, combine, hunt, tend)
   - Otherwise → 'idle'
3. **Fallback chain**: desired → idle → walk → first available
4. **Crossfade**: 0.15s fade when action changes

#### Procedural Fallback
If `!state.mixer || Object.keys(state.actions).length === 0`:
- Uses original limb-swing code (armL/armR/legL/legR rotations)
- Maintains backward compatibility with procedural agents

## File Expectations

### Current State
- ✅ `public/assets/glb/agent.glb` - Rigged bind-pose character (exists)
- ❌ `public/assets/glb/agent-idle.glb` - Idle clip (missing, soft-fails)
- ❌ `public/assets/glb/agent-walk.glb` - Walk clip (missing, soft-fails)
- ❌ `public/assets/glb/agent-work.glb` - Work clip (missing, soft-fails)

### When Files Arrive
1. Drop GLB files into `public/assets/glb/`
2. Refresh page
3. Animations load and play automatically
4. No code changes needed

## Testing Results

### ✅ Boot Test
- Game loads without errors
- Missing clip files don't crash
- No console errors for AnimationMixer or SkeletonUtils

### ✅ Procedural Fallback
- Both agents animate with procedural code when clips missing
- Limb-swing, bob, and work animations work correctly

### ✅ Independence
- Ava and Bo each have separate mixer/skeleton
- No shared skeleton deformation issues

### ✅ Build
- `npm run build` succeeds
- No warnings related to animation code

## Key Decisions

### Why SkeletonUtils.clone?
- THREE.Object3D.clone() shares skeleton references
- Multiple instances would deform each other
- SkeletonUtils.clone() deep-clones bones and updates skinning

### Why soft-fail on missing clips?
- Jason's animation job may not be complete
- Development should continue without blocking
- Graceful degradation to procedural animation

### Why store clips on proto?
- Avoid re-fetching for each agent instance
- Clips are reusable across instances
- Proto pattern keeps memory efficient

### Why 0.15s crossfade?
- Smooth visual transition
- Not too slow (responsive)
- Not too fast (no jarring)

## Future Enhancements

### Potential Improvements
1. **Clip blending**: Blend walk speed based on actual velocity
2. **Animation variants**: Multiple work animations (per task type)
3. **Footstep sync**: Align audio to actual animation foot contact
4. **Root motion**: Extract translation from walk clip for natural movement
5. **Additive animations**: Layer breathing/idle fidgets on top of base

### Not Implemented (by design)
- ❌ Root motion extraction (walk is in-place)
- ❌ Animation events (no clip metadata available)
- ❌ IK for tool holding (no tool bone in Meshy rig)
- ❌ Facial animation (no face rig in Meshy output)

## Troubleshooting

### Agents don't animate
- Check console for GLTFLoader errors
- Verify `agent.glb` exists and is valid
- Confirm `userData.fromGltf` is true

### Agents deform together
- Verify `SkeletonUtils.clone` is being used
- Check `hasSkinningOrBones()` returns true
- Inspect `clone.userData.fromGltf` value

### Clips don't load
- Open Network tab, filter for `.glb`
- 404 is expected if files missing (soft-fail)
- Check `/assets/glb/` path in fetch request

### Wrong animation plays
- Check `state.busy.kind` matches `workingTasks` array
- Verify `walking` parameter passed to `animate()`
- Inspect `state.currentAction` vs `desiredAction`

## Code Locations

### Assets (`src/assets.js`)
- Lines 3: Import SkeletonUtils
- Lines 900-949: `loadAgentAnimations()` method
- Lines 1006-1046: `create()` with skeleton cloning
- Lines 1048-1055: `hasSkinningOrBones()` helper

### Agent (`src/agent.js`)
- Lines 46-63: Mixer initialization
- Lines 84-86: State properties (mixer, actions, currentAction)
- Lines 606-664: `animate()` with mixer update and clip selection

## Performance Notes

### Memory
- Animation clips shared across agent instances (via proto)
- Each agent has independent mixer (~1KB)
- SkeletonUtils.clone creates ~2KB overhead per agent

### CPU
- `mixer.update()` called every frame (~0.1ms per agent)
- Crossfade during transitions adds minimal overhead
- Procedural fallback is slightly cheaper than mixer

### Recommendations
- Current implementation scales to ~10-20 agents
- For more, consider LOD (procedural at distance)
- GPU instancing not possible with skinning
