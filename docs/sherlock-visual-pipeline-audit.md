# Sherlock Visual Pipeline Audit

Date: 2026-05-05  
Scope: `backend/src/*`, `remotion-app/src/web-preview/*`, related preview/render lanes.

## Executive Summary

The visible preview path is currently split between:
- a new backend artifact lane (HyperFrames composition served via `/preview-artifact`)
- and legacy/live browser compositor lanes (native overlay, display-god timeline, historical audio-first session builder).

This split creates authority leaks:
- old live overlay logic still exists and can run when artifact is unavailable
- audio-preview support logic is still present in the same runtime component as video preview
- dark-themed styling from legacy preview shells/components still appears in fallback UI
- frontend still contains logic to build/advance timeline sessions in browser (not manifest-only renderer behavior)
- the so-called preview artifact is still HTML served in an iframe, not a rendered MP4/WebM preview video

## Architecture framing

The highest-friction module is `CreativeAudioLivePlayer`.
Its interface suggests a single governed preview lane, but its implementation still multiplexes:
- artifact display
- manifest polling
- native video stage fallback
- remotion fallback
- display-god fallback
- audio-only fallback

This is a shallow module with too much hidden authority. The deletion test fails badly here: deleting it would reveal several competing preview systems, not one deep seam.

## 1) Exact path when clicking video preview

Current default UX (`PreviewApp`, speed-draft lane):
1. `remotion-app/src/web-preview/PreviewApp.tsx` mounts `CreativeAudioLivePlayer`.
2. `CreativeAudioLivePlayer` posts to `POST /api/edit-sessions/live-preview`.
3. Backend `edit-sessions/routes.ts` -> `EditSessionManager.startPreview(...)`.
4. Backend builds session + transcript/preview state and now also attempts artifact generation (`ensurePreviewArtifact`).
5. Frontend polls:
   - `/api/edit-sessions/:id/status` (SSE/poll fallback)
   - `/api/edit-sessions/:id/preview-manifest`
   - `/api/edit-sessions/:id/preview` (for `previewArtifactUrl`)
6. If `previewArtifactUrl` exists, frontend renders iframe artifact (`/api/edit-sessions/:id/preview-artifact`).
7. If artifact not ready, frontend may fallback to legacy live compositor stages.

Important correction:
- `/preview-artifact` is currently an HTML composition document, not a baked preview video.
- The frontend therefore still depends on browser composition behavior instead of playing a finished render artifact.

## 2) Exact path when clicking audio preview

Audio-only support path is still in active code:
- `CreativeAudioLivePlayer` can resolve separate audio source from `/api/local-preview/audio-preview`.
- If no video src is resolved, it can render `CreativeLiveAudioPreview` (audio-driven timeline surface).
- `CreativeLiveAudioPreview` owns an `<audio>` element + playback loop + dark-themed stage.

## 3) Is video preview accidentally falling back to audio preview logic?

Yes, potentially.
- In `CreativeAudioLivePlayer`, if no native video src and no artifact, terminal fallback returns `<CreativeLiveAudioPreview .../>`.
- This means video-intended runs can still traverse audio-preview runtime behavior under source/availability conditions.

## 4) Where is black/dark background being forced?

Multiple places:
- `CreativeAudioLivePlayer` loading/error shells use dark gradient backgrounds.
- `CreativeLiveAudioPreview` defines many dark gradients (`stageRootStyle`, `backgroundStyleMap`, HUD/control backgrounds).
- `NativePreviewStage` and overlay visual layers contain dark veils/gradients.
- Artifact iframe container currently sets dark background.

Conclusion: dark styling is still implementation-driven, not solely manifest-driven.

## 5) Which module decides to render text?

Currently multiple:
- Backend `EditSessionManager.runPreviewWorker` produces `previewLines`/`previewMotionSequence` (now via decision engines but still state-derived).
- Frontend legacy paths (`NativePreviewStage`, `DisplayGod` timeline transforms) render text overlays from session state.
- Artifact path renders text from manifest line plan via HyperFrames composition generator.

