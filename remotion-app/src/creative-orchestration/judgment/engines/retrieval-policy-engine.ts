import {determineRetrievalPolicy} from "../rules/retrieval-policy";
import type {JudgmentEngineInput, PreJudgmentSnapshot, RetrievalDecision} from "../types";

export class RetrievalPolicyEngine {
  evaluate(input: JudgmentEngineInput, snapshot: Omit<PreJudgmentSnapshot, "retrievalDecision">): RetrievalDecision {
    return determineRetrievalPolicy(input, snapshot);
  }
}
