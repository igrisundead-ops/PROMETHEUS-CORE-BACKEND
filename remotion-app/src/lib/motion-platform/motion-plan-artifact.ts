import type {
  CaptionChunk,
  CaptionStyleProfileId,
  Motion3DMode,
  MotionAssetManifest,
  MotionAssetSourceKind,
  MotionAssetFamily,
  MotionBackgroundOverlayCue,
  MotionCameraCue,
  MotionChoreographyScenePlan,
  MotionGradeProfileId,
  MotionMatteMode,
  MotionMoodTag,
  MotionShowcaseCue,
  MotionTier,
  TransitionOverlayCue,
  TransitionOverlayMode,
  VideoMetadata,
  CaptionVerticalBias,
  AnimationTriggerType
} from "../types";
import {normalizeCaptionStyleProfileId} from "../stylebooks/caption-style-profiles";
import {deterministicChunkWords, mapWordChunksToCaptionChunks} from "../caption-chunker";
import {buildMotionCompositionModel, type MotionCompositionModel} from "./scene-engine";
import {getUnifiedMotionAssetCatalogSummary} from "./motion-asset-registry";

export const MOTION_PLAN_PIPELINE_VERSION = "2026-04-15-motion-orchestration-v1";

export type MotionPlanMode = "reel" | "long-form";

export type MotionPlanPolicy = {
  maxAssetsPerMinute: number;
  repetitionPenalty: number;
  emphasisThreshold: number;
  clutterThreshold: number;
  minSpacingBetweenHeavyAssetsMs: number;
  subtitleProtectionMarginPx: number;
  faceSafeMarginPx: number;
  motionMode: "quiet" | "balanced" | "aggressive";
};

export type MotionPlanAssetSummary = {
  id: string;
  kind: "showcase" | "background" | "transition";
  label: string;
  family: string | null;
  tier: MotionTier | null;
  src: string | null;
  placement_zone: string | null;
  safe_area: string | null;
  duration_policy: string | null;
  loopable: boolean | null;
  blend_mode: string | null;
  opacity: number | null;
  source_kind: MotionAssetSourceKind | string | null;
  source_id: string | null;
  source_file: string | null;
  source_html: string | null;
  source_batch: string | null;
  theme_tags: MotionMoodTag[];
  semantic_tags: string[];
  subject_tags: string[];
  emotional_tags: MotionMoodTag[];
  graph_tags: string[];
  aliases: string[];
  compatible_with: string[];
  layering_rules: Array<Record<string, unknown>>;
  notes: string | null;
};

export type MotionPlanTimelineEvent = {
  id: string;
  kind: "showcase" | "background" | "transition" | "camera" | "choreography" | "motion3d" | "focus";
  asset_id: string | null;
  asset_label: string | null;
  source_chunk_id: string | null;
  source_chunk_text: string;
  start_ms: number;
  peak_start_ms: number;
  peak_end_ms: number;
  end_ms: number;
  trigger_type: AnimationTriggerType;
  placement_zone: string;
  placement_hint: string | null;
  layer_channel: string;
  z_index: number;
  order: number;
  entry_style: string;
  hold_style: string;
  exit_style: string;
  easing: string;
  loop: boolean;
  intensity: MotionTier;
  micro_motion: string | null;
  confidence: number;
  reason: string[];
  compatible_with: string[];
  paired_effect_ids: string[];
};

export type MotionPlanEffectPairing = {
  primary_effect_id: string;
  partner_effect_ids: string[];
  trigger_types: AnimationTriggerType[];
  rationale: string;
};

export type MotionPlanRejectedAsset = {
  id: string;
  label: string;
  kind: string;
  matched_text: string;
  score: number | null;
  reason: string;
};

export type MotionPlanValidation = {
  warnings: string[];
  errors: string[];
  rejected_assets: MotionPlanRejectedAsset[];
};

export type MotionPlanSourceSummary = {
  duration_seconds: number;
  word_count: number;
  chunk_count: number;
  presentation_mode: MotionPlanMode;
  caption_profile_id: CaptionStyleProfileId;
  motion_tier_requested: MotionTier | "auto";
  motion_tier_resolved: MotionTier;
  transcript_available: boolean;
  showcase_cue_count: number;
  background_cue_count: number;
  transition_cue_count: number;
  choreography_scene_count: number;
  intensity_score: number;
};

