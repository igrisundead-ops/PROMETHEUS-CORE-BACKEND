import {buildScoringBreakdown} from "../rules/scoring";
import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  JudgmentEngineInput,
  NegativeGrammarViolation,
  PreJudgmentSnapshot,
  ScoringBreakdown
} from "../types";

export class ScoringEngine {
  scoreCandidate(input: {
    input: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    candidate: CandidateTreatmentProfile;
    violations: NegativeGrammarViolation[];
    antiRepetition: AntiRepetitionSummary;
  }): ScoringBreakdown {
    return buildScoringBreakdown(input);
  }
}
