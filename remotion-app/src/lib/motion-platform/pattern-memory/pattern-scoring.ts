import type {PatternContext, PatternMemoryEntry, PatternScore} from "./pattern-types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (value: string): string[] => normalize(value).split(" ").filter(Boolean);

const overlapScore = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const setB = new Set(b.map((value) => value.toLowerCase()));
  const matches = a.filter((value) => setB.has(value.toLowerCase())).length;
  return matches / Math.max(a.length, b.length);
};

const textMatchScore = (text: string | undefined, terms: string[]): number => {
  if (!text) {
    return 0;
  }
  const tokens = tokenize(text);
  const normalizedTerms = unique(terms.flatMap((term) => tokenize(term)));
  return overlapScore(tokens, normalizedTerms) * 0.7 + overlapScore(normalizedTerms, tokens) * 0.3;
};

export const scorePatternCandidate = (
  entry: PatternMemoryEntry,
  context: PatternContext
): PatternScore => {
  const contextSignals = unique([
    context.semanticIntent,
    context.sceneType,
    context.detectedMomentType,
    context.semanticRole,
    ...context.secondaryIntents,
    ...context.semanticSignals,
    ...context.assetTags,
    ...context.momentTags
  ]).map((value) => value.toLowerCase());

  const semanticFit = round(clamp01(
    0.34 * (entry.semanticIntent === context.semanticIntent ? 1 : 0) +
    0.2 * overlapScore(entry.tagSet, contextSignals) +
    0.18 * textMatchScore(context.chunkText ?? context.momentText ?? context.prompt, entry.tagSet) +
    0.14 * textMatchScore(context.transcriptText, entry.triggerContext) +
    0.14 * overlapScore(entry.effectStack, context.activeEffectIds)
  ));

  const sceneAppropriateness = round(clamp01(
    entry.sceneType === context.sceneType
      ? 1
      : context.isDenseScene && entry.semanticIntent === "restraint-needed"
        ? 1
        : overlapScore([entry.sceneType], contextSignals)
  ));

  const clarity = round(clamp01(
    0.32 + (1 - context.captionDensity) * 0.34 + (1 - context.visualDensity) * 0.24 + (context.hasPause ? 0.1 : 0)
  ));
  const hierarchy = round(clamp01(
    0.26 + (entry.semanticRole === "primary" ? 0.44 : entry.semanticRole === "secondary" ? 0.28 : 0.14) + context.importance * 0.18
  ));
  const focus = round(clamp01(
    0.24 + (entry.semanticIntent === "focus" ? 0.42 : 0) + (entry.effectStack.some((effect) => /focus|zoom/i.test(effect)) ? 0.28 : 0) + context.speakerDominance * 0.16
  ));
  const elegance = round(clamp01(
    0.2 + (1 - entry.clutterRiskScore) * 0.32 + (1 - entry.redundancyRiskScore) * 0.3 + (entry.visualWeight <= 0.65 ? 0.12 : 0)
  ));
  const compatibility = round(clamp01(
    0.22 + overlapScore(entry.compatibleWith, context.activeEffectIds) * 0.34 + overlapScore(entry.tagSet, context.activeTagIds) * 0.24 + (context.activeAssetIds.some((assetId) => entry.assetRefs.includes(assetId)) ? 0.2 : 0)
  ));
  const readability = round(clamp01(
    0.3 + (1 - Math.max(context.captionDensity, context.visualDensity)) * 0.42 + (context.motionTier === "minimal" ? 0.08 : 0)
  ));
  const redundancyRisk = round(clamp01(
    entry.redundancyRiskScore +
    (context.activeEffectIds.some((effectId) => entry.effectStack.includes(effectId)) ? 0.22 : 0) +
    (context.semanticIntent === entry.semanticIntent ? 0.15 : 0) +
    (context.detectedMomentType === entry.detectedMomentType ? 0.08 : 0)
  ));
  const repetitionPenalty = round(clamp01(
    Math.max(0, entry.reuseCount / 18) +
    Math.max(0, entry.failureCount / 8) +
    (entry.reuseCount > 0 && context.activeTagIds.some((tag) => entry.tagSet.includes(tag)) ? 0.12 : 0)
  ));
  const timingFit = round(clamp01(
    0.22 + Math.min(1, entry.timingProfile.totalMs / Math.max(1, context.timelineWindowMs || entry.timingProfile.totalMs)) * 0.34 + (context.hasPause ? 0.18 : 0.04) + (context.isDenseScene && entry.semanticIntent !== "restraint-needed" ? -0.12 : 0)
  ));

  const total = round(
    (semanticFit * 0.24) +
    (sceneAppropriateness * 0.11) +
    (clarity * 0.1) +
    (hierarchy * 0.1) +
    (focus * 0.08) +
    (elegance * 0.1) +
    (compatibility * 0.11) +
    (readability * 0.08) +
    (timingFit * 0.08) +
    ((1 - redundancyRisk) * 0.06) -
    (repetitionPenalty * 0.06)
  );

  return {
    clarity,
    hierarchy,
    focus,
    elegance,
    clutterRisk: round(clamp01(entry.clutterRiskScore + (context.isDenseScene ? 0.15 : 0) + (context.captionDensity > 0.7 ? 0.12 : 0))),
    compatibility,
    readability,
    sceneAppropriateness,
    redundancyRisk,
    repetitionPenalty,
    semanticFit,
    timingFit,
    total
  };
};

export const rankPatternCandidates = (
  entries: PatternMemoryEntry[],
  context: PatternContext
): Array<{entry: PatternMemoryEntry; score: PatternScore}> => {
  return entries
    .filter((entry) => entry.active)
    .map((entry) => ({
      entry,
      score: scorePatternCandidate(entry, context)
    }))
    .sort((left, right) => right.score.total - left.score.total || left.entry.id.localeCompare(right.entry.id));
};
