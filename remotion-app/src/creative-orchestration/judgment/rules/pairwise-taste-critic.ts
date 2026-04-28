import {clamp01} from "../../utils";
import {pairwiseTasteComparisonSchema, type AntiRepetitionSummary, type CandidateTreatmentProfile, type ContrastDirection, type JudgmentEngineInput, type NegativeGrammarViolation, type PairwiseTasteComparison, type PairwiseTasteDimensions, type PreJudgmentSnapshot, type ScoringBreakdown} from "../types";

export type PairwiseCriticCandidateEvaluation = {
  candidate: CandidateTreatmentProfile;
  antiRepetition: AntiRepetitionSummary;
  violations: NegativeGrammarViolation[];
  scoring: ScoringBreakdown;
  blocked: boolean;
};

type CandidateTasteProfile = {
  premiumFeel: number;
  cinematicIntentionality: number;
  readability: number;
  emotionalAlignment: number;
  rhetoricalClarity: number;
  restraint: number;
  noveltyWithoutChaos: number;
  sequenceFit: number;
  nonClicheExecution: number;
  humanMadeFeel: number;
  creatorStyleFit: number;
  renderPracticality: number;
  criticComposite: number;
  riskFlags: string[];
};

const TASTE_DIMENSION_WEIGHTS = {
  premiumFeel: 0.1,
  cinematicIntentionality: 0.09,
  readability: 0.11,
  emotionalAlignment: 0.1,
  rhetoricalClarity: 0.09,
  restraint: 0.08,
  noveltyWithoutChaos: 0.08,
  sequenceFit: 0.12,
  nonClicheExecution: 0.08,
  humanMadeFeel: 0.07,
  creatorStyleFit: 0.05,
  renderPracticality: 0.03
} as const;

const isQuietCandidate = (candidate: CandidateTreatmentProfile): boolean => {
  return candidate.intensity === "minimal" || candidate.intensity === "restrained" || candidate.motionMode === "none";
};

const isExpressiveCandidate = (candidate: CandidateTreatmentProfile): boolean => {
  return candidate.intensity === "expressive" || candidate.backgroundTextMode === "hero" || candidate.placementMode === "full-frame";
};

const hasBlockingReadabilityRisk = (candidate: CandidateTreatmentProfile, snapshot: PreJudgmentSnapshot): boolean => {
  return snapshot.spatialConstraints.frameNeedsRestraint &&
    (candidate.backgroundTextMode === "hero" || candidate.placementMode === "full-frame" || candidate.typographyMode === "full-caption");
};

const buildRiskFlags = (input: {
  snapshot: PreJudgmentSnapshot;
  evaluation: PairwiseCriticCandidateEvaluation;
}): string[] => {
  const {snapshot, evaluation} = input;
  const flags: string[] = [];
  const blockingViolations = evaluation.violations.filter((violation) => violation.blocking);
  if (blockingViolations.length > 0) {
    flags.push("blocking-grammar-risk");
  }
  if (evaluation.scoring.readabilityScore < 0.68 || hasBlockingReadabilityRisk(evaluation.candidate, snapshot)) {
    flags.push("readability-risk");
  }
  if (evaluation.antiRepetition.repeatedMotionModeCount > 0) {
    flags.push("repeated-motion-signature");
  }
  if (evaluation.antiRepetition.repeatedTypographyModeCount > 0) {
    flags.push("repeated-typography-signature");
  }
  if (evaluation.antiRepetition.repeatedPremiumTrickCount > 0) {
    flags.push("premium-trick-repetition");
  }
  if (evaluation.scoring.clutterPenalty > 0.36) {
    flags.push("clutter-risk");
  }
  if (snapshot.recentSequenceMetrics.preferRestraintNext && isExpressiveCandidate(evaluation.candidate)) {
    flags.push("sequence-restraint-mismatch");
  }
  if (snapshot.recentSequenceMetrics.consecutiveEmotionalPeakMoments >= 2 && isExpressiveCandidate(evaluation.candidate)) {
    flags.push("emotional-overpeak-risk");
  }
  if (evaluation.scoring.renderabilityScore < 0.62) {
    flags.push("render-practicality-risk");
  }
  if (snapshot.emphasisTargets.isolatePunchWord && evaluation.candidate.emphasisMode !== "isolated-punch-word") {
    flags.push("weak-punch-word-isolation");
  }
  return [...new Set(flags)];
};

