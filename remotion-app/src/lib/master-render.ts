import type {
  CaptionStyleProfileId,
  CaptionVerticalBias,
  MotionGradeProfileId,
  MotionMatteMode,
  MotionTier
} from "./types";

export const LONGFORM_MASTER_COMPOSITION_ID = "MaleHeadVideoLongForm";
export const LONGFORM_MASTER_OUTPUT_ASSET = "master-renders/longform/current.mp4";
export const LONGFORM_MASTER_MANIFEST_ASSET = "master-renders/longform/current.manifest.json";
export const LONGFORM_MASTER_PIPELINE_VERSION = "2026-04-09-master-longform-v1";

export type MasterRenderRequest = {
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

export type MasterRenderSettingsFingerprint = string;
export type MasterRenderManifestStatus = "running" | "success" | "error";
export type MasterRenderStatusState = MasterRenderManifestStatus | "idle";

export type MasterRenderManifest = {
  status: MasterRenderManifestStatus;
  compositionId: string;
  sourceVideoHash: string;
  pipelineVersion: string;
  settingsFingerprint: MasterRenderSettingsFingerprint;
  request: MasterRenderRequest;
  startedAt: string;
  finishedAt: string | null;
  generatedAt: string | null;
  outputPath: string;
  outputUrl: string | null;
  stageTimingsMs: {
    render: number;
    total: number;
  };
  errorMessage: string | null;
};

export type MasterRenderStatus = {
  state: MasterRenderStatusState;
  manifest: MasterRenderManifest | null;
};

const sanitizeFingerprintSegment = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "auto";
};

export const buildMasterRenderSettingsFingerprint = (
  request: MasterRenderRequest
): MasterRenderSettingsFingerprint => {
  const patternMemoryFingerprint = request.patternMemoryFingerprint ?? request.motionPlanFingerprint;
  return [
    sanitizeFingerprintSegment(LONGFORM_MASTER_PIPELINE_VERSION),
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

export const getMasterRenderStateFromManifest = (
  manifest: MasterRenderManifest | null | undefined
): MasterRenderStatusState => {
  return manifest?.status ?? "idle";
};

export const isMasterRenderManifestFresh = (
  manifest: MasterRenderManifest | null | undefined,
  request: MasterRenderRequest
): boolean => {
  if (!manifest || manifest.status !== "success") {
    return false;
  }

  return (
    manifest.sourceVideoHash === request.sourceVideoHash &&
    manifest.pipelineVersion === LONGFORM_MASTER_PIPELINE_VERSION &&
    manifest.settingsFingerprint === buildMasterRenderSettingsFingerprint(request)
  );
};
