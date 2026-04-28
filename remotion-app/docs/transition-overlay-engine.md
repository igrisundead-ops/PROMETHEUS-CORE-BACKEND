# Transition Overlay Engine

This pipeline uses overlay-based transition clips instead of hard timeline cuts.

## Asset Discovery

- Source assets live in the repo-level `TRANSITION/` folder.
- `scripts/transition-overlays-sync.ts` probes those files, assigns stable ids, and copies them into `public/transitions/`.
- The generated catalog is written to `src/data/transition-overlays.local.json`.

## Routing

- Landscape output uses assets tagged or inferred as `landscape`.
- Vertical output uses the non-landscape pool.
- Orientation is inferred from filename tags first, then normalized in the catalog.

## Timing

- Default overlay scale is `1.05`.
- Preferred effective duration is centered around `1.35-1.40s`.
- Hard maximum duration is `2.5s`.
- Long source clips are trimmed to a deterministic sub-window, so we do not play the full raw file by default.

## Rules

- Standard mode triggers on meaningful silence pockets and uses conservative spacing.
- Fast-intro mode allows denser overlay chaining for montage-style opens.
- Cooldowns and repetition penalties keep the same transition from repeating too often.
- If no valid asset or timing window is available, the engine fails closed and leaves the base video untouched.