const buildTasteProfile = (input: {
  judgmentInput: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  evaluation: PairwiseCriticCandidateEvaluation;
}): CandidateTasteProfile => {
  const {judgmentInput, snapshot, evaluation} = input;
  const {candidate, scoring, antiRepetition, violations} = evaluation;
  const totalPenalty = violations.reduce((sum, violation) => sum + violation.penalty, 0);
  const riskFlags = buildRiskFlags({snapshot, evaluation});
  const quietCandidate = isQuietCandidate(candidate);
  const expressiveCandidate = isExpressiveCandidate(candidate);
  const majorPayoff = judgmentInput.moment.momentType === "payoff" || judgmentInput.moment.importance >= 0.94;
  const lowEnergyPremiumMoment = snapshot.emotionalSpine === "luxury" || judgmentInput.moment.energy <= 0.48;
  const supportsPunchWordIsolation = snapshot.emphasisTargets.isolatePunchWord && candidate.emphasisMode === "isolated-punch-word";
  const repeatedMotionRisk = antiRepetition.repeatedMotionModeCount > 0 ? 0.12 : 0;
  const repeatedTypographyRisk = antiRepetition.repeatedTypographyModeCount > 0 ? 0.1 : 0;
  const premiumTrickRisk = antiRepetition.repeatedPremiumTrickCount > 0 ? 0.14 : 0;
  const blockingPenalty = evaluation.blocked ? 0.2 : 0;
  const busyFramePenalty = snapshot.spatialConstraints.busyFrame &&
    (candidate.backgroundTextMode === "hero" || candidate.placementMode === "full-frame" || candidate.intensity === "expressive")
    ? 0.16
    : 0;
  const sequenceFitBase = (
    scoring.sequenceContrastScore +
    scoring.escalationFitScore +
    scoring.surprisePreservationScore +
    scoring.pacingVariationScore +
    scoring.restraintBalanceScore +
    scoring.emotionalProgressionScore +
    scoring.climaxBudgetScore
  ) / 7;

  const premiumFeel = clamp01(
    scoring.premiumFeelScore * 0.42 +
    scoring.eleganceScore * 0.24 +
    scoring.humanMadeFeelScore * 0.14 +
    (candidate.family.includes("premium") || candidate.family.includes("luxury") || candidate.family === "elegant-founder-brand" ? 0.14 : 0.06) -
    totalPenalty * 0.08 -
    (lowEnergyPremiumMoment && expressiveCandidate ? 0.1 : 0)
  );

  const cinematicIntentionality = clamp01(
    scoring.sequenceContrastScore * 0.22 +
    scoring.emotionalAlignmentScore * 0.22 +
    scoring.humanMadeFeelScore * 0.12 +
    (candidate.motionMode !== "none" ? 0.16 : 0.08) +
    (candidate.motionMode === "light-sweep-reveal" || candidate.motionMode === "depth-card-float" || candidate.finalTreatment === "behind-speaker-depth" ? 0.16 : 0.08) -
    repeatedMotionRisk -
    totalPenalty * 0.06
  );

  const readability = clamp01(
    scoring.readabilityScore * 0.52 +
    scoring.breathingRoomScore * 0.24 +
    (1 - scoring.clutterPenalty) * 0.18 +
    (quietCandidate ? 0.08 : 0) -
    (hasBlockingReadabilityRisk(candidate, snapshot) ? 0.14 : 0) -
    busyFramePenalty
  );

  const emotionalAlignment = clamp01(
    scoring.emotionalAlignmentScore * 0.56 +
    scoring.visualHierarchyScore * 0.2 +
    (supportsPunchWordIsolation ? 0.16 : snapshot.emphasisTargets.isolatePunchWord ? 0.04 : 0.1) +
    (lowEnergyPremiumMoment && quietCandidate ? 0.08 : 0)
  );

  const rhetoricalClarity = clamp01(
    scoring.rhetoricalAlignmentScore * 0.56 +
    scoring.semanticAlignmentScore * 0.18 +
    scoring.visualHierarchyScore * 0.18 +
    (snapshot.rhetoricalPurpose === "emotional-punch" && supportsPunchWordIsolation ? 0.08 : 0) -
    (candidate.placementMode === "full-frame" && snapshot.rhetoricalPurpose === "education" ? 0.08 : 0)
  );

  const restraint = clamp01(
    scoring.restraintBalanceScore * 0.58 +
    (quietCandidate ? 0.24 : 0.08) +
    (snapshot.recentSequenceMetrics.preferRestraintNext && quietCandidate ? 0.14 : 0) -
    (snapshot.recentSequenceMetrics.preferRestraintNext && expressiveCandidate && !majorPayoff ? 0.18 : 0) -
    (candidate.backgroundTextMode === "hero" ? 0.06 : 0)
  );

  const noveltyWithoutChaos = clamp01(
    scoring.noveltyAcrossSequenceScore * 0.36 +
    scoring.noveltyScore * 0.22 +
    (1 - scoring.clutterPenalty) * 0.18 +
    (1 - scoring.repetitionPenalty) * 0.18 -
    blockingPenalty
  );

  const sequenceFit = clamp01(
    sequenceFitBase -
    (snapshot.recentSequenceMetrics.preferRestraintNext && expressiveCandidate && !majorPayoff ? 0.12 : 0) +
    (snapshot.recentSequenceMetrics.consecutiveQuietMoments >= 2 && expressiveCandidate ? 0.06 : 0) -
    (snapshot.spatialConstraints.frameNeedsRestraint && expressiveCandidate ? 0.12 : 0)
  );

  const nonClicheExecution = clamp01(
    scoring.nonRepetitionScore * 0.34 +
    (1 - scoring.repetitionPenalty) * 0.26 +
    scoring.noveltyAcrossSequenceScore * 0.16 +
    (judgmentInput.creatorStyleProfile?.avoidCliches ?? true ? 0.14 : 0.08) -
    premiumTrickRisk -
    repeatedMotionRisk * 0.5 -
    repeatedTypographyRisk * 0.5
  );

  const humanMadeFeel = clamp01(
    scoring.humanMadeFeelScore * 0.66 +
    scoring.eleganceScore * 0.16 +
    (1 - scoring.clutterPenalty) * 0.14 -
    (candidate.backgroundTextMode === "hero" && candidate.placementMode === "full-frame" ? 0.08 : 0)
  );

  const creatorStyleFit = clamp01(
    scoring.creatorStyleAdherenceScore * 0.66 +
    candidate.consistencyLevel * 0.14 +
    ((judgmentInput.creatorStyleProfile?.premiumBias ?? 0.8) >= 0.72 ? premiumFeel * 0.12 : 0.06) +
    ((judgmentInput.creatorStyleProfile?.noveltyPreference ?? 0.45) >= 0.68 ? noveltyWithoutChaos * 0.08 : 0.04)
  );

  const renderPracticality = clamp01(
    scoring.renderabilityScore * 0.72 +
    (evaluation.blocked ? 0.14 : 0.26) +
    (quietCandidate ? 0.08 : 0.02) -
    totalPenalty * 0.08 -
    (busyFramePenalty * 0.5)
  );

  const criticComposite = clamp01(
    premiumFeel * TASTE_DIMENSION_WEIGHTS.premiumFeel +
    cinematicIntentionality * TASTE_DIMENSION_WEIGHTS.cinematicIntentionality +
    readability * TASTE_DIMENSION_WEIGHTS.readability +
    emotionalAlignment * TASTE_DIMENSION_WEIGHTS.emotionalAlignment +
    rhetoricalClarity * TASTE_DIMENSION_WEIGHTS.rhetoricalClarity +
    restraint * TASTE_DIMENSION_WEIGHTS.restraint +
    noveltyWithoutChaos * TASTE_DIMENSION_WEIGHTS.noveltyWithoutChaos +
    sequenceFit * TASTE_DIMENSION_WEIGHTS.sequenceFit +
    nonClicheExecution * TASTE_DIMENSION_WEIGHTS.nonClicheExecution +
    humanMadeFeel * TASTE_DIMENSION_WEIGHTS.humanMadeFeel +
    creatorStyleFit * TASTE_DIMENSION_WEIGHTS.creatorStyleFit +
    renderPracticality * TASTE_DIMENSION_WEIGHTS.renderPracticality
  );

  return {
    premiumFeel,
    cinematicIntentionality,
    readability,
    emotionalAlignment,
    rhetoricalClarity,
    restraint,
    noveltyWithoutChaos,
    sequenceFit,
    nonClicheExecution,
    humanMadeFeel,
    creatorStyleFit,
    renderPracticality,
    criticComposite,
    riskFlags
  };
};

