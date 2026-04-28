import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  PreJudgmentSnapshot,
  SequenceVisualPattern
} from "../types";
import {antiRepetitionSummarySchema} from "../types";
import {clamp01} from "../../utils";
import {deriveVisualDensityProfile} from "./sequence-memory";

const countTrailingMatches = (patterns: SequenceVisualPattern[], predicate: (pattern: SequenceVisualPattern) => boolean): number => {
  let count = 0;
  for (let index = patterns.length - 1; index >= 0; index -= 1) {
    if (!predicate(patterns[index]!)) {
      break;
    }
    count += 1;
  }
  return count;
};

export const buildAntiRepetitionSummary = (input: {
  snapshot: PreJudgmentSnapshot;
  candidate: CandidateTreatmentProfile;
}): AntiRepetitionSummary => {
  const recentPatterns = input.snapshot.recentVisualPatterns;
  const recentDecisionPlans = input.snapshot.recentDecisionPlans;
  const recentFingerprints = input.snapshot.recentTreatmentFingerprintHistory;
  const candidateDensity = deriveVisualDensityProfile(input.candidate);
  const repeatedTreatmentFamilyCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.treatmentFamily === input.candidate.family
  );
  const repeatedTypographyModeCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.typographyMode === input.candidate.typographyMode
  );
  const repeatedMotionModeCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.motionMode === input.candidate.motionMode
  );
  const repeatedPlacementModeCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.placementMode === input.candidate.placementMode
  );
  const repeatedEmphasisModeCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.emphasisMode === input.candidate.emphasisMode
  );
  const repeatedMatteUsageCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.matteUsage === input.candidate.matteUsage
  );
  const repeatedVisualDensityCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.visualDensity === candidateDensity
  );
  const repeatedHeroBackgroundTextCount = recentPatterns.filter((pattern) => pattern.backgroundTextMode === "hero").length;
  const repeatedRhetoricalPurposeCount = countTrailingMatches(
    recentDecisionPlans,
    (summary) => summary.rhetoricalPurpose === input.snapshot.rhetoricalPurpose
  );
  const repeatedEmotionalSpineCount = countTrailingMatches(
    recentDecisionPlans,
    (summary) => summary.emotionalSpine === input.snapshot.emotionalSpine
  );
  const repeatedVisualClimaxCount = countTrailingMatches(
    recentDecisionPlans,
    (summary) => summary.visualClimax
  );
  const repeatedHeroMomentCount = countTrailingMatches(
    recentDecisionPlans,
    (summary) => summary.heroMoment
  );
  const repeatedPremiumTrickCount = recentFingerprints.filter((fingerprint) => fingerprint.premiumTricks.some((trick) => (
    (trick === "hero-background-text" && input.candidate.backgroundTextMode === "hero") ||
    (trick === "behind-subject-text" && input.candidate.matteUsage === "behind-subject-text") ||
    (trick === "blur-slide-reveal" && input.candidate.motionMode === "blur-slide-up") ||
    (trick === "light-sweep" && input.candidate.motionMode === "light-sweep-reveal") ||
    (trick === "zoom-through-layer" && input.candidate.motionMode === "zoom-through-layer")
  ))).length;
  const consecutiveLoudBeatCount = countTrailingMatches(
    recentPatterns,
    (pattern) => pattern.visualDensity === "loud"
  );

  const repetitionPenalty = clamp01(
    repeatedTreatmentFamilyCount * 0.2 +
    repeatedTypographyModeCount * 0.12 +
    repeatedMotionModeCount * 0.1 +
    repeatedPlacementModeCount * 0.08 +
    repeatedEmphasisModeCount * 0.08 +
    repeatedMatteUsageCount * (input.candidate.matteUsage === "behind-subject-text" ? 0.18 : 0.08) +
    repeatedVisualDensityCount * 0.14 +
    (input.candidate.backgroundTextMode === "hero" ? repeatedHeroBackgroundTextCount * 0.08 : 0) +
    repeatedRhetoricalPurposeCount * 0.08 +
    repeatedEmotionalSpineCount * 0.08 +
    repeatedVisualClimaxCount * 0.14 +
    repeatedPremiumTrickCount * 0.1 +
    repeatedHeroMomentCount * 0.08 +
    (candidateDensity === "loud" ? consecutiveLoudBeatCount * 0.12 : 0)
  );

  const reasons: string[] = [];
  const diversityRecommendations: string[] = [];
  const preferredContrastDirections: string[] = [];
  const escalationWarnings: string[] = [];
  const restraintRecommendations: string[] = [];
  if (repeatedTreatmentFamilyCount > 0) {
    reasons.push(`Treatment family ${input.candidate.family} was used in ${repeatedTreatmentFamilyCount} recent beat(s).`);
    diversityRecommendations.push("Shift to a different treatment family before the sequence calcifies.");
  }
  if (repeatedTypographyModeCount > 0) {
    reasons.push(`Typography mode ${input.candidate.typographyMode} is repeating across adjacent beats.`);
    diversityRecommendations.push("Break the current typography pattern with a different text structure.");
  }
  if (repeatedMotionModeCount > 0) {
    reasons.push(`Motion mode ${input.candidate.motionMode} is repeating across adjacent beats.`);
    diversityRecommendations.push("Change the motion signature to restore surprise.");
  }
  if (repeatedMatteUsageCount > 0 && input.candidate.matteUsage === "behind-subject-text") {
    reasons.push("Behind-subject text is repeating too closely across the sequence.");
    preferredContrastDirections.push("reset");
  }
  if (repeatedVisualDensityCount > 0 && candidateDensity === "loud") {
    reasons.push("The recent beats are already visually loud, so another loud beat burns surprise budget.");
    preferredContrastDirections.push("restrain");
    restraintRecommendations.push("Let the next beat breathe instead of staying loud.");
  }
  if (input.snapshot.recentSequenceMetrics.needsContrastNext) {
    reasons.push("Sequence history is asking for contrast instead of another similar beat.");
    preferredContrastDirections.push("invert");
  }
  if (repeatedEmotionalSpineCount > 1) {
    reasons.push(`Emotional cadence ${input.snapshot.emotionalSpine} is peaking too repeatedly.`);
    escalationWarnings.push("Recent emotional cadence is flattening into repetition.");
    preferredContrastDirections.push("reset");
  }
  if (repeatedVisualClimaxCount > 0) {
    reasons.push("Visual climax has already been used recently.");
    escalationWarnings.push("Climax budget is under pressure.");
    restraintRecommendations.push("Hold back visual climax until a true payoff beat.");
  }
  if (repeatedPremiumTrickCount > 0) {
    reasons.push("A premium trick from recent beats is being reused too quickly.");
    diversityRecommendations.push("Rotate the premium cue so polish does not become a formula.");
  }
  if (input.snapshot.recentSequenceMetrics.preferRestraintNext || consecutiveLoudBeatCount >= 2) {
    restraintRecommendations.push("Prefer restraint on this beat to restore sequence contrast.");
  }
  if (repeatedHeroMomentCount > 0) {
    escalationWarnings.push("Hero moment energy is being spent too often.");
  }

  return antiRepetitionSummarySchema.parse({
    repeatedTreatmentFamilyCount,
    repeatedTypographyModeCount,
    repeatedMotionModeCount,
    repeatedPlacementModeCount,
    repeatedEmphasisModeCount,
    repeatedMatteUsageCount,
    repeatedHeroBackgroundTextCount,
    repeatedVisualDensityCount,
    repeatedRhetoricalPurposeCount,
    repeatedEmotionalSpineCount,
    repeatedVisualClimaxCount,
    repeatedPremiumTrickCount,
    repeatedHeroMomentCount,
    consecutiveLoudBeatCount,
    repetitionPenalty,
    recommendRestraint: input.snapshot.recentSequenceMetrics.preferRestraintNext || consecutiveLoudBeatCount >= 2,
    forceContrast: input.snapshot.recentSequenceMetrics.needsContrastNext || repeatedVisualDensityCount >= 2,
    reasons,
    diversityRecommendations: [...new Set(diversityRecommendations)],
    preferredContrastDirections: [...new Set(preferredContrastDirections)],
    escalationWarnings: [...new Set(escalationWarnings)],
    restraintRecommendations: [...new Set(restraintRecommendations)]
  });
};
