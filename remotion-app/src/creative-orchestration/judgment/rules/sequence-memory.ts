import type {
  CandidateTreatmentProfile,
  ContrastDirection,
  CreativeContrastRecord,
  EditDecisionPlan,
  EscalationHistoryEntry,
  EscalationStage,
  JudgmentEngineInput,
  PreJudgmentSnapshot,
  SequenceDecisionSummary,
  SequenceMetrics,
  SequenceVisualPattern,
  TreatmentFingerprint,
  VisualDensityProfile,
  VisualPrioritySubject
} from "../types";
import {clamp01} from "../../utils";

const densityToNumber = (density: VisualDensityProfile): number => {
  if (density === "quiet") {
    return 0.2;
  }
  if (density === "loud") {
    return 0.88;
  }
  return 0.55;
};

const isRestrainedIntensity = (intensity: CandidateTreatmentProfile["intensity"] | SequenceDecisionSummary["intensity"]): boolean => {
  return intensity === "minimal" || intensity === "restrained";
};

export const isExpressiveTypographyMode = (typographyMode: string): boolean => {
  return typographyMode === "keyword-only" ||
    typographyMode === "title-card" ||
    typographyMode === "editorial-cursive";
};

export const deriveVisualDensityProfile = (input: Pick<CandidateTreatmentProfile, "backgroundTextMode" | "intensity" | "matteUsage" | "placementMode">): VisualDensityProfile => {
  const loudSignals = Number(input.backgroundTextMode === "hero") +
    Number(input.intensity === "expressive") +
    Number(input.matteUsage === "behind-subject-text") +
    Number(input.placementMode === "full-frame");
  const quietSignals = Number(input.backgroundTextMode === "none") +
    Number(input.intensity === "minimal") +
    Number(input.matteUsage === "none") +
    Number(input.placementMode === "center-stage");

  if (loudSignals >= 2) {
    return "loud";
  }
  if (quietSignals >= 3) {
    return "quiet";
  }
  return "balanced";
};

const buildFocalStructure = (input: {
  typographyMode: string;
  placementMode: CandidateTreatmentProfile["placementMode"] | SequenceDecisionSummary["placementMode"];
  matteUsage: CandidateTreatmentProfile["matteUsage"] | SequenceDecisionSummary["matteUsage"];
  backgroundTextMode: CandidateTreatmentProfile["backgroundTextMode"] | SequenceDecisionSummary["backgroundTextMode"];
}): VisualPrioritySubject[] => {
  const structure: VisualPrioritySubject[] = ["speaker-face"];

  if (input.typographyMode === "keyword-only") {
    structure.unshift("punch-word");
  } else if (input.typographyMode === "title-card") {
    structure.unshift("headline-phrase");
  } else {
    structure.unshift("supporting-phrase");
  }

  if (input.matteUsage === "behind-subject-text") {
    structure.push("matte-background-text");
  }
  if (input.backgroundTextMode === "hero") {
    structure.push("matte-background-text");
  }
  if (input.placementMode === "full-frame") {
    structure.push("supporting-motion-graphics");
  } else {
    structure.push("negative-space");
  }

  return [...new Set(structure)];
};

const extractPremiumTricks = (input: {
  typographyMode: string;
  motionMode: string;
  matteUsage: CandidateTreatmentProfile["matteUsage"] | SequenceDecisionSummary["matteUsage"];
  backgroundTextMode: CandidateTreatmentProfile["backgroundTextMode"] | SequenceDecisionSummary["backgroundTextMode"];
  placementMode: CandidateTreatmentProfile["placementMode"] | SequenceDecisionSummary["placementMode"];
}): string[] => {
  const tricks: string[] = [];
  if (input.backgroundTextMode === "hero") {
    tricks.push("hero-background-text");
  }
  if (input.matteUsage === "behind-subject-text") {
    tricks.push("behind-subject-text");
  }
  if (input.motionMode === "blur-slide-up") {
    tricks.push("blur-slide-reveal");
  }
  if (input.motionMode === "light-sweep-reveal") {
    tricks.push("light-sweep");
  }
  if (input.motionMode === "zoom-through-layer") {
    tricks.push("zoom-through-layer");
  }
  if (input.typographyMode === "title-card") {
    tricks.push("title-card-lockup");
  }
  if (input.placementMode === "full-frame") {
    tricks.push("full-frame-takeover");
  }
  return tricks;
};