const buildDimensionComparison = (input: {
  candidateAId: string;
  candidateBId: string;
  candidateAValue: number;
  candidateBValue: number;
}) => {
  const advantage = clamp01(Math.abs(input.candidateAValue - input.candidateBValue));
  const favoredCandidateId = Math.abs(input.candidateAValue - input.candidateBValue) < 0.015
    ? null
    : input.candidateAValue > input.candidateBValue
      ? input.candidateAId
      : input.candidateBId;

  return {
    candidateA: input.candidateAValue,
    candidateB: input.candidateBValue,
    advantage: input.candidateAValue >= input.candidateBValue ? advantage : -advantage,
    favoredCandidateId
  };
};

const buildReasons = (input: {
  judgmentInput: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  evaluationA: PairwiseCriticCandidateEvaluation;
  evaluationB: PairwiseCriticCandidateEvaluation;
  profileA: CandidateTasteProfile;
  profileB: CandidateTasteProfile;
  winnerLabel: string;
  loserLabel: string;
  winner: PairwiseCriticCandidateEvaluation;
  loser: PairwiseCriticCandidateEvaluation;
}): string[] => {
  const {
    judgmentInput,
    snapshot,
    evaluationA,
    evaluationB,
    profileA,
    profileB,
    winnerLabel,
    loserLabel,
    winner,
    loser
  } = input;
  const reasons: string[] = [];
  const winnerProfile = winner.candidate.id === evaluationA.candidate.id ? profileA : profileB;
  const loserProfile = loser.candidate.id === evaluationA.candidate.id ? profileA : profileB;

  if (snapshot.recentSequenceMetrics.preferRestraintNext && isQuietCandidate(winner.candidate) && isExpressiveCandidate(loser.candidate)) {
    reasons.push(`${winnerLabel} wins because it creates contrast after recent loud beats.`);
  }
  if (loser.antiRepetition.repeatedMotionModeCount > winner.antiRepetition.repeatedMotionModeCount && loser.antiRepetition.repeatedMotionModeCount > 0) {
    reasons.push(`${loserLabel} loses because it repeats the same ${loser.candidate.motionMode} motion signature.`);
  }
  if (winnerProfile.readability - loserProfile.readability > 0.08) {
    reasons.push(`${winnerLabel} wins because it preserves readability and breathing room.`);
  }
  if (loserProfile.readability < winnerProfile.readability && loser.scoring.clutterPenalty > winner.scoring.clutterPenalty + 0.05) {
    reasons.push(`${loserLabel} is flashier but has weaker readability and higher clutter risk.`);
  }
  if (snapshot.emphasisTargets.isolatePunchWord && winner.candidate.emphasisMode === "isolated-punch-word" && loser.candidate.emphasisMode !== "isolated-punch-word") {
    reasons.push(`${winnerLabel} wins because it isolates the punch word while preserving breathing room.`);
  }
  if ((snapshot.emotionalSpine === "luxury" || judgmentInput.moment.energy <= 0.48) && winner.candidate.family === "luxury-minimal") {
    reasons.push(`${winnerLabel} wins because the moment wants luxury restraint instead of spectacle.`);
  }
  if (winnerProfile.sequenceFit - loserProfile.sequenceFit > 0.08) {
    reasons.push(`${winnerLabel} wins because it fits the current sequence rhythm more cleanly.`);
  }
  if (winnerProfile.nonClicheExecution - loserProfile.nonClicheExecution > 0.08) {
    reasons.push(`${winnerLabel} avoids cliché execution better than ${loserLabel}.`);
  }

  if (reasons.length === 0) {
    const dimensionDeltas = [
      {name: "premium feel", value: winnerProfile.premiumFeel - loserProfile.premiumFeel},
      {name: "cinematic intentionality", value: winnerProfile.cinematicIntentionality - loserProfile.cinematicIntentionality},
      {name: "readability", value: winnerProfile.readability - loserProfile.readability},
      {name: "emotional alignment", value: winnerProfile.emotionalAlignment - loserProfile.emotionalAlignment},
      {name: "sequence fit", value: winnerProfile.sequenceFit - loserProfile.sequenceFit},
      {name: "human-made feel", value: winnerProfile.humanMadeFeel - loserProfile.humanMadeFeel}
    ].sort((left, right) => right.value - left.value);
    reasons.push(`${winnerLabel} wins because it is stronger on ${dimensionDeltas[0]?.name ?? "editorial fit"} without adding unnecessary risk.`);
  }

  return reasons.slice(0, 4);
};

