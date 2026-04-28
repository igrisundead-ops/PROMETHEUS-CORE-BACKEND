import {rankRetrievedAssetCandidates} from "../../../lib/vector/retrieval-result-ranker";
import type {RankedAssetCandidate, VectorSearchHit} from "../../../lib/vector/schemas";
import type {CandidateTreatmentProfile, JudgmentEngineInput, PreJudgmentSnapshot} from "../types";

export const rankAssetCandidatesForJudgment = ({
  hits,
  input,
  snapshot,
  selectedTreatment,
  action
}: {
  hits: VectorSearchHit[];
  input: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  selectedTreatment: CandidateTreatmentProfile;
  action: string;
}): RankedAssetCandidate[] => {
  return rankRetrievedAssetCandidates({
    hits,
    input,
    snapshot,
    selectedTreatment,
    action
  });
};
