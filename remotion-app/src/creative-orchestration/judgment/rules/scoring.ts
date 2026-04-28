import {DEFAULT_SCORING_WEIGHTS} from "../constants";
import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  EditorialDoctrine,
  JudgmentEngineInput,
  NegativeGrammarViolation,
  PreJudgmentSnapshot,
  ScoringBreakdown
} from "../types";
import {clamp01} from "../../utils";
import {buildSequenceAwareScores} from "./sequence-scoring";

const captainAlignment = (candidate: CandidateTreatmentProfile, doctrine: EditorialDoctrine): number => {
  if (doctrine.captain === "text") {
    if (["keyword-emphasis", "title-card", "behind-speaker-depth"].includes(candidate.finalTreatment)) return 0.95;
    if (candidate.finalTreatment === "caption-only") return 0.82;
    return 0.56;
  }
  if (doctrine.captain === "asset") {
    if (candidate.finalTreatment === "asset-led") return 0.96;
    if (candidate.finalTreatment === "asset-supported") return 0.9;
    if (candidate.finalTreatment === "behind-speaker-depth") return 0.74;
    return 0.5;
  }
  if (doctrine.captain === "background") {
    if (candidate.finalTreatment === "background-overlay" || candidate.finalTreatment === "cinematic-transition") return 0.94;
    return 0.58;
  }
  if (candidate.finalTreatment === "caption-only" || candidate.finalTreatment === "no-treatment") return 0.92;
  return 0.46;
};

const reductionAlignment = (candidate: CandidateTreatmentProfile, doctrine: EditorialDoctrine): number => {
  if (doctrine.conceptReductionMode === "hero-word") {
    return candidate.typographyMode === "keyword-only" ? 0.94 : candidate.typographyMode === "title-card" ? 0.82 : 0.58;
  }
  if (doctrine.conceptReductionMode === "hero-phrase") {
    return candidate.typographyMode === "title-card" ? 0.92 : candidate.typographyMode === "keyword-only" ? 0.84 : 0.6;
  }
  if (doctrine.conceptReductionMode === "sequential-keywords") {
    return candidate.finalTreatment === "asset-supported" || candidate.finalTreatment === "asset-led" ? 0.9 : 0.62;
  }
  return candidate.typographyMode === "full-caption" ? 0.92 : 0.64;
};

