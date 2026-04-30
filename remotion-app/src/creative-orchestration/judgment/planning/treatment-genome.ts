import {hashString} from "../../utils";
import {deriveVisualDensityProfile} from "../rules/sequence-memory";
import {buildCandidateFromFamily} from "../rules/treatment-selection";
import {
  treatmentGenomeV1Schema,
  type ArchiveCell,
  type ArchiveEditorialRole,
  type CandidateTreatmentProfile,
  type DoctrineBranch,
  type JudgmentEngineInput,
  type MotionEnergyProfile,
  type PlanningSnapshot,
  type PreJudgmentSnapshot,
  type RetrievalIntent,
  type GodEscalationIntent,
  type TreatmentGenomeV1
} from "../types";

const deriveMotionEnergy = (motionMode: string): MotionEnergyProfile => {
  if (motionMode === "none") {
    return "none";
  }
  if (["gentle-drift", "depth-card-float", "light-sweep-reveal"].includes(motionMode)) {
    return "subtle";
  }
  return "active";
};

const deriveEditorialRole = (input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): ArchiveEditorialRole => {
  if (input.moment.momentType === "payoff" || snapshot.rhetoricalPurpose === "payoff" || snapshot.rhetoricalPurpose === "resolution") {
    return "payoff";
  }
  if (snapshot.rhetoricalPurpose === "education" || snapshot.rhetoricalPurpose === "proof" || snapshot.rhetoricalPurpose === "authority") {
    return "explain";
  }
  if (["tension", "urgency", "escalation", "contrast"].includes(snapshot.rhetoricalPurpose)) {
    return "tension";
  }
  return "setup";
};

const buildArchiveCell = (candidate: CandidateTreatmentProfile, input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): ArchiveCell => {
  const visualDensity = deriveVisualDensityProfile(candidate);
  const motionEnergy = deriveMotionEnergy(candidate.motionMode);
  const editorialRole = deriveEditorialRole(input, snapshot);
  return {
    key: `${candidate.intensity}|${visualDensity}|${motionEnergy}|${editorialRole}`,
    intensity: candidate.intensity,
    visualDensity,
    motionEnergy,
    editorialRole
  };
};

const deriveRetrievalIntent = (candidate: CandidateTreatmentProfile, snapshot: PreJudgmentSnapshot): RetrievalIntent => {
  if (snapshot.retrievalDecision.action === "skip" && (candidate.allowedProposalTypes.includes("asset") || candidate.allowedProposalTypes.includes("motion"))) {
    return "reuse-existing";
  }
  if (snapshot.retrievalDecision.action === "skip") {
    return "skip";
  }
  if (snapshot.retrievalDecision.action === "retrieve-reference-inspiration-only") {
    return "search-deeper";
  }
  if (candidate.allowedProposalTypes.includes("asset") && candidate.allowedProposalTypes.includes("motion")) {
    return "reuse-with-variation";
  }
  return "search-deeper";
};

const deriveGodEscalationIntent = (candidate: CandidateTreatmentProfile, retrievalIntent: RetrievalIntent): GodEscalationIntent => {
  if (retrievalIntent === "skip") {
    return "forbidden";
  }
  if (candidate.finalTreatment === "asset-led" || candidate.finalTreatment === "cinematic-transition") {
    return "preferred-for-precision";
  }
  return "allowed-if-no-fit";
};