const resolveHeroMoment = (input: {
  intensity: CandidateTreatmentProfile["intensity"] | SequenceDecisionSummary["intensity"];
  visualDensity: VisualDensityProfile;
  momentImportance?: number;
  backgroundTextMode: CandidateTreatmentProfile["backgroundTextMode"] | SequenceDecisionSummary["backgroundTextMode"];
  placementMode: CandidateTreatmentProfile["placementMode"] | SequenceDecisionSummary["placementMode"];
}): boolean => {
  return input.momentImportance !== undefined && input.momentImportance >= 0.9
    ? true
    : (input.intensity === "expressive" && input.visualDensity === "loud") ||
        input.backgroundTextMode === "hero" ||
        input.placementMode === "full-frame";
};

const resolveVisualClimax = (input: {
  heroMoment: boolean;
  visualDensity: VisualDensityProfile;
  intensity: CandidateTreatmentProfile["intensity"] | SequenceDecisionSummary["intensity"];
  momentImportance?: number;
}): boolean => {
  return Boolean(input.heroMoment && input.visualDensity === "loud") ||
    (input.intensity === "expressive" && (input.momentImportance ?? 0) >= 0.92);
};

const resolveEmotionalPeak = (input: {
  emotionalSpine: SequenceDecisionSummary["emotionalSpine"];
  momentEnergy?: number;
  momentImportance?: number;
}): boolean => {
  return ["urgency", "surprise", "desire", "vulnerability", "excitement"].includes(input.emotionalSpine) &&
    (((input.momentEnergy ?? 0.5) >= 0.78) || ((input.momentImportance ?? 0.5) >= 0.9));
};

const countTrailingMatches = <T>(items: T[], predicate: (item: T) => boolean): number => {
  let count = 0;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!predicate(items[index]!)) {
      break;
    }
    count += 1;
  }
  return count;
};

const countTrailingSameValue = <T>(items: T[], getValue: (item: T) => string | boolean | number): number => {
  if (items.length === 0) {
    return 0;
  }
  const lastValue = getValue(items[items.length - 1]!);
  return countTrailingMatches(items, (item) => getValue(item) === lastValue);
};

export const deriveTrend = (values: number[]): SequenceMetrics["recentEnergyTrend"] => {
  if (values.length < 2) {
    return "steady";
  }

  const deltas = values.slice(1).map((value, index) => value - values[index]!);
  const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const volatility = deltas.reduce((sum, value) => sum + Math.abs(value), 0) / deltas.length;

  if (volatility >= 0.28) {
    return "volatile";
  }
  if (averageDelta >= 0.06) {
    return "rising";
  }
  if (averageDelta <= -0.06) {
    return "falling";
  }
  return "steady";
};

const resolveContrastDirection = (previous: SequenceVisualPattern | undefined, current: SequenceVisualPattern): ContrastDirection => {
  if (!previous) {
    return "maintain";
  }
  const changedDensity = previous.visualDensity !== current.visualDensity;
  const changedTypography = previous.typographyMode !== current.typographyMode;
  const changedMotion = previous.motionMode !== current.motionMode;
  const previousDensity = densityToNumber(previous.visualDensity);
  const currentDensity = densityToNumber(current.visualDensity);

  if (changedDensity && currentDensity < previousDensity - 0.2) {
    return "restrain";
  }
  if (changedDensity && currentDensity > previousDensity + 0.2) {
    return "escalate";
  }
  if ((previous.heroMoment || previous.visualClimax || previous.emotionalPeak) &&
      !current.heroMoment &&
      !current.visualClimax &&
      !current.emotionalPeak) {
    return "reset";
  }
  if (changedTypography || changedMotion) {
    return "invert";
  }
  return "maintain";
};

const resolveEscalationStage = (input: {
  heroMoment: boolean;
  visualClimax: boolean;
  emotionalPeak: boolean;
  energy?: number;
  recentEnergyTrend?: SequenceMetrics["recentEnergyTrend"];
}): EscalationStage => {
  if (input.visualClimax || input.heroMoment) {
    return "release";
  }
  if ((input.energy ?? 0.5) <= 0.42) {
    return "reset";
  }
  if (input.recentEnergyTrend === "rising" || input.emotionalPeak) {
    return "build";
  }
  if ((input.energy ?? 0.5) >= 0.62) {
    return "hold";
  }
  return "setup";
};

