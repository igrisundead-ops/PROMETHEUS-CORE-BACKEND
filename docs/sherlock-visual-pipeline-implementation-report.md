# Sherlock Visual Pipeline Implementation Report

## What was leaking authority
- `CreativeAudioLivePlayer` could still fall back to `NativePreviewStage` / `DisplayGodPreviewStage` / `RemotionPreviewPlayer` when artifact URL was missing.
- This allowed visible preview behavior outside strict manifest-artifact authority.

## What changed in this pass
- Removed Milvus startup authority from backend boot:
  - `AssetRetrievalService` no longer constructs a Zilliz/Milvus client during app startup.
  - client creation is now lazy at request time, so `/health` survives when Zilliz DNS or network is unavailable.
  - asset retrieval routes now return `503` for retrieval-unavailable/name-resolution failures instead of killing the backend process.
  - Files:
    - [service.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\assets\service.ts)
    - [routes.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\assets\routes.ts)
- Enforced artifact-first behavior in HyperFrames mode:
  - In non-debug mode, frontend no longer silently falls back to live overlay renderers when artifact is missing.
  - File: [CreativeAudioLivePlayer.tsx](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\remotion-app\src\web-preview\CreativeAudioLivePlayer.tsx)
- Made the render seam explicit about artifact reality:
  - backend now reports `previewArtifactKind` and `previewArtifactContentType`
  - current local HyperFrames adapter explicitly reports `html_composition`, not `video`
  - frontend now surfaces that distinction instead of silently treating every artifact as a finished video
  - Files:
    - [render-adapter.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\render\adapters\render-adapter.ts)
    - [local-hyperframes-render-adapter.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\render\adapters\local-hyperframes-render-adapter.ts)
    - [preview-render-service.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\render\preview-render-service.ts)
    - [service.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\edit-sessions\service.ts)
    - [types.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\edit-sessions\types.ts)
    - [render-diagnostics.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\contracts\render-diagnostics.ts)
- Added a real local preview video path for valid local media:
  - `LocalHyperFramesRenderAdapter` now attempts an FFmpeg-baked `preview-artifact.mp4`
  - the adapter burns manifest text into the frame and preserves source audio
  - if local source media is missing or FFmpeg render fails, the system falls back explicitly to HTML composition with warnings
  - Files:
    - [local-hyperframes-render-adapter.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\render\adapters\local-hyperframes-render-adapter.ts)
    - [preview-render-service.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\render\preview-render-service.ts)
    - [service.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\edit-sessions\service.ts)
- Connected manifest typography to real ingested font files:
  - manifest bridge now resolves requested or fallback custom fonts from `font-intelligence/outputs/font-manifest.json`
  - those file paths feed both composition proof and FFmpeg video burn-in
  - File: [font-file-resolver.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\typography\font-file-resolver.ts)
- Tightened render authority trace semantics:
  - `darkPreviewPathUsed` only true for active audio-only mode with dark flags.
  - `legacyOverlayUsed`/`frontendOverlayUsed` now reflect actual usage, not just flags.
  - File: [render-authority.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\render\render-authority.ts)
- Added font/animation proof plumbing into diagnostics:
  - Composition generator now emits proof payloads and `@font-face` blocks when file URLs exist in manifest.
  - Preview render service carries those proof payloads.
  - Session metadata stores proof payloads.
  - Preview diagnostics response now returns `fontProof` and `animationProof`.
  - Files:
    - [hyperframes-composition-generator.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\composition\hyperframes-composition-generator.ts)
    - [preview-render-service.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\render\preview-render-service.ts)
    - [service.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\edit-sessions\service.ts)
    - [render-diagnostics.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\contracts\render-diagnostics.ts)

## Black/dark preview findings
- No new forced black preview authority was introduced in this pass.
- Artifact iframe styling was changed away from forced black background in frontend artifact rendering.

## Audio-only fallback findings
- Video preview authority now reports and resists audio-only path when disabled by config.
- Added test coverage for this rule.

## Tests added/updated in this pass
- Added:
  - [render-authority.test.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\__tests__\render-authority.test.ts)
- Added:
  - [backend-startup.test.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\__tests__\backend-startup.test.ts)
    - proves health still comes up when Milvus retrieval is enabled but the host is unreachable
- Updated:
  - [preview-render-service.test.ts](C:\Users\HomePC\Downloads\HELP, VIDEO MATTING\backend\src\__tests__\preview-render-service.test.ts)
    - proves HTML fallback when no local source path exists
    - proves MP4 preview artifact generation when valid local source media exists
- Verified passing:
  - `hyperframes-composition-generator.test.ts`
  - `preview-render-service.test.ts`
  - `edit-session-live-preview-route.test.ts`
  - `edit-session-preview-manifest-route.test.ts`
  - `render-flags.test.ts`
  - `backend-startup.test.ts`
  - frontend `audio-creative-preview-session.test.ts`

## Remaining risks
- Frontend still contains legacy stage components for debug/dev fallback paths; they are no longer default authority in HyperFrames production mode, but code remains.
- Preview artifact is now conditionally real:
  - valid local source media can produce MP4 preview artifacts
  - invalid or non-local source paths still fall back to HTML composition
  - a full always-video render worker is still not complete for every source mode
- Manifest currently may include remote font URLs rather than guaranteed copied local assets; stronger asset-resolution/copy proof should be enforced next.
- Full playback integrity diagnostics (`artifactHasAudio`, duration parity, player mount count) still need broader end-to-end instrumentation.
- Backend `typecheck` still fails because it resolves into `remotion-app/src/lib/cinematic-typography/house-font-loader.tsx` without JSX enabled. This is a pre-existing cross-project TypeScript configuration issue, not a render-pipeline regression.

## Next moves
1. Add explicit `render-authority` enforcement in backend preview route that fails fast on forbidden mode combinations in development.
2. Enforce font file copy/link validation (not just declaration) with failing quality gate when custom font is required but unresolved.
3. Add end-to-end preview diagnostics for audio presence and playback stop reasons.
