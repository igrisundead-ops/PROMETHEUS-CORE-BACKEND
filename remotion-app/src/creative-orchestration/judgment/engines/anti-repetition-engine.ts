import {buildAntiRepetitionSummary} from "../rules/anti-repetition";
import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  PreJudgmentSnapshot
} from "../types";

export class AntiRepetitionEngine {
  evaluate(input: {
    snapshot: PreJudgmentSnapshot;
    candidate: CandidateTreatmentProfile;
  }): AntiRepetitionSummary {
    return buildAntiRepetitionSummary(input);
  }
}
