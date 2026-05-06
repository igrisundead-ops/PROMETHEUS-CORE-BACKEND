# Target Render Architecture

Date: 2026-05-05
Status: Target (enforcement plan)

## Canonical Flow

Source Video + Transcript
-> Segment Planner
-> Rhetorical Intent Detector
-> Typography Decision Engine
-> Font Compatibility Graph
-> Animation Retrieval Engine
-> Creative Judgment Engine
-> CreativeDecisionManifest
-> HyperFrames Composition Generator
-> Preview Render Worker
-> Preview Artifact URL
-> Frontend Player + Diagnostics

## Module Responsibilities

### 1) Ingestion Layer
- Accept source media and transcript inputs.
- Normalize transcript into segment + word timing structures.
- Persist media references and session metadata.
- No creative styling decisions.

### 2) Intelligence Layer
- Produce all creative decisions (typography, animation, layout, pacing).
- Resolve font pairing via compatibility graph.
- Resolve animation via Milvus retrieval or explicit fallback reason.
- Emit only `CreativeDecisionManifest`.
- No rendering or DOM generation.

### 3) Composition Layer
- Consume manifest only.
- Translate manifest into deterministic HyperFrames composition artifacts (HTML/CSS/GSAP).
- No Milvus queries.
- No transcript re-analysis.
- No independent font/animation choice.

### 4) Render Layer
- Render preview artifact (720p budget default) and final artifact (1080p/4k budget).
- Own render timing metrics and engine diagnostics.
- Expose adapter seam for local/Vast execution.

### 5) Frontend Layer
- Trigger preview job.
- Poll/subscribe for job state.
- Play artifact URL in standard player.
- Display diagnostics.
- No heavy creative overlay rendering by default.

### 6) Diagnostics Layer
- Report manifest + engine truth:
  - fontGraphUsed
  - milvusUsed
  - customFontsUsed
  - fallbackUsed + reasons
  - previewEngine
  - overlapCheckPassed
  - renderTimeMs / compositionGenerationTimeMs

## Interfaces

### CreativeDecisionManifest boundary
- Source of truth for every visible typography/motion/layout decision.
- Required before any composition generation.

### Composition generator boundary
- `generateHyperFramesComposition(manifest) -> composition bundle`
- Deterministic output for same manifest version + seed.

### Render adapter boundary
- `render(compositionDir, options) -> artifact + metrics`
- Implementations:
  - LocalHyperFramesRenderAdapter
  - VastHyperFramesRenderAdapter (placeholder)
  - LegacyRemotionRenderAdapter (quarantined)

## Seams and Adapters

- Seam A: Intelligence -> Composition
  - Interface: strict manifest schema + validator.
  - Adapter: temporary mapper from existing edit-session state into manifest (short-term bridge only).

- Seam B: Composition -> Render
  - Interface: render adapter.
  - Adapter: local execution now, Vast integration later.

- Seam C: Backend -> Frontend
  - Interface: preview job status payload with artifact URL + diagnostics.
  - Adapter: keep SSE transport, replace overlay payload with artifact contract.

## Failure Modes

1. Missing transcript timings
- Behavior: explicit fallback in diagnostics; no silent random pacing.

2. No compatible custom fonts
- Behavior: explicit fallback font reason; `fallbackUsed=true`.

3. Milvus retrieval unavailable
- Behavior: explicit animation fallback reason; record retrieval failure code.

4. Layout overlap risk
- Behavior: fail preview or auto-fix line plan, then record warnings.

5. Legacy renderer accidentally invoked
- Behavior: block by feature flag and emit diagnostics warning/error.

## Observability Requirements

- Per-job structured logs for stages:
  - manifest_generation
  - composition_generation
  - preview_render
- Required metrics:
  - `manifestGenerationMs`
  - `compositionGenerationMs`
  - `renderTimeMs`
- Required truth fields in preview response:
  - `previewEngine`
  - `manifestVersion`
  - `fontGraphUsed`
  - `milvusUsed`
  - `fallbackUsed`
  - `legacyOverlayUsed`
  - `remotionUsed`
  - `hyperframesUsed`

## Enforcement Rules

1. Frontend preview default must be artifact playback.
2. Browser live overlay paths are debug-only and off by default.
3. Remotion preview is quarantined and opt-in only.
4. Composition layer must not make creative decisions.
5. Any fallback must be explicit in diagnostics.
