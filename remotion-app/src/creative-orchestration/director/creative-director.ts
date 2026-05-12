import type {
  AgentProposal,
  CreativeContext,
  CreativeDiagnostics,
  CreativeMoment,
  CreativeTimeline,
  DirectorDecision
} from "../types";
import type {GovernorResolution} from "../governance/types";
import {hashString} from "../utils";
import {ExistingAgentOrchestratorAdapter} from "../judgment";
import type {EditDecisionPlan} from "../judgment/types";

export class CreativeDirector {
  private readonly adapter = new ExistingAgentOrchestratorAdapter();

  async decide(
    context: CreativeContext,
    moments: CreativeMoment[],
    proposalsByMoment: Map<string, AgentProposal[]>,
    revisionPass: number = 0,
    criticIssues: CreativeDiagnostics["warnings"] = [],
    resolutions: GovernorResolution[] = []
  ): Promise<{
    decisions: DirectorDecision[];
    selectedProposals: AgentProposal[];
    rejectedProposals: AgentProposal[];
    timeline: CreativeTimeline;
    editDecisionPlans: CreativeTimeline["editDecisionPlans"];
    judgmentAuditTrail: CreativeTimeline["judgmentAuditTrail"];
    feedbackSignals: CreativeTimeline["feedbackSignals"];
  }> {
    const decisions: DirectorDecision[] = [];
    const selectedProposals: AgentProposal[] = [];
    const rejectedProposals: AgentProposal[] = [];
    const tracks: CreativeTimeline["tracks"] = [];
    const editDecisionPlans: NonNullable<CreativeTimeline["editDecisionPlans"]> = [];
    const judgmentAuditTrail: NonNullable<CreativeTimeline["judgmentAuditTrail"]> = [];
    const feedbackSignals: NonNullable<CreativeTimeline["feedbackSignals"]> = [];
    const warnings = [...criticIssues];
    const sequenceHistory: Array<{plan: EditDecisionPlan; moment: CreativeMoment}> = [];

    for (let i = 0; i < moments.length; i++) {
      const moment = moments[i];
      const resolution = resolutions[i];
      const proposals = proposalsByMoment.get(moment.id) ?? [];

      const governedProposals = proposals.map(p => {
        if (!resolution) return p;
        const governedPayload = { ...p.payload };
        if (p.type === "text" || p.type === "motion" || p.type === "layout") {
          governedPayload["aggression"] = resolution.finalAggression;
          governedPayload["motion"] = resolution.finalMotion;
          governedPayload["scale"] = resolution.finalScale;
          governedPayload["dominance"] = resolution.finalDominance;
          governedPayload["opacity"] = resolution.finalOpacity;
          governedPayload["timing"] = resolution.finalTiming;
          governedPayload["pacing"] = resolution.finalPacing;
          governedPayload["silence"] = resolution.finalSilence;
          governedPayload["governorRationale"] = resolution.explainability.join(" | ");
        }
        return { ...p, payload: governedPayload };
      });

      const decisionSet = await this.adapter.decideMoment(context, moment, governedProposals, criticIssues, sequenceHistory);
      const decision: DirectorDecision = {
        ...decisionSet.decision,
        governedPhysics: resolution ? {
          aggression: resolution.finalAggression,
          motion: resolution.finalMotion,
          scale: resolution.finalScale,
          dominance: resolution.finalDominance,
          opacity: resolution.finalOpacity,
          timing: resolution.finalTiming,
          pacing: resolution.finalPacing,
          silence: resolution.finalSilence,
        } : undefined
      };
      decisions.push(decision);
      selectedProposals.push(...decisionSet.selectedProposals);
      rejectedProposals.push(...decisionSet.rejectedProposals);
      tracks.push(...decisionSet.tracks);
      editDecisionPlans.push(decisionSet.plan);
      judgmentAuditTrail.push(decisionSet.plan.audit);
      feedbackSignals.push(...decisionSet.plan.feedbackSignals);
      sequenceHistory.push({plan: decisionSet.plan, moment});
      if (decisionSet.plan.negativeGrammarViolations.length > 0) {
        warnings.push(
          ...decisionSet.plan.negativeGrammarViolations.map((violation) => `${moment.id}: ${violation.message}`)
        );
      }
    }

    const mattingWindows = selectedProposals
      .filter((proposal) => proposal.type === "matting" && proposal.payload["mattingMode"] !== "none")
      .map((proposal) => ({
        startMs: proposal.startMs,
        endMs: proposal.endMs,
        reason: String(proposal.payload["reason"] ?? "Matting requested.")
      }));
    const renderCost = selectedProposals.some((proposal) => proposal.renderCost === "high")
      ? "high"
      : selectedProposals.some((proposal) => proposal.renderCost === "medium")
        ? "medium"
        : "low";

    const timeline: CreativeTimeline = {
      id: `creative-timeline-${hashString(`${context.jobId}|${revisionPass}`)}`,
      sourceJobId: context.sourceJobId ?? context.jobId,
      durationMs: context.chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0),
      moments,
      decisions,
      tracks,
      editDecisionPlans,
      judgmentAuditTrail,
      feedbackSignals,
      diagnostics: {
        proposalCount: proposalsByMoment.size === 0 ? 0 : [...proposalsByMoment.values()].reduce((sum, items) => sum + items.length, 0),
        approvedCount: selectedProposals.length,
        rejectedCount: rejectedProposals.length,
        renderCost,
        mattingWindows,
        warnings
      }
    };

    return {
      decisions,
      selectedProposals,
      rejectedProposals,
      timeline,
      editDecisionPlans,
      judgmentAuditTrail,
      feedbackSignals
    };
  }
}
