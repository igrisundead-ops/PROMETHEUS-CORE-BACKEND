import type {AestheticConstraintDecision, PatternContext, PatternMemoryEntry, PatternRejectionReason} from "./pattern-types";

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const DEFAULT_BUDGET = {
  underlinesPerMinute: 2,
  circlesPerMinute: 2,
  highAttentionPerMinute: 3,
  bubbleCardsPerFiveMinutes: 2,
  heavyAssetsMinSpacingMs: 12000,
  duplicateNumericEmphasis: true,
  subtitleProtectionMarginPx: 112,
  faceSafeMarginPx: 120
};

export const getDefaultPatternConstraintBudget = (): AestheticConstraintDecision["budgets"] => ({...DEFAULT_BUDGET});

const hasAny = (values: string[], patterns: RegExp[]): boolean => patterns.some((pattern) => values.some((value) => pattern.test(value)));

const getConstraintSignals = (entry: PatternMemoryEntry): string[] => unique([
  entry.semanticIntent,
  entry.sceneType,
  entry.patternType,
  ...entry.effectStack,
  ...entry.tagSet,
  ...entry.compatibilityRules,
  ...entry.antiPatterns
]);

type UsageHistory = {
  underlinesUsed: number;
  circlesUsed: number;
  highAttentionUsed: number;
  bubbleCardsUsed: number;
  heavyAssetLastUsedAtMs: number | null;
  numericEmphasisSeen: boolean;
};

const buildUsageHistory = (
  context: PatternContext,
  history: PatternMemoryEntry[]
): UsageHistory => {
  return {
    underlinesUsed: history.filter((entry) => /underline/i.test(entry.id) || entry.effectStack.some((effect) => /blur-underline/i.test(effect))).length,
    circlesUsed: history.filter((entry) => /circle/i.test(entry.id) || entry.effectStack.some((effect) => /circle-reveal/i.test(effect))).length,
    highAttentionUsed: history.filter((entry) => entry.semanticRole === "primary" && entry.visualWeight >= 0.68).length,
    bubbleCardsUsed: history.filter((entry) => entry.semanticIntent === "bubble-card" || /bubble|card/i.test(entry.category)).length,
    heavyAssetLastUsedAtMs: history.length > 0 ? context.timelinePositionMs - history.length * 1000 : null,
    numericEmphasisSeen: history.some((entry) => entry.semanticIntent === "numeric-emphasis" || entry.semanticIntent === "counter")
  };
};

const hasHeavySignal = (entry: PatternMemoryEntry): boolean => {
  return entry.visualWeight >= 0.7 || entry.semanticIntent === "focus" || entry.semanticIntent === "numeric-emphasis" || entry.semanticIntent === "comparison";
};

const buildReason = (reasonCodes: PatternRejectionReason[]): string => {
  if (reasonCodes.length === 0) {
    return "pattern approved";
  }
  return `blocked: ${reasonCodes.join(", ")}`;
};

export const evaluateAestheticConstraints = ({
  entry,
  context,
  history = []
}: {
  entry: PatternMemoryEntry;
  context: PatternContext;
  history?: PatternMemoryEntry[];
}): AestheticConstraintDecision => {
  const budget = getDefaultPatternConstraintBudget();
  const usage = buildUsageHistory(context, history);
  const reasonCodes = new Set<PatternRejectionReason>();
  const signalText = getConstraintSignals(entry);

  const isUnderline = hasAny(signalText, [/underline/i]);
  const isCircle = hasAny(signalText, [/circle/i]);
  const isBubbleCard = entry.semanticIntent === "bubble-card" || hasAny(signalText, [/bubble/i, /card/i]);
  const isHighAttention = entry.semanticRole === "primary" || entry.visualWeight >= 0.68 || entry.semanticIntent === "focus" || entry.semanticIntent === "numeric-emphasis";
  const denseScene = context.isDenseScene || context.visualDensity >= 0.72 || context.captionDensity >= 0.72;

  if (denseScene && entry.semanticIntent !== "restraint-needed" && isHighAttention) {
    reasonCodes.add("density-blocked");
    reasonCodes.add("clutter-risk");
  }

  if (isUnderline && usage.underlinesUsed >= budget.underlinesPerMinute) {
    reasonCodes.add("budget-blocked");
    reasonCodes.add("repetition-limit");
  }

  if (isCircle && usage.circlesUsed >= budget.circlesPerMinute) {
    reasonCodes.add("budget-blocked");
    reasonCodes.add("repetition-limit");
  }

  if (isBubbleCard && usage.bubbleCardsUsed >= budget.bubbleCardsPerFiveMinutes) {
    reasonCodes.add("budget-blocked");
    reasonCodes.add("repetition-limit");
  }

  if (isHighAttention && usage.highAttentionUsed >= budget.highAttentionPerMinute && entry.semanticIntent !== "restraint-needed") {
    reasonCodes.add("too-many-simultaneous-effects");
    reasonCodes.add("clutter-risk");
  }

  if (budget.duplicateNumericEmphasis && (entry.semanticIntent === "numeric-emphasis" || entry.semanticIntent === "counter") && usage.numericEmphasisSeen) {
    reasonCodes.add("duplicate-semantic-emphasis");
    reasonCodes.add("redundancy");
  }

  if (hasHeavySignal(entry) && usage.heavyAssetLastUsedAtMs !== null && (context.timelinePositionMs - usage.heavyAssetLastUsedAtMs) < budget.heavyAssetsMinSpacingMs) {
    reasonCodes.add("timing-conflict");
    reasonCodes.add("overuse");
  }

  if (entry.semanticIntent === "restraint-needed") {
    reasonCodes.clear();
  }

  const allowed = reasonCodes.size === 0;
  const suppressedEffectIds = allowed ? [] : entry.effectStack.filter((effectId) => /underline|circle|highlight|typewriter|zoom|focus/i.test(effectId));
  const similarPatternIds = history
    .filter((historyEntry) => historyEntry.semanticIntent === entry.semanticIntent || historyEntry.sceneType === entry.sceneType)
    .slice(-5)
    .map((historyEntry) => historyEntry.id);

  return {
    allowed,
    hardBlocked: !allowed,
    reasonCodes: [...reasonCodes],
    message: buildReason([...reasonCodes]),
    budgets: budget,
    similarPatternIds,
    suppressedEffectIds,
    recommendedReplacementPatternIds: entry.semanticIntent === "restraint-needed"
      ? []
      : history
        .filter((historyEntry) => historyEntry.semanticIntent === "restraint-needed")
        .slice(-2)
        .map((historyEntry) => historyEntry.id)
  };
};
