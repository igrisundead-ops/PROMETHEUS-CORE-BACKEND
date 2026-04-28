import type {
  CaptionStyleProfileId,
  CaptionVerticalBias,
  CaptionChunk,
  MotionAssetFamily,
  MotionAssetManifest,
  MotionGradeProfileId,
  MotionIntensity,
  MotionMatteMode,
  MotionMoodTag,
  MotionTier,
  VideoMetadata
} from "../types";
import {
  getDefaultCaptionBiasForProfile,
  isLongformEveTypographyCaptionStyleProfile
} from "../stylebooks/caption-style-profiles";
import {getAssetFamiliesForTier, resolveMotionAssets} from "./asset-manifests";
import {getMotionAssetCatalogSummary} from "./asset-catalog";
import {getDefaultGradeProfileIdForTier} from "./grade-profiles";
import {getDefaultTransitionPresetIdForTier, pickTransitionPresetId, resolveTransitionPreset} from "./transition-presets";

export type MotionPlanOverrides = {
  motionIntensity?: MotionIntensity | "auto";
  captionBias?: CaptionVerticalBias | "auto";
  gradeProfileId?: MotionGradeProfileId | "auto";
  transitionPresetId?: string | "auto";
  matteMode?: MotionMatteMode | "auto";
  assetFamilies?: MotionAssetFamily[] | "auto";
};

export type MotionPlanSignals = {
  durationSeconds: number;
  aspectRatio: number;
  totalChunks: number;
  totalWords: number;
  totalCharacters: number;
  wordsPerSecond: number;
  averageWordsPerChunk: number;
  averageCharactersPerChunk: number;
  semanticDensity: number;
  emphasisDensity: number;
  variationDensity: number;
  punctuationDensity: number;
  readabilityPressure: number;
  energyScore: number;
  clarityScore: number;
  intensityScore: number;
};

export type MotionPlanFieldSource = "auto" | "manual" | "profile-default";

export type MotionPlan = {
  motionIntensity: MotionIntensity;
  captionBias: CaptionVerticalBias;
  gradeProfileId: MotionGradeProfileId;
  transitionPresetId: string;
  matteMode: MotionMatteMode;
  assetFamilies: MotionAssetFamily[];
  selectedAssets: MotionAssetManifest[];
  signals: MotionPlanSignals;
  reasons: string[];
  fieldSources: {
    motionIntensity: MotionPlanFieldSource;
    captionBias: MotionPlanFieldSource;
    gradeProfileId: MotionPlanFieldSource;
    transitionPresetId: MotionPlanFieldSource;
    matteMode: MotionPlanFieldSource;
    assetFamilies: MotionPlanFieldSource;
  };
  assetCatalogSummary: ReturnType<typeof getMotionAssetCatalogSummary>;
};

export type MotionPlanInput = {
  chunks: CaptionChunk[];
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  captionProfileId?: CaptionStyleProfileId;
  overrides?: MotionPlanOverrides;
  assetLibrary?: MotionAssetManifest[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9!?']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const unique = <T,>(values: T[]): T[] => [...new Set(values)];

const countPunctuation = (text: string): number => {
  const shortMarks = text.match(/[!?]/g)?.length ?? 0;
  const ellipses = text.includes("...") ? 1 : 0;
  return shortMarks + ellipses;
};

const getDurationSeconds = (
  chunks: CaptionChunk[],
  videoMetadata: MotionPlanInput["videoMetadata"]
): number => {
  if (Number.isFinite(videoMetadata.durationSeconds) && videoMetadata.durationSeconds > 0) {
    return videoMetadata.durationSeconds;
  }
  const chunkEnd = chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0);
  return Math.max(1, chunkEnd / 1000);
};

const getAspectRatio = (videoMetadata: MotionPlanInput["videoMetadata"]): number => {
  if (videoMetadata.width > 0 && videoMetadata.height > 0) {
    return round2(videoMetadata.width / videoMetadata.height);
  }
  return round2(9 / 16);
};

const getMotionDensitySignals = (chunks: CaptionChunk[]) => {
  const totalWords = chunks.reduce((sum, chunk) => sum + chunk.words.length, 0);
  const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.text.replace(/\s+/g, "").length, 0);
  const totalEmphasisWords = chunks.reduce((sum, chunk) => sum + (chunk.emphasisWordIndices?.length ?? 0), 0);
  const variationCount = chunks.filter((chunk) => chunk.semantic?.isVariation).length;
  const semanticCount = chunks.filter((chunk) => chunk.semantic?.intent !== "default").length;
  const punctuationCount = chunks.reduce((sum, chunk) => sum + countPunctuation(chunk.text), 0);

  return {
    totalWords,
    totalCharacters,
    totalEmphasisWords,
    variationCount,
    semanticCount,
    punctuationCount
  };
};