Authority is not singular yet.

Manifest seam problem:
- `getPreviewManifest` still returns `overlayPlan` derived from session state.
- That means the frontend-facing interface still exposes non-manifest text data even though the intended seam is `CreativeDecisionManifest -> rendered artifact`.

## 6) Which module decides font?

Current effective decisions:
- Backend manifest bridge hardcodes primary/secondary families in `buildCreativeDecisionManifest` (temporary bridge).
- Legacy frontend overlay systems still apply their own typography styles.
- Artifact generator uses manifest primary family, but font proof/loading is incomplete (no robust file-resolved `@font-face` flow yet).

## 7) Which module decides animation?

Multiple:
- Backend `AnimationRetrievalEngine` now selects animation family for preview motion sequence.
- Legacy frontend overlay renderers (`NativePreviewStage`, live timeline) still execute animation behavior independently.
- Artifact generator currently uses CSS keyframe reveal; not yet GSAP timeline generated strictly from manifest animation block.

This means the animation retrieval module exists, but its leverage is weak because the composition module does not yet deeply obey it.

## 8) Which module decides background?

Mostly frontend legacy rendering components currently:
- `CreativeLiveAudioPreview` background maps and stage styles
- `NativePreviewStage` veil/gradient logic
- `CreativeAudioLivePlayer` shell overlays
- Artifact path has own composition background too

Manifest does not yet fully own global background authority.

## 9) Which module controls audio playback?

- `CreativeLiveAudioPreview` controls `<audio>`: play/pause/seek/timeupdate/onended.
- `CreativeAudioLivePlayer` resolves audio source and status for fallback paths.
- Artifact iframe path currently defers playback behavior to artifact media element(s) in HTML composition.

## 10) Which module controls video playback?

- Legacy: `NativePreviewStage` / `RemotionPreviewPlayer` via local `<video>` control loops.
- Artifact path: composition `index.html` video element.
- `CreativeAudioLivePlayer` chooses which surface renders.

## 11) Multiple video/audio elements fighting each other?

Risk exists:
- `CreativeAudioLivePlayer` can build/use direct browser video, session video source, separate audio source.
- Legacy audio preview has dedicated `<audio>`.
- Native preview stages also manage video/overlay media elements.
- Artifact iframe may contain its own video while legacy state loops still run in parent component lifecycle.

The real issue is not just count, but seam confusion:
- parent React module owns preview state and transport concerns
- child fallback modules own playback
- artifact document owns its own playback

There is no single playback authority module yet.

## 12) Multiple transcript/text renderers running at once?

Potentially yes in fallback windows:
- backend state has `previewLines`
- legacy overlay text renderer(s) can run
- artifact text renderer can run once URL available

Not fully single-renderer-authority yet.

## 13) Frontend rendering text outside manifest?

Yes.
- Legacy preview stages render text from session/state/timeline structures.
- Not every visible text layer is yet manifest-only.

## 14) Backend fallback generating text outside manifest?

Yes (bridge state still exists).
- `runPreviewWorker` builds preview text/lines/motion state during transcript streaming.
- Manifest is derived from session state, not yet the sole upstream source.

## 15) Any old caption path still active?

Yes.
- `NativePreviewStage` and related web-preview timeline systems remain active fallback/runtime options.

## 16) Any Remotion path still active by default?

Default is now HyperFrames-labeled path, and remotion interactive is gated by backend lanes.
But remotion code remains present and can activate when explicitly enabled.

## 17) Any old dark preview path still active by default?

Yes, for loading/error/fallback shells and audio-first components.

## 18) Is HyperFrames truly used for visible preview?

