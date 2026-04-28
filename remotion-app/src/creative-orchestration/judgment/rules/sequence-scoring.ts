import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  ContrastDirection,
  JudgmentEngineInput,
  PreJudgmentSnapshot
} from "../types";
import {clamp01} from "../../utils";
import {deriveVisualDensityProfile} from "./sequence-memory";

const isQuietCandidate = (candidate: CandidateTreatmentProfile): boolean => {
  return candidate.intensity === "minimal" || candidate.intensity === "restrained" || candidate.motionMode === "none";
};

const isExpressiveCandidate = (candidate: CandidateTreatmentProfile): boolean => {
  return candidate.intensity === "expressive" || candidate.backgroundTextMode === "hero" || candidate.placementMode === "full-frame";
};

const prefersContrastDirection = (antiRepetition: AntiRepetitionSummary, direction: ContrastDirection): boolean => {
  return antiRepetition.preferredContrastDirections.includes(direction);
};

export const buildSequenceAwareScores = (input: {
  input: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  candidate: CandidateTreatmentProfile;
  antiRepetition: AntiRepetitionSummary;
}): Pick<
  import("../types").ScoringBreakdown,
  "sequenceContrastScore" |
  "escalationFitScore" |
  "surprisePreservationScore" |
  "pacingVariationScore" |
  "restraintBalanceScore" |
  "emotionalProgressionScore" |
  "climaxBudgetScore" |
  "noveltyAcrossSequenceScore"
> => {
  const {input: judgmentInput, snapshot, candidate, antiRepetition} = input;
  const recentMetrics = snapshot.recentSequenceMetrics;
  const lastPattern = snapshot.recentVisualPatterns[snapshot.recentVisualPatterns.length - 1];
  const lastDecision = snapshot.recentDecisionPlans[snapshot.recentDecisionPlans.length - 1];
  const candidateDensity = deriveVisualDensityProfile(candidate);
  const quietCandidate = isQuietCandidate(candidate);
  const expressiveCandidate = isExpressiveCandidate(candidate);
  const majorPayoff = judgmentInput.moment.momentType === "payoff" || judgmentInput.moment.importance >= 0.94;
  const emotionalResetCandidate = ["calm", "confidence", "trust", "authority"].includes(snapshot.emotionalSpine);

  const sequenceContrastScore = clamp01(
    !lastPattern
      ? 0.74
      : 0.46 +
        (lastPattern.visualDensity !== candidateDensity ? 0.18 : 0) +
        (lastPattern.motionMode !== candidate.motionMode ? 0.11 : 0) +
        (lastPattern.typographyMode !== candidate.typographyMode ? 0.09 : 0) +
        (lastPattern.placementMode !== candidate.placementMode ? 0.08 : 0) +
        (prefersContrastDirection(antiRepetition, "restrain") && quietCandidate ? 0.12 : 0) +
        (prefersContrastDirection(antiRepetition, "invert") && lastPattern.motionMode !== candidate.motionMode ? 0.08 : 0) +
        (prefersContrastDirection(antiRepetition, "reset") && quietCandidate ? 0.08 : 0)
  );

  const escalationFitScore = clamp01(
    recentMetrics.recentEnergyTrend === "rising" || judgmentInput.moment.energy > recentMetrics.recentAverageEnergy + 0.08
      ? expressiveCandidate
        ? majorPayoff
          ? 0.94
          : 0.82
        : 0.56
      : recentMetrics.preferRestraintNext
        ? quietCandidate
          ? 0.92
          : majorPayoff
            ? 0.7
            : 0.44
        : quietCandidate && recentMetrics.consecutiveQuietMoments >= 2
          ? 0.58
          : 0.76
  );

  const surprisePreservationScore = clamp01(
    recentMetrics.surpriseBudgetRemaining < 0.45
      ? quietCandidate
        ? 0.92
        : majorPayoff
          ? 0.64
          : 0.36
      : expressiveCandidate && majorPayoff
        ? 0.9
        : candidateDensity === "balanced"
          ? 0.78
          : 0.68
  );

  const pacingVariationScore = clamp01(
    !lastPattern
      ? 0.74
      : 0.48 +
        (lastPattern.motionMode !== candidate.motionMode ? 0.14 : -0.04) +
        (lastPattern.emphasisMode !== candidate.emphasisMode ? 0.12 : -0.04) +
        (lastPattern.placementMode !== candidate.placementMode ? 0.09 : -0.03) +
        (antiRepetition.repeatedMotionModeCount > 0 && lastPattern.motionMode !== candidate.motionMode ? 0.08 : 0) +
        (antiRepetition.repeatedTypographyModeCount > 0 && lastPattern.typographyMode !== candidate.typographyMode ? 0.06 : 0)
  );

  const restraintBalanceScore = clamp01(
    recentMetrics.preferRestraintNext
      ? quietCandidate
        ? 0.94
        : majorPayoff
          ? 0.68
          : 0.42
      : recentMetrics.consecutiveRestrainedMoments >= 2
        ? expressiveCandidate
          ? 0.82
          : 0.62
        : 0.72 + (quietCandidate && recentMetrics.restraintBalance < 0.35 ? 0.08 : 0)
  );

  const emotionalProgressionScore = clamp01(
    recentMetrics.consecutiveEmotionalPeakMoments >= 2
      ? quietCandidate
        ? 0.92
        : emotionalResetCandidate
          ? 0.82
        : majorPayoff
          ? 0.66
          : 0.38
      : lastDecision && lastDecision.emotionalSpine !== snapshot.emotionalSpine
        ? 0.82
        : 0.7
  );

  const climaxBudgetScore = clamp01(
    recentMetrics.climaxBudgetRemaining < 0.42
      ? majorPayoff
        ? expressiveCandidate
          ? 0.82
          : 0.62
        : quietCandidate
          ? 0.94
          : 0.32
      : majorPayoff && expressiveCandidate
        ? 0.92
        : 0.72
  );

  const noveltyAcrossSequenceScore = clamp01(
    candidate.noveltyLevel * 0.45 +
    sequenceContrastScore * 0.25 +
    pacingVariationScore * 0.18 +
    (antiRepetition.forceContrast ? 0.08 : 0) +
    (antiRepetition.repetitionPenalty > 0.3 && candidateDensity !== lastPattern?.visualDensity ? 0.08 : 0)
  );

  return {
    sequenceContrastScore,
    escalationFitScore,
    surprisePreservationScore,
    pacingVariationScore,
    restraintBalanceScore,
    emotionalProgressionScore,
    climaxBudgetScore,
    noveltyAcrossSequenceScore
  };
};