export type MotionPlanArtifact = {
  job_id: string;
  plan_version: string;
  generated_at: string;
  pattern_memory_fingerprint: string | null;
  pattern_memory: NonNullable<MotionCompositionModel["patternMemory"]> | null;
  source_summary: MotionPlanSourceSummary;
  policy: MotionPlanPolicy;
  asset_catalog_summary: ReturnType<typeof getUnifiedMotionAssetCatalogSummary>;
  motion_model: MotionCompositionModel;
  selected_assets: MotionPlanAssetSummary[];
  asset_assignments: Array<{
    asset_id: string;
    kind: MotionPlanAssetSummary["kind"];
    label: string;
    source_event_ids: string[];
    placement_zone: string | null;
    layer_channel: string;
    z_index: number;
    duration_policy: string | null;
    safe_area: string | null;
    loopable: boolean | null;
    trigger_type: AnimationTriggerType;
    compatible_with: string[];
    entry_style: string;
    exit_style: string;
    intensity: MotionTier;
    confidence: number;
    reason: string;
  }>;
  timeline_events: MotionPlanTimelineEvent[];
  paired_effects: MotionPlanEffectPairing[];
  validation: MotionPlanValidation;
  notes: string[];
};

export type MotionPlanArtifactInput = {
  jobId: string;
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  captionProfileId?: CaptionStyleProfileId;
  motionTier?: MotionTier | "auto";
  gradeProfileId?: MotionGradeProfileId | "auto";
  transitionPresetId?: string;
  matteMode?: MotionMatteMode | "auto";
  captionBias?: CaptionVerticalBias | "auto";
  presentationMode?: MotionPlanMode;
  motion3DMode?: Motion3DMode;
  transitionOverlayMode?: TransitionOverlayMode;
  suppressAmbientAssets?: boolean;
  ambientAssetFamilies?: MotionAssetFamily[];
  showcaseCatalog?: MotionAssetManifest[];
  chunks?: CaptionChunk[];
  transcriptWords?: Array<{
    text: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
  motionModelOverride?: MotionCompositionModel | null;
  generatedAt?: string;
};

const DEFAULT_MOTION_PLAN_PIPELINE_VERSION = MOTION_PLAN_PIPELINE_VERSION;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const uniqueById = <T extends {id: string}>(items: T[]): T[] => {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    output.push(item);
  }
  return output;
};

const uniqueStrings = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const normalizePresentationMode = (
  input: MotionPlanArtifactInput,
  motionModel: MotionCompositionModel
): MotionPlanMode => {
  if (input.presentationMode) {
    return input.presentationMode;
  }
  const {width, height} = input.videoMetadata;
  if (width > 0 && height > 0) {
    return width >= height ? "long-form" : "reel";
  }
  return motionModel.motionPlan.motionIntensity === "minimal" ? "reel" : "long-form";
};

const derivePolicyMode = (tier: MotionTier): MotionPlanPolicy["motionMode"] => {
  if (tier === "minimal") {
    return "quiet";
  }
  if (tier === "editorial") {
    return "balanced";
  }
  return "aggressive";
};

const buildMotionPlanPolicy = ({
  motionModel,
  presentationMode
}: {
  motionModel: MotionCompositionModel;
  presentationMode: MotionPlanMode;
}): MotionPlanPolicy => {
  const tier = motionModel.motionPlan.motionIntensity;
  const intensityScore = motionModel.motionPlan.signals.intensityScore;
  const durationMinutes = Math.max(0.01, motionModel.motionPlan.signals.durationSeconds / 60);
  const showcaseDensity = motionModel.showcasePlan.cues.length / durationMinutes;
  const heavySpacing = tier === "hero"
    ? 7200
    : tier === "premium"
      ? 9200
      : tier === "editorial"
        ? 11200
        : 14000;
  const subtitleProtectionMarginPx = presentationMode === "long-form" ? 92 : 116;
  const faceSafeMarginPx = presentationMode === "long-form" ? 104 : 128;

  return {
    maxAssetsPerMinute: round((tier === "hero" ? 4.1 : tier === "premium" ? 3.2 : tier === "editorial" ? 2.4 : 1.7) + showcaseDensity * 0.18, 2),
    repetitionPenalty: round(clamp01(0.38 + intensityScore / 260), 2),
    emphasisThreshold: round(clamp01(0.48 + intensityScore / 260), 2),
    clutterThreshold: round(clamp01(0.24 + showcaseDensity / 18), 2),
    minSpacingBetweenHeavyAssetsMs: heavySpacing,
    subtitleProtectionMarginPx,
    faceSafeMarginPx,
    motionMode: derivePolicyMode(tier)
  };
};

