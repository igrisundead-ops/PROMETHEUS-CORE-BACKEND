import {buildCandidateFromFamily} from "../rules/treatment-selection";
import type {CandidateTreatmentProfile, JudgmentEngineInput, PreJudgmentSnapshot} from "../types";

const proposalMatchesCandidate = (candidate: CandidateTreatmentProfile, proposalId: string, payload: Record<string, unknown>): boolean => {
  if (candidate.allowedProposalTypes.length === 0) {
    return false;
  }
  if (candidate.allowedTextModes.length > 0 && typeof payload["mode"] === "string" && !candidate.allowedTextModes.includes(String(payload["mode"]))) {
    return false;
  }
  return Boolean(proposalId);
};

export class CandidateTreatmentEngine {
  generate(input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): CandidateTreatmentProfile[] {
    return snapshot.allowedTreatmentFamilies.map((family) => {
      const candidate = buildCandidateFromFamily(family, snapshot, input);
      const preferredProposalIds = input.agentProposals
        .filter((proposal) => candidate.allowedProposalTypes.includes(proposal.type) && proposalMatchesCandidate(candidate, proposal.id, proposal.payload))
        .sort((left, right) => right.confidence - left.confidence || right.priority - left.priority)
        .slice(0, 5)
        .map((proposal) => proposal.id);
      return {
        ...candidate,
        preferredProposalIds
      };
    });
  }
}
