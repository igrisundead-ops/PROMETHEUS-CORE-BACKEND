import type {
  MotionAssetManifest,
  MotionCameraCue,
  MotionChoreographyPlan,
  MotionChoreographyScenePlan,
  MotionPrimitiveId,
  MotionTimelineInstruction
} from "../../types";
import type {MotionCompositionModel} from "../scene-engine";
import {defaultPatternMemorySnapshot, getPatternMemoryFingerprint} from "./pattern-memory-snapshot";
import {evaluateAestheticConstraints, getDefaultPatternConstraintBudget} from "./pattern-constraints";
import {applyPatternMemoryUpdate, updatePatternEntryScores} from "./pattern-update";
import {buildPatternSummary, pickBestPatternMatch, retrievePatternMatches} from "./pattern-retrieval";
import type {
  AestheticConstraintDecision,
  PatternContext,
  PatternMatchResult,
  PatternMemoryEntry,
  PatternMemoryLedgerEvent,
  PatternMemorySnapshot,
  PatternRecommendation,
  PatternUpdatePayload
} from "./pattern-types";

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (value: string): string[] => normalizeText(value).split(" ").filter(Boolean);

const inferSceneType = (chunkText: string, semanticIntent: string): PatternContext["sceneType"] => {
  const text = normalizeText(chunkText);
  if (semanticIntent === "comparison" || /\b(vs|versus|compare|comparison|against|before after)\b/.test(text)) return "comparison";
  if (semanticIntent === "cta" || /\b(subscribe|follow|join|click|download|start)\b/.test(text)) return "cta";
  if (semanticIntent === "quote" || /\b(quote|said|told|mentioned)\b/.test(text)) return "quote";
  if (semanticIntent === "numeric-emphasis" || /\b(percent|percentage|number|numbers|stat|stats|metric|counter)\b/.test(text)) return "stat";
  if (semanticIntent === "growth" || /\b(grow|growth|increase|scale|progress)\b/.test(text)) return "growth";
  if (semanticIntent === "call" || /\b(call|contact|outreach|reach out)\b/.test(text)) return "call";
  if (semanticIntent === "list" || /\b(step|steps|first|second|third|next|finally)\b/.test(text)) return "list";
  return "feature-highlight";
};

export const buildPatternMemoryContext = (
  input: Partial<PatternContext> & {
    chunkText?: string;
    prompt?: string;
    semanticIntent?: PatternContext["semanticIntent"];
    semanticRole?: PatternContext["semanticRole"];
    semanticSignals?: string[];
    timelinePositionMs?: number;
    timelineWindowMs?: number;
  }
): PatternContext => {
  const chunkText = input.chunkText ?? input.momentText ?? input.prompt ?? "";
  const semanticIntent = input.semanticIntent ?? "unknown";
  return {
    jobId: input.jobId,
    videoId: input.videoId,
    sourceVideoId: input.sourceVideoId,
    sceneId: input.sceneId,
    momentId: input.momentId,
    sourceVideoHash: input.sourceVideoHash,
    prompt: input.prompt ?? "",
    transcriptText: input.transcriptText ?? input.prompt ?? "",
    chunkText,
    momentText: input.momentText ?? chunkText,
    semanticIntent,
    secondaryIntents: input.secondaryIntents ?? [],
    sceneType: input.sceneType ?? inferSceneType(chunkText, semanticIntent),
    detectedMomentType: input.detectedMomentType ?? semanticIntent,
    semanticRole: input.semanticRole ?? "secondary",
    visualDensity: input.visualDensity ?? 0,
    captionDensity: input.captionDensity ?? 0,
    speakerDominance: input.speakerDominance ?? 0.5,
    motionTier: input.motionTier ?? "editorial",
    activeEffectIds: input.activeEffectIds ?? [],
    activeAssetIds: input.activeAssetIds ?? [],
    activeTagIds: input.activeTagIds ?? [],
    assetTags: input.assetTags ?? unique(tokenize(chunkText)),
    momentTags: input.momentTags ?? unique(tokenize(chunkText)),
    semanticSignals: input.semanticSignals ?? unique(tokenize(chunkText)),
    minuteBucket: input.minuteBucket ?? Math.floor((input.timelinePositionMs ?? 0) / 60000),
    timelinePositionMs: input.timelinePositionMs ?? 0,
    timelineWindowMs: input.timelineWindowMs ?? 0,
    importance: input.importance ?? 0.5,
    hasPause: input.hasPause ?? false,
    isDenseScene: input.isDenseScene ?? false,
    isLongForm: input.isLongForm ?? true,
    selectionMode: input.selectionMode,
    targetRef: input.targetRef
  };
};