export const toSequenceDecisionSummary = (input: {
  segmentId: string;
  rhetoricalPurpose: SequenceDecisionSummary["rhetoricalPurpose"];
  emotionalSpine: SequenceDecisionSummary["emotionalSpine"];
  minimalismLevel: SequenceDecisionSummary["minimalismLevel"];
  selectedTreatment: EditDecisionPlan["selectedTreatment"];
  finalScore: number;
  retrievalAction?: SequenceDecisionSummary["retrievalAction"];
  negativeGrammarRuleIds?: string[];
  momentType?: string;
  momentEnergy?: number;
  momentImportance?: number;
}): SequenceDecisionSummary => {
  const visualDensity = deriveVisualDensityProfile(input.selectedTreatment);
  const heroMoment = resolveHeroMoment({
    intensity: input.selectedTreatment.intensity,
    visualDensity,
    momentImportance: input.momentImportance,
    backgroundTextMode: input.selectedTreatment.backgroundTextMode,
    placementMode: input.selectedTreatment.placementMode
  });
  const visualClimax = resolveVisualClimax({
    heroMoment,
    visualDensity,
    intensity: input.selectedTreatment.intensity,
    momentImportance: input.momentImportance
  });
  const emotionalPeak = resolveEmotionalPeak({
    emotionalSpine: input.emotionalSpine,
    momentEnergy: input.momentEnergy,
    momentImportance: input.momentImportance
  });

  return {
    segmentId: input.segmentId,
    rhetoricalPurpose: input.rhetoricalPurpose,
    emotionalSpine: input.emotionalSpine,
    treatmentFamily: input.selectedTreatment.family,
    typographyMode: input.selectedTreatment.typographyMode,
    motionMode: input.selectedTreatment.motionMode,
    emphasisMode: input.selectedTreatment.emphasisMode,
    placementMode: input.selectedTreatment.placementMode,
    matteUsage: input.selectedTreatment.matteUsage,
    backgroundTextMode: input.selectedTreatment.backgroundTextMode,
    intensity: input.selectedTreatment.intensity,
    minimalismLevel: input.minimalismLevel,
    visualDensity,
    finalScore: clamp01(input.finalScore),
    retrievalAction: input.retrievalAction ?? "skip",
    negativeGrammarRuleIds: input.negativeGrammarRuleIds ?? [],
    heroMoment,
    visualClimax,
    emotionalPeak,
    focalStructure: buildFocalStructure(input.selectedTreatment),
    premiumTricks: extractPremiumTricks(input.selectedTreatment),
    momentType: input.momentType,
    momentEnergy: input.momentEnergy,
    momentImportance: input.momentImportance
  };
};

export const toSequenceVisualPattern = (input: {
  segmentId: string;
  treatmentFamily: SequenceVisualPattern["treatmentFamily"];
  typographyMode: string;
  motionMode: string;
  emphasisMode: string;
  placementMode: SequenceVisualPattern["placementMode"];
  matteUsage: SequenceVisualPattern["matteUsage"];
  backgroundTextMode: SequenceVisualPattern["backgroundTextMode"];
  intensity: SequenceVisualPattern["intensity"];
  rhetoricalPurpose?: SequenceVisualPattern["rhetoricalPurpose"];
  emotionalSpine?: SequenceVisualPattern["emotionalSpine"];
  retrievalAction?: SequenceVisualPattern["retrievalAction"];
  heroMoment?: boolean;
  visualClimax?: boolean;
  emotionalPeak?: boolean;
  focalStructure?: SequenceVisualPattern["focalStructure"];
  premiumTricks?: string[];
  negativeGrammarRuleIds?: string[];
}): SequenceVisualPattern => {
  const visualDensity = deriveVisualDensityProfile(input);
  const heroMoment = input.heroMoment ?? resolveHeroMoment({
    intensity: input.intensity,
    visualDensity,
    backgroundTextMode: input.backgroundTextMode,
    placementMode: input.placementMode
  });
  return {
    segmentId: input.segmentId,
    treatmentFamily: input.treatmentFamily,
    typographyMode: input.typographyMode,
    motionMode: input.motionMode,
    emphasisMode: input.emphasisMode,
    placementMode: input.placementMode,
    matteUsage: input.matteUsage,
    backgroundTextMode: input.backgroundTextMode,
    intensity: input.intensity,
    visualDensity,
    rhetoricalPurpose: input.rhetoricalPurpose,
    emotionalSpine: input.emotionalSpine,
    retrievalAction: input.retrievalAction ?? "skip",
    heroMoment,
    visualClimax: input.visualClimax ?? resolveVisualClimax({
      heroMoment,
      visualDensity,
      intensity: input.intensity
    }),
    emotionalPeak: input.emotionalPeak ?? false,
    focalStructure: input.focalStructure ?? buildFocalStructure(input),
    premiumTricks: input.premiumTricks ?? extractPremiumTricks(input),
    negativeGrammarRuleIds: input.negativeGrammarRuleIds ?? []
  };
};

