import {createTraceEntry} from "../utils/trace";
import {ObservationSnapshotEngine} from "./observation-snapshot-engine";
import {PlanningSnapshotEngine} from "./planning-snapshot-engine";
import {TreatmentGenomeFactory} from "./treatment-genome";
import {QualityDiversityArchive} from "./qd-archive";
import {BeamSearchEngine} from "./beam-search-engine";
import {
  plannerAuditSchema,
  type CandidateTreatmentProfile,
  type JudgmentEngineInput,
  type PlannerAudit,
  type PreJudgmentSnapshot
} from "../types";

export class SteppingStonePlanner {
  private readonly observationSnapshotEngine = new ObservationSnapshotEngine();
  private readonly planningSnapshotEngine = new PlanningSnapshotEngine();
  private readonly treatmentGenomeFactory = new TreatmentGenomeFactory();
  private readonly qualityDiversityArchive = new QualityDiversityArchive();
  private readonly beamSearchEngine = new BeamSearchEngine();

  plan(input: {
    judgmentInput: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
  }): {
    shortlist: CandidateTreatmentProfile[];
    audit: PlannerAudit;
  } {
    const {judgmentInput, snapshot} = input;
    const observationSnapshot = this.observationSnapshotEngine.build(judgmentInput, snapshot);
    const planningSnapshot = this.planningSnapshotEngine.build(judgmentInput, snapshot, observationSnapshot);
    const genomes = planningSnapshot.doctrineBranches.flatMap((branch) => this.treatmentGenomeFactory.buildForBranch({
      judgmentInput,
      snapshot,
      planningSnapshot,
      branch
    }));
    const archiveEntries = this.qualityDiversityArchive.build(genomes);
    const beamResult = this.beamSearchEngine.rank({
      genomes,
      archiveEntries,
      planningSnapshot,
      snapshot
    });
    const shortlist = beamResult.shortlist.map((genome) => {
      const {
        doctrineBranchId: _doctrineBranchId,
        retrievalIntent: _retrievalIntent,
        godEscalationIntent: _godEscalationIntent,
        noveltyBias: _noveltyBias,
        consistencyBias: _consistencyBias,
        archiveCell: _archiveCell,
        editorialRole: _editorialRole,
        ...candidate
      } = genome;
      return candidate;
    });

    return {
      shortlist,
      audit: plannerAuditSchema.parse({
        observationSnapshot,
        planningSnapshot,
        archiveEntries,
        shortlist: beamResult.shortlist,
        beamCandidates: beamResult.beamCandidates,
        selectedPath: beamResult.selectedPath,
        fallbackUsed: shortlist.length === 0,
        trace: [
          createTraceEntry("observation-snapshot", "Built deterministic observation snapshot for planner input.", {
            assetFingerprintCount: observationSnapshot.assetFingerprintCount,
            retrievalResultCount: observationSnapshot.retrievalResultCount
          }),
          createTraceEntry("planning-snapshot", "Built bounded planning snapshot with doctrine branches and search budget.", {
            doctrineBranchCount: planningSnapshot.doctrineBranches.length,
            beamWidth: planningSnapshot.beamWidth,
            lookaheadMoments: planningSnapshot.lookaheadMoments
          }),
          createTraceEntry("treatment-genomes", "Generated planner genomes for bounded doctrine branches.", {
            genomeCount: genomes.length
          }),
          createTraceEntry("qd-archive", "Selected QD archive elites across archive cells.", {
            archiveEntryCount: archiveEntries.length
          }),
          createTraceEntry("beam-search", "Ranked planner genomes under the sequence objective.", {
            shortlistIds: beamResult.shortlist.map((genome) => genome.id),
            selectedGenomeIds: beamResult.selectedPath.genomeIds
          })
        ]
      })
    };
  }
}