const inferKind = (asset: MotionAssetManifest): MotionPlanAssetSummary["kind"] => {
  if (asset.assetRole === "showcase") {
    return "showcase";
  }
  if (asset.placementZone === "background-depth" || asset.family === "depth-mask" || asset.family === "grid") {
    return "background";
  }
  return "transition";
};

const summarizeAsset = (
  asset: MotionAssetManifest,
  kind: MotionPlanAssetSummary["kind"]
): MotionPlanAssetSummary => ({
  id: asset.id,
  kind,
  label: asset.canonicalLabel ?? asset.id,
  family: asset.family ?? null,
  tier: asset.tier ?? null,
  src: asset.src ?? null,
  placement_zone: asset.placementZone ?? null,
  safe_area: asset.safeArea ?? null,
  duration_policy: asset.durationPolicy ?? null,
  loopable: asset.loopable ?? null,
  blend_mode: asset.blendMode ?? null,
  opacity: typeof asset.opacity === "number" ? round(asset.opacity, 3) : null,
  source_kind: asset.sourceKind ?? asset.source ?? null,
  source_id: asset.sourceId ?? null,
  source_file: asset.sourceFile ?? null,
  source_html: asset.sourceHtml ?? null,
  source_batch: asset.sourceBatch ?? null,
  theme_tags: asset.themeTags ?? [],
  semantic_tags: asset.semanticTags ?? [],
  subject_tags: asset.subjectTags ?? [],
  emotional_tags: asset.emotionalTags ?? [],
  graph_tags: asset.graphTags ?? [],
  aliases: asset.aliases ?? [],
  compatible_with: asset.compatibleWith ?? [],
  layering_rules: asset.layeringRules ?? [],
  notes: asset.sourceHtml ? "Animated HTML prototype source." : asset.assetRole === "showcase" ? "Showcase motion asset." : null
});

const findSourceChunk = (
  motionModel: MotionCompositionModel,
  startMs: number,
  endMs: number
): MotionCompositionModel["chunks"][number] | null => {
  return motionModel.chunks.find((chunk) => startMs >= chunk.startMs - 80 && endMs <= chunk.endMs + 140) ?? null;
};

const summarizeShowcaseCue = (
  cue: MotionShowcaseCue,
  index: number,
  motionModel: MotionCompositionModel
): MotionPlanTimelineEvent => {
  const sourceChunk = findSourceChunk(motionModel, cue.matchedStartMs, cue.matchedEndMs);
  return {
    id: `showcase-${cue.assetId}-${index}`,
    kind: "showcase",
    asset_id: cue.asset.id,
    asset_label: cue.canonicalLabel,
    source_chunk_id: sourceChunk?.id ?? null,
    source_chunk_text: sourceChunk?.text ?? cue.matchedText,
    start_ms: cue.startMs,
    peak_start_ms: cue.peakStartMs,
    peak_end_ms: cue.peakEndMs,
    end_ms: cue.endMs,
    trigger_type: cue.cueSource === "template-graphic" ? "timeline" : "word-level",
    placement_zone: cue.asset.placementZone,
    placement_hint: cue.asset.showcasePlacementHint ?? null,
    layer_channel: cue.asset.assetRole === "showcase" ? "overlay" : "accent",
    z_index: 120 + index,
    order: index,
    entry_style: cue.cueSource,
    hold_style: cue.matchKind,
    exit_style: cue.asset.loopable ? "loop" : "fade-out",
    easing: "ease-out",
    loop: Boolean(cue.asset.loopable),
    intensity: motionModel.motionPlan.motionIntensity,
    micro_motion: cue.reason ?? null,
    confidence: round(clamp01(cue.score / 100), 3),
    reason: [cue.reason ?? "showcase-cue", ...(cue.governorReasonCodes ?? []).map((code) => `governor:${code}`)],
    compatible_with: cue.asset.compatibleWith ?? [],
    paired_effect_ids: cue.asset.compatibleWith ?? []
  };
};

