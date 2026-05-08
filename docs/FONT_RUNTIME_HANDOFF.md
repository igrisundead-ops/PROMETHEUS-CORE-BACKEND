# Prometheus Font Runtime Handoff

## Current Status
- **Current Branch**: `phase1-font-hydration`
- **Verification Status**: Phase 2B-2A Fully Verified

## Phase Summaries

### Phase 1: Font Hydration + Manifest
- **Hydration**: 20 premium font binaries extracted from `FONTS/` into `remotion-app/public/fonts/library/`.
- **Manifest**: `font-manifest-urls.json` generated with relative paths, `publicUrl` mapping, and content hashes.
- **Portability**: All paths are relative to the repo root/manifest; no absolute Windows paths remain.

### Phase 2A: Runtime Registry + @font-face Bridge
- **Registry**: New manifest-backed registry created in `remotion-app/src/lib/font-intelligence/font-runtime-registry.ts`.
- **Bridge**: Created `font-runtime-loader.tsx` to dynamically inject `@font-face` rules using the browser `FontFace` API.
- **Aliasing**: All manifest fonts use deterministic CSS aliases (e.g., `__prometheus_font_family_aesthetic_e6b80b03`) to prevent name collisions.

### Phase 2B-1: Renderable Font Bridge Proof Subset
- **Bridge**: Introduced `runtime-font-bridge.ts` to map doctrine candidate IDs to manifest records.
- **Proof**: Manually added `manifest-aesthetic`, `manifest-amerika`, and `manifest-antenna` to the doctrine to prove the selector could "see" them.

### Phase 2B-1.5: Removed Hidden Proof Defaults
- **Cleanup**: Deleted `PHASE_2A_PROOF_RUNTIME_FONT_ID` defaults from production bootstrap paths.
- **Debugging**: Injected `debugSelectedFontId` and `debugSelectedFont` props to compositions for explicit local proofing.
- **Automatic Priority**: The system now defaults to the automatic selector; manual overrides are strictly for debug.

### Phase 2B-2A: Dynamic Manifest Candidates
- **Generalization**: Removed hardcoded proof definitions.
- **Dynamic Discovery**: The bridge now iterates over the entire manifest to create "Virtual Candidates" (`manifest-family_<familyId>`).
- **Heuristics**: Injected name-based heuristics (Script/Sans/Serif patterns) to assign provisional roles to hydrated fonts.
- **Selector Integration**: The selector now automatically merges these 20 dynamic candidates into the selection pool.

## Runtime Architecture

### Selection Path
1. **Context**: `resolveCaptionEditorialDecision` (editorial-engine.ts)
2. **Selector**: `selectRuntimeFontSelection` (runtime-font-selector.ts)
3. **Registry Hook**: `getRuntimePaletteIdForTypographyCandidate` checks the **Manifest Bridge** first.
4. **Resolution**: If a `manifest-family_*` ID is matched, it returns a manifest-backed palette.
5. **Rendering**: The `CinematicCaptionOverlay` receives the deterministic CSS alias and applies it. `RuntimeFontLoader` ensures the binary is active in the browser.

### Commands
- **Smoke Test**: `cd remotion-app && npx tsx scripts/font-smoke-test.ts`
- **Typecheck**: `cd remotion-app && npm run typecheck`
- **Local Preview**: `cd remotion-app && npm run dev`

## Known Risks & Gaps
1. **Browser Render Proof**: Playwright is not available in the repo. Smoke tests verify path/CSS integrity but cannot prove final pixel-level rendering.
2. **Provisional Role Mapping**: Manifest fonts are assigned roles via simple name-matching (e.g., "Gothic" -> Sans). This needs refinement in Phase 2B-2B.
3. **Duplicate Registries**: `cinematic-typography` and `font-intelligence` both have registry files. They are bridged but not yet merged.
4. **Weight/Style Integrity**: The selector does not yet penalize fonts for missing exact weights (e.g., requesting 700 but using hydrated 400).
5. **Static Backend**: The backend `pipeline.ts` does not yet pass a `fontId` in the payload; the frontend selector is currently doing all the "thinking."

## What Not To Touch
- `backend/src/*`: The backend is currently decoupled from this font work.
- `VectorRetrievalService`: Do not wire this into the live render path until manifest scoring (2B-2B) is done.
- `motion-plan.ts`: Do not alter motion logic until typography stability is confirmed.

## Recommended Next Step
**Local Visual Preview**: Perform a manual visual verification in a local browser to ensure the deterministic aliases correctly load the hydrated binaries during preview. Once visual stability is confirmed, proceed to **Phase 2B-2B: Manifest-Aware Scoring & Weight Integrity**.