const buildComparisonRiskFlags = (input: {
  winner: PairwiseCriticCandidateEvaluation;
  loser: PairwiseCriticCandidateEvaluation;
  winnerProfile: CandidateTasteProfile;
  loserProfile: CandidateTasteProfile;
}): string[] => {
  const flags = [
    ...input.winnerProfile.riskFlags.map((flag) => `winner:${flag}`),
    ...input.loserProfile.riskFlags.map((flag) => `loser:${flag}`)
  ];
  if (input.winnerProfile.readability < 0.72) {
    flags.push("winner:narrow-readability-margin");
  }
  if (input.loserProfile.nonClicheExecution < 0.62) {
    flags.push("loser:cliche-execution-risk");
  }
  return [...new Set(flags)];
};

export const buildPairwiseTasteComparison = (input: {
  judgmentInput: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  evaluationA: PairwiseCriticCandidateEvaluation;
  evaluationB: PairwiseCriticCandidateEvaluation;
}): PairwiseTasteComparison => {
  const profileA = buildTasteProfile({
    judgmentInput: input.judgmentInput,
    snapshot: input.snapshot,
    evaluation: input.evaluationA
  });
  const profileB = buildTasteProfile({
    judgmentInput: input.judgmentInput,
    snapshot: input.snapshot,
    evaluation: input.evaluationB
  });
  const baseScoreDelta = input.evaluationA.scoring.finalScore - input.evaluationB.scoring.finalScore;
  const criticScoreDelta = (profileA.criticComposite - profileB.criticComposite) + (baseScoreDelta * 0.15);
  const winner = criticScoreDelta >= 0 ? input.evaluationA : input.evaluationB;
  const loser = criticScoreDelta >= 0 ? input.evaluationB : input.evaluationA;
  const winnerProfile = criticScoreDelta >= 0 ? profileA : profileB;
  const loserProfile = criticScoreDelta >= 0 ? profileB : profileA;
  const winnerLabel = winner.candidate.id === input.evaluationA.candidate.id
    ? `Candidate A (${winner.candidate.family})`
    : `Candidate B (${winner.candidate.family})`;
  const loserLabel = loser.candidate.id === input.evaluationA.candidate.id
    ? `Candidate A (${loser.candidate.family})`
    : `Candidate B (${loser.candidate.family})`;

  const tasteDimensions: PairwiseTasteDimensions = {
    premiumFeel: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.premiumFeel,
      candidateBValue: profileB.premiumFeel
    }),
    cinematicIntentionality: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.cinematicIntentionality,
      candidateBValue: profileB.cinematicIntentionality
    }),
    readability: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.readability,
      candidateBValue: profileB.readability
    }),
    emotionalAlignment: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.emotionalAlignment,
      candidateBValue: profileB.emotionalAlignment
    }),
    rhetoricalClarity: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.rhetoricalClarity,
      candidateBValue: profileB.rhetoricalClarity
    }),
    restraint: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.restraint,
      candidateBValue: profileB.restraint
    }),
    noveltyWithoutChaos: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.noveltyWithoutChaos,
      candidateBValue: profileB.noveltyWithoutChaos
    }),
    sequenceFit: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.sequenceFit,
      candidateBValue: profileB.sequenceFit
    }),
    nonClicheExecution: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.nonClicheExecution,
      candidateBValue: profileB.nonClicheExecution
    }),
    humanMadeFeel: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.humanMadeFeel,
      candidateBValue: profileB.humanMadeFeel
    }),
    creatorStyleFit: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.creatorStyleFit,
      candidateBValue: profileB.creatorStyleFit
    }),
    renderPracticality: buildDimensionComparison({
      candidateAId: input.evaluationA.candidate.id,
      candidateBId: input.evaluationB.candidate.id,
      candidateAValue: profileA.renderPracticality,
      candidateBValue: profileB.renderPracticality
    })
  };

  return pairwiseTasteComparisonSchema.parse({
    candidateAId: input.evaluationA.candidate.id,
    candidateBId: input.evaluationB.candidate.id,
    winnerCandidateId: winner.candidate.id,
    loserCandidateId: loser.candidate.id,
    margin: clamp01(Math.abs(criticScoreDelta)),
    baseScoreDelta: clamp01(Math.abs(baseScoreDelta)) * Math.sign(baseScoreDelta || 1),
    criticScoreDelta: clamp01(Math.abs(criticScoreDelta)) * Math.sign(criticScoreDelta || 1),
    reasons: buildReasons({
      judgmentInput: input.judgmentInput,
      snapshot: input.snapshot,
      evaluationA: input.evaluationA,
      evaluationB: input.evaluationB,
      profileA,
      profileB,
      winnerLabel,
      loserLabel,
      winner,
      loser
    }),
    riskFlags: buildComparisonRiskFlags({
      winner,
      loser,
      winnerProfile,
      loserProfile
    }),
    tasteDimensions
  });
};

