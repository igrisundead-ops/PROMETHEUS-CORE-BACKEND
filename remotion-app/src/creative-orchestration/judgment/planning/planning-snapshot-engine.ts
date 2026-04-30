import {hashString} from "../../utils";
import {DoctrineBranchEngine} from "./doctrine-branch-engine";
import {
  planningSnapshotSchema,
  type JudgmentEngineInput,
  type ObservationSnapshot,
  type PlanningSnapshot,
  type PreJudgmentSnapshot
} from "../types";

const resolveLookaheadMoments = (input: JudgmentEngineInput): number => {
  return input.moment.importance >= 0.9 || ["hook", "payoff", "transition"].includes(input.moment.momentType)
    ? 5
    : 3;
};

const resolveLookaheadSeconds = (input: JudgmentEngineInput): number => {
  return input.moment.importance >= 0.9 || input.moment.energy >= 0.8 ? 10 : 6;
};

export class PlanningSnapshotEngine {
  private readonly doctrineBranchEngine = new DoctrineBranchEngine();

  build(input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot, observationSnapshot: ObservationSnapshot): PlanningSnapshot {
    const doctrineBranches = this.doctrineBranchEngine.build(input, snapshot);
    return planningSnapshotSchema.parse({
      id: `planning-${hashString(`${input.segmentId}|${doctrineBranches.map((branch) => branch.id).join("|")}`)}`,
      segmentId: input.segmentId,
      observationSnapshotId: observationSnapshot.id,
      primaryDoctrine: snapshot.editorialDoctrine,
      doctrineBranches,
      allowedTreatmentFamilies: snapshot.allowedTreatmentFamilies,
      blockedTreatmentFamilies: snapshot.blockedTreatmentFamilies,
      archiveDimensions: ["intensity", "visual-density", "motion-energy", "editorial-role"],
      lookaheadMoments: resolveLookaheadMoments(input),
      lookaheadSeconds: resolveLookaheadSeconds(input),
      genomeBudgetPerBranch: 6,
      archiveReuseBudgetPerBranch: 3,
      beamWidth: 6
    });
  }
}
