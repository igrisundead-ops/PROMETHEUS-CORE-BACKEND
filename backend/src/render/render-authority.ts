import type {RenderConfig} from "../config/render-flags";

export type PreviewModeRequested = "video_preview" | "audio_only_preview";
export type RenderEngine = "hyperframes" | "remotion";

export type PipelineTrace = {
  jobId: string;
  previewModeRequested: PreviewModeRequested;
  previewModeActuallyUsed: PreviewModeRequested;
  renderEngineRequested: RenderEngine;
  renderEngineActuallyUsed: RenderEngine;
  oldFallbackTriggered: boolean;
  fallbackReason: string | null;
  audioOnlyPathUsed: boolean;
  darkPreviewPathUsed: boolean;
  legacyOverlayUsed: boolean;
  remotionUsed: boolean;
  hyperframesUsed: boolean;
  manifestUsed: boolean;
  textRendererUsed: "manifest_artifact" | "legacy_overlay" | "none";
  fontSelectorUsed: "typography_decision_engine" | "legacy_frontend" | "none";
  animationSelectorUsed: "animation_retrieval_engine" | "legacy_frontend" | "none";
  frontendOverlayUsed: boolean;
  backendCompositionUsed: boolean;
  videoElementCount: number;
  audioElementCount: number;
};

export const resolveRenderAuthority = ({
  jobId,
  previewModeRequested,
  renderConfig,
  artifactAvailable
}: {
  jobId: string;
  previewModeRequested: PreviewModeRequested;
  renderConfig: RenderConfig;
  artifactAvailable: boolean;
}): PipelineTrace => {
  const renderEngineRequested: RenderEngine = renderConfig.PREVIEW_ENGINE;
  const remotionAllowed = renderConfig.ENABLE_REMOTION_PREVIEW && renderEngineRequested === "remotion";
  const renderEngineActuallyUsed: RenderEngine = remotionAllowed ? "remotion" : "hyperframes";

  const illegalAudioOnlyForVideo = previewModeRequested === "video_preview" && renderConfig.ENABLE_AUDIO_ONLY_PREVIEW === false;
  const previewModeActuallyUsed: PreviewModeRequested = illegalAudioOnlyForVideo ? "video_preview" : previewModeRequested;

  const oldFallbackTriggered = !artifactAvailable;
  const fallbackReason = artifactAvailable ? null : "preview_artifact_unavailable";
  const darkPreviewPathUsed = previewModeActuallyUsed === "audio_only_preview"
    && (renderConfig.ENABLE_DARK_AUDIO_PREVIEW || renderConfig.ENABLE_BLACK_PREVIEW_BACKGROUND);
  const legacyOverlayUsed = !artifactAvailable && renderConfig.ENABLE_LIVE_BROWSER_OVERLAY;

  return {
    jobId,
    previewModeRequested,
    previewModeActuallyUsed,
    renderEngineRequested,
    renderEngineActuallyUsed,
    oldFallbackTriggered,
    fallbackReason,
    audioOnlyPathUsed: previewModeActuallyUsed === "audio_only_preview",
    darkPreviewPathUsed,
    legacyOverlayUsed,
    remotionUsed: renderEngineActuallyUsed === "remotion",
    hyperframesUsed: renderEngineActuallyUsed === "hyperframes",
    manifestUsed: true,
    textRendererUsed: artifactAvailable ? "manifest_artifact" : legacyOverlayUsed ? "legacy_overlay" : "none",
    fontSelectorUsed: "typography_decision_engine",
    animationSelectorUsed: "animation_retrieval_engine",
    frontendOverlayUsed: legacyOverlayUsed,
    backendCompositionUsed: true,
    videoElementCount: artifactAvailable ? 1 : 0,
    audioElementCount: 0
  };
};
