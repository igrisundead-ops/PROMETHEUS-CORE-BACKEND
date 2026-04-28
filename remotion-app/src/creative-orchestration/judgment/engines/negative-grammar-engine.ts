import {negativeGrammarRules} from "../rules/negative-grammar";
import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  JudgmentEngineInput,
  NegativeGrammarViolation,
  PreJudgmentSnapshot
} from "../types";

export class NegativeGrammarEngine {
  validateCandidate(input: {
    input: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    candidate: CandidateTreatmentProfile;
    antiRepetition: AntiRepetitionSummary;
  }): NegativeGrammarViolation[] {
    return negativeGrammarRules
      .map((rule) => rule.evaluate(input))
      .filter((violation): violation is NegativeGrammarViolation => Boolean(violation));
  }
}
