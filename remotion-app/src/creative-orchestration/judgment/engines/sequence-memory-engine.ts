import {DEFAULT_SEQUENCE_LOOKBACK_WINDOW} from "../constants";
import {
  buildCreativeContrastRecord,
  buildEscalationHistoryEntry,
  buildSequenceMetrics,
  buildTreatmentFingerprint,
  toSequenceDecisionSummary,
  toSequenceVisualPattern
} from "../rules/sequence-memory";
import {
  candidateTreatmentProfileSchema,
  creativeContrastRecordSchema,
  escalationHistoryEntrySchema,
  judgmentEngineInputSchema,
  sequenceDecisionSummarySchema,
  sequenceMetricsSchema,
  sequenceVisualPatternSchema,
  treatmentFingerprintSchema,
  type EditDecisionPlan,
  type JudgmentEngineInput,
  type SequenceDecisionSummary,
  type SequenceMetrics,
  type SequenceVisualPattern
} from "../types";

export const planToSequenceDecisionSummary = (input: {
  plan: EditDecisionPlan;
  moment?: {
    momentType?: string;
    energy?: number;
    importance?: number;
  };
}): SequenceDecisionSummary => {
  return sequenceDecisionSummarySchema.parse(toSequenceDecisionSummary({
    segmentId: input.plan.segmentId,
    rhetoricalPurpose: input.plan.rhetoricalPurpose,
    emotionalSpine: input.plan.emotionalSpine,
    minimalismLevel: input.plan.minimalismLevel,
    selectedTreatment: input.plan.selectedTreatment,
    finalScore: input.plan.scoringBreakdown.finalScore,
    retrievalAction: input.plan.retrievalDecision.action,
    negativeGrammarRuleIds: input.plan.negativeGrammarViolations.map((violation) => violation.ruleId),
    momentType: input.moment?.momentType,
    momentEnergy: input.moment?.energy,
    momentImportance: input.moment?.importance
  }));
};

export const summaryToSequenceVisualPattern = (summary: SequenceDecisionSummary): SequenceVisualPattern => {
  return sequenceVisualPatternSchema.parse(toSequenceVisualPattern({
    segmentId: summary.segmentId,
    treatmentFamily: summary.treatmentFamily,
    typographyMode: summary.typographyMode,
    motionMode: summary.motionMode,
    emphasisMode: summary.emphasisMode,
    placementMode: summary.placementMode,
    matteUsage: summary.matteUsage,
    backgroundTextMode: summary.backgroundTextMode,
    intensity: summary.intensity,
    rhetoricalPurpose: summary.rhetoricalPurpose,
    emotionalSpine: summary.emotionalSpine,
    retrievalAction: summary.retrievalAction,
    heroMoment: summary.heroMoment,
    visualClimax: summary.visualClimax,
    emotionalPeak: summary.emotionalPeak,
    focalStructure: summary.focalStructure,
    premiumTricks: summary.premiumTricks,
    negativeGrammarRuleIds: summary.negativeGrammarRuleIds
  }));
};

export class SequenceMemoryEngine {
  build(input: JudgmentEngineInput): {
    recentSelectedTreatments: JudgmentEngineInput["recentSelectedTreatments"];
    recentDecisionPlans: SequenceDecisionSummary[];
    recentVisualPatterns: SequenceVisualPattern[];
    recentTreatmentFingerprintHistory: JudgmentEngineInput["recentTreatmentFingerprintHistory"];
    recentCreativeContrastHistory: JudgmentEngineInput["recentCreativeContrastHistory"];
    recentEscalationHistory: JudgmentEngineInput["recentEscalationHistory"];
    recentSequenceMetrics: SequenceMetrics;
  } {
    const parsed = judgmentEngineInputSchema.parse(input);
    const lookbackWindow = parsed.recentSequenceMetrics?.lookbackWindow ?? DEFAULT_SEQUENCE_LOOKBACK_WINDOW;
    const recentSelectedTreatments = parsed.recentSelectedTreatments
      .slice(-lookbackWindow)
      .map((treatment) => candidateTreatmentProfileSchema.parse(treatment));
    const recentDecisionPlans = parsed.recentDecisionPlans
      .slice(-lookbackWindow)
      .map((summary) => sequenceDecisionSummarySchema.parse(summary));
    const recentVisualPatterns = (
      parsed.recentVisualPatterns.length > 0
        ? parsed.recentVisualPatterns
        : recentDecisionPlans.map((summary) => summaryToSequenceVisualPattern(summary))
    )
      .slice(-lookbackWindow)
      .map((pattern) => sequenceVisualPatternSchema.parse(pattern));
    const recentTreatmentFingerprintHistory = (
      parsed.recentTreatmentFingerprintHistory.length > 0
        ? parsed.recentTreatmentFingerprintHistory
        : recentDecisionPlans.map((summary) => buildTreatmentFingerprint(summary))
    )
      .slice(-lookbackWindow)
      .map((fingerprint) => treatmentFingerprintSchema.parse(fingerprint));
    const recentCreativeContrastHistory = (
      parsed.recentCreativeContrastHistory.length > 0
        ? parsed.recentCreativeContrastHistory
        : recentVisualPatterns.map((pattern, index) => buildCreativeContrastRecord({
            current: pattern,
            previous: recentVisualPatterns[index - 1]
          }))
    )
      .slice(-lookbackWindow)
      .map((record) => creativeContrastRecordSchema.parse(record));
    const recentEscalationHistory = (
      parsed.recentEscalationHistory.length > 0
        ? parsed.recentEscalationHistory
        : recentDecisionPlans.map((summary) => buildEscalationHistoryEntry(summary))
    )
      .slice(-lookbackWindow)
      .map((entry) => escalationHistoryEntrySchema.parse(entry));
    const recentSequenceMetrics = sequenceMetricsSchema.parse(buildSequenceMetrics({
      recentDecisionPlans,
      recentVisualPatterns,
      recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory,
      recentEscalationHistory,
      recentSequenceMetrics: parsed.recentSequenceMetrics,
      lookbackWindow
    }));

    return {
      recentSelectedTreatments,
      recentDecisionPlans,
      recentVisualPatterns,
      recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory,
      recentEscalationHistory,
      recentSequenceMetrics
    };
  }
}