const buildAllowedConstraintDecision = (budget = getDefaultPatternConstraintBudget()): AestheticConstraintDecision => ({
  allowed: true,
  hardBlocked: false,
  reasonCodes: [],
  message: "pattern approved",
  budgets: budget,
  similarPatternIds: [],
  suppressedEffectIds: [],
  recommendedReplacementPatternIds: []
});

export type PatternMemorySelection = {
  snapshot: PatternMemorySnapshot;
  matches: PatternMatchResult[];
  bestMatch: PatternMatchResult | null;
  summary: Record<string, unknown>;
};

type PatternResolvedScene = {
  id: string;
  startMs: number;
  endMs: number;
  transitionIn: string;
  transitionOut: string;
  transitionBudgetFrames: number;
  sourceChunkId?: string;
  matteId?: string;
  cameraCue?: MotionCameraCue;
  primitiveIds?: MotionPrimitiveId[];
  timelineInstructions?: MotionTimelineInstruction[];
  previewStageInstructions?: MotionTimelineInstruction[];
  sceneKind?: string;
  choreographyPresetId?: string;
  focusTargetId?: string;
  headlineText?: string;
  subtextText?: string;
  assets?: MotionAssetManifest[];
};

export type PatternMotionModelLike = {
  chunks: Array<{
    id: string;
    text: string;
    startMs: number;
    endMs: number;
    words: Array<{text: string; startMs: number; endMs: number}>;
    semantic?: {intent: string; isVariation: boolean; suppressDefault: boolean} | undefined;
    emphasisWordIndices?: number[];
  }>;
  motionPlan: {
    motionIntensity: string;
    selectedAssets: MotionAssetManifest[];
    reasons: string[];
    assetFamilies?: string[];
    signals?: {intensityScore?: number};
    gradeProfileId?: string;
  };
  showcasePlan: {
    cues: Array<Record<string, unknown>>;
    selectedAssets: MotionAssetManifest[];
    reasons: string[];
  };
  choreographyPlan: MotionChoreographyPlan;
  cameraCues: MotionCameraCue[];
  scenes: PatternResolvedScene[];
  backgroundOverlayPlan?: {cues: Array<Record<string, unknown>>; reasons: string[]};
  transitionOverlayPlan?: {cues: Array<Record<string, unknown>>; reasons: string[]};
  soundDesignPlan?: {reasons: string[]};
  [key: string]: unknown;
};

export const getPatternMemorySnapshot = (): PatternMemorySnapshot => defaultPatternMemorySnapshot;
export const getPatternMemoryFingerprintValue = (): string => getPatternMemoryFingerprint();

export const selectPatternMemory = (
  context: PatternContext,
  snapshot: PatternMemorySnapshot = defaultPatternMemorySnapshot
): PatternMemorySelection => {
  const matches = retrievePatternMatches(snapshot, context, {
    limit: 6,
    includeBlocked: true
  });
  const bestMatch = pickBestPatternMatch(snapshot, context, {
    includeBlocked: false
  });
  return {
    snapshot,
    matches,
    bestMatch,
    summary: buildPatternSummary(bestMatch)
  };
};

export const evaluatePatternMemoryConstraints = (
  entry: PatternMemoryEntry,
  context: PatternContext,
  history: PatternMemoryEntry[] = []
): AestheticConstraintDecision => {
  return evaluateAestheticConstraints({
    entry,
    context,
    history
  });
};