const summarizeCameraCue = (
  cue: MotionCompositionModel["cameraCues"][number],
  index: number,
  motionModel: MotionCompositionModel
): MotionPlanTimelineEvent => ({
  id: `camera-${cue.id}-${index}`,
  kind: "camera",
  asset_id: cue.triggerPatternIds?.[0] ?? null,
  asset_label: cue.reason ?? cue.triggerText ?? cue.id,
  source_chunk_id: null,
  source_chunk_text: cue.triggerText ?? cue.reason ?? "",
  start_ms: cue.startMs,
  peak_start_ms: cue.peakStartMs,
  peak_end_ms: cue.peakEndMs,
  end_ms: cue.endMs,
  trigger_type: "timeline",
  placement_zone: "full-frame",
  placement_hint: "center",
  layer_channel: "host",
  z_index: 60 + index,
  order: index,
  entry_style: cue.timingFamily,
  hold_style: "camera-hold",
  exit_style: cue.mode,
  easing: "ease-out",
  loop: false,
  intensity: motionModel.motionPlan.motionIntensity,
  micro_motion: cue.reason ?? null,
  confidence: round(clamp01(cue.peakScale / 1.3), 3),
  reason: [cue.reason ?? "camera-cue"],
  compatible_with: ["target-focus-zoom", "motion-camera-cue"],
  paired_effect_ids: ["target-focus-zoom"]
});

const summarizeBoundaryCue = (
  cue: MotionCompositionModel["backgroundOverlayPlan"]["cues"][number] | MotionCompositionModel["transitionOverlayPlan"]["cues"][number],
  index: number,
  motionModel: MotionCompositionModel,
  kind: MotionPlanTimelineEvent["kind"]
): MotionPlanTimelineEvent => ({
  id: `${kind}-${cue.assetId}-${index}`,
  kind,
  asset_id: cue.assetId,
  asset_label: cue.asset.label,
  source_chunk_id: cue.sourceChunkId,
  source_chunk_text: cue.sourceChunkText,
  start_ms: cue.startMs,
  peak_start_ms: cue.peakStartMs,
  peak_end_ms: cue.peakEndMs,
  end_ms: cue.endMs,
  trigger_type: "timeline",
  placement_zone: "background-depth",
  placement_hint: null,
  layer_channel: kind === "transition" ? "overlay" : "base",
  z_index: kind === "transition" ? 30 + index : 12 + index,
  order: index,
  entry_style: kind === "transition" && "blendMode" in cue ? cue.blendMode : cue.fitStrategy.rationale,
  hold_style: cue.reasoning,
  exit_style: kind === "transition" ? "wipe-out" : "drift-out",
  easing: "ease-in-out",
  loop: false,
  intensity: motionModel.motionPlan.motionIntensity,
  micro_motion: cue.reasoning,
  confidence: round(clamp01(cue.score / 100), 3),
  reason: [cue.reasoning].filter(Boolean),
  compatible_with: [],
  paired_effect_ids: []
});

const summarizeChoreographyScene = (
  scene: MotionCompositionModel["choreographyPlan"]["scenes"][number],
  index: number,
  motionModel: MotionCompositionModel
): MotionPlanTimelineEvent => {
  const sourceScene = motionModel.scenes.find((candidate) => candidate.id === scene.sceneId);
  const startMs = sourceScene?.startMs ?? 0;
  const endMs = sourceScene?.endMs ?? startMs + 1200;
  const firstPrimitive = scene.primitiveIds[0] ?? null;
  return {
    id: `choreography-${scene.sceneId}-${index}`,
    kind: "choreography",
    asset_id: firstPrimitive,
    asset_label: scene.headlineText,
    source_chunk_id: sourceScene?.sourceChunkId ?? null,
    source_chunk_text: scene.headlineText,
    start_ms: startMs,
    peak_start_ms: startMs,
    peak_end_ms: endMs,
    end_ms: endMs,
    trigger_type: "word-level",
    placement_zone: "overlay",
    placement_hint: null,
    layer_channel: "host",
    z_index: 90 + index,
    order: index,
    entry_style: scene.choreographyPresetId,
    hold_style: scene.sceneKind,
    exit_style: scene.continuity.carryCamera ? "camera-carry" : "release",
    easing: "ease-out",
    loop: false,
    intensity: motionModel.motionPlan.motionIntensity,
    micro_motion: scene.subtextText ?? null,
    confidence: 0.86,
    reason: [scene.sceneKind, ...scene.timelineInstructions.map((instruction) => instruction.phase)],
    compatible_with: scene.primitiveIds,
    paired_effect_ids: scene.primitiveIds
  };
};

