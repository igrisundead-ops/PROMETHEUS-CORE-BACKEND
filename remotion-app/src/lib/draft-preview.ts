import type {
  CaptionStyleProfileId,
  CaptionVerticalBias,
  MotionGradeProfileId,
  MotionMatteMode,
  MotionTier,
  VideoMetadata
} from "./types";

export const LONGFORM_DRAFT_COMPOSITION_ID = "MaleHeadVideoLongFormDraft";
export const LONGFORM_DRAFT_VIDEO_ASSET = "input-video-landscape.draft.m4a";
export const LONGFORM_DRAFT_OUTPUT_ASSET = "draft-previews/longform/current.mp4";
export const LONGFORM_DRAFT_MANIFEST_ASSET = "draft-previews/longform/current.manifest.json";
export const LONGFORM_DRAFT_SOURCE_PROXY_MANIFEST_ASSET = "draft-previews/longform/source-proxy.manifest.json";
export const LONGFORM_DRAFT_MAX_WIDTH = 854;
export const LONGFORM_DRAFT_MAX_HEIGHT = 480;
export const LONGFORM_DRAFT_FPS = 15;
export const LONGFORM_DRAFT_PROXY_GOP = 12;
export const LONGFORM_DRAFT_PIPELINE_VERSION = "2026-04-17-audio-first-creative-preview-v1";

export type DraftPreviewRequest = {
  sourceVideoHash: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier | "auto";
  gradeProfileId: MotionGradeProfileId | "auto";
  transitionPresetId: string;
  matteMode: MotionMatteMode | "auto";
  captionBias: CaptionVerticalBias | "auto";
  motionPlanFingerprint: string;
  patternMemoryFingerprint?: string;
};

export type DraftPreviewSettingsFingerprint = string;
export type DraftPreviewManifestStatus = "running" | "success" | "error";
export type DraftPreviewStatusState = DraftPreviewManifestStatus | "idle";

export type DraftPreviewManifest = {
  status: DraftPreviewManifestStatus;
  compositionId: string;
  sourceVideoHash: string;
  pipelineVersion: string;
  settingsFingerprint: DraftPreviewSettingsFingerprint;
  request: DraftPreviewRequest;
  startedAt: string;
  finishedAt: string | null;
  generatedAt: string | null;
  outputPath: string;
  outputUrl: string | null;
  draftSourceProxyPath: string;
  draftSourceProxyPublicPath: string;
  draftSourceProxyCacheHit: boolean;
  stageTimingsMs: {
    draftSourceProxyGeneration: number;
    render: number;
    total: number;
  };
  renderDiagnostics?: Record<string, unknown> | null;
  errorMessage: string | null;
};

export type DraftPreviewStatus = {
  state: DraftPreviewStatusState;
  manifest: DraftPreviewManifest | null;
};

export type DraftPreviewSourceProxyManifest = {
  sourceVideoHash: string;
  generatedAt: string;
  outputPath: string;
  outputPublicPath: string;
  width: number;
  height: number;
  fps: number;
};

const clampEven = (value: number): number => {
  const rounded = Math.max(2, Math.round(value));
  if (rounded % 2 === 0) {
    return rounded;
  }

  const lower = Math.max(2, rounded - 1);
  const upper = rounded + 1;
  return Math.abs(value - upper) < Math.abs(value - lower) ? upper : lower;
};

const sanitizeFingerprintSegment = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "auto";
};

export const getLongformDraftVideoMetadata = (
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "durationSeconds">
): VideoMetadata => {
  const sourceWidth = Math.max(1, videoMetadata.width);
  const sourceHeight = Math.max(1, videoMetadata.height);
  const widthScale = LONGFORM_DRAFT_MAX_WIDTH / sourceWidth;
  const heightScale = LONGFORM_DRAFT_MAX_HEIGHT / sourceHeight;
  const scale = Math.min(widthScale, heightScale, 1);
  const width = clampEven(sourceWidth * scale);
  const height = clampEven(sourceHeight * scale);
  const durationSeconds = Math.max(0, videoMetadata.durationSeconds);
  const durationInFrames = Math.max(1, Math.ceil(durationSeconds * LONGFORM_DRAFT_FPS));

  return {
    width,
    height,
    fps: LONGFORM_DRAFT_FPS,
    durationSeconds,
    durationInFrames
  };
};

export const buildDraftPreviewSettingsFingerprint = (
  request: DraftPreviewRequest
): DraftPreviewSettingsFingerprint => {
  const patternMemoryFingerprint = request.patternMemoryFingerprint ?? request.motionPlanFingerprint;
  return [
    sanitizeFingerprintSegment(LONGFORM_DRAFT_PIPELINE_VERSION),
    sanitizeFingerprintSegment(request.sourceVideoHash.slice(0, 16) || request.sourceVideoHash),
    sanitizeFingerprintSegment(request.captionProfileId),
    sanitizeFingerprintSegment(request.motionTier),
    sanitizeFingerprintSegment(request.gradeProfileId),
    sanitizeFingerprintSegment(request.transitionPresetId),
    sanitizeFingerprintSegment(request.matteMode),
    sanitizeFingerprintSegment(request.captionBias),
    sanitizeFingerprintSegment(request.motionPlanFingerprint),
    sanitizeFingerprintSegment(patternMemoryFingerprint)
  ].join("__");
};

export const getDraftPreviewUrl = (
  manifest: Pick<DraftPreviewManifest, "outputUrl" | "settingsFingerprint"> | null | undefined
): string | null => {
  if (!manifest) {
    return null;
  }

  if (manifest.outputUrl?.trim()) {
    return manifest.outputUrl;
  }

  return `/${LONGFORM_DRAFT_OUTPUT_ASSET}?v=${encodeURIComponent(manifest.settingsFingerprint.slice(0, 24))}`;
};

export const getDraftPreviewStateFromManifest = (
  manifest: DraftPreviewManifest | null | undefined
): DraftPreviewStatusState => {
  return manifest?.status ?? "idle";
};

export const isDraftPreviewManifestFresh = (
  manifest: DraftPreviewManifest | null | undefined,
  request: DraftPreviewRequest
): boolean => {
  if (!manifest || manifest.status !== "success") {
    return false;
  }

  return (
    manifest.sourceVideoHash === request.sourceVideoHash &&
    manifest.pipelineVersion === LONGFORM_DRAFT_PIPELINE_VERSION &&
    manifest.settingsFingerprint === buildDraftPreviewSettingsFingerprint(request)
  );
};