const getReadabilityPressure = (signals: {
  averageWordsPerChunk: number;
  averageCharactersPerChunk: number;
  punctuationDensity: number;
}): number => {
  const wordPressure = clamp01((signals.averageWordsPerChunk - 3.25) / 3.25);
  const charPressure = clamp01((signals.averageCharactersPerChunk - 14) / 18);
  const punctuationRelief = clamp01(signals.punctuationDensity * 2.2);
  return clamp01(wordPressure * 0.46 + charPressure * 0.44 + punctuationRelief * 0.1);
};

const getMotionIntensityScore = ({
  durationSeconds,
  aspectRatio,
  totalWords,
  totalCharacters,
  totalChunks,
  totalEmphasisWords,
  semanticCount,
  variationCount,
  punctuationCount
}: {
  durationSeconds: number;
  aspectRatio: number;
  totalWords: number;
  totalCharacters: number;
  totalChunks: number;
  totalEmphasisWords: number;
  semanticCount: number;
  variationCount: number;
  punctuationCount: number;
}): MotionPlanSignals => {
  const averageWordsPerChunk = totalChunks > 0 ? totalWords / totalChunks : 0;
  const averageCharactersPerChunk = totalChunks > 0 ? totalCharacters / totalChunks : 0;
  const wordsPerSecond = durationSeconds > 0 ? totalWords / durationSeconds : 0;
  const semanticDensity = totalChunks > 0 ? semanticCount / totalChunks : 0;
  const emphasisDensity = totalWords > 0 ? totalEmphasisWords / totalWords : 0;
  const variationDensity = totalChunks > 0 ? variationCount / totalChunks : 0;
  const punctuationDensity = totalChunks > 0 ? punctuationCount / totalChunks : 0;
  const readabilityPressure = getReadabilityPressure({
    averageWordsPerChunk,
    averageCharactersPerChunk,
    punctuationDensity
  });

  const durationScore = durationSeconds <= 45 ? 8 : durationSeconds <= 90 ? 13 : durationSeconds <= 180 ? 18 : 12;
  const pacingScore = clamp01(wordsPerSecond / 3.2) * 20;
  const semanticScore = clamp01(semanticDensity * 2.1) * 20;
  const emphasisScore = clamp01(emphasisDensity * 5.5) * 18;
  const variationScore = clamp01(variationDensity * 4.5) * 14;
  const punctuationScore = clamp01(punctuationDensity / 1.5) * 8;
  const aspectScore = aspectRatio < 0.7 ? 4 : aspectRatio > 0.9 ? -2 : 0;
  const clarityScore = readabilityPressure * 18;
  const energyScore =
    durationScore +
    pacingScore +
    semanticScore +
    emphasisScore +
    variationScore +
    punctuationScore +
    aspectScore;
  const intensityScore = clamp01((energyScore - clarityScore) / 72) * 100;

  return {
    durationSeconds,
    aspectRatio,
    totalChunks,
    totalWords,
    totalCharacters,
    wordsPerSecond: round2(wordsPerSecond),
    averageWordsPerChunk: round2(averageWordsPerChunk),
    averageCharactersPerChunk: round2(averageCharactersPerChunk),
    semanticDensity: round2(semanticDensity),
    emphasisDensity: round2(emphasisDensity),
    variationDensity: round2(variationDensity),
    punctuationDensity: round2(punctuationDensity),
    readabilityPressure: round2(readabilityPressure),
    energyScore: round2(energyScore),
    clarityScore: round2(clarityScore),
    intensityScore: round2(intensityScore)
  };
};

const resolveMotionIntensity = (
  signals: MotionPlanSignals,
  explicit?: MotionPlanOverrides["motionIntensity"]
): MotionIntensity => {
  if (explicit && explicit !== "auto") {
    return explicit;
  }
  if (signals.intensityScore < 28) {
    return "minimal";
  }
  if (signals.intensityScore < 52) {
    return "editorial";
  }
  if (signals.intensityScore < 74) {
    return "premium";
  }
  return "hero";
};

