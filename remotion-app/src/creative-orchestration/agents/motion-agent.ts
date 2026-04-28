import type {AgentProposal, CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

const pickChoreography = (moment: CreativeMoment): string => {
  if (moment.momentType === "transition") {
    return "zoom-through-layer";
  }
  if (moment.momentType === "list") {
    return "staggered-keyword-entrance";
  }
  if (moment.momentType === "title" || moment.momentType === "hook") {
    return "depth-card-float";
  }
  if (moment.momentType === "payoff") {
    return "light-sweep-reveal";
  }
  if (moment.momentType === "question") {
    return "blur-slide-up";
  }
  return "gentle-drift";
};

export class MotionAgent implements CreativeAgent<CreativeContext> {
  id = "motion-agent";
  label = "Motion / Apple Movement";

  async propose(context: CreativeContext, moment: CreativeMoment): Promise<AgentProposal[]> {
    const directive = context.judgmentDirectives?.[moment.id];
    const heroMoment = moment.suggestedIntensity === "hero" || moment.importance >= 0.9;
    const useThreeJs = heroMoment && (moment.momentType === "title" || moment.momentType === "payoff") && directive?.minimalismLevel !== "minimal" && !directive?.recentSequenceMetrics.preferRestraintNext;
    const choreography = pickChoreography(moment);
    const shouldSkipRetrieval = directive?.retrievalDecision.action === "skip" || !directive?.requestedAgentTypes.includes("motion");
    const approvedCandidates = directive?.approvedAssetCandidates.filter((candidate) => candidate.selected && !candidate.inspirationOnly && (candidate.assetType === "motion_graphic" || candidate.assetType === "gsap_animation_logic")) ?? [];
    const approvedMotionCandidate = approvedCandidates[0] ?? null;
    if (!directive?.requestedAgentTypes.includes("motion")) {
      return [];
    }
    if (!shouldSkipRetrieval && !approvedMotionCandidate) {
      return [];
    }
    const enterDurationMs = directive?.recentSequenceMetrics.preferRestraintNext ? 300 : heroMoment ? 540 : moment.energy >= 0.7 ? 460 : 340;
    const exitDurationMs = heroMoment ? 320 : 260;

    return [
      {
        id: `proposal-motion-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "motion",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + (heroMoment ? 12 : 4),
        confidence: clamp01(0.6 + moment.energy * 0.22 + moment.importance * 0.15 + (approvedMotionCandidate ? 0.08 : 0)),
        renderCost: useThreeJs
          ? "high"
          : approvedMotionCandidate?.renderComplexity === "high"
            ? "high"
            : directive?.minimalismLevel === "minimal" || directive?.recentSequenceMetrics.preferRestraintNext
              ? "low"
              : moment.energy >= 0.8 ? "medium" : "low",
        requiresMatting: (moment.momentType === "hook" || moment.momentType === "title") && directive?.spatialConstraints.behindSubjectTextLegal !== false,
        requiresVideoFrames: useThreeJs,
        compatibleWith: ["text", "background", "sound", "asset"],
        payload: {
          choreography: approvedMotionCandidate?.motionTags[0] ?? choreography,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          cameraIntent: useThreeJs ? "slow-push-in" : moment.momentType === "transition" ? "zoom-through-layer" : "none",
          enter: {
            from: {opacity: 0, y: 24, blur: 14, scale: 0.96},
            to: {opacity: 1, y: 0, blur: 0, scale: 1},
            durationMs: enterDurationMs
          },
          exit: {
            to: {opacity: 0, y: -12, blur: 8, scale: 0.98},
            durationMs: exitDurationMs
          },
          layerDepth: directive?.recentSequenceMetrics.preferRestraintNext ? 1 : heroMoment ? 3 : 2,
          useThreeJs,
          useGSAP: Boolean(approvedMotionCandidate?.assetType === "gsap_animation_logic"),
          approvedRetrievedCandidateId: approvedMotionCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedCandidates.slice(0, 4).map((candidate) => candidate.assetId),
          retrievedAssetId: approvedMotionCandidate?.assetId,
          retrievalLibraries: directive?.retrievalDecision.allowedLibraries,
          supportingAssetIds: approvedCandidates.slice(1, 4).map((candidate) => candidate.assetId),
          retrievedAssets: approvedCandidates.slice(0, 4).map((candidate) => ({
            assetId: candidate.assetId,
            score: candidate.finalScore,
            publicPath: candidate.publicPath,
            why: candidate.rankingRationale[0]
          }))
        },
        reasoning: shouldSkipRetrieval
          ? `Judgment policy skipped retrieval, so motion stayed deterministic with ${choreography}.`
          : approvedMotionCandidate
            ? `Moment type ${moment.momentType} prefers ${approvedMotionCandidate.assetId}; judgment approved it because ${approvedMotionCandidate.rankingRationale[0] ?? "it best fit the selected treatment"}.`
            : `No approved motion candidate was available, so the agent avoided bypassing judgment retrieval.`
      } satisfies AgentProposal
    ];
  }
}
