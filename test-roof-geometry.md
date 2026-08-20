# Hut Roof Geometry Verification

## Configuration
- Wall height: `height = 1.8`
- Roof rise: `roofRise = 1.1`
- Half depth: `halfDepth ≈ 1.6` (depth/2 + overhang)
- Slope angle: `slopeAngle = atan2(1.1, 1.6) ≈ 0.606 rad ≈ 34.7°`

## Key Points (World Coordinates)
- **Ridge**: `(0, 2.9, 0)` — height + roofRise = 1.8 + 1.1
- **Back eave**: `(0, 1.8, -1.6)` — wall top at negative Z
- **Front eave**: `(0, 1.8, +1.6)` — wall top at positive Z

## Back Plane (z < 0)
- **Position**: `(0, 2.35, -0.8)` — midpoint between ridge and back eave
- **Rotation**: `rotation.x = -0.606` (negative angle)
- **Effect**: In Three.js, positive rotation.x rotates local +Z toward -Y (down)
  - With negative rotation, local +Z rotates toward +Y (up)
  - The box extends ±slopeLength/2 in local Z
  - Local +Z (toward ridge at z=0) goes UP ✓
  - Local -Z (toward eave at z=-1.6) goes DOWN ✓
- **Result**: Slopes upward from back eave toward ridge — CORRECT Λ

## Front Plane (z > 0)
- **Position**: `(0, 2.35, +0.8)` — midpoint between ridge and front eave
- **Rotation**: `rotation.x = +0.606` (positive angle)
- **Effect**: Positive rotation.x rotates local +Z toward -Y (down)
  - The box extends ±slopeLength/2 in local Z
  - Local +Z (toward eave at z=+1.6) goes DOWN ✓
  - Local -Z (toward ridge at z=0) goes UP ✓
- **Result**: Slopes upward from front eave toward ridge — CORRECT Λ

## Verification
✅ Ridge at y=2.9 is HIGHEST point (wall tops at y=1.8)
✅ Both planes slope UP toward center ridge
✅ Forms Λ (peak-up A-frame)
✅ NOT V (inverted valley)

## Constraints Met
- `npm run build` passes
- Building collision detection preserved
- Ridge height > wall height (conceptual assertion satisfied)
- Agent can still enter through doorway (geometry unchanged)