const resolveCaptionBias = ({
  captionProfileId,
  signals,
  motionIntensity,
  explicit
}: {
  captionProfileId?: CaptionStyleProfileId;
  signals: MotionPlanSignals;
  motionIntensity: MotionIntensity;
  explicit?: MotionPlanOverrides["captionBias"];
}): {
  captionBias: CaptionVerticalBias;
  source: MotionPlanFieldSource;
} => {
  if (explicit && explicit !== "auto") {
    return {
      captionBias: explicit,
      source: "manual"
    };
  }

  const profileBias = getDefaultCaptionBiasForProfile(captionProfileId);
  if (isLongformEveTypographyCaptionStyleProfile(captionProfileId)) {
    return {
      captionBias: profileBias,
      source: "profile-default"
    };
  }

  if (captionProfileId === "svg_typography_v1") {
    return {
      captionBias: "middle",
      source: "profile-default"
    };
  }

  if (motionIntensity === "hero" && signals.readabilityPressure < 0.38) {
    return {
      captionBias: "middle",
      source: "auto"
    };
  }

  if (signals.readabilityPressure > 0.58 || signals.averageWordsPerChunk >= 4.25) {
    return {
      captionBias: "bottom",
      source: "auto"
    };
  }

  return {
    captionBias: profileBias,
    source: "profile-default"
  };
};

const resolveGradeProfileId = (
  motionIntensity: MotionIntensity,
  explicit?: MotionPlanOverrides["gradeProfileId"]
): MotionGradeProfileId => {
  if (explicit && explicit !== "auto") {
    return explicit;
  }

  if (motionIntensity === "minimal") {
    return "neutral";
  }
  if (motionIntensity === "editorial") {
    return "cool-editorial";
  }
  if (motionIntensity === "premium") {
    return "premium-contrast";
  }
  return "warm-cinematic";
};

const resolveMatteMode = (
  motionIntensity: MotionIntensity,
  signals: MotionPlanSignals,
  explicit?: MotionPlanOverrides["matteMode"]
): MotionMatteMode => {
  if (explicit && explicit !== "auto") {
    return explicit;
  }

  if (motionIntensity === "hero" && signals.durationSeconds >= 45) {
    return "prefer-matte";
  }
  if (motionIntensity === "premium" && signals.readabilityPressure < 0.32) {
    return "auto";
  }
  return "off";
};

const resolveAssetFamilies = (
  motionIntensity: MotionIntensity,
  explicit?: MotionPlanOverrides["assetFamilies"]
): MotionAssetFamily[] => {
  if (explicit && explicit !== "auto") {
    return explicit;
  }
  return getAssetFamiliesForTier(motionIntensity);
};

const resolveTransitionPresetId = ({
  motionIntensity,
  signals,
  captionProfileId,
  explicit
}: {
  motionIntensity: MotionIntensity;
  signals: MotionPlanSignals;
  captionProfileId?: CaptionStyleProfileId;
  explicit?: MotionPlanOverrides["transitionPresetId"];
}): string => {
  if (explicit && explicit !== "auto") {
    return resolveTransitionPreset(explicit).id;
  }

  const seed = [
    motionIntensity,
    captionProfileId ?? "slcp",
    signals.durationSeconds.toFixed(2),
    signals.aspectRatio.toFixed(2),
    signals.intensityScore.toFixed(2)
  ].join("|");
  const presetId = pickTransitionPresetId({
    tier: motionIntensity,
    seed,
    preferredPresetId: getDefaultTransitionPresetIdForTier(motionIntensity)
  });
  return resolveTransitionPreset(presetId).id;
};

const resolveMotionMoodTags = (signals: MotionPlanSignals, motionIntensity: MotionIntensity): MotionMoodTag[] => {
  const tags = new Set<MotionMoodTag>(["neutral"]);
  if (motionIntensity === "minimal") {
    tags.add("calm");
  }
  if (motionIntensity === "editorial") {
    tags.add("cool");
    tags.add("kinetic");
  }
  if (motionIntensity === "premium") {
    tags.add("warm");
    tags.add("authority");
  }
  if (motionIntensity === "hero") {
    tags.add("heroic");
    tags.add("authority");
  }
  if (signals.semanticDensity > 0.18 || signals.punctuationDensity > 0.5) {
    tags.add("kinetic");
  }
  if (signals.readabilityPressure > 0.52) {
    tags.add("calm");
  }
  return [...tags];
};

