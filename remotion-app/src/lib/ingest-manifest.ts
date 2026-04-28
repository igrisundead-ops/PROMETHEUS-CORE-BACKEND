import type {
  CaptionStyleProfileId,
  MotionTier,
  PresentationMode
} from "./types";
import type {
  TranscriptionMode,
  TranscriptionProvider
} from "./transcription-routing";

export type IngestSyncState = "ready" | "stale";

export type IngestStageTimingsMs = {
  videoProbe: number;
  transcriptMediaPrep: number;
  transcription: number;
  chunking: number;
  motionMapping: number;
  clipPlanning?: number;
  proxyGeneration: number;
  writeOutputs: number;
  total: number;
};

export type IngestOutputTargets = {
  transcriptPath: string;
  captionsPath: string;
  videoMetadataPath: string;
  videoPublicPath: string;
  previewVideoPublicPath: string;
  motionMapPath: string;
  motionPlanPath?: string;
  ingestManifestPath: string;
  missingAssetRegistryPath?: string;
  nolanClipPlanPath?: string;
};

export type IngestManifest = {
  generatedAt: string;
  activeSourceId: string;
  sourceVideoPath: string;
  sourceVideoHash: string;
  previewVideoUrlVersion: string;
  syncState: IngestSyncState;
  syncIssues: string[];
  transcriptCacheKey: string;
  transcriptCachePath: string;
  transcriptSource: "cache" | TranscriptionProvider;
  transcriptionMode: TranscriptionMode;
  transcriptionProvider: TranscriptionProvider;
  transcriptionFallbacks: string[];
  transcriptSourceMediaPath: string;
  transcriptSourceMediaSizeBytes: number;
  originalVideoSizeBytes: number;
  presentationMode: PresentationMode;
  captionProfileId: CaptionStyleProfileId;
  captionProfileDisplayName: string;
  requestedMotionTier: MotionTier | "auto";
  resolvedMotionTier: MotionTier;
  jobId: string | null;
  description: string | null;
  selectedMotionMomentCount: number;
  flaggedMotionMomentCount: number;
  suppressedMotionMomentCount: number;
  showcaseGovernor?: {
    profileId: string;
    version: string;
    selectedAssetCueCount: number;
    selectedTemplateCueCount: number;
    selectedTypographyCueCount: number;
    missingCategoryCount: number;
    queuedCategoryIds: string[];
    missingAssetRegistryPath?: string;
  } | null;
  nolanClipPlan?: {
    engineId: string;
    version: string;
    candidateCount: number;
    pageCount: number;
    recommendedClipIds: string[];
    referenceScriptPath: string | null;
    referenceSectionCount: number;
    outputPath?: string;
  } | null;
  outputs: IngestOutputTargets;
  showcaseCatalog: {
    source: "synced" | "cached";
    assetCount: number;
    cachePath: string;
  };
  pipelineSequence: Array<{
    step: string;
    status: "completed" | "warning";
    detail: string;
  }>;
  stageTimingsMs: IngestStageTimingsMs;
};

export const getPublicAssetPathFromOutput = (
  outputPath: string | null | undefined
): string | null => {
  const normalized = outputPath?.trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? null;
};

export const buildVersionedPublicAssetUrl = ({
  assetPath,
  version
}: {
  assetPath: string | null | undefined;
  version: string | null | undefined;
}): string | null => {
  const publicAssetPath = getPublicAssetPathFromOutput(assetPath);
  if (!publicAssetPath) {
    return null;
  }

  const normalizedVersion = version?.trim();
  if (!normalizedVersion) {
    return `/${publicAssetPath}`;
  }

  return `/${publicAssetPath}?v=${encodeURIComponent(normalizedVersion)}`;
};

export const resolveIngestDisplayLabel = (
  manifest: Partial<Pick<IngestManifest, "description" | "sourceVideoPath">> | null | undefined
): string => {
  const explicitLabel = manifest?.description?.trim();
  if (explicitLabel) {
    return explicitLabel;
  }

  const sourceName = getPublicAssetPathFromOutput(manifest?.sourceVideoPath);
  return sourceName ?? "Current long-form ingest";
};

export const isIngestManifestReady = (
  manifest: Partial<Pick<IngestManifest, "syncState">> | null | undefined
): boolean => {
  return manifest?.syncState === "ready";
};
