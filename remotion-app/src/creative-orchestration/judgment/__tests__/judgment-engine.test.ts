import {describe, expect, it} from "vitest";

import {CoreJudgmentEngine, CandidateTreatmentEngine} from "..";
import {buildJudgmentInput} from "./test-helpers";

describe("judgment engine", () => {
  it("high emotional punch isolates the punch word", () => {
    const engine = new CoreJudgmentEngine();
    const snapshot = engine.buildPreJudgmentSnapshot(buildJudgmentInput({
      transcriptSegment: "This changes everything",
      moment: {
        transcriptText: "This changes everything",
        momentType: "hook",
        importance: 0.98,
        energy: 0.92
      }
    }));

    expect(snapshot.emphasisTargets.isolatePunchWord).toBe(true);
    expect(snapshot.emphasisTargets.punchWord).toBeTruthy();
  });

  it("skips retrieval when local deterministic treatment is sufficient", () => {
    const engine = new CoreJudgmentEngine();
    const snapshot = engine.buildPreJudgmentSnapshot(buildJudgmentInput({
      transcriptSegment: "Keep it clean and steady",
      moment: {
        transcriptText: "Keep it clean and steady",
        momentType: "ambient",
        importance: 0.44,
        energy: 0.32,
        suggestedIntensity: "minimal"
      },
      agentProposals: [
        {
          id: "proposal-asset-local",
          agentId: "asset-agent",
          momentId: "segment-1",
          type: "asset",
          startMs: 0,
          endMs: 1800,
          priority: 82,
          confidence: 0.88,
          renderCost: "low",
          payload: {
            assetId: "local-card-001"
          },
          reasoning: "Local asset already fits."
        }
      ]
    }));

    expect(snapshot.retrievalDecision.needed).toBe(false);
    expect(snapshot.retrievalDecision.action).toBe("skip");
  });

  it("higher novelty preference increases candidate diversity", () => {
    const engine = new CoreJudgmentEngine();
    const candidateEngine = new CandidateTreatmentEngine();
    const lowNoveltyInput = buildJudgmentInput({
      transcriptSegment: "Here is the framework for growth",
      creatorStyleProfile: {
        noveltyPreference: 0.2,
        consistencyPreference: 0.8,
        premiumBias: 0.84,
        eleganceBias: 0.8,
        reducedMotionPreference: 0.2,
        humanMadeFeelBias: 0.86,
        avoidCliches: true,
        preferredTreatmentFamilies: [],
        forbiddenTreatmentFamilies: []
      }
    });
    const highNoveltyInput = buildJudgmentInput({
      transcriptSegment: "Here is the framework for growth",
      creatorStyleProfile: {
        noveltyPreference: 0.92,
        consistencyPreference: 0.2,
        premiumBias: 0.84,
        eleganceBias: 0.8,
        reducedMotionPreference: 0.2,
        humanMadeFeelBias: 0.86,
        avoidCliches: true,
        preferredTreatmentFamilies: [],
        forbiddenTreatmentFamilies: []
      }
    });

    const lowNoveltyCandidates = candidateEngine.generate(lowNoveltyInput, engine.buildPreJudgmentSnapshot(lowNoveltyInput));
    const highNoveltyCandidates = candidateEngine.generate(highNoveltyInput, engine.buildPreJudgmentSnapshot(highNoveltyInput));

    expect(highNoveltyCandidates.length).toBeGreaterThan(lowNoveltyCandidates.length);
    expect(highNoveltyCandidates.some((candidate) => candidate.family === "high-contrast-experimental")).toBe(true);
  });
});
