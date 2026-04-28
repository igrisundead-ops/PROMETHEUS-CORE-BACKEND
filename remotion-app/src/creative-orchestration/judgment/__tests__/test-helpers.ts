import {judgmentEngineInputSchema, type JudgmentEngineInput} from "../types";

type JudgmentInputOverrides = Omit<Partial<JudgmentEngineInput>, "moment"> & {
  moment?: Partial<JudgmentEngineInput["moment"]>;
};

const buildWords = (text: string): JudgmentEngineInput["moment"]["words"] => {
  return text.split(/\s+/).map((word, index) => ({
    text: word,
    startMs: index * 220,
    endMs: index * 220 + 180,
    confidence: 0.96
  }));
};

export const buildJudgmentInput = (overrides: JudgmentInputOverrides = {}): JudgmentEngineInput => {
  const transcriptSegment = overrides.transcriptSegment ?? overrides.moment?.transcriptText ?? "Build trust with proof";
  const moment = {
    id: overrides.segmentId ?? "segment-1",
    startMs: 0,
    endMs: 1800,
    transcriptText: transcriptSegment,
    words: buildWords(transcriptSegment),
    momentType: "hook",
    energy: 0.82,
    importance: 0.9,
    density: 2.6,
    suggestedIntensity: "hero",
    ...(overrides.moment ?? {})
  } as JudgmentEngineInput["moment"];

  return judgmentEngineInputSchema.parse({
    segmentId: overrides.segmentId ?? "segment-1",
    moment,
    transcriptSegment,
    speakerMetadata: {
      placementRegion: "center",
      faceOccupancy: 0.42,
      dominantSpeaker: true,
      ...(overrides.speakerMetadata ?? {})
    },
    sceneAnalysis: {
      sceneDensity: 0.4,
      motionDensity: 0.35,
      backgroundComplexity: 0.3,
      brightness: 0.48,
      negativeSpaceScore: 0.62,
      occlusionRisk: 0.2,
      mobileReadabilityRisk: 0.18,
      activeFocalElements: 1,
      safeZones: ["center", "top-safe", "bottom-safe"],
      busyRegions: [],
      ...(overrides.sceneAnalysis ?? {})
    },
    subjectSegmentation: {
      matteConfidence: 0.84,
      subjectRegion: "center",
      behindSubjectTextSupported: true,
      ...(overrides.subjectSegmentation ?? {})
    },
    creatorStyleProfile: {
      noveltyPreference: 0.42,
      consistencyPreference: 0.58,
      premiumBias: 0.84,
      eleganceBias: 0.8,
      reducedMotionPreference: 0.2,
      humanMadeFeelBias: 0.86,
      avoidCliches: true,
      preferredTreatmentFamilies: [],
      forbiddenTreatmentFamilies: [],
      ...(overrides.creatorStyleProfile ?? {})
    },
    previousOutputMemory: {
      recentTreatmentFamilies: [],
      repeatedKeywords: [],
      recentlyUsedAssetIds: [],
      recentlyUsedProposalIds: [],
      ...(overrides.previousOutputMemory ?? {})
    },
    assetFingerprints: overrides.assetFingerprints ?? [],
    typographyMetadata: {
      allowsCursive: true,
      longCopyThresholdWords: 10,
      premiumProfiles: ["longform_svg_typography_v1"],
      blockedProfiles: [],
      ...(overrides.typographyMetadata ?? {})
    },
    motionGraphicsMetadata: {
      availableModes: ["gentle-drift", "blur-slide-up", "zoom-through-layer"],
      maxSimultaneousFocalElements: 3,
      gsapSupported: true,
      threeJsAllowed: true,
      ...(overrides.motionGraphicsMetadata ?? {})
    },
    gsapAnimationMetadata: {
      availablePresets: ["blur-slide-up", "focus-zoom"],
      premiumPresets: ["focus-zoom"],
      heavyPresets: ["zoom-through-layer"],
      ...(overrides.gsapAnimationMetadata ?? {})
    },
    retrievalResults: overrides.retrievalResults ?? [],
    feedbackHistory: overrides.feedbackHistory ?? [],
    agentProposals: overrides.agentProposals ?? [],
    recentSelectedTreatments: overrides.recentSelectedTreatments ?? [],
    recentDecisionPlans: overrides.recentDecisionPlans ?? [],
    recentVisualPatterns: overrides.recentVisualPatterns ?? [],
    recentSequenceMetrics: overrides.recentSequenceMetrics
  });
};