const summarizeMotion3DScene = (
  scene: MotionCompositionModel["motion3DPlan"]["scenes"][number],
  index: number,
  motionModel: MotionCompositionModel
): MotionPlanTimelineEvent => ({
  id: `motion3d-${scene.id}-${index}`,
  kind: "motion3d",
  asset_id: scene.focusLayerId ?? scene.id,
  asset_label: scene.cameraPreset,
  source_chunk_id: null,
  source_chunk_text: scene.reasons.join(" "),
  start_ms: scene.startMs,
  peak_start_ms: scene.startMs,
  peak_end_ms: scene.endMs,
  end_ms: scene.endMs,
  trigger_type: "timeline",
  placement_zone: "full-frame",
  placement_hint: "center",
  layer_channel: "host",
  z_index: 105 + index,
  order: index,
  entry_style: scene.cameraPreset,
  hold_style: "3d-hold",
  exit_style: "3d-release",
  easing: "ease-in-out",
  loop: false,
  intensity: motionModel.motionPlan.motionIntensity,
  micro_motion: scene.reasons[0] ?? null,
  confidence: 0.88,
  reason: scene.reasons,
  compatible_with: [],
  paired_effect_ids: []
});

const buildValidation = (motionModel: MotionCompositionModel): MotionPlanValidation => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rejectedAssets: MotionPlanRejectedAsset[] = [];

  if (motionModel.showcasePlan.cues.length === 0) {
    warnings.push("No showcase cues were selected for the current timeline.");
  }
  if (motionModel.scenes.length === 0) {
    errors.push("No motion scenes were produced.");
  }

  const duplicateAssetIds = motionModel.scenes
    .flatMap((scene) => scene.assets.map((asset) => asset.id))
    .filter((assetId, index, array) => array.indexOf(assetId) !== index);

  if (duplicateAssetIds.length > 0) {
    warnings.push(`Duplicate motion assets were reused across scenes: ${[...new Set(duplicateAssetIds)].join(", ")}`);
  }

  if (motionModel.showcasePlan.selectedAssets.length === 0 && motionModel.motionPlan.selectedAssets.length === 0) {
    rejectedAssets.push({
      id: "no-selected-motion-assets",
      label: "Motion Assets",
      kind: "showcase",
      matched_text: "n/a",
      score: null,
      reason: "The motion planner did not retain any motion assets."
    });
  }

  return {
    warnings,
    errors,
    rejected_assets: rejectedAssets
  };
};

const buildAssetAssignments = (motionModel: MotionCompositionModel): MotionPlanArtifact["asset_assignments"] => {
  type AssignmentWithId = MotionPlanArtifact["asset_assignments"][number] & {id: string};
  const assignments: AssignmentWithId[] = motionModel.scenes.flatMap((scene, sceneIndex) => {
    return scene.assets.map((asset, assetIndex) => ({
      id: `${scene.id}:${asset.id}:${assetIndex}`,
      asset_id: asset.id,
      kind: inferKind(asset),
      label: asset.canonicalLabel ?? asset.id,
      source_event_ids: [scene.id, scene.sourceChunkId ?? scene.id],
      placement_zone: asset.placementZone ?? null,
      layer_channel: asset.assetRole === "showcase"
        ? "overlay"
        : asset.placementZone === "background-depth"
          ? "base"
          : "accent",
      z_index: sceneIndex * 10 + assetIndex,
      duration_policy: asset.durationPolicy ?? null,
      safe_area: asset.safeArea ?? null,
      loopable: asset.loopable ?? null,
      trigger_type: scene.sceneKind === "feature-highlight" || scene.sceneKind === "cta" ? "timeline" : "word-level",
      compatible_with: asset.compatibleWith ?? [],
      entry_style: scene.transitionInPreset.family,
      exit_style: scene.transitionOutPreset.family,
      intensity: motionModel.motionPlan.motionIntensity,
      confidence: round(clamp01(scene.cameraCue ? scene.cameraCue.peakScale / 1.25 : 0.82), 3),
      reason: scene.sourceChunkId ? `scene:${scene.sourceChunkId}` : `scene:${scene.id}`
    }));
  });

  return uniqueById(assignments).map(({id: _id, ...assignment}) => assignment);
};

