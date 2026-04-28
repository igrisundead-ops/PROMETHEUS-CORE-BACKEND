import {describe, expect, it} from "vitest";

import {
  AntiRepetitionEngine,
  CoreJudgmentEngine,
  NegativeGrammarEngine,
  PairwiseTasteCriticEngine,
  ScoringEngine,
  sequenceDecisionSummarySchema,
  summaryToSequenceVisualPattern
} from "..";
import {buildCandidateFromFamily} from "../rules/treatment-selection";
import {buildJudgmentInput} from "./test-helpers";

const buildRecentDecision = (overrides: Partial<ReturnType<typeof sequenceDecisionSummarySchema.parse>> = {}) => {
  return sequenceDecisionSummarySchema.parse({
    segmentId: "recent-1",
    rhetoricalPurpose: "emotional-punch",
    emotionalSpine: "urgency",
    treatmentFamily: "high-contrast-experimental",
    typographyMode: "keyword-only",
    motionMode: "blur-slide-up",
    emphasisMode: "aggressive-isolation",
    placementMode: "full-frame",
    matteUsage: "supporting-depth",
    backgroundTextMode: "hero",
    intensity: "expressive",
    minimalismLevel: "expressive",
    visualDensity: "loud",
    finalScore: 0.88,
    momentType: "hook",
    momentEnergy: 0.9,
    momentImportance: 0.94,
    ...overrides
  });
};

const buildHistoryInput = (recentDecisionPlans: ReturnType<typeof buildRecentDecision>[]) => ({
  recentDecisionPlans,
  recentVisualPatterns: recentDecisionPlans.map((summary) => summaryToSequenceVisualPattern(summary))
});

const buildCandidateEvaluation = (input: ReturnType<typeof buildJudgmentInput>, candidate: ReturnType<typeof buildCandidateFromFamily>) => {
  const antiRepetitionEngine = new AntiRepetitionEngine();
  const validator = new NegativeGrammarEngine();
  const scoringEngine = new ScoringEngine();
  const engine = new CoreJudgmentEngine();
  const snapshot = engine.buildPreJudgmentSnapshot(input);
  const antiRepetition = antiRepetitionEngine.evaluate({snapshot, candidate});
  const violations = validator.validateCandidate({input, snapshot, candidate, antiRepetition});
  const scoring = scoringEngine.scoreCandidate({input, snapshot, candidate, violations, antiRepetition});
  return {
    snapshot,
    evaluation: {
      candidate,
      antiRepetition,
      violations,
      scoring,
      blocked: violations.some((violation) => violation.blocking)
    }
  };
};

