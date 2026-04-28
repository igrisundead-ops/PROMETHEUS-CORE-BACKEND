import type {
  EditDecisionPlan,
  FeedbackLogEntry,
  FeedbackEventType,
  JudgmentEngineInput,
  RejectedTreatment
} from "../types";

const createFeedbackEntry = (
  segmentId: string,
  signalType: FeedbackEventType,
  value: FeedbackLogEntry["value"],
  reason?: string
): FeedbackLogEntry => ({
  id: `${segmentId}-${signalType}`,
  segmentId,
  signalType,
  value,
  reason
});

export class FeedbackLoggingLayer {
  buildSignals(input: JudgmentEngineInput, partialPlan: Pick<EditDecisionPlan, "segmentId" | "selectedTreatment" | "scoringBreakdown" | "confidence"> & {rejectedTreatments: RejectedTreatment[]}): FeedbackLogEntry[] {
    return [
      createFeedbackEntry(
        partialPlan.segmentId,
        "creator-preference-pattern",
        {
          treatmentFamily: partialPlan.selectedTreatment.family,
          confidence: partialPlan.confidence
        },
        "Selected treatment should be tracked for future preference learning."
      ),
      createFeedbackEntry(
        partialPlan.segmentId,
        "manual-override",
        {
          blockedAlternatives: partialPlan.rejectedTreatments.map((entry) => ({
            family: entry.family,
            reason: entry.reason
          }))
        },
        "Rejected alternatives should remain inspectable for override and learning."
      ),
      createFeedbackEntry(
        partialPlan.segmentId,
        "watch-retention-proxy",
        {
          retentionPotentialScore: partialPlan.scoringBreakdown.retentionPotentialScore,
          rhetoricalPurpose: input.moment.momentType
        },
        "Retention proxy gives the learning loop a deterministic baseline before real analytics arrive."
      )
    ];
  }
}
