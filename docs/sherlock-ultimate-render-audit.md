# Sherlock Ultimate Render Audit

Date: 2026-05-05
Scope: frontend `remotion-app/src/web-preview/*`, backend `backend/src/edit-sessions/*`, preview runner `backend/src/local-preview-runner.ts`, related render/typography/motion modules.

## A) What happens when user clicks preview?

Observed active live-preview path (`speed-draft`):

1. Frontend click path
- UI renders `Refresh Live Preview` in `remotion-app/src/web-preview/PreviewApp.tsx`.
- `PreviewApp` mounts `CreativeAudioLivePlayer` when delivery mode is `speed-draft` and run id increments.

2. Frontend request path
- `CreativeAudioLivePlayer` posts to `POST /api/edit-sessions/live-preview`.
- It then opens SSE `/api/edit-sessions/:id/events` and fallback-polls `/api/edit-sessions/:id/status`.
- It separately polls `/api/edit-sessions/:id/preview-manifest` every ~1200ms.

3. Backend session path
- Route: `backend/src/edit-sessions/routes.ts` handles `/api/edit-sessions/live-preview`.
- It creates session -> completes upload metadata -> calls `manager.startPreview(...)`.

4. Backend preview worker path
- `EditSessionManager.startPreview` in `backend/src/edit-sessions/service.ts` prepares placeholder state and launches worker.
- `runPreviewWorker` streams AssemblyAI realtime transcript and promotes preview text.
- Preview text is built locally by `splitPreviewLines(...)` and motion cues by `buildMotionSequence(...)` with fixed animations (`fade_up`, `type_lock`, `soft_push`).

5. Frontend render path (interactive)
- If source has video: browser plays native `<video>` and overlays one of:
  - `DisplayGodPreviewStage` (hyperframes-labeled path), or
  - `NativePreviewStage`, or
  - `RemotionPreviewPlayer` if renderer toggle is set to remotion.
- If no video: fallback to audio creative preview component.

6. Export path
- Final render route uses render driver backed by `LocalPreviewRunner`.
- `LocalPreviewRunner` executes scripts in `remotion-app/scripts/*` (`draft-preview-longform.ts`, `master-render-longform.ts`).

Conclusion: current "live preview" is primarily browser playback + live overlay composition, not server-rendered preview artifact.

## B) What render/preview systems exist?

Confirmed systems present:

- Hyperframes-labeled interactive lane:
  - `DisplayGodPreviewStage`, `HyperframesPreview`, manifest schema in `remotion-app/src/web-preview/hyperframes/*`.
- Native overlay lane:
  - `NativePreviewStage`, `CreativeLiveAudioPreview`, in-browser timeline + overlay rendering.
- Remotion interactive compare lane:
  - `RemotionPreviewPlayer` toggled from UI.
- Remotion offline render lane:
  - `LocalPreviewRunner` calls TS scripts for draft/master MP4.
- Edit-session preview manifest:
  - `schemaVersion: hyperframes-preview-manifest/v1`, includes lanes + overlayPlan.

Also present in repo:
- Large motion platform + semantic planners + fallback engines under `remotion-app/src/lib/motion-platform/*`.
- Font intelligence and compatibility graph modules under `remotion-app/src/lib/cinematic-typography/*` and `font-intelligence/*`.
- Milvus/vector services in backend asset retrieval routes.

## C) What is the active path?

Active default interactive path now:
- `PreviewApp` defaults renderer to `hyperframes` lane label, but runtime still composes overlays in browser above native video.
- Backend returns preview state/manifest; frontend builds timeline locally and renders overlays live.

Active export path:
- Remotion scripts via `LocalPreviewRunner` (draft/master MP4) remain active and authoritative for final render.

## D) What is dead or legacy?

Not fully dead, but clearly legacy/duplicate/quarantine candidates:

