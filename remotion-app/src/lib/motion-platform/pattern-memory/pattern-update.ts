import type {
  PatternContext,
  PatternMemoryEntry,
  PatternMemoryLedgerEvent,
  PatternMemorySnapshot,
  PatternOutcome,
  PatternRejectionReason,
  PatternRecommendation,
  PatternScore,
  PatternUpdatePayload
} from "./pattern-types";
import {buildPatternMemoryFingerprint, buildPatternMemoryIndex} from "./pattern-seeds";

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const normalizeEntry = (entry: PatternMemoryEntry): PatternMemoryEntry => ({
  ...entry,
  triggerContext: unique(entry.triggerContext),
  effectStack: unique(entry.effectStack),
  animationStyle: unique(entry.animationStyle),
  compatibilityRules: unique(entry.compatibilityRules),
  antiPatterns: unique(entry.antiPatterns),
  compatibleWith: unique(entry.compatibleWith),
  assetRefs: unique(entry.assetRefs),
  tagSet: unique(entry.tagSet)
});

const determineEventType = (outcome: PatternOutcome, humanApproved: boolean): PatternMemoryLedgerEvent["type"] => {
  if (outcome === "deprecated") {
    return "deprecate";
  }
  if (outcome === "blocked" || outcome === "rejected") {
    return "reject";
  }
  if (humanApproved) {
    return "reinforce";
  }
  if (outcome === "success") {
    return "apply";
  }
  return "update";
};

const applyOutcomeToEntry = (
  entry: PatternMemoryEntry,
  payload: PatternUpdatePayload
): PatternMemoryEntry => {
  const successDelta = payload.outcome === "success"
    ? 0.08
    : payload.outcome === "partial-success"
      ? 0.03
      : payload.outcome === "blocked" || payload.outcome === "rejected"
        ? -0.08
        : payload.outcome === "deprecated"
          ? -0.15
          : -0.02;
  const failureDelta = payload.outcome === "blocked" || payload.outcome === "rejected" ? 1 : payload.outcome === "deprecated" ? 2 : 0;
  const reuseDelta = payload.outcome === "success" || payload.outcome === "partial-success" ? 1 : 0;
  const confidenceBoost = payload.humanApproved ? 0.1 : 0;

  return normalizeEntry({
    ...entry,
    successScore: round(clamp01(entry.successScore + successDelta)),
    confidenceScore: round(clamp01(entry.confidenceScore + confidenceBoost + (payload.outcome === "blocked" ? -0.06 : 0))),
    reuseCount: entry.reuseCount + reuseDelta,
    failureCount: entry.failureCount + failureDelta,
    lastUsedAt: payload.context.sourceVideoHash ?? payload.context.sourceVideoId ?? payload.context.videoId ?? entry.lastUsedAt,
    sourceVideoId: payload.context.sourceVideoId ?? payload.context.videoId ?? entry.sourceVideoId,
    active: payload.outcome === "deprecated" ? false : entry.active,
    rejectionReasons: payload.rejectedReason && !entry.rejectionReasons.includes(payload.rejectedReason)
      ? [...entry.rejectionReasons, payload.rejectedReason]
      : entry.rejectionReasons,
    notes: payload.notes ? `${entry.notes} | ${payload.notes}`.trim() : entry.notes
  });
};

export const applyPatternMemoryUpdate = (
  snapshot: PatternMemorySnapshot,
  payload: PatternUpdatePayload
): {
  snapshot: PatternMemorySnapshot;
  updatedEntry: PatternMemoryEntry | null;
  event: PatternMemoryLedgerEvent;
} => {
  const currentIndex = snapshot.entries.findIndex((entry) => entry.id === payload.patternId);
  const updatedEntry = currentIndex >= 0 ? applyOutcomeToEntry(snapshot.entries[currentIndex], payload) : null;
  const entries = currentIndex >= 0
    ? snapshot.entries.map((entry, index) => (index === currentIndex ? updatedEntry! : entry))
    : snapshot.entries;
  const index = buildPatternMemoryIndex(entries);
  const nextSnapshot: PatternMemorySnapshot = {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    entries,
    index
  };
  const fingerprint = buildPatternMemoryFingerprint({
    version: nextSnapshot.version,
    generatedAt: nextSnapshot.generatedAt,
    rulesVersion: nextSnapshot.rulesVersion,
    entries: nextSnapshot.entries,
    index: nextSnapshot.index,
    notes: nextSnapshot.notes
  });
  const completedSnapshot: PatternMemorySnapshot = {
    ...nextSnapshot,
    fingerprint
  };

  return {
    snapshot: completedSnapshot,
    updatedEntry,
    event: {
      id: `ledger-${payload.patternId}-${Date.now().toString(36)}`,
      type: determineEventType(payload.outcome, Boolean(payload.humanApproved)),
      at: new Date().toISOString(),
      patternId: payload.patternId,
      context: payload.context,
      outcome: payload.outcome,
      reasons: unique([
        payload.rejectedReason,
        payload.notes,
        payload.outcome
      ]),
      recommendation: null,
      constraint: null,
      humanApproved: Boolean(payload.humanApproved),
      notes: payload.notes
    }
  };
};

export const updatePatternEntryScores = (
  entry: PatternMemoryEntry,
  score: PatternScore,
  context: PatternContext,
  recommendation: PatternRecommendation
): PatternMemoryEntry => {
  const reinforcement = recommendation.action === "apply" ? 0.06 : recommendation.action === "pair" ? 0.03 : recommendation.action === "avoid" ? -0.03 : 0;
  return normalizeEntry({
    ...entry,
    successScore: round(clamp01(entry.successScore + score.total * 0.02 + reinforcement)),
    confidenceScore: round(clamp01(entry.confidenceScore + score.semanticFit * 0.02 + (context.importance > 0.75 ? 0.03 : 0))),
    reuseCount: recommendation.action === "apply" ? entry.reuseCount + 1 : entry.reuseCount,
    lastUsedAt: context.sourceVideoHash ?? context.sourceVideoId ?? context.videoId ?? entry.lastUsedAt,
    sourceVideoId: context.sourceVideoId ?? context.videoId ?? entry.sourceVideoId,
    active: recommendation.action === "deprecate" ? false : entry.active,
    notes: recommendation.reasons.length > 0 ? `${entry.notes} | ${recommendation.reasons.join(", ")}`.trim() : entry.notes
  });
};

export const mergePatternMemoryEntries = (
  entries: PatternMemoryEntry[],
  updatedEntry: PatternMemoryEntry
): PatternMemoryEntry[] => {
  const index = entries.findIndex((entry) => entry.id === updatedEntry.id);
  if (index < 0) {
    return [...entries, updatedEntry];
  }
  return entries.map((entry, entryIndex) => (entryIndex === index ? updatedEntry : entry));
};

export const createPatternMemoryRejectionReason = (
  reasons: PatternRejectionReason[]
): PatternRejectionReason => {
  return reasons[0] ?? "unknown";
};
