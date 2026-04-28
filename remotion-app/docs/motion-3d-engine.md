# 3D Motion Layering Engine

This module adds a selective 3D camera + depth system intended for premium motion-graphics overlays.
It is not a game scene. Most motion remains 2D with GSAP timelines; Three.js is used only where depth staging matters.

The current implementation now sits under a choreography layer:
- scene kinds resolve to authored presets
- 2D overlay timing and 3D depth timing share one planned timeline
- native preview uses a preview-safe approximation instead of full Three.js parity

## Where it lives
- `src/lib/motion-3d/` contains the planner, config, and runtime.
- `src/lib/motion-platform/choreography-planner.ts` contains the scene choreography registry and timeline planner.
- `src/components/Motion3DOverlay.tsx` renders the 3D overlay layer.
- `src/components/MotionChoreographyOverlay.tsx` renders the authored headline/subtext choreography layer.
- `src/Root.tsx` contains a demo composition: `Cinematic3DDemo`.

## How assets are discovered
The 3D planner builds layers from the existing motion scene assets:
- It samples a small number of scene assets.
- Placement zones map to depth tiers: background, mid, foreground.
- A text layer is optionally created from the scene's chunk text.

## Aspect ratio routing
The 3D engine takes the video metadata dimensions and places layers in pixel space.
It is agnostic to orientation, because the camera and planes are sized directly to the output width/height.

## Trimming and timing
The 3D overlay is scoped to the active scene window. The timeline seeks to the local scene time based on the Remotion frame.

## Motion rules
- Camera moves are subtle by default.
- Parallax is applied via depth-based drift.
- Text layers remain readable (minimal tilt, minimal skew).
- Depth-worthy layers can move in Three.js while flat layers stay in 2D.
- Preview-safe stage transforms should feel directionally identical even when rendered without WebGL.

## Usage
Enable 3D per composition:

```tsx
<Composition
  id="Cinematic3DDemo"
  component={FemaleCoachDeanGraziosi}
  width={1080}
  height={1920}
  fps={30}
  durationInFrames={900}
  defaultProps={{
    motion3DMode: "showcase"
  }}
/>
```

Available modes: `off`, `editorial`, `showcase`.

## Extending
- Add new camera presets in `src/lib/motion-3d/motion-3d-runtime.ts`.
- Adjust depth defaults in `src/lib/motion-3d/motion-3d-config.ts`.
- Extend choreography scene rules in `src/lib/motion-platform/choreography-planner.ts`.
- Extend planner logic in `src/lib/motion-3d/motion-3d-planner.ts` for which choreography targets should receive real depth treatment.