- Duplicate interactive renderers coexisting:
  - `DisplayGodPreviewStage` vs `NativePreviewStage` vs `RemotionPreviewPlayer`.
- Manifest advertises both interactive lanes (`hyperframes`, `remotion`) in active schema.
- Legacy/offline render dependency still routed through Remotion scripts for both draft and master.
- Multiple caption/overlay systems in `web-preview` and `motion-platform` coexist with overlapping responsibilities.
- Numerous fallback-heavy motion/typography modules likely exceed current active path needs.

## E) What is bypassing intelligence?

Confirmed bypasses in active preview flow:

1. Font graph bypass in live preview path
- `runPreviewWorker` does not call font compatibility graph; it generates lines/cues directly.
- Web preview CSS and stages contain hardcoded families (e.g. DM Sans / DM Serif / Playfair fallbacks).

2. Milvus animation retrieval bypass in live preview path
- Active preview cue generation uses fixed animation family mapping in `buildMotionCue`.
- No required Milvus retrieval call in edit-session preview path.

3. Manifest authority gap
- Current preview manifest is transport + overlay payload, not strict CreativeDecisionManifest.
- Composition layer still makes decisions client-side from session state.

4. Fallback behavior not centralized in diagnostics contract
- Fallbacks exist across modules, but active preview response does not provide a single strict diagnostics truth set for font-graph used / milvus used / fallback reason.

## F) What causes quality failure?

Likely primary contributors (confirmed by code shape):

- Subtitle-like line splitting (`splitPreviewLines`) instead of rhetorical typography planning.
- Fixed small animation set (`fade_up`, `type_lock`, `soft_push`) reused frequently.
- Multiple overlay engines can produce inconsistent visual grammar.
- Hardcoded font stacks in preview CSS/stages can override richer custom font intent.
- Frontend-side timeline assembly introduces inconsistency between data and composition.

## G) What causes performance failure?

Likely primary contributors (confirmed by architecture):

- Heavy live browser overlay composition while video plays.
- Repeated polling and state-driven rebuild cycles in `CreativeAudioLivePlayer`.
- Multiple potential stage fallbacks in same interactive runtime.
- Manifest polling interval (~1200ms) + SSE + status polling complexity.
- Frontend doing composition work that should be backend/render-worker owned.

## H) What should be removed, quarantined, or kept?

### KEEP
- `backend/src/edit-sessions/routes.ts` and store/session scaffolding (good seam).
- SSE/session status transport concept.
- Existing font intelligence, compatibility graph, vector retrieval modules as capabilities.
- `LocalPreviewRunner` only as temporary adapter while new render seam is introduced.

### REWRITE
- Preview manifest contract -> strict CreativeDecisionManifest.
- Preview worker logic to stop hardcoded line/animation decisions and consume intelligence outputs.
- Frontend preview runtime to artifact player + diagnostics-first workflow.

### QUARANTINE
- Interactive remotion preview toggle in `PreviewApp` + `RemotionPreviewPlayer`.
- Native overlay fallback stages (`NativePreviewStage`) as debug-only behind explicit flag.
- DisplayGod fallback routing, only enabled for debug experiments.

### DELETE AFTER TESTS
- Duplicate caption render paths once manifest-driven HyperFrames composition generator and preview artifact path are stable.
- Unused hardcoded font-combo modules in active preview path.

### DELETE NOW ONLY IF DEFINITELY DEAD
- None yet. Current codebase still references most paths directly or indirectly.

---

## High-confidence architectural verdict

Current system has depth but low locality:
- Intelligence modules exist, but active preview path has shallow direct implementations for core visual decisions.
- Interface seam between intelligence and composition is weak (no strict manifest authority).
- Multiple renderer implementations reduce leverage and increase split-brain behavior.

The next step is to enforce one interface boundary:
- `CreativeDecisionManifest` as the only allowed creative decision carrier,
- then isolate composition to HyperFrames generator,
- then move preview to server-rendered artifact response.
