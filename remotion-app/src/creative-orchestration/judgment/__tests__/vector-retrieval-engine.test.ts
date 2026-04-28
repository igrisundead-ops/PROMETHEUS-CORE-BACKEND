import {describe, expect, it} from "vitest";

import {CandidateTreatmentEngine, CoreJudgmentEngine} from "..";
import {VectorRetrievalEngine, type VectorSearchTransport} from "../engines/vector-retrieval-engine";
import {buildJudgmentInput} from "./test-helpers";
import type {CandidateTreatmentProfile} from "../types";
import {preJudgmentSnapshotSchema} from "../types";
import {vectorSearchResponseSchema, type VectorSearchHit, type VectorSearchRequest, type VectorSearchResponse} from "../../../lib/vector/schemas";

const candidateEngine = new CandidateTreatmentEngine();

const resolveSelectedTreatment = ({
  input,
  snapshot
}: {
  input: ReturnType<typeof buildJudgmentInput>;
  snapshot: ReturnType<CoreJudgmentEngine["buildPreJudgmentSnapshot"]>;
}): CandidateTreatmentProfile => {
  return candidateEngine.generate(input, snapshot)[0]!;
};

const withAction = (
  snapshot: ReturnType<CoreJudgmentEngine["buildPreJudgmentSnapshot"]>,
  action: string,
  allowedLibraries: string[]
) => {
  return preJudgmentSnapshotSchema.parse({
    ...snapshot,
    retrievalDecision: {
      ...snapshot.retrievalDecision,
      needed: action !== "skip",
      action,
      skipReason: action === "skip" ? "Test override." : null,
      allowedLibraries
    }
  });
};

const buildHit = (overrides: Partial<VectorSearchHit>): VectorSearchHit => ({
  id: overrides.id ?? `hit-${Math.random().toString(16).slice(2)}`,
  assetId: overrides.assetId ?? "asset-1",
  assetType: overrides.assetType ?? "motion_graphic",
  partition: overrides.partition ?? "motion_graphics",
  sourceLibrary: overrides.sourceLibrary ?? "test-library",
  title: overrides.title ?? "Test Asset",
  relativePath: overrides.relativePath ?? "assets/test",
  absolutePath: overrides.absolutePath ?? "",
  publicPath: overrides.publicPath ?? "/assets/test",
  vectorSearchText: overrides.vectorSearchText ?? "premium cinematic motion support",
  literalTags: overrides.literalTags ?? ["premium", "motion"],
  semanticTags: overrides.semanticTags ?? ["authority", "clarity"],
  rhetoricalRoles: overrides.rhetoricalRoles ?? ["authority", "hook"],
  emotionalRoles: overrides.emotionalRoles ?? ["confidence", "premium"],
  motionTags: overrides.motionTags ?? ["blur_to_clarity"],
  styleFamily: overrides.styleFamily ?? ["cinematic_premium"],
  creatorFit: overrides.creatorFit ?? ["premium_creator"],
  sceneUseCases: overrides.sceneUseCases ?? ["founder_intro"],
  symbolicMeaning: overrides.symbolicMeaning ?? ["authority"],
  compatibility: overrides.compatibility ?? ["supportsBehindSubjectText"],
  negativeGrammar: overrides.negativeGrammar ?? [],
  renderComplexity: overrides.renderComplexity ?? "medium",
  visualEnergy: overrides.visualEnergy ?? "moderate",
  supportedAspectRatios: overrides.supportedAspectRatios ?? ["9:16"],
  replaceableSlots: overrides.replaceableSlots ?? [],
  features: overrides.features ?? [],
  metadataJson: overrides.metadataJson ?? {},
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  vectorScore: overrides.vectorScore ?? 0.86,
  backendScore: overrides.backendScore ?? 0.86
});

const buildResponse = (request: VectorSearchRequest, hits: VectorSearchHit[]): VectorSearchResponse => {
  return vectorSearchResponseSchema.parse({
    requestId: request.requestId,
    backend: "milvus",
    collection: "prometheus_creative_assets",
    partitions: request.partitions,
    totalCandidates: hits.length,
    warnings: [],
    results: hits
  });
};

