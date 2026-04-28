import {buildPairwiseTasteComparison, rankCandidatesWithPairwiseCritic, type PairwiseCriticCandidateEvaluation, type PairwiseCriticSelection} from "../rules/pairwise-taste-critic";
import type {JudgmentEngineInput, PairwiseTasteComparison, PreJudgmentSnapshot} from "../types";

export class PairwiseTasteCriticEngine {
  compareCandidates(input: {
    judgmentInput: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    evaluationA: PairwiseCriticCandidateEvaluation;
    evaluationB: PairwiseCriticCandidateEvaluation;
  }): PairwiseTasteComparison {
    return buildPairwiseTasteComparison(input);
  }

  rankCandidates(input: {
    judgmentInput: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    evaluations: PairwiseCriticCandidateEvaluation[];
  }): PairwiseCriticSelection {
    return rankCandidatesWithPairwiseCritic(input);
  }
}

export type {PairwiseCriticCandidateEvaluation, PairwiseCriticSelection};

