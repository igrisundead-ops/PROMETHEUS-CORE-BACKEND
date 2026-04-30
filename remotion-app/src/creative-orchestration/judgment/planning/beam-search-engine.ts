import {
  plannerBeamCandidateSchema,
  plannerScoreBreakdownSchema,
  plannerSelectedPathSchema,
  type ArchiveEntry,
  type DoctrineBranch,
  type PlannerBeamCandidate,
  type PlannerScoreBreakdown,
  type PlannerSelectedPath,
  type PlanningSnapshot,
  type PreJudgmentSnapshot,
  type TreatmentGenomeV1
} from "../types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const scoreGenome = (input: {
  genome: TreatmentGenomeV1;
  snapshot: PreJudgmentSnapshot;
  branch: DoctrineBranch | undefined;
}): PlannerScoreBreakdown => {
  const {genome, snapshot, branch} = input;
  const lastPlan = snapshot.recentDecisionPlans[snapshot.recentDecisionPlans.length - 1];
  const sequenceConsequence = clamp01(
    0.55 +
    (snapshot.recentSequenceMetrics.preferRestraintNext && (genome.intensity === "minimal" || genome.intensity === "restrained") ? 0.22 : 0) +
    (!snapshot.recentSequenceMetrics.preferRestraintNext && genome.intensity === "expressive" ? 0.14 : 0) +
    (snapshot.recentSequenceMetrics.needsContrastNext && lastPlan?.treatmentFamily !== genome.family ? 0.12 : 0) -
    (snapshot.recentSequenceMetrics.preferRestraintNext && genome.intensity === "expressive" ? 0.18 : 0)
  );
  const repetitionAvoidance = clamp01(
    0.7 -
    (lastPlan?.motionMode === genome.motionMode ? 0.18 : 0) -
    (lastPlan?.typographyMode === genome.typographyMode ? 0.14 : 0) -
    (lastPlan?.placementMode === genome.placementMode ? 0.1 : 0) +
    (snapshot.recentSequenceMetrics.needsContrastNext ? 0.08 : 0)
  );
  const doctrineCoherence = clamp01(
    0.62 +
    (branch?.editorialDoctrine.captain === "restraint" && genome.intensity !== "expressive" ? 0.18 : 0) +
    (branch?.editorialDoctrine.conceptReductionMode !== "literal-caption" && genome.typographyMode === "keyword-only" ? 0.14 : 0) +
    (branch?.editorialDoctrine.captain === "asset" && genome.allowedProposalTypes.includes("asset") ? 0.08 : 0)
  );
  const surprisePreservation = clamp01(
    0.55 +
    (genome.noveltyLevel * 0.22) -
    (snapshot.recentSequenceMetrics.surpriseBudgetRemaining <= 0.45 && genome.intensity === "expressive" ? 0.18 : 0)
  );
  const climaxBudgetPreservation = clamp01(
    0.66 -
    (snapshot.recentSequenceMetrics.climaxBudgetRemaining <= 0.42 && genome.intensity === "expressive" ? 0.24 : 0) +
    (snapshot.recentSequenceMetrics.climaxBudgetRemaining > 0.42 && genome.intensity === "expressive" ? 0.08 : 0)
  );
  const retrievalPracticality = clamp01(
    genome.retrievalIntent === "skip" ? 0.92 :
      genome.retrievalIntent === "reuse-existing" ? 0.86 :
        genome.retrievalIntent === "reuse-with-variation" ? 0.74 :
          genome.godEscalationIntent === "preferred-for-precision" ? 0.48 : 0.58
  );

  return plannerScoreBreakdownSchema.parse({
    sequenceConsequence,
    repetitionAvoidance,
    doctrineCoherence,
    surprisePreservation,
    climaxBudgetPreservation,
    retrievalPracticality,
    finalScore: clamp01(
      sequenceConsequence * 0.24 +
      repetitionAvoidance * 0.2 +
      doctrineCoherence * 0.18 +
      surprisePreservation * 0.14 +
      climaxBudgetPreservation * 0.14 +
      retrievalPracticality * 0.1
    )
  });
};

export class BeamSearchEngine {
  rank(input: {
    genomes: TreatmentGenomeV1[];
    archiveEntries: ArchiveEntry[];
    planningSnapshot: PlanningSnapshot;
    snapshot: PreJudgmentSnapshot;
  }): {
    beamCandidates: PlannerBeamCandidate[];
    selectedPath: PlannerSelectedPath;
    shortlist: TreatmentGenomeV1[];
  } {
    const archiveCandidates = input.archiveEntries
      .slice(0, input.planningSnapshot.archiveReuseBudgetPerBranch)
      .map((entry) => entry.genome);
    const pool = [...input.genomes, ...archiveCandidates];
    const unique = new Map<string, TreatmentGenomeV1>();
    pool.forEach((genome) => {
      if (!unique.has(genome.id)) {
        unique.set(genome.id, genome);
      }
    });

    const ranked = [...unique.values()]
      .map((genome) => {
        const branch = input.planningSnapshot.doctrineBranches.find((entry) => entry.id === genome.doctrineBranchId);
        const scoreBreakdown = scoreGenome({
          genome,
          snapshot: input.snapshot,
          branch
        });
        return {
          genome,
          candidate: plannerBeamCandidateSchema.parse({
            genomeId: genome.id,
            doctrineBranchId: genome.doctrineBranchId,
            archiveCellKey: genome.archiveCell.key,
            scoreBreakdown,
            pruned: false,
            reasons: [
              `Sequence objective scored ${scoreBreakdown.finalScore.toFixed(3)}.`,
              genome.retrievalIntent === "search-deeper"
                ? "Genome asks for deeper retrieval before any generation step."
                : `Genome retrieval intent is ${genome.retrievalIntent}.`
            ]
          })
        };
      })
      .sort((left, right) => right.candidate.scoreBreakdown.finalScore - left.candidate.scoreBreakdown.finalScore || left.genome.id.localeCompare(right.genome.id));

    const kept = ranked.slice(0, input.planningSnapshot.beamWidth);
    const pruned = ranked.slice(input.planningSnapshot.beamWidth).map((entry) => ({
      ...entry.candidate,
      pruned: true,
      reasons: [...entry.candidate.reasons, "Pruned by initial beam width budget."]
    }));

    const selected = kept[0];
    return {
      beamCandidates: [...kept.map((entry) => entry.candidate), ...pruned],
      selectedPath: plannerSelectedPathSchema.parse({
        genomeIds: selected ? [selected.genome.id] : [],
        doctrineBranchIds: selected ? [selected.genome.doctrineBranchId] : [],
        scoreBreakdown: selected?.candidate.scoreBreakdown ?? plannerScoreBreakdownSchema.parse({
          sequenceConsequence: 0.5,
          repetitionAvoidance: 0.5,
          doctrineCoherence: 0.5,
          surprisePreservation: 0.5,
          climaxBudgetPreservation: 0.5,
          retrievalPracticality: 0.5,
          finalScore: 0.5
        }),
        lookaheadMomentsEvaluated: Math.min(input.planningSnapshot.lookaheadMoments, 1)
      }),
      shortlist: kept.slice(0, 4).map((entry) => entry.genome)
    };
  }
}