const createTransport = (
  resolver: (requests: VectorSearchRequest[]) => VectorSearchResponse[] | Promise<VectorSearchResponse[]>
): {transport: VectorSearchTransport; calls: VectorSearchRequest[][]} => {
  const calls: VectorSearchRequest[][] = [];
  return {
    calls,
    transport: {
      async search(requests: VectorSearchRequest[]): Promise<VectorSearchResponse[]> {
        calls.push(requests);
        return resolver(requests);
      }
    }
  };
};

describe("vector retrieval engine", () => {
  it("skip action does not call Milvus", async () => {
    const input = buildJudgmentInput({
      transcriptSegment: "Keep it clean and steady",
      moment: {
        transcriptText: "Keep it clean and steady",
        momentType: "ambient",
        importance: 0.4,
        energy: 0.22,
        suggestedIntensity: "minimal"
      },
      agentProposals: [
        {
          id: "local-asset",
          agentId: "asset-agent",
          momentId: "segment-1",
          type: "asset",
          startMs: 0,
          endMs: 1800,
          priority: 80,
          confidence: 0.9,
          renderCost: "low",
          payload: {},
          reasoning: "Strong local coverage."
        }
      ]
    });
    const baseEngine = new CoreJudgmentEngine();
    const snapshot = baseEngine.buildPreJudgmentSnapshot(input);
    const selectedTreatment = resolveSelectedTreatment({input, snapshot});
    const {transport, calls} = createTransport(() => []);
    const retrievalEngine = new VectorRetrievalEngine(transport);

    await retrievalEngine.retrieve({input, snapshot, selectedTreatment});

    expect(calls).toHaveLength(0);
  });

  it("retrieve-typography-only searches only the typography partition", async () => {
    const input = buildJudgmentInput();
    const baseEngine = new CoreJudgmentEngine();
    const snapshot = withAction(baseEngine.buildPreJudgmentSnapshot(input), "retrieve-typography-only", ["typography-library"]);
    const selectedTreatment = resolveSelectedTreatment({input, snapshot});
    const {transport, calls} = createTransport((requests) => requests.map((request) => buildResponse(request, [])));
    const retrievalEngine = new VectorRetrievalEngine(transport);

    await retrievalEngine.retrieve({input, snapshot, selectedTreatment});

    expect(calls[0]?.[0]?.partitions).toEqual(["typography"]);
  });

  it("retrieve-motion-only searches motion graphics and GSAP partitions", async () => {
    const input = buildJudgmentInput();
    const baseEngine = new CoreJudgmentEngine();
    const snapshot = withAction(baseEngine.buildPreJudgmentSnapshot(input), "retrieve-motion-only", ["motion-library", "gsap-library"]);
    const selectedTreatment = resolveSelectedTreatment({input, snapshot});
    const {transport, calls} = createTransport((requests) => requests.map((request) => buildResponse(request, [])));
    const retrievalEngine = new VectorRetrievalEngine(transport);

    await retrievalEngine.retrieve({input, snapshot, selectedTreatment});

    expect(calls[0]?.[0]?.partitions).toEqual(["motion_graphics", "gsap_animation_logic"]);
  });

  it("forbidden pairings are rejected after retrieval", async () => {
    const input = buildJudgmentInput({
      transcriptSegment: "premium creator hook",
      moment: {
        transcriptText: "premium creator hook",
        momentType: "hook",
        importance: 0.9,
        energy: 0.84
      }
    });
    const baseEngine = new CoreJudgmentEngine();
    const snapshot = withAction(baseEngine.buildPreJudgmentSnapshot(input), "retrieve-motion-only", ["motion-library", "gsap-library"]);
    const selectedTreatment = resolveSelectedTreatment({input, snapshot});
    const {transport} = createTransport((requests) => requests.map((request) => buildResponse(request, [
      buildHit({
        assetId: "forbidden-motion",
        assetType: "gsap_animation_logic",
        partition: "gsap_animation_logic",
        negativeGrammar: ["premium creator hook should never be paired with this scene"],
        vectorScore: 0.95
      }),
      buildHit({
        assetId: "safe-motion",
        assetType: "motion_graphic",
        partition: "motion_graphics",
        negativeGrammar: [],
        vectorScore: 0.84
      })
    ])));
    const retrievalEngine = new VectorRetrievalEngine(transport);

    const result = await retrievalEngine.retrieve({input, snapshot, selectedTreatment});

    expect(result.rejectedAssetCandidates.some((candidate) => candidate.assetId === "forbidden-motion")).toBe(true);
    expect(result.rankedAssetCandidates.some((candidate) => candidate.assetId === "safe-motion")).toBe(true);
  });

  it("high render cost assets are penalized for low-importance beats", async () => {
    const input = buildJudgmentInput({
      moment: {
        importance: 0.34,
        energy: 0.5,
        transcriptText: "quiet explanation",
        momentType: "explanation"
      },
      transcriptSegment: "quiet explanation"
    });
    const baseEngine = new CoreJudgmentEngine();
    const snapshot = withAction(baseEngine.buildPreJudgmentSnapshot(input), "retrieve-motion-only", ["motion-library"]);
    const selectedTreatment = resolveSelectedTreatment({input, snapshot});
    const {transport} = createTransport((requests) => requests.map((request) => buildResponse(request, [
      buildHit({
        assetId: "high-cost",
        renderComplexity: "high",
        vectorScore: 0.9
      }),
      buildHit({
        assetId: "low-cost",
        renderComplexity: "low",
        vectorScore: 0.82
      })
    ])));
    const retrievalEngine = new VectorRetrievalEngine(transport);

    const result = await retrievalEngine.retrieve({input, snapshot, selectedTreatment});

    expect(result.rankedAssetCandidates[0]?.assetId).toBe("low-cost");
  });

  it("repeated motion signatures are penalized using sequence memory", async () => {
    const input = buildJudgmentInput();
    const baseEngine = new CoreJudgmentEngine();
    const baseSnapshot = baseEngine.buildPreJudgmentSnapshot(input);
    const snapshot = withAction({
      ...baseSnapshot,
      recentDecisionPlans: [
        {
          segmentId: "recent-1",
          rhetoricalPurpose: "authority",
          emotionalSpine: "confidence",
          treatmentFamily: "expressive-premium",
          typographyMode: "keyword-only",
          motionMode: "blur_to_clarity",
          emphasisMode: "isolate-punch-word",
          placementMode: "center-stage",
          matteUsage: "none",
          backgroundTextMode: "none",
          intensity: "expressive",
          minimalismLevel: "expressive",
          visualDensity: "balanced",
          finalScore: 0.88,
          retrievalAction: "retrieve-motion-only",
          negativeGrammarRuleIds: [],
          heroMoment: true,
          visualClimax: false,
          emotionalPeak: false,
          focalStructure: [],
          premiumTricks: []
        }
      ]
    } as typeof baseSnapshot, "retrieve-motion-only", ["motion-library"]);
    const selectedTreatment = resolveSelectedTreatment({input, snapshot});
    const {transport} = createTransport((requests) => requests.map((request) => buildResponse(request, [
      buildHit({
        assetId: "repeat-motion",
        motionTags: ["blur_to_clarity"],
        vectorScore: 0.88
      }),
      buildHit({
        assetId: "fresh-motion",
        motionTags: ["parallax_drift"],
        vectorScore: 0.8
      })
    ])));
    const retrievalEngine = new VectorRetrievalEngine(transport);

    const result = await retrievalEngine.retrieve({input, snapshot, selectedTreatment});

    expect(result.rankedAssetCandidates[0]?.assetId).toBe("fresh-motion");
  });

  it("creator style changes the ranked winner", async () => {
    const premiumInput = buildJudgmentInput({
      creatorStyleProfile: {
        noveltyPreference: 0.2,
        consistencyPreference: 0.8,
        premiumBias: 0.96,
        eleganceBias: 0.9,
        reducedMotionPreference: 0.2,
        humanMadeFeelBias: 0.9,
        avoidCliches: true,
        preferredTreatmentFamilies: [],
        forbiddenTreatmentFamilies: []
      }
    });
    const exploratoryInput = buildJudgmentInput({
      creatorStyleProfile: {
        noveltyPreference: 0.95,
        consistencyPreference: 0.1,
        premiumBias: 0.2,
        eleganceBias: 0.4,
        reducedMotionPreference: 0.2,
        humanMadeFeelBias: 0.8,
        avoidCliches: true,
        preferredTreatmentFamilies: [],
        forbiddenTreatmentFamilies: []
      }
    });
    const baseEngine = new CoreJudgmentEngine();
    const premiumSnapshot = withAction(baseEngine.buildPreJudgmentSnapshot(premiumInput), "retrieve-motion-only", ["motion-library"]);
    const exploratorySnapshot = withAction(baseEngine.buildPreJudgmentSnapshot(exploratoryInput), "retrieve-motion-only", ["motion-library"]);
    const premiumTreatment = resolveSelectedTreatment({input: premiumInput, snapshot: premiumSnapshot});
    const exploratoryTreatment = resolveSelectedTreatment({input: exploratoryInput, snapshot: exploratorySnapshot});
    const responsesFor = (requests: VectorSearchRequest[]) => requests.map((request) => buildResponse(request, [
      buildHit({
        assetId: "premium-fit",
        styleFamily: ["cinematic_premium", "authority"],
        creatorFit: ["premium_creator"],
        motionTags: ["glow_pulse"]
      }),
      buildHit({
        assetId: "novel-fit",
        styleFamily: ["editorial_experimental"],
        creatorFit: ["experimental_creator"],
        motionTags: ["floating_hover", "parallax_drift", "kinetic_stagger", "orbital_motion", "scale_up_reveal"]
      })
    ]));

    const premiumResult = await new VectorRetrievalEngine(createTransport(responsesFor).transport).retrieve({
      input: premiumInput,
      snapshot: premiumSnapshot,
      selectedTreatment: premiumTreatment
    });
    const exploratoryResult = await new VectorRetrievalEngine(createTransport(responsesFor).transport).retrieve({
      input: exploratoryInput,
      snapshot: exploratorySnapshot,
      selectedTreatment: exploratoryTreatment
    });

    expect(premiumResult.rankedAssetCandidates[0]?.assetId).toBe("premium-fit");
    expect(exploratoryResult.rankedAssetCandidates[0]?.assetId).toBe("novel-fit");
  });

  it("inspiration-only results cannot be executed directly", async () => {
    const input = buildJudgmentInput();
    const baseEngine = new CoreJudgmentEngine();
    const snapshot = withAction(baseEngine.buildPreJudgmentSnapshot(input), "retrieve-reference-inspiration-only", ["premium-reference-library"]);
    const selectedTreatment = resolveSelectedTreatment({input, snapshot});
    const {transport} = createTransport((requests) => requests.map((request) => buildResponse(request, [
      buildHit({
        assetId: "reference-1",
        assetType: "reference",
        partition: "references"
      })
    ])));
    const retrievalEngine = new VectorRetrievalEngine(transport);

    const result = await retrievalEngine.retrieve({input, snapshot, selectedTreatment});

    expect(result.selectedAssetCandidateIds).toEqual([]);
    expect(result.rejectedAssetCandidates.some((candidate) => candidate.assetId === "reference-1")).toBe(true);
  });

  it("writes retrieval trace into the final plan audit", async () => {
    const {transport} = createTransport((requests) => requests.map((request) => buildResponse(request, [
      buildHit({
        assetId: "approved-motion",
        assetType: "motion_graphic",
        partition: "motion_graphics"
      })
    ])));
    const vectorEngine = new VectorRetrievalEngine(transport);
    const engine = new CoreJudgmentEngine({
      vectorRetrievalEngine: vectorEngine
    });

    const plan = await engine.plan(buildJudgmentInput({
      transcriptSegment: "This changes everything",
      moment: {
        transcriptText: "This changes everything",
        momentType: "hook",
        importance: 0.96,
        energy: 0.9
      }
    }));

    expect(plan.audit.retrievalTrace?.entries.length ?? 0).toBeGreaterThan(0);
    expect(plan.audit.selectedAssetCandidateIds.length).toBeGreaterThan(0);
    expect(plan.milvusSearchRequests.length).toBeGreaterThan(0);
    expect(plan.trace.some((entry) => entry.step === "vector-retrieval")).toBe(true);
  });
});