export const buildScoringBreakdown = ({
  input,
  snapshot,
  candidate,
  violations,
  antiRepetition
}: {
  input: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  candidate: CandidateTreatmentProfile;
  violations: NegativeGrammarViolation[];
  antiRepetition: AntiRepetitionSummary;
}): ScoringBreakdown => {
  const blockingViolations = violations.filter((violation) => violation.blocking);
  const totalPenalty = violations.reduce((sum, violation) => sum + violation.penalty, 0);
  const captainAlignmentScore = captainAlignment(candidate, snapshot.editorialDoctrine);
  const reductionAlignmentScore = reductionAlignment(candidate, snapshot.editorialDoctrine);
  const readabilityScore = clamp01(
    (snapshot.spatialConstraints.denseTextAllowed ? 0.82 : 0.52) -
    (candidate.typographyMode === "full-caption" && snapshot.spatialConstraints.busyFrame ? 0.34 : 0) -
    (candidate.placementMode === "right-anchor" && input.speakerMetadata?.placementRegion === "right-third" ? 0.22 : 0)
  );
  const semanticAlignmentScore = clamp01((candidate.reasoning.length > 0 ? 0.66 : 0.5) + captainAlignmentScore * 0.18 + reductionAlignmentScore * 0.16);
  const rhetoricalAlignmentScore = clamp01(
    snapshot.rhetoricalPurpose === "authority" && candidate.finalTreatment === "title-card" ? 0.92 :
      snapshot.rhetoricalPurpose === "education" && candidate.finalTreatment === "asset-supported" ? 0.9 :
        snapshot.rhetoricalPurpose === "emotional-punch" && candidate.emphasisMode === "isolated-punch-word" ? 0.94 :
          0.68
  );
  const emotionalAlignmentScore = clamp01(
    snapshot.emotionalSpine === "luxury" && candidate.family === "elegant-founder-brand" ? 0.94 :
      snapshot.emotionalSpine === "urgency" && candidate.family === "aggressive-conversion" ? 0.92 :
        snapshot.emotionalSpine === "authority" && candidate.family === "high-authority" ? 0.93 :
          snapshot.emotionalSpine === "vulnerability" && candidate.family === "emotional-cinematic" ? 0.9 :
            0.7
  );
  const premiumFeelScore = clamp01((input.creatorStyleProfile?.premiumBias ?? 0.8) * 0.7 + (candidate.family.includes("premium") || candidate.family.includes("luxury") ? 0.25 : 0.1));
  const eleganceScore = clamp01((input.creatorStyleProfile?.eleganceBias ?? 0.78) * 0.68 + (candidate.intensity === "expressive" ? 0.05 : 0.18) - totalPenalty * 0.14);
  const noveltyScore = clamp01(candidate.noveltyLevel);
  const nonRepetitionScore = clamp01(
    0.82 - ((input.previousOutputMemory?.recentTreatmentFamilies ?? []).includes(candidate.family) ? 0.34 : 0) - ((input.previousOutputMemory?.recentlyUsedProposalIds ?? []).some((id) => candidate.preferredProposalIds.includes(id)) ? 0.18 : 0)
  );
  const clutterPenalty = clamp01(
    totalPenalty +
    (candidate.placementMode === "full-frame" ? 0.08 : 0) +
    (candidate.backgroundTextMode === "hero" ? 0.08 : 0) +
    (candidate.allowedProposalTypes.includes("motion") && snapshot.spatialConstraints.frameNeedsRestraint ? 0.12 : 0)
  );
  const breathingRoomScore = clamp01(snapshot.spatialConstraints.frameNeedsRestraint ? 0.86 - clutterPenalty : 0.72 - clutterPenalty * 0.4);
  const visualHierarchyScore = clamp01(
    snapshot.emphasisTargets.isolatePunchWord && candidate.emphasisMode === "isolated-punch-word" ? 0.93 :
      candidate.typographyMode === "full-caption" && snapshot.emphasisTargets.supportingTextNeeded ? 0.8 :
        0.68
  );
  const renderabilityScore = clamp01(
    candidate.allowedProposalTypes.includes("motion") && (input.motionGraphicsMetadata?.threeJsAllowed ?? true) === false && candidate.motionMode === "zoom-through-layer"
      ? 0.42
      : blockingViolations.length > 0
        ? 0.35
        : 0.88 - (candidate.intensity === "expressive" ? 0.1 : 0)
  );
  const timingAlignmentScore = clamp01(input.moment.endMs - input.moment.startMs <= 2200 && candidate.typographyMode === "title-card" ? 0.9 : 0.74);
  const retentionPotentialScore = clamp01((input.moment.importance * 0.55) + (candidate.emphasisMode === "isolated-punch-word" ? 0.28 : 0.16));
  const creatorStyleAdherenceScore = clamp01(
    (input.creatorStyleProfile?.preferredTreatmentFamilies ?? []).includes(candidate.family)
      ? 0.94
      : 0.62 + (input.creatorStyleProfile?.consistencyPreference ?? 0.55) * 0.18
  );
  const humanMadeFeelScore = clamp01(
    (input.creatorStyleProfile?.humanMadeFeelBias ?? 0.8) * 0.62 +
    (candidate.family === "high-contrast-experimental" ? 0.12 : 0.18) -
    clutterPenalty * 0.18
  );
  const doctrinePenalty = clamp01(
    (snapshot.editorialDoctrine.supportToolBudget === "none" && candidate.motionMode !== "none" ? 0.12 : 0) +
    (!snapshot.editorialDoctrine.allowIndependentTypography && candidate.typographyMode === "title-card" ? 0.15 : 0) +
    (snapshot.editorialDoctrine.preferTextOnlyForAbstractMoments && candidate.finalTreatment === "asset-led" ? 0.14 : 0)
  );
  const {
    sequenceContrastScore,
    escalationFitScore,
    surprisePreservationScore,
    pacingVariationScore,
    restraintBalanceScore,
    emotionalProgressionScore,
    climaxBudgetScore,
    noveltyAcrossSequenceScore
  } = buildSequenceAwareScores({
    input,
    snapshot,
    candidate,
    antiRepetition
  });
  const repetitionPenalty = clamp01(antiRepetition.repetitionPenalty);

  const weights = DEFAULT_SCORING_WEIGHTS;
  const weightedTotal =
    (readabilityScore * weights.readability) +
    (semanticAlignmentScore * weights.semanticAlignment) +
    (rhetoricalAlignmentScore * weights.rhetoricalAlignment) +
    (emotionalAlignmentScore * weights.emotionalAlignment) +
    (premiumFeelScore * weights.premiumFeel) +
    (eleganceScore * weights.elegance) +
    (nonRepetitionScore * weights.nonRepetition) +
    (noveltyScore * weights.novelty) +
    (breathingRoomScore * weights.breathingRoom) +
    (visualHierarchyScore * weights.visualHierarchy) +
    (renderabilityScore * weights.renderability) +
    (timingAlignmentScore * weights.timingAlignment) +
    (retentionPotentialScore * weights.retentionPotential) +
    (creatorStyleAdherenceScore * weights.creatorStyleAdherence) +
    (humanMadeFeelScore * weights.humanMadeFeel) +
    (sequenceContrastScore * weights.sequenceContrast) +
    (escalationFitScore * weights.escalationFit) +
    (surprisePreservationScore * weights.surprisePreservation) +
    (pacingVariationScore * weights.pacingVariation) +
    (restraintBalanceScore * weights.restraintBalance) +
    (emotionalProgressionScore * weights.emotionalProgression) +
    (climaxBudgetScore * weights.climaxBudget) +
    (noveltyAcrossSequenceScore * weights.noveltyAcrossSequence) -
    ((clutterPenalty + doctrinePenalty) * weights.clutterPenalty) -
    (repetitionPenalty * weights.repetitionPenalty);

  return {
    readabilityScore,
    semanticAlignmentScore,
    rhetoricalAlignmentScore,
    emotionalAlignmentScore,
    premiumFeelScore,
    eleganceScore,
    nonRepetitionScore,
    noveltyScore,
    clutterPenalty: clamp01(clutterPenalty + doctrinePenalty),
    breathingRoomScore,
    visualHierarchyScore,
    renderabilityScore,
    timingAlignmentScore,
    retentionPotentialScore,
    creatorStyleAdherenceScore,
    humanMadeFeelScore,
    sequenceContrastScore,
    escalationFitScore,
    surprisePreservationScore,
    repetitionPenalty,
    pacingVariationScore,
    restraintBalanceScore,
    emotionalProgressionScore,
    climaxBudgetScore,
    noveltyAcrossSequenceScore,
    finalScore: clamp01(weightedTotal)
  };
};
