import {hashString} from "../../utils";
import {
  observationSnapshotSchema,
  type JudgmentEngineInput,
  type ObservationSnapshot,
  type PreJudgmentSnapshot
} from "../types";

export class ObservationSnapshotEngine {
  build(input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): ObservationSnapshot {
    return observationSnapshotSchema.parse({
      id: `observation-${hashString(`${input.segmentId}|${snapshot.recentSequenceMetrics.lookbackWindow}`)}`,
      segmentId: input.segmentId,
      moment: input.moment,
      speakerMetadata: input.speakerMetadata,
      sceneAnalysis: input.sceneAnalysis,
      subjectSegmentation: input.subjectSegmentation,
      spatialConstraints: snapshot.spatialConstraints,
      emphasisTargets: snapshot.emphasisTargets,
      recentDecisionPlans: snapshot.recentDecisionPlans,
      recentVisualPatterns: snapshot.recentVisualPatterns,
      recentSequenceMetrics: snapshot.recentSequenceMetrics,
      assetFingerprintCount: input.assetFingerprints.length,
      retrievalResultCount: input.retrievalResults.length
    });
  }
}
