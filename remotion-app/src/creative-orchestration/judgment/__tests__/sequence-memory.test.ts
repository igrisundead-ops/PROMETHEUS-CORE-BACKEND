import {describe, expect, it} from "vitest";

import {
  AntiRepetitionEngine,
  CoreJudgmentEngine,
  NegativeGrammarEngine,
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
    motionMode: "zoom-through-layer",
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

describe("sequence memory", () => {
  it("penalizes consecutive repeated flashy treatments across the sequence", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const scoring = new ScoringEngine();
    const validator = new NegativeGrammarEngine();
    const repeatedHistory = [
      buildRecentDecision({segmentId: "recent-1"}),
      buildRecentDecision({segmentId: "recent-2"})
    ];
    const input = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      moment: {
        transcriptText: "This changes everything",
        momentType: "hook",
        importance: 0.86,
        energy: 0.82
      },
      ...buildHistoryInput(repeatedHistory)
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const flashy = buildCandidateFromFamily("high-contrast-experimental", snapshot, input);
    const flashyAntiRepetition = antiRepetition.evaluate({snapshot, candidate: flashy});
    const flashyViolations = validator.validateCandidate({input, snapshot, candidate: flashy, antiRepetition: flashyAntiRepetition});
    const flashyScore = scoring.scoreCandidate({input, snapshot, candidate: flashy, violations: flashyViolations, antiRepetition: flashyAntiRepetition});

    expect(flashyAntiRepetition.repetitionPenalty).toBeGreaterThan(0.35);
    expect(flashyScore.repetitionPenalty).toBeGreaterThan(0.35);
  });

  it("lets a restrained candidate win after multiple loud beats", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const scoring = new ScoringEngine();
    const validator = new NegativeGrammarEngine();
    const repeatedHistory = [
      buildRecentDecision({segmentId: "recent-1"}),
      buildRecentDecision({segmentId: "recent-2"})
    ];
    const input = buildJudgmentInput({
      transcriptSegment: "Here is the framework that keeps the system clear",
      moment: {
        transcriptText: "Here is the framework that keeps the system clear",
        momentType: "explanation",
        importance: 0.74,
        energy: 0.58,
        suggestedIntensity: "medium"
      },
      ...buildHistoryInput(repeatedHistory)
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const restrained = buildCandidateFromFamily("safe-premium", snapshot, input);
    const flashy = buildCandidateFromFamily("high-contrast-experimental", snapshot, input);
    const restrainedAntiRepetition = antiRepetition.evaluate({snapshot, candidate: restrained});
    const flashyAntiRepetition = antiRepetition.evaluate({snapshot, candidate: flashy});
    const restrainedScore = scoring.scoreCandidate({
      input,
      snapshot,
      candidate: restrained,
      violations: validator.validateCandidate({input, snapshot, candidate: restrained, antiRepetition: restrainedAntiRepetition}),
      antiRepetition: restrainedAntiRepetition
    });
    const flashyViolations = validator.validateCandidate({input, snapshot, candidate: flashy, antiRepetition: flashyAntiRepetition});
    const flashyScore = scoring.scoreCandidate({
      input,
      snapshot,
      candidate: flashy,
      violations: flashyViolations,
      antiRepetition: flashyAntiRepetition
    });
    const winner = [
      {
        family: restrained.family,
        blocked: false,
        score: restrainedScore.finalScore
      },
      {
        family: flashy.family,
        blocked: flashyViolations.some((violation) => violation.blocking),
        score: flashyScore.finalScore
      }
    ].sort((left, right) => Number(left.blocked) - Number(right.blocked) || right.score - left.score)[0];

    expect(winner?.family).toBe("safe-premium");
  });

  it("blocks repeated behind-subject text across adjacent beats", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const validator = new NegativeGrammarEngine();
    const priorBehindSubject = buildRecentDecision({
      segmentId: "recent-behind-subject",
      treatmentFamily: "emotional-cinematic",
      motionMode: "light-sweep-reveal",
      emphasisMode: "isolated-punch-word",
      placementMode: "behind-subject",
      matteUsage: "behind-subject-text",
      backgroundTextMode: "hero",
      visualDensity: "loud"
    });
    const input = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      subjectSegmentation: {
        matteConfidence: 0.92,
        subjectRegion: "center",
        behindSubjectTextSupported: true
      },
      ...buildHistoryInput([priorBehindSubject])
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const candidate = {
      ...buildCandidateFromFamily("emotional-cinematic", snapshot, input),
      matteUsage: "behind-subject-text" as const
    };
    const violations = validator.validateCandidate({
      input,
      snapshot,
      candidate,
      antiRepetition: antiRepetition.evaluate({snapshot, candidate})
    });

    expect(violations.some((violation) => violation.ruleId === "avoid-repeated-behind-subject-text-across-adjacent-beats" && violation.blocking)).toBe(true);
  });

  it("raises contrast and pacing scores when the recent sequence is repetitive", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const scoring = new ScoringEngine();
    const validator = new NegativeGrammarEngine();
    const repeatedHistory = [
      buildRecentDecision({segmentId: "recent-1"}),
      buildRecentDecision({segmentId: "recent-2"})
    ];
    const baseInput = buildJudgmentInput({
      transcriptSegment: "Keep the explanation clean",
      moment: {
        transcriptText: "Keep the explanation clean",
        momentType: "explanation",
        importance: 0.68,
        energy: 0.44
      }
    });
    const sequenceAwareInput = buildJudgmentInput({
      transcriptSegment: "Keep the explanation clean",
      moment: {
        transcriptText: "Keep the explanation clean",
        momentType: "explanation",
        importance: 0.68,
        energy: 0.44
      },
      ...buildHistoryInput(repeatedHistory)
    });
    const isolatedSnapshot = engine.buildPreJudgmentSnapshot(baseInput);
    const sequenceSnapshot = engine.buildPreJudgmentSnapshot(sequenceAwareInput);
    const candidateIsolated = buildCandidateFromFamily("safe-premium", isolatedSnapshot, baseInput);
    const candidateSequence = buildCandidateFromFamily("safe-premium", sequenceSnapshot, sequenceAwareInput);
    const isolatedAnti = antiRepetition.evaluate({snapshot: isolatedSnapshot, candidate: candidateIsolated});
    const sequenceAnti = antiRepetition.evaluate({snapshot: sequenceSnapshot, candidate: candidateSequence});
    const isolatedScore = scoring.scoreCandidate({
      input: baseInput,
      snapshot: isolatedSnapshot,
      candidate: candidateIsolated,
      violations: validator.validateCandidate({input: baseInput, snapshot: isolatedSnapshot, candidate: candidateIsolated, antiRepetition: isolatedAnti}),
      antiRepetition: isolatedAnti
    });
    const sequenceScore = scoring.scoreCandidate({
      input: sequenceAwareInput,
      snapshot: sequenceSnapshot,
      candidate: candidateSequence,
      violations: validator.validateCandidate({input: sequenceAwareInput, snapshot: sequenceSnapshot, candidate: candidateSequence, antiRepetition: sequenceAnti}),
      antiRepetition: sequenceAnti
    });

    expect(sequenceScore.sequenceContrastScore).toBeGreaterThan(isolatedScore.sequenceContrastScore);
    expect(sequenceScore.pacingVariationScore).toBeGreaterThan(isolatedScore.pacingVariationScore);
    expect(sequenceScore.noveltyAcrossSequenceScore).toBeGreaterThan(isolatedScore.noveltyAcrossSequenceScore);
  });

  it("changes the winner when sequence history makes repetition too costly", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const scoring = new ScoringEngine();
    const validator = new NegativeGrammarEngine();
    const isolatedInput = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      moment: {
        transcriptText: "This changes everything",
        momentType: "hook",
        importance: 0.9,
        energy: 0.88,
        suggestedIntensity: "hero"
      }
    });
    const sequenceAwareInput = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      moment: {
        transcriptText: "This changes everything",
        momentType: "hook",
        importance: 0.9,
        energy: 0.88,
        suggestedIntensity: "hero"
      },
      ...buildHistoryInput([
        buildRecentDecision({segmentId: "recent-1"}),
        buildRecentDecision({segmentId: "recent-2"})
      ])
    });

    const scorePair = (input: typeof isolatedInput) => {
      const snapshot = engine.buildPreJudgmentSnapshot(input);
      const restrained = buildCandidateFromFamily("safe-premium", snapshot, input);
      const expressive = buildCandidateFromFamily("expressive-premium", snapshot, input);
      const restrainedAnti = antiRepetition.evaluate({snapshot, candidate: restrained});
      const expressiveAnti = antiRepetition.evaluate({snapshot, candidate: expressive});
      const restrainedScore = scoring.scoreCandidate({
        input,
        snapshot,
        candidate: restrained,
        violations: validator.validateCandidate({input, snapshot, candidate: restrained, antiRepetition: restrainedAnti}),
        antiRepetition: restrainedAnti
      });
      const expressiveScore = scoring.scoreCandidate({
        input,
        snapshot,
        candidate: expressive,
        violations: validator.validateCandidate({input, snapshot, candidate: expressive, antiRepetition: expressiveAnti}),
        antiRepetition: expressiveAnti
      });
      return restrainedScore.finalScore > expressiveScore.finalScore ? "safe-premium" : "expressive-premium";
    };

    expect(scorePair(isolatedInput)).toBe("expressive-premium");
    expect(scorePair(sequenceAwareInput)).toBe("safe-premium");
  });

  it("repeated emotional peaks trigger pacing correction and favor a reset beat", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const scoring = new ScoringEngine();
    const validator = new NegativeGrammarEngine();
    const repeatedPeakHistory = [
      buildRecentDecision({segmentId: "peak-1", emotionalSpine: "urgency", momentEnergy: 0.94, momentImportance: 0.95, heroMoment: true, emotionalPeak: true, visualClimax: true}),
      buildRecentDecision({segmentId: "peak-2", emotionalSpine: "surprise", momentEnergy: 0.96, momentImportance: 0.96, heroMoment: true, emotionalPeak: true, visualClimax: true})
    ];
    const input = buildJudgmentInput({
      transcriptSegment: "Now let it land with confidence",
      moment: {
        transcriptText: "Now let it land with confidence",
        momentType: "explanation",
        importance: 0.74,
        energy: 0.84,
        suggestedIntensity: "medium"
      },
      ...buildHistoryInput(repeatedPeakHistory)
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const calmCandidate = buildCandidateFromFamily("luxury-minimal", snapshot, input);
    const loudCandidate = buildCandidateFromFamily("expressive-premium", snapshot, input);
    const calmAnti = antiRepetition.evaluate({snapshot, candidate: calmCandidate});
    const loudAnti = antiRepetition.evaluate({snapshot, candidate: loudCandidate});
    const calmScore = scoring.scoreCandidate({
      input,
      snapshot,
      candidate: calmCandidate,
      violations: validator.validateCandidate({input, snapshot, candidate: calmCandidate, antiRepetition: calmAnti}),
      antiRepetition: calmAnti
    });
    const loudViolations = validator.validateCandidate({input, snapshot, candidate: loudCandidate, antiRepetition: loudAnti});
    const loudScore = scoring.scoreCandidate({
      input,
      snapshot,
      candidate: loudCandidate,
      violations: loudViolations,
      antiRepetition: loudAnti
    });

    expect(snapshot.recentSequenceMetrics.consecutiveEmotionalPeakMoments).toBeGreaterThanOrEqual(2);
    expect(loudViolations.some((violation) => violation.ruleId === "avoid-repeated-emotional-peaks-without-reset")).toBe(true);
    expect(calmScore.emotionalProgressionScore).toBeGreaterThan(loudScore.emotionalProgressionScore);
  });

  it("penalizes the same typography mode when it repeats too often", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const validator = new NegativeGrammarEngine();
    const repeatedTypographyHistory = [
      buildRecentDecision({segmentId: "type-1", typographyMode: "keyword-only", motionMode: "blur-slide-up", emphasisMode: "isolated-punch-word"}),
      buildRecentDecision({segmentId: "type-2", typographyMode: "keyword-only", motionMode: "light-sweep-reveal", emphasisMode: "isolated-punch-word"}),
      buildRecentDecision({segmentId: "type-3", typographyMode: "keyword-only", motionMode: "zoom-through-layer", emphasisMode: "aggressive-isolation"})
    ];
    const input = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      ...buildHistoryInput(repeatedTypographyHistory)
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const candidate = buildCandidateFromFamily("expressive-premium", snapshot, input);
    const anti = antiRepetition.evaluate({snapshot, candidate});
    const violations = validator.validateCandidate({input, snapshot, candidate, antiRepetition: anti});

    expect(snapshot.recentSequenceMetrics.consecutiveRepeatedTypographyModeMoments).toBeGreaterThanOrEqual(3);
    expect(anti.repeatedTypographyModeCount).toBeGreaterThanOrEqual(3);
    expect(violations.some((violation) => violation.ruleId === "avoid-repeating-typography-signature")).toBe(true);
  });

  it("penalizes the same motion signature when it repeats too often", () => {
    const engine = new CoreJudgmentEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const validator = new NegativeGrammarEngine();
    const repeatedMotionHistory = [
      buildRecentDecision({segmentId: "motion-1", motionMode: "blur-slide-up", typographyMode: "keyword-only"}),
      buildRecentDecision({segmentId: "motion-2", motionMode: "blur-slide-up", typographyMode: "title-card"}),
      buildRecentDecision({segmentId: "motion-3", motionMode: "blur-slide-up", typographyMode: "full-caption"})
    ];
    const input = buildJudgmentInput({
      transcriptSegment: "Push this forward",
      ...buildHistoryInput(repeatedMotionHistory)
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const candidate = {
      ...buildCandidateFromFamily("expressive-premium", snapshot, input),
      motionMode: "blur-slide-up"
    };
    const anti = antiRepetition.evaluate({snapshot, candidate});
    const violations = validator.validateCandidate({input, snapshot, candidate, antiRepetition: anti});

    expect(snapshot.recentSequenceMetrics.consecutiveRepeatedMotionSignatureMoments).toBeGreaterThanOrEqual(3);
    expect(anti.repeatedMotionModeCount).toBeGreaterThanOrEqual(3);
    expect(violations.some((violation) => violation.ruleId === "avoid-repeating-motion-signature")).toBe(true);
  });
});