export const buildMotionPlanArtifact = (input: MotionPlanArtifactInput): MotionPlanArtifact => {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const motionModel = input.motionModelOverride ?? buildMotionCompositionModel({
    chunks: input.chunks ?? [],
    tier: input.motionTier ?? "auto",
    fps: input.videoMetadata.fps,
    videoMetadata: input.videoMetadata,
    captionProfileId: input.captionProfileId,
    gradeProfileId: input.gradeProfileId,
    transitionPresetId: input.transitionPresetId,
    matteMode: input.matteMode,
    captionBias: input.captionBias,
    showcaseCatalog: input.showcaseCatalog,
    suppressAmbientAssets: input.suppressAmbientAssets,
    ambientAssetFamilies: input.ambientAssetFamilies,
    motion3DMode: input.motion3DMode,
    transitionOverlayMode: input.transitionOverlayMode
  });
  const presentationMode = normalizePresentationMode(input, motionModel);
  const allSelectedAssets = uniqueById([
    ...motionModel.motionPlan.selectedAssets,
    ...motionModel.showcasePlan.selectedAssets,
    ...motionModel.scenes.flatMap((scene) => scene.assets)
  ]);
  const timelineEvents = [
    ...motionModel.showcasePlan.cues.map((cue, index) => summarizeShowcaseCue(cue, index, motionModel)),
    ...motionModel.cameraCues.map((cue, index) => summarizeCameraCue(cue, index, motionModel)),
    ...motionModel.backgroundOverlayPlan.cues.map((cue, index) => summarizeBoundaryCue(cue, index, motionModel, "background")),
    ...motionModel.transitionOverlayPlan.cues.map((cue, index) => summarizeBoundaryCue(cue, index, motionModel, "transition")),
    ...motionModel.choreographyPlan.scenes.map((scene, index) => summarizeChoreographyScene(scene, index, motionModel)),
    ...motionModel.motion3DPlan.scenes.map((scene, index) => summarizeMotion3DScene(scene, index, motionModel))
  ].sort((left, right) => left.start_ms - right.start_ms || left.order - right.order);

  return {
    job_id: input.jobId,
    plan_version: DEFAULT_MOTION_PLAN_PIPELINE_VERSION,
    generated_at: generatedAt,
    pattern_memory_fingerprint: motionModel.patternMemory?.fingerprint ?? null,
    pattern_memory: motionModel.patternMemory ?? null,
    source_summary: {
      duration_seconds: round(input.videoMetadata.durationSeconds, 2),
      word_count: input.transcriptWords?.length ?? motionModel.chunks.reduce((sum, chunk) => sum + chunk.words.length, 0),
      chunk_count: motionModel.chunks.length,
      presentation_mode: presentationMode,
      caption_profile_id: input.captionProfileId ?? "slcp",
      motion_tier_requested: input.motionTier ?? "auto",
      motion_tier_resolved: motionModel.tier,
      transcript_available: motionModel.chunks.length > 0,
      showcase_cue_count: motionModel.showcasePlan.cues.length,
      background_cue_count: motionModel.backgroundOverlayPlan.cues.length,
      transition_cue_count: motionModel.transitionOverlayPlan.cues.length,
      choreography_scene_count: motionModel.choreographyPlan.scenes.length,
      intensity_score: round(motionModel.motionPlan.signals.intensityScore, 2)
    },
    policy: buildMotionPlanPolicy({
      motionModel,
      presentationMode
    }),
    asset_catalog_summary: getUnifiedMotionAssetCatalogSummary(),
    motion_model: motionModel,
    selected_assets: allSelectedAssets.map((asset) => summarizeAsset(asset, inferKind(asset))),
    asset_assignments: buildAssetAssignments(motionModel),
    timeline_events: timelineEvents,
    paired_effects: motionModel.choreographyPlan.primitiveRegistry
      .filter((primitive) => (primitive.compatibleWith?.length ?? 0) > 0)
      .map((primitive) => ({
        primary_effect_id: primitive.id,
        partner_effect_ids: primitive.compatibleWith ?? [],
        trigger_types: Array.isArray(primitive.triggerType)
          ? primitive.triggerType
          : primitive.triggerType
            ? [primitive.triggerType]
            : ["word-level"],
        rationale: primitive.notes
      })),
    validation: buildValidation(motionModel),
    notes: uniqueStrings([
      ...motionModel.motionPlan.reasons,
      ...motionModel.showcasePlan.reasons,
      ...motionModel.backgroundOverlayPlan.reasons,
      ...motionModel.transitionOverlayPlan.reasons,
      ...motionModel.choreographyPlan.reasons,
      ...motionModel.motion3DPlan.reasons,
      ...motionModel.soundDesignPlan.reasons
    ])
  };
};