describe("pairwise taste critic", () => {
  it("chooses a restrained candidate after a loud sequence even if the flashy candidate has a slightly higher base score", () => {
    const critic = new PairwiseTasteCriticEngine();
    const engine = new CoreJudgmentEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "Here is the framework that keeps the system clean",
      moment: {
        transcriptText: "Here is the framework that keeps the system clean",
        momentType: "explanation",
        importance: 0.76,
        energy: 0.58,
        suggestedIntensity: "medium"
      },
      ...buildHistoryInput([
        buildRecentDecision({segmentId: "loud-1"}),
        buildRecentDecision({segmentId: "loud-2"})
      ])
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const restrained = buildCandidateFromFamily("luxury-minimal", snapshot, input);
    const flashy = buildCandidateFromFamily("high-contrast-experimental", snapshot, input);
    const restrainedResult = buildCandidateEvaluation(input, restrained);
    const flashyResult = buildCandidateEvaluation(input, flashy);
    const normalizedComparison = critic.compareCandidates({
      judgmentInput: input,
      snapshot,
      evaluationA: {
        ...restrainedResult.evaluation,
        scoring: {
          ...restrainedResult.evaluation.scoring,
          finalScore: 0.74
        }
      },
      evaluationB: {
        ...flashyResult.evaluation,
        scoring: {
          ...flashyResult.evaluation.scoring,
          finalScore: 0.76
        }
      }
    });

    expect(normalizedComparison.baseScoreDelta).toBeLessThan(0);
    expect(normalizedComparison.winnerCandidateId).toBe(restrained.id);
    expect(normalizedComparison.reasons.some((reason) => /contrast after recent loud beats/i.test(reason))).toBe(true);
  });

  it("rejects a repeated motion signature when a cleaner alternative exists", () => {
    const critic = new PairwiseTasteCriticEngine();
    const engine = new CoreJudgmentEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "Push this forward",
      ...buildHistoryInput([
        buildRecentDecision({segmentId: "motion-1", motionMode: "blur-slide-up"}),
        buildRecentDecision({segmentId: "motion-2", motionMode: "blur-slide-up"})
      ])
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const repeatedMotion = {
      ...buildCandidateFromFamily("expressive-premium", snapshot, input),
      motionMode: "blur-slide-up"
    };
    const contrastMotion = {
      ...buildCandidateFromFamily("emotional-cinematic", snapshot, input),
      motionMode: "light-sweep-reveal",
      matteUsage: "supporting-depth" as const
    };
    const comparison = critic.compareCandidates({
      judgmentInput: input,
      snapshot,
      evaluationA: buildCandidateEvaluation(input, repeatedMotion).evaluation,
      evaluationB: buildCandidateEvaluation(input, contrastMotion).evaluation
    });

    expect(comparison.winnerCandidateId).toBe(contrastMotion.id);
    expect(comparison.riskFlags.some((flag) => flag.includes("repeated-motion-signature"))).toBe(true);
    expect(comparison.reasons.some((reason) => /repeats the same blur-slide-up motion signature/i.test(reason))).toBe(true);
  });

  it("prefers a readable treatment over a visually complex one", () => {
    const critic = new PairwiseTasteCriticEngine();
    const engine = new CoreJudgmentEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "Build trust with proof and clarity",
      sceneAnalysis: {
        sceneDensity: 0.82,
        motionDensity: 0.76,
        backgroundComplexity: 0.84,
        brightness: 0.6,
        negativeSpaceScore: 0.24,
        occlusionRisk: 0.46,
        activeFocalElements: 3,
        safeZones: ["top-safe", "bottom-safe"],
        busyRegions: ["center", "right-third"],
        mobileReadabilityRisk: 0.72
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const readable = buildCandidateFromFamily("safe-premium", snapshot, input);
    const complex = buildCandidateFromFamily("high-contrast-experimental", snapshot, input);
    const comparison = critic.compareCandidates({
      judgmentInput: input,
      snapshot,
      evaluationA: buildCandidateEvaluation(input, readable).evaluation,
      evaluationB: buildCandidateEvaluation(input, complex).evaluation
    });

    expect(comparison.winnerCandidateId).toBe(readable.id);
    expect(comparison.tasteDimensions.readability.favoredCandidateId).toBe(readable.id);
    expect(comparison.reasons.some((reason) => /readability/i.test(reason))).toBe(true);
  });

  it("prefers punch-word isolation for an emotional-punch moment", () => {
    const critic = new PairwiseTasteCriticEngine();
    const engine = new CoreJudgmentEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      moment: {
        transcriptText: "This changes everything",
        momentType: "hook",
        importance: 0.94,
        energy: 0.9
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const isolated = buildCandidateFromFamily("expressive-premium", snapshot, input);
    const nonIsolated = buildCandidateFromFamily("safe-premium", snapshot, input);
    const comparison = critic.compareCandidates({
      judgmentInput: input,
      snapshot,
      evaluationA: buildCandidateEvaluation(input, isolated).evaluation,
      evaluationB: buildCandidateEvaluation(input, nonIsolated).evaluation
    });

    expect(comparison.winnerCandidateId).toBe(isolated.id);
    expect(comparison.reasons.some((reason) => /isolates the punch word/i.test(reason))).toBe(true);
  });

  it("preserves a luxury minimal treatment for a premium low-energy moment", () => {
    const critic = new PairwiseTasteCriticEngine();
    const engine = new CoreJudgmentEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "A refined premium system with quiet confidence",
      moment: {
        transcriptText: "A refined premium system with quiet confidence",
        momentType: "title",
        importance: 0.78,
        energy: 0.34,
        suggestedIntensity: "minimal"
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const luxuryMinimal = buildCandidateFromFamily("luxury-minimal", snapshot, input);
    const expressive = buildCandidateFromFamily("expressive-premium", snapshot, input);
    const comparison = critic.compareCandidates({
      judgmentInput: input,
      snapshot,
      evaluationA: buildCandidateEvaluation(input, luxuryMinimal).evaluation,
      evaluationB: buildCandidateEvaluation(input, expressive).evaluation
    });

    expect(comparison.winnerCandidateId).toBe(luxuryMinimal.id);
    expect(comparison.reasons.some((reason) => /luxury restraint/i.test(reason))).toBe(true);
  });

  it("stores critic reasons and pairwise comparisons in the final plan audit and trace", async () => {
    const engine = new CoreJudgmentEngine();
    const plan = await engine.plan(buildJudgmentInput({
      transcriptSegment: "This changes everything",
      moment: {
        transcriptText: "This changes everything",
        momentType: "hook",
        importance: 0.92,
        energy: 0.88
      },
      ...buildHistoryInput([
        buildRecentDecision({segmentId: "recent-1"}),
        buildRecentDecision({segmentId: "recent-2", motionMode: "light-sweep-reveal"})
      ])
    }));

    expect(plan.pairwiseTasteComparisons.length).toBeGreaterThan(0);
    expect(plan.criticSelectedCandidateId).toBe(plan.selectedTreatment.id);
    expect(plan.criticRationale.length).toBeGreaterThan(0);
    expect(plan.audit.pairwiseTasteComparisons.length).toBe(plan.pairwiseTasteComparisons.length);
    expect(plan.audit.criticRationale.length).toBeGreaterThan(0);
    expect(plan.trace.some((entry) => entry.step === "pairwise-taste-critic")).toBe(true);
  });
});