Partially:
- Artifact route + iframe path uses HyperFrames composition artifact.
- But legacy non-artifact fallback paths are still in component, so HyperFrames is not yet exclusive authority.
- Even in the HyperFrames path, the backend currently serves HTML composition as the artifact, not a rendered video file.

## 19) Are custom fonts actually loaded into final visible composition?

Not proven end-to-end yet.
- Manifest carries font names.
- Composition generator uses family names.
- `@font-face` generation exists only if `fileUrl` is present in manifest, but the bridge manifest currently hardcodes families without resolving actual font files.
- Robust font file resolution/proof (`@font-face` from resolved custom font file assets with diagnostics) is still incomplete.

## 20) Are animation embeddings connected to visible animations?

Partially.
- Backend animation decision engine exists and is wired for preview state decisions.
- But artifact generator currently uses static CSS reveal and does not yet prove GSAP timeline from retrieved animation ID/family.

## Preview artifact reality check

The current `RenderAdapter` seam is misleading:
- `LocalHyperFramesRenderAdapter` returns `index.html` as `localPath`.
- `/api/edit-sessions/:id/preview-artifact` serves that HTML with `text/html; charset=utf-8`.
- Frontend renders it in an `<iframe>`.

So the current pipeline is:

Video + transcript
-> preview state bridge
-> manifest bridge
-> HyperFrames HTML composition
-> iframe in frontend

It is not yet:

Video + transcript
-> manifest
-> HyperFrames render worker
-> MP4/WebM preview artifact
-> frontend video player

## Authority Leak Findings (Primary)

1. `CreativeAudioLivePlayer` still contains both artifact-first flow and legacy live compositor logic.
2. The render adapter seam lies about what an artifact is: HTML composition is being treated as if it were a preview video.
3. Audio-preview modules remain in same runtime path as video preview.
4. Dark preview styling is embedded in shell/fallback components.
5. Composition generator currently does not yet prove custom-font file loading and GSAP-from-manifest execution.
6. Manifest is still partly a bridge generated from session state rather than the sole creative origin.

## Proposed deepening opportunities

1. Deepen the preview artifact module
- Files: `backend/src/render/*`, `backend/src/edit-sessions/service.ts`, `routes.ts`
- Problem: the current interface says "preview artifact" but the implementation returns HTML composition.
- Solution: make the seam honest by splitting `composition artifact` from `rendered preview video artifact`, then require the frontend production path to use only the rendered video artifact.
- Benefits: more leverage at the render seam, clearer diagnostics, better locality for playback bugs.

2. Deepen the frontend preview player module
- Files: `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx`, related preview stages
- Problem: one module multiplexes several authorities and fallback trees.
- Solution: create a production `PreviewArtifactPlayer` interface with one responsibility: poll preview job, receive video artifact, play one video element, show diagnostics.
- Benefits: much better locality, lower playback complexity, easy test seam for "one player only".

3. Deepen the manifest generation module
- Files: `backend/src/edit-sessions/service.ts`, `backend/src/typography/*`, `backend/src/animation/*`
- Problem: manifest values are still partly hardcoded in the bridge.
- Solution: move font, line plan, core words, animation timing, and fallback reasoning fully behind dedicated modules whose interface returns manifest-ready decisions.
- Benefits: stronger leverage from the intelligence modules and fewer hidden decisions in session orchestration.

## Keep / Quarantine Recommendations

KEEP:
- Backend manifest contract + render flags + render adapter seam + artifact route.
- Typography/animation decision engines.

QUARANTINE:
- `CreativeLiveAudioPreview` for production video preview.
- `NativePreviewStage` fallback in production mode.
- Remotion interactive path unless explicitly enabled.

REWRITE:
- HyperFrames generator to emit font proof + animation proof diagnostics.
- Frontend player to single artifact player in production mode (one media authority).
- Render adapter seam to distinguish HTML composition from actual rendered preview video.

DELETE AFTER TESTS:
- duplicate live text overlay surfaces once artifact-only path is stable.
