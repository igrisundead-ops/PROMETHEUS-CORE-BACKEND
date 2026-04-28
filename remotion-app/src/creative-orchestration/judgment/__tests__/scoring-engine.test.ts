import {describe, expect, it} from "vitest";

import {AntiRepetitionEngine, CoreJudgmentEngine, NegativeGrammarEngine, ScoringEngine} from "..";
import {buildCandidateFromFamily} from "../rules/treatment-selection";
import {buildJudgmentInput} from "./test-helpers";

describe("scoring engine", () => {
  it("penalizes heavy headline placement on the right when the speaker occupies that third", () => {
    const engine = new CoreJudgmentEngine();
    const scoring = new ScoringEngine();
    const validator = new NegativeGrammarEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const input = buildJudgmentInput({
      speakerMetadata: {
        placementRegion: "right-third",
        faceOccupancy: 0.62,
        dominantSpeaker: true
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const rightHeavy = {
      ...buildCandidateFromFamily("high-authority", snapshot, input),
      placementMode: "right-anchor" as const
    };
    const leftHeavy = {
      ...buildCandidateFromFamily("high-authority", snapshot, input),
      placementMode: "left-anchor" as const
    };

    const rightScore = scoring.scoreCandidate({
      input,
      snapshot,
      candidate: rightHeavy,
      violations: validator.validateCandidate({input, snapshot, candidate: rightHeavy, antiRepetition: antiRepetition.evaluate({snapshot, candidate: rightHeavy})}),
      antiRepetition: antiRepetition.evaluate({snapshot, candidate: rightHeavy})
    });
    const leftScore = scoring.scoreCandidate({
      input,
      snapshot,
      candidate: leftHeavy,
      violations: validator.validateCandidate({input, snapshot, candidate: leftHeavy, antiRepetition: antiRepetition.evaluate({snapshot, candidate: leftHeavy})}),
      antiRepetition: antiRepetition.evaluate({snapshot, candidate: leftHeavy})
    });

    expect(leftScore.finalScore).toBeGreaterThan(rightScore.finalScore);
  });

  it("lets the cleaner legal candidate beat a flashy illegal one", () => {
    const engine = new CoreJudgmentEngine();
    const scoring = new ScoringEngine();
    const validator = new NegativeGrammarEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      sceneAnalysis: {
        sceneDensity: 0.66,
        motionDensity: 0.68,
        backgroundComplexity: 0.64,
        brightness: 0.58,
        negativeSpaceScore: 0.32,
        occlusionRisk: 0.44,
        mobileReadabilityRisk: 0.48,
        activeFocalElements: 2,
        safeZones: ["left-third", "top-safe"],
        busyRegions: ["center"]
      },
      subjectSegmentation: {
        matteConfidence: 0.38,
        subjectRegion: "center",
        behindSubjectTextSupported: true
      },
      creatorStyleProfile: {
        noveltyPreference: 0.88,
        consistencyPreference: 0.22,
        premiumBias: 0.84,
        eleganceBias: 0.8,
        reducedMotionPreference: 0.1,
        humanMadeFeelBias: 0.86,
        avoidCliches: true,
        preferredTreatmentFamilies: [],
        forbiddenTreatmentFamilies: []
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const flashy = {
      ...buildCandidateFromFamily("high-contrast-experimental", snapshot, input),
      matteUsage: "behind-subject-text" as const,
      backgroundTextMode: "hero" as const,
      placementMode: "full-frame" as const
    };
    const safe = buildCandidateFromFamily("safe-premium", snapshot, input);

    const flashyAntiRepetition = antiRepetition.evaluate({snapshot, candidate: flashy});
    const safeAntiRepetition = antiRepetition.evaluate({snapshot, candidate: safe});
    const flashyViolations = validator.validateCandidate({input, snapshot, candidate: flashy, antiRepetition: flashyAntiRepetition});
    const safeViolations = validator.validateCandidate({input, snapshot, candidate: safe, antiRepetition: safeAntiRepetition});
    const flashyScore = scoring.scoreCandidate({input, snapshot, candidate: flashy, violations: flashyViolations, antiRepetition: flashyAntiRepetition});
    const safeScore = scoring.scoreCandidate({input, snapshot, candidate: safe, violations: safeViolations, antiRepetition: safeAntiRepetition});

    const winner = [
      {
        family: flashy.family,
        blocked: flashyViolations.some((violation) => violation.blocking),
        score: flashyScore.finalScore
      },
      {
        family: safe.family,
        blocked: safeViolations.some((violation) => violation.blocking),
        score: safeScore.finalScore
      }
    ].sort((left, right) => Number(left.blocked) - Number(right.blocked) || right.score - left.score)[0];

    expect(flashyViolations.length).toBeGreaterThan(safeViolations.length);
    expect(winner?.family).toBe("safe-premium");
  });
});
