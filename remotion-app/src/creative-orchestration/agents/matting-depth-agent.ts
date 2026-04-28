import type {AgentProposal, CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

export class MattingDepthAgent implements CreativeAgent<CreativeContext> {
  id = "matting-depth-agent";
  label = "Matting / Depth";

  async propose(context: CreativeContext, moment: CreativeMoment): Promise<AgentProposal[]> {
    const directive = context.judgmentDirectives?.[moment.id];
    const approvedMatteCandidate = directive?.approvedAssetCandidates.find((candidate) => candidate.selected && !candidate.inspirationOnly && (candidate.compatibility.includes("requiresMatting") || candidate.compatibility.includes("supportsBehindSubjectText"))) ?? null;
    const requiresMatting =
      moment.momentType === "hook" ||
      moment.momentType === "title" ||
      moment.momentType === "payoff" ||
      moment.importance >= 0.9;

    if (!requiresMatting || directive?.spatialConstraints.behindSubjectTextLegal === false || !directive?.requestedAgentTypes.includes("matting")) {
      return [{
        id: `proposal-matting-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "matting",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: 8,
        confidence: 0.55,
        renderCost: "low",
        payload: {
          mattingMode: "none",
          reason: directive?.spatialConstraints.behindSubjectTextLegal === false
            ? "Matte confidence is too weak for critical behind-subject text."
            : "No depth separation is required for this moment.",
          fallbackIfUnavailable: "none",
          approvedRetrievedCandidateId: approvedMatteCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedMatteCandidate ? [approvedMatteCandidate.assetId] : []
        },
        reasoning: "This moment does not need depth compositing."
      } satisfies AgentProposal];
    }

    if (directive?.retrievalDecision.action === "retrieve-matte-related-treatments" && !approvedMatteCandidate) {
      return [];
    }

    return [
      {
        id: `proposal-matting-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "matting",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + 10,
        confidence: clamp01(0.72 + moment.importance * 0.18),
        renderCost: "medium",
        requiresMatting: true,
        payload: {
          mattingMode: "required",
          reason: approvedMatteCandidate
            ? `Approved matte-related candidate ${approvedMatteCandidate.assetId} supports depth separation here.`
            : "The moment wants depth separation or behind-subject text.",
          timeWindow: {
            startMs: moment.startMs,
            endMs: moment.endMs
          },
          estimatedCost: "medium",
          fallbackIfUnavailable: "move-text-to-side-glass-card",
          approvedRetrievedCandidateId: approvedMatteCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedMatteCandidate ? [approvedMatteCandidate.assetId] : []
        },
        reasoning: approvedMatteCandidate
          ? `High-impact moments can request matting when judgment approved ${approvedMatteCandidate.assetId} for matte-aware support.`
          : "High-impact moments are allowed to request short-window matting with a safe fallback."
      } satisfies AgentProposal
    ];
  }
}