const mutateCandidate = (
  candidate: CandidateTreatmentProfile,
  snapshot: PreJudgmentSnapshot,
  branch: DoctrineBranch
): CandidateTreatmentProfile[] => {
  const mutations: CandidateTreatmentProfile[] = [];
  if (!snapshot.spatialConstraints.frameNeedsRestraint && candidate.placementMode === "center-stage") {
    mutations.push({
      ...candidate,
      id: `${candidate.id}-floating`,
      placementMode: "floating-callout",
      noveltyLevel: Math.min(1, candidate.noveltyLevel + 0.08),
      consistencyLevel: Math.max(0, candidate.consistencyLevel - 0.04),
      reasoning: [...candidate.reasoning, "Planner mutation explored a floating-callout placement for extra contrast."]
    });
  }
  if (branch.editorialDoctrine.supportToolBudget !== "none" && candidate.backgroundTextMode === "none") {
    mutations.push({
      ...candidate,
      id: `${candidate.id}-support`,
      backgroundTextMode: "subtle",
      noveltyLevel: Math.min(1, candidate.noveltyLevel + 0.04),
      reasoning: [...candidate.reasoning, "Planner mutation added a subtle support-text layer under the bounded doctrine budget."]
    });
  }
  if (snapshot.recentSequenceMetrics.preferRestraintNext && candidate.motionMode !== "none") {
    mutations.push({
      ...candidate,
      id: `${candidate.id}-restrained`,
      motionMode: "gentle-drift",
      intensity: candidate.intensity === "expressive" ? "balanced" : candidate.intensity,
      consistencyLevel: Math.min(1, candidate.consistencyLevel + 0.06),
      reasoning: [...candidate.reasoning, "Planner mutation softened motion to protect sequence restraint."]
    });
  } else if (!snapshot.recentSequenceMetrics.preferRestraintNext && candidate.motionMode === "gentle-drift") {
    mutations.push({
      ...candidate,
      id: `${candidate.id}-active`,
      motionMode: "depth-card-float",
      noveltyLevel: Math.min(1, candidate.noveltyLevel + 0.06),
      reasoning: [...candidate.reasoning, "Planner mutation increased motion energy to avoid flat sequence rhythm."]
    });
  }
  return mutations.slice(0, 2);
};

const toGenome = (
  candidate: CandidateTreatmentProfile,
  input: JudgmentEngineInput,
  snapshot: PreJudgmentSnapshot,
  branch: DoctrineBranch
): TreatmentGenomeV1 => {
  const archiveCell = buildArchiveCell(candidate, input, snapshot);
  const retrievalIntent = deriveRetrievalIntent(candidate, snapshot);
  return treatmentGenomeV1Schema.parse({
    ...candidate,
    id: `${candidate.id}-${String(hashString(`${branch.id}|${candidate.motionMode}|${candidate.placementMode}`))}`,
    doctrineBranchId: branch.id,
    retrievalIntent,
    godEscalationIntent: deriveGodEscalationIntent(candidate, retrievalIntent),
    noveltyBias: input.creatorStyleProfile?.noveltyPreference ?? snapshot.retrievalDecision.noveltyBias,
    consistencyBias: input.creatorStyleProfile?.consistencyPreference ?? snapshot.retrievalDecision.consistencyBias,
    archiveCell,
    editorialRole: archiveCell.editorialRole
  });
};

export class TreatmentGenomeFactory {
  buildForBranch(input: {
    judgmentInput: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    planningSnapshot: PlanningSnapshot;
    branch: DoctrineBranch;
  }): TreatmentGenomeV1[] {
    const {judgmentInput, snapshot, planningSnapshot, branch} = input;
    const branchSnapshot: PreJudgmentSnapshot = {
      ...snapshot,
      editorialDoctrine: branch.editorialDoctrine
    };
    const bases = planningSnapshot.allowedTreatmentFamilies.map((family) => buildCandidateFromFamily(family, branchSnapshot, judgmentInput));
    const genomes = bases.flatMap((candidate) => [
      toGenome(candidate, judgmentInput, branchSnapshot, branch),
      ...mutateCandidate(candidate, branchSnapshot, branch).map((mutation) => toGenome(mutation, judgmentInput, branchSnapshot, branch))
    ]);

    const unique = new Map<string, TreatmentGenomeV1>();
    genomes.forEach((genome) => {
      if (!unique.has(genome.id)) {
        unique.set(genome.id, genome);
      }
    });
    return [...unique.values()].slice(0, planningSnapshot.genomeBudgetPerBranch);
  }
}
