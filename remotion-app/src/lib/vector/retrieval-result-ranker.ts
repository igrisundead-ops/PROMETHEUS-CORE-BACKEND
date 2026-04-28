import type {CandidateTreatmentProfile, JudgmentEngineInput, PreJudgmentSnapshot} from "../../creative-orchestration/judgment/types";

import {rankedAssetCandidateSchema, type RankedAssetCandidate, type VectorSearchHit} from "./schemas";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const overlapScore = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  const matches = left.filter((value) => rightSet.has(value.toLowerCase())).length;
  return matches / Math.max(left.length, right.length, 1);
};

const textContains = (pool: string, values: string[]): boolean => {
  const normalizedPool = pool.toLowerCase();
  return values.some((value) => normalizedPool.includes(value.toLowerCase()));
};

const renderCostScore = (importance: number, complexity: string): number => {
  if (complexity === "low") return 1;
  if (complexity === "medium") return importance >= 0.55 ? 0.82 : 0.55;
  if (complexity === "high") return importance >= 0.82 ? 0.7 : 0.16;
  return 0.6;
};

const repeatedMotionPenalty = ({
  hit,
  snapshot
}: {
  hit: VectorSearchHit;
  snapshot: PreJudgmentSnapshot;
}): number => {
  const recentMotionModes = snapshot.recentDecisionPlans.map((plan) => plan.motionMode.toLowerCase());
  if (recentMotionModes.some((mode) => hit.motionTags.some((tag) => tag.toLowerCase().includes(mode)))) {
    return 0.28;
  }
  if (snapshot.recentTreatmentFingerprintHistory.some((fingerprint) => hit.motionTags.some((tag) => tag.toLowerCase().includes(fingerprint.motionMode.toLowerCase())))) {
    return 0.18;
  }
  return 0;
};

const safetyPenalty = ({
  hit,
  input,
  snapshot
}: {
  hit: VectorSearchHit;
  input: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
}): {penalty: number; reasons: string[]} => {
  const reasons: string[] = [];
  let penalty = 0;
  const negativePool = [
    ...hit.negativeGrammar,
    ...hit.compatibility
  ].join(" ").toLowerCase();
  const transcript = input.transcriptSegment.toLowerCase();
  const transcriptTokens = transcript.split(/[^a-z0-9]+/).filter((token) => token.length > 3);
  const forbiddenPairingMatch = hit.negativeGrammar.find((entry) => {
    const tokens = entry.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
    const overlap = tokens.filter((token) => transcriptTokens.includes(token)).length;
    return overlap >= 2;
  });

  if (snapshot.spatialConstraints.frameNeedsRestraint && textContains(negativePool, ["busy", "overused", "performance_intensive"])) {
    penalty += 0.18;
    reasons.push("Scene needs restraint and this asset advertises busy or performance-heavy behavior.");
  }
  if (!snapshot.spatialConstraints.behindSubjectTextLegal && textContains(negativePool, ["supportsbehindsubjecttext", "requiresmatting"])) {
    penalty += 0.26;
    reasons.push("Frame constraints reject behind-subject or matting-heavy behavior here.");
  }
  if (snapshot.spatialConstraints.mobileReadabilityRisk >= 0.45 && textContains(negativePool, ["heavy text density", "dense caption", "busy background"])) {
    penalty += 0.2;
    reasons.push("Mobile readability risk is already high for this moment.");
  }
  if (textContains(negativePool, [transcript])) {
    penalty += 0.12;
    reasons.push("Negative grammar directly conflicts with the current transcript semantics.");
  }
  if (forbiddenPairingMatch) {
    penalty += 0.42;
    reasons.push(`Forbidden pairing matched the current scene: ${forbiddenPairingMatch}.`);
  }

  return {penalty, reasons};
};

