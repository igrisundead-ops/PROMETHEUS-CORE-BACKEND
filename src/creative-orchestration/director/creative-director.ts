import type {
  AgentProposal,
  CreativeContext,
  CreativeDiagnostics,
  CreativeMoment,
  CreativeTimeline,
  DirectorDecision
} from "../types";
import {hashString} from "../utils";

const proposalScore = (proposal: AgentProposal, revisionPass: number, repeatedStylePenalty: number): number => {
  const costPenalty = proposal.renderCost === "high" ? 18 : proposal.renderCost === "medium" ? 8 : 0;
  const revisionPenalty = revisionPass > 0 && proposal.type === "text" ? repeatedStylePenalty : 0;
  return proposal.priority + proposal.confidence * 24 - costPenalty - revisionPenalty;
};

const selectBest = (proposals: AgentProposal[], revisionPass: number, repeatedStylePenalty: number): AgentProposal[] => {
  const selected: AgentProposal[] = [];
  const byType = new Map<string, AgentProposal[]>();
  for (const proposal of proposals) {
    const bucket = byType.get(proposal.type) ?? [];
    bucket.push(proposal);
    byType.set(proposal.type, bucket);
  }

  for (const [type, bucket] of byType) {
    const ranked = [...bucket].sort((a, b) => proposalScore(b, revisionPass, repeatedStylePenalty) - proposalScore(a, revisionPass, repeatedStylePenalty) || a.id.localeCompare(b.id));
    if (ranked[0]) {
      selected.push(ranked[0]);
    }
    void type;
  }

  return selected.sort((a, b) => a.startMs - b.startMs || a.type.localeCompare(b.type));
};

const deriveFinalTreatment = (selected: AgentProposal[]): DirectorDecision["finalTreatment"] => {
  const hasText = selected.some((proposal) => proposal.type === "text");
  const hasAsset = selected.some((proposal) => proposal.type === "asset");
  const hasBackground = selected.some((proposal) => proposal.type === "background");
  const hasMotion = selected.some((proposal) => proposal.type === "motion");
  const hasMatting = selected.some((proposal) => proposal.type === "matting" && proposal.payload["mattingMode"] !== "none");

  const textMode = selected.find((proposal) => proposal.type === "text")?.payload["mode"];
  if (hasMatting) {
    return "behind-speaker-depth";
  }
  if (textMode === "title-card") {
    return "title-card";
  }
  if (hasAsset && textMode === "keyword-only") {
    return "asset-supported";
  }
  if (hasAsset && textMode === "no-text") {
    return "asset-led";
  }
  if (hasBackground && !hasText && !hasAsset) {
    return "background-overlay";
  }
  if (hasMotion && !hasText && !hasAsset) {
    return "cinematic-transition";
  }
  if (textMode === "keyword-only") {
    return "keyword-emphasis";
  }
  if (textMode === "no-text") {
    return "no-treatment";
  }
  return hasText ? "caption-only" : "no-treatment";
};

export class CreativeDirector {
  decide(
    context: CreativeContext,
    moments: CreativeMoment[],
    proposalsByMoment: Map<string, AgentProposal[]>,
    revisionPass: number = 0,
    criticIssues: CreativeDiagnostics["warnings"] = []
  ): {
    decisions: DirectorDecision[];
    selectedProposals: AgentProposal[];
    rejectedProposals: AgentProposal[];
    timeline: CreativeTimeline;
  } {
    const decisions: DirectorDecision[] = [];
    const selectedProposals: AgentProposal[] = [];
    const rejectedProposals: AgentProposal[] = [];
    const repeatedStylePenalty = criticIssues.some((warning) => /repeat|repeated/i.test(warning)) ? 14 : 0;

    for (const moment of moments) {
      const proposals = proposalsByMoment.get(moment.id) ?? [];
      const bestProposals = selectBest(proposals, revisionPass, repeatedStylePenalty);
      const chosen: AgentProposal[] = [];
      const chosenTypes = new Set<string>();

      for (const proposal of bestProposals) {
        if (chosenTypes.has(proposal.type)) {
          rejectedProposals.push(proposal);
          continue;
        }

        const conflict = proposal.conflictsWith?.some((proposalId) => chosen.some((selected) => selected.id === proposalId));
        if (conflict) {
          rejectedProposals.push(proposal);
          continue;
        }

        chosen.push(proposal);
        chosenTypes.add(proposal.type);
      }

      const selectedIds = chosen.map((proposal) => proposal.id);
      const rejectedIds = proposals
        .filter((proposal) => !selectedIds.includes(proposal.id))
        .map((proposal) => proposal.id);

      selectedProposals.push(...chosen);
      rejectedProposals.push(...proposals.filter((proposal) => rejectedIds.includes(proposal.id)));

      const finalTreatment = deriveFinalTreatment(chosen);
      const rationale = chosen.map((proposal) => proposal.reasoning).join(" ");
      decisions.push({
        momentId: moment.id,
        selectedProposalIds: selectedIds,
        rejectedProposalIds: rejectedIds,
        finalTreatment,
        reasoning: rationale || `Selected ${finalTreatment} from ${proposals.length} proposals.`
      });
    }

    const tracks = selectedProposals
      .filter((proposal) => proposal.type !== "render" && proposal.type !== "memory")
      .map((proposal, index) => ({
        id: `${proposal.type}-track-${String(index + 1).padStart(3, "0")}`,
        type: proposal.type,
        startMs: proposal.startMs,
        endMs: proposal.endMs,
        zIndex: proposal.type === "background" ? 0 : proposal.type === "sound" ? 1 : proposal.type === "asset" ? 3 : proposal.type === "matting" ? 5 : 4,
        payload: proposal.payload,
        dependencies: proposal.compatibleWith?.length ? proposal.compatibleWith : undefined
      }));
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
    const warnings = [
      ...criticIssues,
      ...(selectedProposals.filter((proposal) => proposal.renderCost === "high").length > 2 ? ["High-cost effects are stacking too aggressively."] : []),
      ...(selectedProposals.filter((proposal) => proposal.type === "sound").length > moments.length ? ["Sound cues are approaching spam territory."] : [])
    ];

    const timeline: CreativeTimeline = {
      id: `creative-timeline-${hashString(`${context.jobId}|${revisionPass}`)}`,
      sourceJobId: context.sourceJobId ?? context.jobId,
      durationMs: context.chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0),
      moments,
      decisions,
      tracks,
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
      timeline
    };
  }
}