export const resolveMotionPlan = (input: MotionPlanInput): MotionPlan => {
  const assetCatalogSummary = getMotionAssetCatalogSummary();
  const durationSeconds = getDurationSeconds(input.chunks, input.videoMetadata);
  const aspectRatio = getAspectRatio(input.videoMetadata);
  const densitySignals = getMotionDensitySignals(input.chunks);
  const motionSignals = getMotionIntensityScore({
    durationSeconds,
    aspectRatio,
    totalWords: densitySignals.totalWords,
    totalCharacters: densitySignals.totalCharacters,
    totalChunks: input.chunks.length,
    totalEmphasisWords: densitySignals.totalEmphasisWords,
    semanticCount: densitySignals.semanticCount,
    variationCount: densitySignals.variationCount,
    punctuationCount: densitySignals.punctuationCount
  });
  const motionIntensity = resolveMotionIntensity(motionSignals, input.overrides?.motionIntensity);
  const captionBiasResolution = resolveCaptionBias({
    captionProfileId: input.captionProfileId,
    signals: motionSignals,
    motionIntensity,
    explicit: input.overrides?.captionBias
  });
  const captionBias = captionBiasResolution.captionBias;
  const gradeProfileId = resolveGradeProfileId(motionIntensity, input.overrides?.gradeProfileId);
  const transitionPresetId = resolveTransitionPresetId({
    motionIntensity,
    signals: motionSignals,
    captionProfileId: input.captionProfileId,
    explicit: input.overrides?.transitionPresetId
  });
  const matteMode = resolveMatteMode(motionIntensity, motionSignals, input.overrides?.matteMode);
  const assetFamilies = resolveAssetFamilies(motionIntensity, input.overrides?.assetFamilies);
  const assetLibrary = input.assetLibrary ?? undefined;
  const selectedAssets = resolveMotionAssets({
    tier: motionIntensity,
    moodTags: resolveMotionMoodTags(motionSignals, motionIntensity),
    safeArea: "avoid-caption-region",
    families: assetFamilies,
    queryText: input.chunks.map((chunk) => chunk.text).join(" "),
    library: assetLibrary
  });
  const selectedAssetTrace = selectedAssets
    .map((asset) => `${asset.id}:${asset.source ?? "local"}`)
    .join(", ");

  const reasons = [
    `duration=${motionSignals.durationSeconds.toFixed(1)}s aspect=${motionSignals.aspectRatio.toFixed(2)}`,
    `density=words:${motionSignals.wordsPerSecond.toFixed(2)}/s semantics:${motionSignals.semanticDensity.toFixed(2)} emphasis:${motionSignals.emphasisDensity.toFixed(2)}`,
    `clarity=readability:${motionSignals.readabilityPressure.toFixed(2)} intensity:${motionSignals.intensityScore.toFixed(1)}`,
    `bias=${captionBias} grade=${gradeProfileId} matte=${matteMode}`,
    `assets=${assetFamilies.join(",") || "none"}`,
    `catalog=local:${assetCatalogSummary.localCount} remote:${assetCatalogSummary.remoteCount} remoteEnabled:${assetCatalogSummary.remoteEnabled}`,
    `selectedAssets=${selectedAssetTrace || "none"}`
  ];

  return {
    motionIntensity,
    captionBias,
    gradeProfileId,
    transitionPresetId,
    matteMode,
    assetFamilies,
    selectedAssets,
    signals: motionSignals,
    reasons,
    fieldSources: {
      motionIntensity: input.overrides?.motionIntensity && input.overrides.motionIntensity !== "auto" ? "manual" : "auto",
      captionBias: captionBiasResolution.source,
      gradeProfileId: input.overrides?.gradeProfileId && input.overrides.gradeProfileId !== "auto" ? "manual" : "auto",
      transitionPresetId:
        input.overrides?.transitionPresetId && input.overrides.transitionPresetId !== "auto"
          ? "manual"
          : "auto",
      matteMode: input.overrides?.matteMode && input.overrides.matteMode !== "auto" ? "manual" : "auto",
      assetFamilies: input.overrides?.assetFamilies && input.overrides.assetFamilies !== "auto" ? "manual" : "auto"
    },
    assetCatalogSummary
  };
};

export const getMotionPlanRecommendedMotionIntensity = (signals: MotionPlanSignals): MotionIntensity => {
  return resolveMotionIntensity(signals);
};