export const buildTreatmentFingerprint = (input: SequenceDecisionSummary): TreatmentFingerprint => {
  return {
    segmentId: input.segmentId,
    treatmentFamily: input.treatmentFamily,
    typographyMode: input.typographyMode,
    motionMode: input.motionMode,
    emphasisMode: input.emphasisMode,
    placementMode: input.placementMode,
    matteUsage: input.matteUsage,
    backgroundTextMode: input.backgroundTextMode,
    visualDensity: input.visualDensity,
    intensity: input.intensity,
    rhetoricalPurpose: input.rhetoricalPurpose,
    emotionalSpine: input.emotionalSpine,
    retrievalAction: input.retrievalAction,
    heroMoment: input.heroMoment,
    visualClimax: input.visualClimax,
    emotionalPeak: input.emotionalPeak,
    focalStructure: input.focalStructure,
    premiumTricks: input.premiumTricks,
    negativeGrammarRuleIds: input.negativeGrammarRuleIds
  };
};

export const buildCreativeContrastRecord = (input: {
  current: SequenceVisualPattern;
  previous?: SequenceVisualPattern;
}): CreativeContrastRecord => {
  const {current, previous} = input;
  return {
    segmentId: current.segmentId,
    comparedToSegmentId: previous?.segmentId ?? null,
    direction: resolveContrastDirection(previous, current),
    changedTypography: previous ? previous.typographyMode !== current.typographyMode : false,
    changedMotion: previous ? previous.motionMode !== current.motionMode : false,
    changedPlacement: previous ? previous.placementMode !== current.placementMode : false,
    changedDensity: previous ? previous.visualDensity !== current.visualDensity : false,
    changedEmotionalCadence: previous ? previous.emotionalSpine !== current.emotionalSpine : false,
    changedRhetoricalRhythm: previous ? previous.rhetoricalPurpose !== current.rhetoricalPurpose : false,
    notes: previous
      ? [
          ...(previous.visualDensity === current.visualDensity ? ["Visual density stayed too similar."] : []),
          ...(previous.motionMode === current.motionMode ? ["Motion signature stayed the same."] : [])
        ]
      : []
  };
};

export const buildEscalationHistoryEntry = (input: SequenceDecisionSummary, recentEnergyTrend?: SequenceMetrics["recentEnergyTrend"]): EscalationHistoryEntry => {
  return {
    segmentId: input.segmentId,
    stage: resolveEscalationStage({
      heroMoment: input.heroMoment,
      visualClimax: input.visualClimax,
      emotionalPeak: input.emotionalPeak,
      energy: input.momentEnergy,
      recentEnergyTrend
    }),
    energy: input.momentEnergy ?? 0.5,
    importance: input.momentImportance ?? 0.5,
    visualDensity: input.visualDensity,
    intensity: input.intensity,
    heroMoment: input.heroMoment,
    visualClimax: input.visualClimax,
    emotionalPeak: input.emotionalPeak
  };
};