const creatorStyleScore = ({
  hit,
  input
}: {
  hit: VectorSearchHit;
  input: JudgmentEngineInput;
}): number => {
  const styleProfile = input.creatorStyleProfile;
  const identityPool = [
    ...hit.styleFamily,
    ...hit.creatorFit,
    ...hit.features
  ].join(" ").toLowerCase();
  const behaviorPool = [
    ...hit.styleFamily,
    ...hit.creatorFit,
    ...hit.motionTags,
    ...hit.features
  ].join(" ").toLowerCase();
  const craftsmanshipPool = [
    ...hit.styleFamily,
    ...hit.creatorFit,
    ...hit.features
  ].join(" ").toLowerCase();

  const premiumSignal = textContains(identityPool, ["premium", "authority", "cinematic", "luxury"]) ? 1 : 0.2;
  const noveltySignal = clamp01(
    (hit.motionTags.length >= 4 ? 0.75 : hit.motionTags.length >= 3 ? 0.58 : 0.28) +
    (textContains(behaviorPool, ["experimental", "editorial", "novel", "kinetic", "unexpected"]) ? 0.24 : 0)
  );
  const eleganceSignal = textContains(identityPool, ["elegant", "luxury", "minimal", "cinematic"]) ? 0.9 : 0.4;
  const humanMadeSignal = textContains(craftsmanshipPool, ["editorial", "handcrafted", "human", "boutique"]) ? 0.82 : 0.56;
  const reducedMotionSignal = hit.motionTags.length <= 2 || hit.visualEnergy === "low" ? 0.84 : 0.28;

  if (!styleProfile) {
    return clamp01(
      premiumSignal * 0.34 +
      noveltySignal * 0.18 +
      eleganceSignal * 0.18 +
      humanMadeSignal * 0.16 +
      reducedMotionSignal * 0.14
    );
  }

  const weightedScore =
    premiumSignal * (styleProfile.premiumBias * 0.34 + 0.08) +
    noveltySignal * (styleProfile.noveltyPreference * 0.3 + 0.06) +
    eleganceSignal * (styleProfile.eleganceBias * 0.18 + 0.04) +
    humanMadeSignal * (styleProfile.humanMadeFeelBias * 0.12 + 0.04) +
    reducedMotionSignal * (styleProfile.reducedMotionPreference * 0.06 + 0.02);
  const premiumMismatchPenalty = (1 - premiumSignal) * styleProfile.premiumBias * 0.12;
  const consistencyMismatchPenalty = noveltySignal * styleProfile.consistencyPreference * 0.1;

  return clamp01(weightedScore - premiumMismatchPenalty - consistencyMismatchPenalty);
};

export const rankRetrievedAssetCandidates = ({
  hits,
  input,
  snapshot,
  selectedTreatment,
  action
}: {
  hits: VectorSearchHit[];
  input: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  selectedTreatment: CandidateTreatmentProfile;
  action: string;
}): RankedAssetCandidate[] => {
  return hits.map((hit) => {
    const rhetoricalFit = overlapScore([snapshot.rhetoricalPurpose, input.moment.momentType], hit.rhetoricalRoles);
    const emotionalFit = overlapScore([snapshot.emotionalSpine], hit.emotionalRoles);
    const treatmentFit = overlapScore(
      [selectedTreatment.family, selectedTreatment.motionMode, selectedTreatment.typographyMode, selectedTreatment.matteUsage],
      [...hit.styleFamily, ...hit.motionTags, ...hit.sceneUseCases, ...hit.compatibility]
    );
    const noveltyPenalty = repeatedMotionPenalty({hit, snapshot});
    const styleFit = creatorStyleScore({hit, input});
    const readabilityRisk = snapshot.spatialConstraints.mobileReadabilityRisk >= 0.4 &&
      textContains([...hit.literalTags, ...hit.semanticTags, ...hit.negativeGrammar].join(" "), ["busy", "dense", "glitch", "chaos"])
      ? 0.26
      : 0;
    const premiumFeel = clamp01(
      overlapScore(["premium", "authority", "cinematic", "luxury"], [...hit.styleFamily, ...hit.emotionalRoles, ...hit.symbolicMeaning]) +
      (styleFit * 0.2)
    );
    const assetTypeFit = action === "retrieve-typography-only"
      ? (hit.assetType === "typography" ? 1 : 0.1)
      : action === "retrieve-motion-only"
        ? (hit.assetType === "motion_graphic" || hit.assetType === "gsap_animation_logic" ? 1 : 0.15)
        : 0.72;
    const renderScore = renderCostScore(input.moment.importance, hit.renderComplexity);
    const safety = safetyPenalty({hit, input, snapshot});
    const judgmentScore = clamp01(
      rhetoricalFit * 0.16 +
      emotionalFit * 0.14 +
      treatmentFit * 0.16 +
      styleFit * 0.14 +
      renderScore * 0.1 +
      assetTypeFit * 0.12 +
      premiumFeel * 0.1 +
      (1 - readabilityRisk) * 0.08
    );
    const finalScore = clamp01(hit.vectorScore * 0.42 + judgmentScore * 0.58 - noveltyPenalty - safety.penalty - readabilityRisk);
    const rejectionReasons: string[] = [];
    if (renderScore <= 0.2) {
      rejectionReasons.push("Render complexity is too high for the current beat importance.");
    }
    if (noveltyPenalty >= 0.22) {
      rejectionReasons.push("Repeated motion signature conflicts with recent sequence memory.");
    }
    rejectionReasons.push(...safety.reasons);
    const rankingRationale = [
      rhetoricalFit >= 0.5 ? "Strong rhetorical role alignment." : "Limited rhetorical role alignment.",
      emotionalFit >= 0.5 ? "Emotionally matches the beat." : "Emotional fit is partial.",
      renderScore >= 0.7 ? "Render cost is acceptable for this beat." : "Render cost needs caution."
    ];
    return rankedAssetCandidateSchema.parse({
      ...hit,
      judgmentScore,
      finalScore,
      selected: false,
      inspirationOnly: false,
      rejectionReasons,
      rankingRationale
    });
  }).sort((left, right) => right.finalScore - left.finalScore || right.vectorScore - left.vectorScore || left.assetId.localeCompare(right.assetId));
};
