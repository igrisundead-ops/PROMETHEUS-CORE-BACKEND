import {describe, expect, it} from "vitest";

import {AntiRepetitionEngine, CoreJudgmentEngine, NegativeGrammarEngine} from "..";
import {buildCandidateFromFamily} from "../rules/treatment-selection";
import {buildJudgmentInput} from "./test-helpers";

describe("negative grammar", () => {
  it("blocks dense typography on a busy frame", () => {
    const engine = new CoreJudgmentEngine();
    const validator = new NegativeGrammarEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const input = buildJudgmentInput({
      sceneAnalysis: {
        sceneDensity: 0.9,
        motionDensity: 0.78,
        backgroundComplexity: 0.92,
        brightness: 0.45,
        negativeSpaceScore: 0.18,
        occlusionRisk: 0.5,
        mobileReadabilityRisk: 0.76,
        activeFocalElements: 3,
        safeZones: ["top-safe"],
        busyRegions: ["center", "right-third"]
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const candidate = buildCandidateFromFamily("safe-premium", snapshot, input);
    const violations = validator.validateCandidate({input, snapshot, candidate, antiRepetition: antiRepetition.evaluate({snapshot, candidate})});

    expect(snapshot.spatialConstraints.denseTextAllowed).toBe(false);
    expect(violations.some((violation) => violation.ruleId === "avoid-dense-typography-on-busy-backgrounds" && violation.blocking)).toBe(true);
  });

  it("blocks cursive mode for long informational copy", () => {
    const engine = new CoreJudgmentEngine();
    const validator = new NegativeGrammarEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "This is a long informational explanation that should stay clear readable and structured for the audience",
      moment: {
        transcriptText: "This is a long informational explanation that should stay clear readable and structured for the audience",
        words: "This is a long informational explanation that should stay clear readable and structured for the audience".split(/\s+/).map((word, index) => ({
          text: word,
          startMs: index * 160,
          endMs: index * 160 + 120
        })),
        momentType: "explanation",
        importance: 0.68,
        energy: 0.48
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const candidate = {
      ...buildCandidateFromFamily("safe-premium", snapshot, input),
      typographyMode: "editorial-cursive"
    };
    const violations = validator.validateCandidate({input, snapshot, candidate, antiRepetition: antiRepetition.evaluate({snapshot, candidate})});

    expect(violations.some((violation) => violation.ruleId === "block-cursive-for-long-informational-copy" && violation.blocking)).toBe(true);
  });

  it("blocks behind-subject critical text when matte confidence is weak", () => {
    const engine = new CoreJudgmentEngine();
    const validator = new NegativeGrammarEngine();
    const antiRepetition = new AntiRepetitionEngine();
    const input = buildJudgmentInput({
      transcriptSegment: "This changes everything",
      subjectSegmentation: {
        matteConfidence: 0.32,
        subjectRegion: "center",
        behindSubjectTextSupported: true
      }
    });
    const snapshot = engine.buildPreJudgmentSnapshot(input);
    const candidate = {
      ...buildCandidateFromFamily("emotional-cinematic", snapshot, input),
      matteUsage: "behind-subject-text" as const
    };
    const violations = validator.validateCandidate({input, snapshot, candidate, antiRepetition: antiRepetition.evaluate({snapshot, candidate})});

    expect(violations.some((violation) => violation.ruleId === "block-behind-subject-text-with-weak-matte" && violation.blocking)).toBe(true);
  });
});