export const buildSequenceMetrics = (input: {
  recentDecisionPlans: SequenceDecisionSummary[];
  recentVisualPatterns: SequenceVisualPattern[];
  recentSequenceMetrics?: JudgmentEngineInput["recentSequenceMetrics"];
  recentTreatmentFingerprintHistory?: TreatmentFingerprint[];
  recentCreativeContrastHistory?: CreativeContrastRecord[];
  recentEscalationHistory?: EscalationHistoryEntry[];
  lookbackWindow: number;
}): SequenceMetrics => {
  const recentDecisionPlans = input.recentDecisionPlans.slice(-input.lookbackWindow);
  const recentVisualPatterns = input.recentVisualPatterns.slice(-input.lookbackWindow);
  const treatmentFingerprintHistory = (
    input.recentTreatmentFingerprintHistory?.length
      ? input.recentTreatmentFingerprintHistory
      : recentDecisionPlans.map((summary) => buildTreatmentFingerprint(summary))
  ).slice(-input.lookbackWindow);
  const creativeContrastHistory = (
    input.recentCreativeContrastHistory?.length
      ? input.recentCreativeContrastHistory
      : recentVisualPatterns.map((pattern, index) => buildCreativeContrastRecord({
          current: pattern,
          previous: recentVisualPatterns[index - 1]
        }))
  ).slice(-input.lookbackWindow);

  const energySeries = recentDecisionPlans.map((summary) => summary.momentEnergy ?? 0.5);
  const importanceSeries = recentDecisionPlans.map((summary) => summary.momentImportance ?? 0.5);
  const densitySeries = recentVisualPatterns.map((pattern) => densityToNumber(pattern.visualDensity));
  const recentEnergyTrend = deriveTrend(energySeries);
  const recentVisualDensityTrend = deriveTrend(densitySeries);
  const recentAverageEnergy = energySeries.length > 0
    ? energySeries.reduce((sum, value) => sum + value, 0) / energySeries.length
    : 0.5;
  const recentAverageImportance = importanceSeries.length > 0
    ? importanceSeries.reduce((sum, value) => sum + value, 0) / importanceSeries.length
    : 0.5;

  const escalationHistory = (
    input.recentEscalationHistory?.length
      ? input.recentEscalationHistory
      : recentDecisionPlans.map((summary) => buildEscalationHistoryEntry(summary, recentEnergyTrend))
  ).slice(-input.lookbackWindow);

  const consecutiveHighIntensityMoments = countTrailingMatches(recentDecisionPlans, (summary) => summary.intensity === "expressive");
  const consecutiveQuietMoments = countTrailingMatches(recentDecisionPlans, (summary) => summary.visualDensity === "quiet" || isRestrainedIntensity(summary.intensity));
  const consecutiveBehindSubjectTextMoments = countTrailingMatches(recentDecisionPlans, (summary) => summary.matteUsage === "behind-subject-text");
  const consecutiveExpressiveTypographyMoments = countTrailingMatches(recentDecisionPlans, (summary) => isExpressiveTypographyMode(summary.typographyMode));
  const consecutiveRepeatedTypographyModeMoments = countTrailingSameValue(recentDecisionPlans, (summary) => summary.typographyMode);
  const consecutiveRepeatedMotionSignatureMoments = countTrailingSameValue(recentDecisionPlans, (summary) => summary.motionMode);
  const consecutiveRepeatedPlacementMoments = countTrailingSameValue(recentDecisionPlans, (summary) => summary.placementMode);
  const consecutiveEmotionalPeakMoments = countTrailingMatches(recentDecisionPlans, (summary) => summary.emotionalPeak);
  const consecutiveVisualClimaxMoments = countTrailingMatches(recentDecisionPlans, (summary) => summary.visualClimax);
  const consecutiveHeroMoments = countTrailingMatches(recentDecisionPlans, (summary) => summary.heroMoment);
  const consecutiveRestrainedMoments = countTrailingMatches(recentDecisionPlans, (summary) => isRestrainedIntensity(summary.intensity));
  const recentHeroBackgroundTextCount = recentVisualPatterns.filter((pattern) => pattern.backgroundTextMode === "hero").length;
  const recentHeroMomentCount = recentDecisionPlans.filter((summary) => summary.heroMoment).length;
  const recentVisualClimaxCount = recentDecisionPlans.filter((summary) => summary.visualClimax).length;
  const recentRetrievalActions = recentDecisionPlans.map((summary) => summary.retrievalAction);
  const recentNegativeGrammarRuleIds = recentDecisionPlans.flatMap((summary) => summary.negativeGrammarRuleIds);
  const rhetoricalProgression = recentDecisionPlans.map((summary) => summary.rhetoricalPurpose);
  const emotionalProgression = recentDecisionPlans.map((summary) => summary.emotionalSpine);
  const recentDominantTreatmentFamilies = [...new Set(recentDecisionPlans.map((summary) => summary.treatmentFamily))];

  const repetitiveFamilies = recentDecisionPlans.length > 0
    ? recentDecisionPlans.length - recentDominantTreatmentFamilies.length
    : 0;
  const repetitiveTypography = Math.max(0, consecutiveRepeatedTypographyModeMoments - 1);
  const repetitiveMotion = Math.max(0, consecutiveRepeatedMotionSignatureMoments - 1);
  const repetitivePlacement = Math.max(0, consecutiveRepeatedPlacementMoments - 1);
  const repetitiveDensity = Math.max(0, countTrailingSameValue(recentVisualPatterns, (pattern) => pattern.visualDensity) - 1);
  const repeatedPremiumTrickCount = Math.max(0, treatmentFingerprintHistory.flatMap((fingerprint) => fingerprint.premiumTricks).length - new Set(treatmentFingerprintHistory.flatMap((fingerprint) => fingerprint.premiumTricks)).size);
  const repetitionPressure = clamp01(
    repetitiveFamilies * 0.18 +
    repetitiveTypography * 0.18 +
    repetitiveMotion * 0.16 +
    repetitivePlacement * 0.12 +
    repetitiveDensity * 0.14 +
    repeatedPremiumTrickCount * 0.06 +
    Math.max(0, recentHeroBackgroundTextCount - 1) * 0.08
  );
  const emotionalPeakPressure = clamp01(
    consecutiveEmotionalPeakMoments * 0.22 +
    recentDecisionPlans.filter((summary) => summary.emotionalPeak).length * 0.12
  );
  const surpriseBudgetRemaining = clamp01(
    1 -
    (recentHeroMomentCount * 0.18) -
    (recentVisualClimaxCount * 0.22) -
    (repetitionPressure * 0.34)
  );
  const climaxBudgetRemaining = clamp01(1 - recentVisualClimaxCount * 0.3 - consecutiveVisualClimaxMoments * 0.12);
  const restrainedMoments = recentDecisionPlans.filter((summary) => isRestrainedIntensity(summary.intensity)).length;
  const restraintBalance = recentDecisionPlans.length > 0
    ? clamp01(restrainedMoments / recentDecisionPlans.length)
    : 0.5;
  const needsContrastNext = repetitionPressure >= 0.38 ||
    creativeContrastHistory.filter((record) => record.direction === "maintain").length >= Math.max(2, input.lookbackWindow - 1);
  const preferRestraintNext = consecutiveHighIntensityMoments >= 2 ||
    consecutiveVisualClimaxMoments >= 1 ||
    emotionalPeakPressure >= 0.5 ||
    surpriseBudgetRemaining <= 0.45 ||
    climaxBudgetRemaining <= 0.42;

  return {
    lookbackWindow: input.lookbackWindow,
    recentEnergyTrend,
    recentVisualDensityTrend,
    recentAverageEnergy,
    recentAverageImportance,
    consecutiveHighIntensityMoments,
    consecutiveQuietMoments,
    consecutiveBehindSubjectTextMoments,
    consecutiveExpressiveTypographyMoments,
    consecutiveRepeatedTypographyModeMoments,
    consecutiveRepeatedMotionSignatureMoments,
    consecutiveRepeatedPlacementMoments,
    consecutiveEmotionalPeakMoments,
    consecutiveVisualClimaxMoments,
    consecutiveHeroMoments,
    consecutiveRestrainedMoments,
    recentHeroBackgroundTextCount,
    recentHeroMomentCount,
    recentVisualClimaxCount,
    repetitionPressure,
    emotionalPeakPressure,
    surpriseBudgetRemaining,
    climaxBudgetRemaining,
    restraintBalance,
    needsContrastNext,
    preferRestraintNext,
    rhetoricalProgression,
    emotionalProgression,
    recentDominantTreatmentFamilies,
    recentRetrievalActions,
    recentNegativeGrammarRuleIds,
    recentTreatmentFingerprintHistory: treatmentFingerprintHistory,
    recentCreativeContrastHistory: creativeContrastHistory,
    recentEscalationHistory: escalationHistory
  };
};