export type PairwiseCriticSelection = {
  selectedCandidateId: string;
  runnerUpCandidateId: string | null;
  criticRationale: string[];
  tasteRiskFlags: string[];
  pairwiseTasteComparisons: PairwiseTasteComparison[];
};

export const rankCandidatesWithPairwiseCritic = (input: {
  judgmentInput: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  evaluations: PairwiseCriticCandidateEvaluation[];
}): PairwiseCriticSelection => {
  const focusEvaluations = input.evaluations.slice(0, Math.min(4, input.evaluations.length));
  if (focusEvaluations.length === 0) {
    return {
      selectedCandidateId: "",
      runnerUpCandidateId: null,
      criticRationale: [],
      tasteRiskFlags: [],
      pairwiseTasteComparisons: []
    };
  }
  if (focusEvaluations.length === 1) {
    const single = focusEvaluations[0]!;
    return {
      selectedCandidateId: single.candidate.id,
      runnerUpCandidateId: null,
      criticRationale: ["Only one viable candidate remained after scoring and negative grammar."],
      tasteRiskFlags: buildRiskFlags({
        snapshot: input.snapshot,
        evaluation: single
      }),
      pairwiseTasteComparisons: []
    };
  }

  const stats = new Map<string, {
    wins: number;
    marginTotal: number;
    rationale: Set<string>;
    riskFlags: Set<string>;
  }>();
  focusEvaluations.forEach((evaluation) => {
    stats.set(evaluation.candidate.id, {
      wins: 0,
      marginTotal: 0,
      rationale: new Set<string>(),
      riskFlags: new Set<string>()
    });
  });

  const pairwiseTasteComparisons: PairwiseTasteComparison[] = [];
  for (let leftIndex = 0; leftIndex < focusEvaluations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < focusEvaluations.length; rightIndex += 1) {
      const comparison = buildPairwiseTasteComparison({
        judgmentInput: input.judgmentInput,
        snapshot: input.snapshot,
        evaluationA: focusEvaluations[leftIndex]!,
        evaluationB: focusEvaluations[rightIndex]!
      });
      pairwiseTasteComparisons.push(comparison);
      const winnerStats = stats.get(comparison.winnerCandidateId);
      const loserStats = stats.get(comparison.loserCandidateId);
      if (winnerStats) {
        winnerStats.wins += 1;
        winnerStats.marginTotal += comparison.margin;
        comparison.reasons.forEach((reason) => winnerStats.rationale.add(reason));
        comparison.riskFlags.forEach((flag) => winnerStats.riskFlags.add(flag));
      }
      if (loserStats) {
        loserStats.marginTotal -= comparison.margin * 0.35;
        comparison.riskFlags.forEach((flag) => loserStats.riskFlags.add(flag));
      }
    }
  }

  const ranked = focusEvaluations
    .map((evaluation) => ({
      evaluation,
      wins: stats.get(evaluation.candidate.id)?.wins ?? 0,
      marginTotal: stats.get(evaluation.candidate.id)?.marginTotal ?? 0,
      rationale: [...(stats.get(evaluation.candidate.id)?.rationale ?? [])],
      riskFlags: [...(stats.get(evaluation.candidate.id)?.riskFlags ?? [])]
    }))
    .sort((left, right) => (
      right.wins - left.wins ||
      right.marginTotal - left.marginTotal ||
      right.evaluation.scoring.finalScore - left.evaluation.scoring.finalScore ||
      left.evaluation.candidate.id.localeCompare(right.evaluation.candidate.id)
    ));

  const selected = ranked[0]!;
  const runnerUp = ranked[1]?.evaluation.candidate.id ?? null;
  return {
    selectedCandidateId: selected.evaluation.candidate.id,
    runnerUpCandidateId: runnerUp,
    criticRationale: selected.rationale.slice(0, 4),
    tasteRiskFlags: selected.riskFlags,
    pairwiseTasteComparisons
  };
};
