# Mixamo Rig and Animation Notes

## Skeleton Structure

The Meshy-generated agent uses a **24-joint Mixamo rig**:

### Joint Hierarchy
```
Hips (root)
├── Spine
│   ├── Spine01
│   │   └── Spine02
│   │       ├── neck
│   │       │   └── Head
│   │       │       ├── head_end
│   │       │       └── headfront
│   │       ├── LeftShoulder
│   │       │   └── LeftArm
│   │       │       └── LeftForeArm
│   │       │           └── LeftHand
│   │       └── RightShoulder
│   │           └── RightArm
│   │               └── RightForeArm
│   │                   └── RightHand
├── LeftUpLeg
│   └── LeftLeg
│       └── LeftFoot
│           └── LeftToeBase
└── RightUpLeg
    └── RightLeg
        └── RightFoot
            └── RightToeBase
```

### Joint Count: 24
- **Torso**: Hips, Spine, Spine01, Spine02 (4)
- **Head**: neck, Head, head_end, headfront (4)
- **Left Arm**: LeftShoulder, LeftArm, LeftForeArm, LeftHand (4)
- **Right Arm**: RightShoulder, RightArm, RightForeArm, RightHand (4)
- **Left Leg**: LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase (4)
- **Right Leg**: RightUpLeg, RightLeg, RightFoot, RightToeBase (4)

## Animation Clips

### File Structure
Each companion GLB is a **full skinned character** (~9.5MB) with:
- Complete mesh and materials (same as agent.glb)
- Full skeleton (24 Mixamo joints)
- One animation clip (72 channels = 24 joints × 3 transform tracks)

### Clip Names (Mixamo Format)
- **agent-idle.glb**: `Armature|Idle|baselayer`
- **agent-walk.glb**: `Armature|Casual_Walk_inplace|baselayer`
- **agent-work.glb**: `Armature|Collect_Object|baselayer`

### Usage Pattern
```javascript
// Companion GLBs are clip donors only
// Load animations, discard mesh
const gltf = await loader.parseAsync(buffer);
if (gltf.animations && gltf.animations.length > 0) {
  clips[role] = gltf.animations; // Keep only animations
}
// Do NOT add gltf.scene to the world
```

## Implementation Details

### Skeleton Cloning
```javascript
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

// For each agent instance (Ava and Bo)
const clone = skeletonClone(proto);
// Each clone gets independent skeleton with same 24 joints
```

### Why SkeletonUtils.clone?
- `Object3D.clone()` shares skeleton references
- Multiple agents would deform each other
- `skeletonClone()` deep-clones bones and updates skinning
- Result: Ava and Bo have independent skeletons

### Animation Mixer Setup
```javascript
const mixer = new THREE.AnimationMixer(group);
const clips = group.userData.animationClips;

// Create actions for each role
for (const [role, clipArray] of Object.entries(clips)) {
  const action = mixer.clipAction(clipArray[0]);
  action.setLoop(THREE.LoopRepeat);
  actions[role] = action;
}
```

### Channel Count
Each clip has **72 channels**:
- 24 joints × 3 tracks per joint (position, rotation, scale)
- Mixamo typically animates position on root (Hips) only
- Most joints use rotation only
- Scale rarely animated (usually identity)

## Animation Playback

### State Mapping
- **walking** → `actions.walk` (Casual_Walk_inplace)
- **busy (working tasks)** → `actions.work` (Collect_Object)
  - eat, forage, gather, process, build, combine, hunt, tend
- **otherwise** → `actions.idle` (Idle)

### Crossfade Duration
```javascript
const fadeTime = 0.15; // 150ms
previousAction.fadeOut(fadeTime);
newAction.reset().fadeIn(fadeTime).play();
```

### Fallback Chain
```javascript
if (!state.actions[desiredAction]) {
  if (state.actions.idle) desiredAction = 'idle';
  else if (state.actions.walk) desiredAction = 'walk';
  else desiredAction = Object.keys(state.actions)[0];
}
```

## Performance Notes

### Memory
- **Base mesh**: ~5.5MB (agent.glb)
- **Per companion**: ~9.5MB (includes duplicate mesh + clip)
- **Clips shared**: All agent instances use same clip references
- **Per agent overhead**: ~2KB (mixer + skeleton)

### CPU
- **Mixer update**: ~0.1ms per agent per frame
- **72 channels**: Modern CPU handles easily
- **Crossfade**: Minimal overhead during transition
- **Recommendation**: 10-20 agents comfortable on typical hardware

## Troubleshooting

### Clip Not Playing
1. Check clip name matches exactly (case-sensitive)
2. Verify `mixer.update(dt)` is called every frame
3. Confirm `action.play()` was called
4. Check action weight > 0

### Skeleton Deformation Issues
1. Verify using `skeletonClone()` not `clone()`
2. Check `hasSkinningOrBones()` returns true
3. Inspect each agent has unique skeleton UUID

### Missing Animations
1. Check Network tab for 404 on companion GLBs
2. Verify soft-fail works (game still boots)
3. Fallback to procedural animation should activate

### Performance Issues
1. Check mixer count (one per agent)
2. Verify clips are shared (not cloned per agent)
3. Consider LOD for distant agents
4. Profile `mixer.update()` calls

## Future Enhancements

### Potential Improvements
1. **Root motion extraction**: Use Hips translation for natural movement
2. **Animation blending**: Blend walk speed based on velocity
3. **Additive layers**: Breathing, head look-at, item holding
4. **State variants**: Multiple work animations per task type
5. **Transition matching**: Smart pose matching for smoother transitions

### Mixamo Limitations
- **No facial animation**: Head bones don't have blend shapes
- **No IK**: No inverse kinematics for tool holding
- **Limited customization**: Pre-baked animations only
- **File size**: Each companion is full character (~9.5MB)

### Optimization Options
- **Strip mesh from companions**: Extract clips only (~500KB each)
- **Quantize animations**: Reduce precision for smaller files
- **Merge clips**: Single GLB with multiple clips
- **Procedural IK**: Add tool-holding layer on top
