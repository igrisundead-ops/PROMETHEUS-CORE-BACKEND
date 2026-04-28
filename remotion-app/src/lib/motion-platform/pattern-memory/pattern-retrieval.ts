import type {PatternContext, PatternMatchResult, PatternMemoryEntry, PatternMemorySnapshot, PatternRecommendation} from "./pattern-types";
import {evaluateAestheticConstraints} from "./pattern-constraints";
import {rankPatternCandidates, scorePatternCandidate} from "./pattern-scoring";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const buildRecommendation = ({
  entry,
  score,
  constraint
}: {
  entry: PatternMemoryEntry;
  score: PatternMatchResult["score"];
  constraint: PatternMatchResult["constraint"];
}): PatternRecommendation => {
  const action = constraint.allowed
    ? score.total >= 0.72
      ? "apply"
      : score.total >= 0.58
        ? "pair"
        : "defer"
    : constraint.reasonCodes.includes("density-blocked") || constraint.reasonCodes.includes("clutter-risk")
      ? "avoid"
      : "replace";

  return {
    patternId: entry.id,
    action,
    confidence: round(clamp01(Math.max(score.total, entry.confidenceScore) - (constraint.allowed ? 0 : 0.18))),
    effectStack: [...entry.effectStack],
    assetRefs: [...entry.assetRefs],
    reasons: unique([
      `semantic:${entry.semanticIntent}`,
      `scene:${entry.sceneType}`,
      ...constraint.reasonCodes.map((reason) => `constraint:${reason}`)
    ]),
    pairedPatternIds: constraint.recommendedReplacementPatternIds
  };
};

export const retrievePatternMatches = (
  snapshot: PatternMemorySnapshot,
  context: PatternContext,
  options?: {
    limit?: number;
    includeBlocked?: boolean;
  }
): PatternMatchResult[] => {
  const limit = options?.limit ?? 5;
  const ranked = rankPatternCandidates(snapshot.entries, context);
  const history = snapshot.entries.slice(-24);

  return ranked
    .map(({entry, score}) => {
      const constraint = evaluateAestheticConstraints({
        entry,
        context,
        history
      });
      const recommendation = buildRecommendation({entry, score, constraint});
      const warnings = unique([
        ...(constraint.allowed ? [] : constraint.reasonCodes.map((reason) => `constraint:${reason}`)),
        score.repetitionPenalty > 0.42 ? "recent repetition risk" : undefined,
        score.redundancyRisk > 0.48 ? "redundancy risk" : undefined,
        score.clutterRisk > 0.48 ? "clutter risk" : undefined
      ]);

      return {
        entry,
        score,
        recommendation,
        constraint,
        reasons: recommendation.reasons,
        warnings
      };
    })
    .filter((result) => options?.includeBlocked ? true : result.constraint.allowed)
    .slice(0, limit);
};

export const pickBestPatternMatch = (
  snapshot: PatternMemorySnapshot,
  context: PatternContext,
  options?: {
    includeBlocked?: boolean;
  }
): PatternMatchResult | null => {
  return retrievePatternMatches(snapshot, context, {
    limit: 1,
    includeBlocked: options?.includeBlocked
  })[0] ?? null;
};

export const getPatternMatchReasons = (
  result: PatternMatchResult | null
): string[] => {
  if (!result) {
    return ["no-pattern-match"];
  }

  return unique([
    ...result.reasons,
    ...result.warnings,
    `score:${result.score.total.toFixed(3)}`
  ]);
};

export const buildPatternSummary = (
  result: PatternMatchResult | null
): Record<string, unknown> => {
  if (!result) {
    return {
      pattern_id: null,
      action: "defer",
      confidence: 0,
      reasons: ["no-pattern-match"]
    };
  }

  return {
    pattern_id: result.entry.id,
    action: result.recommendation.action,
    confidence: result.recommendation.confidence,
    semantic_intent: result.entry.semanticIntent,
    scene_type: result.entry.sceneType,
    total_score: result.score.total,
    reasons: result.recommendation.reasons,
    warnings: result.warnings
  };
};

export const findCompatiblePatternChain = (
  snapshot: PatternMemorySnapshot,
  context: PatternContext,
  maxDepth = 3
): PatternMemoryEntry[] => {
  const matches = retrievePatternMatches(snapshot, context, {
    limit: maxDepth,
    includeBlocked: false
  });
  const selected = new Map<string, PatternMemoryEntry>();
  matches.forEach((match) => {
    selected.set(match.entry.id, match.entry);
    match.entry.compatibleWith.forEach((ref) => {
      const target = snapshot.entries.find((entry) => entry.id === ref || entry.effectStack.includes(ref));
      if (target) {
        selected.set(target.id, target);
      }
    });
  });
  return [...selected.values()];
};

export const scorePatternForContext = scorePatternCandidate;