export const applyPatternMemoryGovernance = <TModel extends PatternMotionModelLike>(
  model: TModel,
  snapshot: PatternMemorySnapshot = defaultPatternMemorySnapshot
): TModel & {
  patternMemory: {
    fingerprint: string;
    summary: Record<string, unknown>;
    matches: PatternMatchResult[];
  };
} => {
  const baseChunkText = model.chunks.map((chunk) => chunk.text).join(" ");
  const baseContext = buildPatternMemoryContext({
    chunkText: baseChunkText,
    prompt: baseChunkText,
    semanticIntent: "unknown",
    semanticRole: "secondary",
    motionTier: String(model.motionPlan.motionIntensity) as PatternContext["motionTier"],
    activeEffectIds: [
      ...model.choreographyPlan.scenes.flatMap((scene) => scene.primitiveIds ?? []).map((primitive) => `primitive:${primitive}`),
      ...model.motionPlan.selectedAssets.map((asset) => asset.id)
    ],
    activeAssetIds: model.motionPlan.selectedAssets.map((asset) => asset.id),
    activeTagIds: unique([
      ...model.motionPlan.selectedAssets.flatMap((asset) => asset.graphTags ?? []),
      ...model.showcasePlan.selectedAssets.flatMap((asset) => asset.graphTags ?? [])
    ]),
    assetTags: unique([
      ...model.motionPlan.selectedAssets.flatMap((asset) => asset.graphTags ?? []),
      ...model.showcasePlan.selectedAssets.flatMap((asset) => asset.graphTags ?? [])
    ]),
    semanticSignals: unique([
      ...model.motionPlan.reasons,
      ...model.showcasePlan.reasons,
      ...model.choreographyPlan.reasons
    ]),
    timelinePositionMs: model.chunks[0]?.startMs ?? 0,
    timelineWindowMs: Math.max(1000, model.chunks.reduce((max, chunk) => Math.max(max, chunk.endMs - chunk.startMs), 0)),
    visualDensity: Math.min(1, model.motionPlan.selectedAssets.length / Math.max(1, model.chunks.length || 1)),
    captionDensity: Math.min(1, model.chunks.reduce((count, chunk) => count + Math.max(1, chunk.words.length), 0) / Math.max(1, model.chunks.length * 4)),
    importance: Math.min(1, model.motionPlan.signals?.intensityScore ? Number(model.motionPlan.signals.intensityScore) / 100 : 0.5),
    hasPause: model.chunks.some((chunk, index) => index > 0 && (chunk.startMs - model.chunks[index - 1].endMs) >= 180),
    isDenseScene: model.chunks.some((chunk) => chunk.text.length > 48 || chunk.words.length >= 6),
    isLongForm: model.chunks.length >= 24
  });
  const selection = selectPatternMemory(baseContext, snapshot);
  const history = snapshot.entries.slice(-24);
  const restraintMatch = selection.matches.find((match) => match.entry.semanticIntent === "restraint-needed" && match.constraint.allowed) ?? null;
  const shouldRestrain = Boolean(restraintMatch) || baseContext.isDenseScene || baseContext.captionDensity >= 0.72 || baseContext.visualDensity >= 0.72;

  const governedScenes = model.scenes.map((scene) => {
    const choreographyScene = model.choreographyPlan.sceneMap?.[scene.id] ?? model.choreographyPlan.scenes.find((candidate) => candidate.sceneId === scene.id) ?? null;
    const sceneKind = choreographyScene?.sceneKind ?? scene.sceneKind ?? "feature-highlight";
    const sceneText = `${scene.headlineText ?? ""} ${scene.subtextText ?? ""}`.trim();
    const primitiveIds = scene.primitiveIds ?? choreographyScene?.primitiveIds ?? [];
    const context = buildPatternMemoryContext({
      ...baseContext,
      sceneId: scene.id,
      momentId: scene.id,
      semanticIntent: sceneKind === "comparison"
        ? "comparison"
        : sceneKind === "quote"
          ? "quote"
          : sceneKind === "stat"
            ? "numeric-emphasis"
            : sceneKind === "cta"
              ? "cta"
              : "highlight",
      sceneType: sceneKind,
      detectedMomentType: sceneKind,
      semanticRole: "primary",
      chunkText: sceneText,
      momentText: sceneText,
      timelinePositionMs: scene.startMs ?? baseContext.timelinePositionMs,
      activeEffectIds: primitiveIds.map((primitive) => `primitive:${primitive}`),
      activeAssetIds: primitiveIds.map((primitive) => `primitive:${primitive}`),
      activeTagIds: unique([sceneKind, ...primitiveIds]),
      assetTags: unique([sceneKind, ...primitiveIds]),
      semanticSignals: unique([sceneKind, ...primitiveIds]),
      importance: sceneKind === "cta" ? 0.82 : sceneKind === "stat" ? 0.9 : 0.7,
      isDenseScene: shouldRestrain,
      hasPause: (choreographyScene?.timelineInstructions ?? scene.timelineInstructions ?? []).some((instruction: MotionTimelineInstruction) => instruction.phase === "hold"),
      isLongForm: baseContext.isLongForm
    });
    const bestMatchForScene = pickBestPatternMatch(snapshot, context, {includeBlocked: true});
    const sceneHistory = history.filter((entry) => entry.sceneType === context.sceneType || entry.semanticIntent === context.semanticIntent);
    const constraints = bestMatchForScene
      ? evaluatePatternMemoryConstraints(bestMatchForScene.entry, context, sceneHistory)
      : buildAllowedConstraintDecision();
    const keepPrimitives = primitiveIds.filter((primitiveId) => {
      if (!shouldRestrain) {
        return true;
      }
      return primitiveId === "highlight-word" || primitiveId === "typewriter";
    });
    const filteredPrimitiveIds = keepPrimitives.length > 0 ? keepPrimitives : primitiveIds.slice(0, 1);
    const reasons = unique([
      ...(choreographyScene?.timelineInstructions ?? scene.timelineInstructions ?? []).map((instruction: MotionTimelineInstruction) => instruction.phase),
      ...(bestMatchForScene?.recommendation.reasons ?? []),
      ...(constraints.allowed ? [] : constraints.reasonCodes.map((reason) => `constraint:${reason}`))
    ]);

    return {
      ...scene,
      primitiveIds: filteredPrimitiveIds,
      patternMemory: {
        bestPatternId: bestMatchForScene?.entry.id ?? null,
        reasons,
        allowed: constraints.allowed
      }
    } as typeof scene & {
      patternMemory: {
        bestPatternId: string | null;
        reasons: string[];
        allowed: boolean;
      };
    };
  });

  return {
    ...model,
    scenes: governedScenes as TModel["scenes"],
    choreographyPlan: {
      ...model.choreographyPlan,
      reasons: unique([
        ...model.choreographyPlan.reasons,
        ...selection.matches.flatMap((match: PatternMatchResult) => match.reasons),
        ...(shouldRestrain ? ["pattern-memory restraint enforced"] : [])
      ])
    },
    motionPlan: {
      ...model.motionPlan,
      reasons: unique([
        ...model.motionPlan.reasons,
        `pattern-memory:${selection.summary.pattern_id ?? "none"}`,
        ...(shouldRestrain ? ["pattern-memory restraint"] : [])
      ])
    },
    patternMemory: {
      fingerprint: snapshot.fingerprint,
      summary: selection.summary,
      matches: selection.matches
    }
  };
};

export const recordPatternMemoryOutcome = (
  snapshot: PatternMemorySnapshot,
  payload: PatternUpdatePayload
): {
  snapshot: PatternMemorySnapshot;
  ledgerEvent: PatternMemoryLedgerEvent;
} => {
  const result = applyPatternMemoryUpdate(snapshot, payload);
  return {
    snapshot: result.snapshot,
    ledgerEvent: result.event
  };
};

export const updatePatternEntryFromScore = (
  entry: PatternMemoryEntry,
  recommendation: PatternRecommendation
): PatternMemoryEntry => {
  return updatePatternEntryScores(entry, {
    clarity: 0.5,
    hierarchy: 0.5,
    focus: 0.5,
    elegance: 0.5,
    clutterRisk: 0.2,
    compatibility: 0.5,
    readability: 0.5,
    sceneAppropriateness: 0.5,
    redundancyRisk: 0.2,
    repetitionPenalty: 0.1,
    semanticFit: 0.5,
    timingFit: 0.5,
    total: recommendation.confidence
  }, {
    semanticIntent: "unknown",
    secondaryIntents: [],
    sceneType: "feature-highlight",
    detectedMomentType: "unknown",
    semanticRole: "secondary",
    visualDensity: 0.2,
    captionDensity: 0.2,
    speakerDominance: 0.5,
    motionTier: "editorial",
    activeEffectIds: recommendation.effectStack,
    activeAssetIds: recommendation.assetRefs,
    activeTagIds: recommendation.reasons,
    assetTags: recommendation.reasons,
    momentTags: recommendation.reasons,
    semanticSignals: recommendation.reasons,
    minuteBucket: 0,
    timelinePositionMs: 0,
    timelineWindowMs: 1000,
    importance: recommendation.confidence,
    hasPause: false,
    isDenseScene: false,
    isLongForm: true
  }, recommendation);
};

export const getPatternMemorySummary = (): Record<string, unknown> => {
  const snapshot = defaultPatternMemorySnapshot;
  return {
    fingerprint: snapshot.fingerprint,
    version: snapshot.version,
    rulesVersion: snapshot.rulesVersion,
    entries: snapshot.entries.length,
    active: snapshot.entries.filter((entry) => entry.active).length,
    topPatterns: snapshot.entries.slice(0, 8).map((entry: PatternMemoryEntry) => ({
      id: entry.id,
      semanticIntent: entry.semanticIntent,
      sceneType: entry.sceneType,
      successScore: entry.successScore,
      confidenceScore: entry.confidenceScore
    }))
  };
};

export {buildPatternSummary};
