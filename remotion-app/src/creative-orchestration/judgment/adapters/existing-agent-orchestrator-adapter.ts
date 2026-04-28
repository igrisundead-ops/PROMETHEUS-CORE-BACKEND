import type {AgentProposal, CreativeContext, CreativeMoment, CreativeTrack, DirectorDecision} from "../../types";
import {hashString} from "../../utils";
import {DEFAULT_SEQUENCE_LOOKBACK_WINDOW} from "../constants";
import type {
  AgentJudgmentDirective,
  EditDecisionPlan,
  JudgmentEngineInput,
  JudgmentProposal,
  JudgmentWord,
  LibraryTarget,
  TraceEntry
} from "../types";
import {agentJudgmentDirectiveSchema} from "../types";
import {CoreJudgmentEngine} from "../engines/core-judgment-engine";
import {planToSequenceDecisionSummary, summaryToSequenceVisualPattern} from "../engines/sequence-memory-engine";
import {buildCreativeContrastRecord, buildEscalationHistoryEntry, buildTreatmentFingerprint} from "../rules/sequence-memory";
import {createTraceEntry} from "../utils/trace";

const toJudgmentWords = (moment: CreativeMoment): JudgmentWord[] => {
  return moment.words.map((word) => ({
    text: word.text,
    startMs: word.startMs,
    endMs: word.endMs,
    confidence: word.confidence
  }));
};

const toJudgmentProposals = (proposals: AgentProposal[]): JudgmentProposal[] => {
  return proposals.map((proposal) => ({
    id: proposal.id,
    agentId: proposal.agentId,
    momentId: proposal.momentId,
    type: proposal.type,
    startMs: proposal.startMs,
    endMs: proposal.endMs,
    priority: proposal.priority,
    confidence: proposal.confidence,
    renderCost: proposal.renderCost,
    requiresMatting: proposal.requiresMatting,
    requiresVideoFrames: proposal.requiresVideoFrames,
    compatibleWith: proposal.compatibleWith,
    conflictsWith: proposal.conflictsWith,
    payload: proposal.payload,
    reasoning: proposal.reasoning
  }));
};

const scoreProposalForCandidate = (proposal: AgentProposal, plan: EditDecisionPlan): number => {
  const approvedRetrievedCandidateIds = new Set(plan.selectedAssetCandidateIds);
  const proposalApprovedIds = [
    String(proposal.payload["approvedRetrievedCandidateId"] ?? "").trim(),
    ...(Array.isArray(proposal.payload["approvedRetrievedCandidateIds"])
      ? proposal.payload["approvedRetrievedCandidateIds"].map((value) => String(value).trim())
      : [])
  ].filter(Boolean);
  if (plan.governance.blockedAgentTypes.includes(proposal.type)) {
    return -1000;
  }
  if (!plan.governance.allowedAgentTypes.includes(proposal.type)) {
    return -200;
  }
  if (proposal.type === "text") {
    const mode = String(proposal.payload["mode"] ?? "");
    if (plan.selectedTreatment.allowedTextModes.length > 0 && !plan.selectedTreatment.allowedTextModes.includes(mode)) {
      return -250;
    }
    const visualRole = String(proposal.payload["visualRole"] ?? "");
    if (!plan.editorialDoctrine.allowIndependentTypography && visualRole === "captain") {
      return -210;
    }
  }
  if (proposal.type === "matting" && plan.selectedTreatment.matteUsage === "none") {
    return -220;
  }
  if (proposal.type === "motion" && plan.selectedTreatment.motionMode === "none") {
    return -180;
  }
  if (proposal.type === "sound" && plan.minimalismLevel === "minimal") {
    return -120;
  }
  if (proposal.type === "asset" && plan.selectedTreatment.finalTreatment === "title-card") {
    return -80;
  }
  if (proposal.type === "asset") {
    const visualRole = String(proposal.payload["visualRole"] ?? "");
    if (plan.editorialDoctrine.captain === "text" && visualRole === "captain") {
      return -130;
    }
    if (plan.editorialDoctrine.captain === "asset" && visualRole === "support") {
      return -45;
    }
  }
  if (proposal.type === "motion" && proposal.renderCost === "high" && plan.spatialConstraints.frameNeedsRestraint) {
    return -140;
  }
  if (proposal.type === "motion" && plan.recentSequenceMetrics.preferRestraintNext && proposal.renderCost !== "low") {
    return -175;
  }
  if (proposal.type === "text" && plan.spatialConstraints.denseTextAllowed === false && String(proposal.payload["mode"] ?? "") === "full-caption") {
    return -160;
  }
  if (proposal.type === "text" && plan.antiRepetitionSummary.forceContrast) {
    const lastTypography = plan.recentDecisionPlans[plan.recentDecisionPlans.length - 1]?.typographyMode;
    if (lastTypography && lastTypography === String(proposal.payload["mode"] ?? "")) {
      return -130;
    }
  }
  if (proposal.type === "matting" && plan.spatialConstraints.behindSubjectTextLegal === false && String(proposal.payload["mattingMode"] ?? "") === "required") {
    return -200;
  }
  if (proposal.type === "matting" && plan.recentSequenceMetrics.consecutiveBehindSubjectTextMoments > 0 && String(proposal.payload["mattingMode"] ?? "") === "required") {
    return -230;
  }
  if (proposal.type === "asset" || proposal.type === "motion") {
    const retrievedAssets = Array.isArray(proposal.payload["retrievedAssets"]) ? proposal.payload["retrievedAssets"] : [];
    if (plan.retrievalDecision.action === "skip" && retrievedAssets.length > 0) {
      return -120;
    }
  }
  if (plan.retrievalDecision.action !== "skip" && approvedRetrievedCandidateIds.size > 0 && ["asset", "motion", "text", "matting"].includes(proposal.type)) {
    if (proposalApprovedIds.length === 0) {
      return -240;
    }
    if (proposalApprovedIds.some((candidateId) => !approvedRetrievedCandidateIds.has(candidateId))) {
      return -280;
    }
  }
  if (proposal.type === "motion" && plan.antiRepetitionSummary.repeatedMotionModeCount > 0) {
    const lastMotion = plan.recentDecisionPlans[plan.recentDecisionPlans.length - 1]?.motionMode;
    if (lastMotion && lastMotion === String(proposal.payload["choreography"] ?? "")) {
      return -110;
    }
  }
  return proposal.priority * 0.02 +
    proposal.confidence * 100 +
    (plan.selectedTreatment.preferredProposalIds.includes(proposal.id) ? 18 : 0) +
    (proposalApprovedIds.some((candidateId) => approvedRetrievedCandidateIds.has(candidateId)) ? 22 : 0);
};

const isRenderableTrackProposal = (
  proposal: AgentProposal
): proposal is AgentProposal & {type: CreativeTrack["type"]} => {
  return proposal.type === "text" ||
    proposal.type === "asset" ||
    proposal.type === "background" ||
    proposal.type === "motion" ||
    proposal.type === "sound" ||
    proposal.type === "camera" ||
    proposal.type === "matting";
};

const zIndexForProposal = (proposal: AgentProposal, plan: EditDecisionPlan): number => {
  if (proposal.type === "background") return 0;
  if (proposal.type === "sound") return 1;
  if (proposal.type === "asset") return 3;
  if (proposal.type === "motion") return 4;
  if (proposal.type === "matting") return plan.selectedTreatment.matteUsage === "behind-subject-text" ? 5 : 3;
  return 4;
};

type SequenceHistoryEntry = {
  plan: EditDecisionPlan;
  moment: CreativeMoment;
};

export class ExistingAgentOrchestratorAdapter {
  private readonly engine = new CoreJudgmentEngine();

  private buildSequenceMemoryInput(context: CreativeContext, sequenceHistory: SequenceHistoryEntry[] = []): Pick<
    JudgmentEngineInput,
    "recentSelectedTreatments" |
    "recentDecisionPlans" |
    "recentVisualPatterns" |
    "recentSequenceMetrics" |
    "recentTreatmentFingerprintHistory" |
    "recentCreativeContrastHistory" |
    "recentEscalationHistory"
  > {
    const lookbackWindow = context.judgmentInput?.recentSequenceMetrics?.lookbackWindow ?? DEFAULT_SEQUENCE_LOOKBACK_WINDOW;
    const sequenceSummaries = sequenceHistory.map((entry) => planToSequenceDecisionSummary({
      plan: entry.plan,
      moment: entry.moment
    }));
    const externalRecentDecisionPlans = context.judgmentInput?.recentDecisionPlans ?? [];
    const externalRecentVisualPatterns = context.judgmentInput?.recentVisualPatterns?.length
      ? context.judgmentInput.recentVisualPatterns
      : externalRecentDecisionPlans.map((summary) => summaryToSequenceVisualPattern(summary));
    const recentDecisionPlans = [
      ...externalRecentDecisionPlans,
      ...sequenceSummaries
    ].slice(-lookbackWindow);
    const recentSelectedTreatments = [
      ...(context.judgmentInput?.recentSelectedTreatments ?? []),
      ...sequenceHistory.map((entry) => entry.plan.selectedTreatment)
    ].slice(-lookbackWindow);
    const recentVisualPatterns = [
      ...externalRecentVisualPatterns,
      ...sequenceSummaries.map((summary) => summaryToSequenceVisualPattern(summary))
    ].slice(-lookbackWindow);
    const recentTreatmentFingerprintHistory = [
      ...(context.judgmentInput?.recentTreatmentFingerprintHistory ?? []),
      ...sequenceSummaries.map((summary) => buildTreatmentFingerprint(summary))
    ].slice(-lookbackWindow);
    const recentCreativeContrastHistory = recentVisualPatterns
      .map((pattern, index) => buildCreativeContrastRecord({
        current: pattern,
        previous: recentVisualPatterns[index - 1]
      }))
      .slice(-lookbackWindow);
    const recentEscalationHistory = [
      ...(context.judgmentInput?.recentEscalationHistory ?? []),
      ...sequenceSummaries.map((summary) => buildEscalationHistoryEntry(summary))
    ].slice(-lookbackWindow);

    return {
      recentSelectedTreatments,
      recentDecisionPlans,
      recentVisualPatterns,
      recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory,
      recentEscalationHistory,
      recentSequenceMetrics: context.judgmentInput?.recentSequenceMetrics
    };
  }

  buildJudgmentInput(context: CreativeContext, moment: CreativeMoment, proposals: AgentProposal[], criticIssues: string[] = [], sequenceHistory: SequenceHistoryEntry[] = []): JudgmentEngineInput {
    const directive = context.judgmentDirectives?.[moment.id];
    const noveltyBoost = criticIssues.some((issue) => /repeat|repeated/i.test(issue)) ? 0.12 : 0;
    const creatorStyleProfile = context.judgmentInput?.creatorStyleProfile
      ? {
          ...context.judgmentInput.creatorStyleProfile,
          noveltyPreference: Math.min(1, (context.judgmentInput.creatorStyleProfile.noveltyPreference ?? 0.45) + noveltyBoost)
        }
      : undefined;
    const sequenceMemory = this.buildSequenceMemoryInput(context, sequenceHistory);
    return {
      segmentId: moment.id,
      moment: {
        id: moment.id,
        startMs: moment.startMs,
        endMs: moment.endMs,
        transcriptText: moment.transcriptText,
        words: toJudgmentWords(moment),
        momentType: moment.momentType,
        energy: moment.energy,
        importance: moment.importance,
        density: moment.density,
        suggestedIntensity: moment.suggestedIntensity
      },
      transcriptSegment: moment.transcriptText,
      speakerMetadata: context.judgmentInput?.speakerMetadataByMoment?.[moment.id],
      sceneAnalysis: context.judgmentInput?.sceneAnalysisByMoment?.[moment.id],
      subjectSegmentation: context.judgmentInput?.subjectSegmentationByMoment?.[moment.id],
      creatorStyleProfile,
      previousOutputMemory: context.judgmentInput?.previousOutputMemory,
      assetFingerprints: context.judgmentInput?.assetFingerprints ?? [],
      typographyMetadata: context.judgmentInput?.typographyMetadata,
      motionGraphicsMetadata: context.judgmentInput?.motionGraphicsMetadata,
      gsapAnimationMetadata: context.judgmentInput?.gsapAnimationMetadata,
      retrievalResults: context.judgmentInput?.retrievalResultsByMoment?.[moment.id] ?? [],
      feedbackHistory: context.judgmentInput?.feedbackHistory ?? [],
      agentProposals: toJudgmentProposals(proposals.length > 0 ? proposals : []),
      ...sequenceMemory,
      ...(directive
        ? {
            speakerMetadata: context.judgmentInput?.speakerMetadataByMoment?.[moment.id] ?? undefined
          }
        : {})
    };
  }

  async buildDirectives(context: CreativeContext, moments: CreativeMoment[]): Promise<Record<string, AgentJudgmentDirective>> {
    const provisionalHistory: SequenceHistoryEntry[] = [];
    const directives: Record<string, AgentJudgmentDirective> = {};
    for (const moment of moments) {
      const input = this.buildJudgmentInput(context, moment, [], [], provisionalHistory);
      const snapshot = this.engine.buildPreJudgmentSnapshot(input);
      const provisionalPlan = await this.engine.plan(input);
      const sequenceRecommendations = [
        ...(snapshot.recentSequenceMetrics.preferRestraintNext ? ["Prefer restraint after the recent loud run."] : []),
        ...(snapshot.recentSequenceMetrics.consecutiveBehindSubjectTextMoments > 0 ? ["Avoid immediate hero matte repetition."] : []),
        ...(snapshot.recentSequenceMetrics.consecutiveQuietMoments >= 2 && !snapshot.recentSequenceMetrics.preferRestraintNext ? ["Sequence can afford stronger expression now."] : []),
        ...(snapshot.recentSequenceMetrics.surpriseBudgetRemaining < 0.45 ? ["Protect surprise budget unless this beat is a true payoff."] : [])
      ];
      const blockedAgentTypes: AgentJudgmentDirective["blockedAgentTypes"] = [
        ...(snapshot.minimalismLevel === "minimal" ? ["camera"] as const : []),
        ...(snapshot.recentSequenceMetrics.preferRestraintNext && moment.momentType !== "payoff" ? ["motion"] as const : [])
      ];
      const executableCandidates = provisionalPlan.rankedAssetCandidates.filter((candidate) => candidate.selected && !candidate.inspirationOnly);
      const requestedAgentTypes: AgentJudgmentDirective["requestedAgentTypes"] = ["text", "layout", "background"];
      if (snapshot.retrievalDecision.action !== "skip" && executableCandidates.some((candidate) => candidate.assetType === "static_image" || candidate.assetType === "reference" || candidate.assetType === "motion_graphic")) {
        requestedAgentTypes.push("asset");
      }
      if (!blockedAgentTypes.includes("motion") && executableCandidates.some((candidate) => candidate.assetType === "motion_graphic" || candidate.assetType === "gsap_animation_logic")) {
        requestedAgentTypes.push("motion");
      }
      if (snapshot.spatialConstraints.behindSubjectTextLegal && snapshot.recentSequenceMetrics.consecutiveBehindSubjectTextMoments === 0 && executableCandidates.some((candidate) => candidate.compatibility.includes("requiresMatting") || candidate.compatibility.includes("supportsBehindSubjectText"))) {
        requestedAgentTypes.push("matting");
      }
      directives[moment.id] = agentJudgmentDirectiveSchema.parse({
        segmentId: moment.id,
        rhetoricalPurpose: snapshot.rhetoricalPurpose,
        emotionalSpine: snapshot.emotionalSpine,
        minimalismLevel: snapshot.minimalismLevel,
        editorialDoctrine: snapshot.editorialDoctrine,
        retrievalDecision: snapshot.retrievalDecision,
        emphasisTargets: snapshot.emphasisTargets,
        spatialConstraints: snapshot.spatialConstraints,
        allowedTreatmentFamilies: snapshot.allowedTreatmentFamilies,
        blockedTreatmentFamilies: snapshot.blockedTreatmentFamilies,
        blockedAgentTypes,
        requestedAgentTypes,
        requestedPlacementModes: snapshot.spatialConstraints.safeZones,
        recentSequenceMetrics: snapshot.recentSequenceMetrics,
        sequenceRecommendations,
        preferredContrastDirections: provisionalPlan.antiRepetitionSummary.preferredContrastDirections,
        retrievalEnforcementSummary: provisionalPlan.retrievalEnforcementSummary,
        approvedAssetCandidates: provisionalPlan.rankedAssetCandidates,
        rejectedAssetCandidates: provisionalPlan.rejectedAssetCandidates,
        milvusSearchRequests: provisionalPlan.milvusSearchRequests,
        milvusSearchResults: provisionalPlan.milvusSearchResults,
        retrievalTrace: provisionalPlan.retrievalTrace,
        trace: snapshot.trace
      });
      provisionalHistory.push({plan: provisionalPlan, moment});
    }
    return directives;
  }

  async decideMoment(context: CreativeContext, moment: CreativeMoment, proposals: AgentProposal[], criticIssues: string[] = [], sequenceHistory: SequenceHistoryEntry[] = []): Promise<{
    decision: DirectorDecision;
    plan: EditDecisionPlan;
    selectedProposals: AgentProposal[];
    rejectedProposals: AgentProposal[];
    tracks: CreativeTrack[];
    trace: TraceEntry[];
  }> {
    const input = this.buildJudgmentInput(context, moment, proposals, criticIssues, sequenceHistory);
    const plan = await this.engine.plan(input);
    const proposalBuckets = new Map<string, AgentProposal[]>();
    proposals.forEach((proposal) => {
      const bucket = proposalBuckets.get(proposal.type) ?? [];
      bucket.push(proposal);
      proposalBuckets.set(proposal.type, bucket);
    });

    const selectedProposals = [...proposalBuckets.entries()].flatMap(([, bucket]) => {
      const scored = bucket
        .map((proposal) => ({proposal, score: scoreProposalForCandidate(proposal, plan)}))
        .filter((entry) => entry.score > -150)
        .sort((left, right) => right.score - left.score || left.proposal.id.localeCompare(right.proposal.id));
      return scored[0] ? [scored[0].proposal] : [];
    });

    const selectedProposalIds = new Set(selectedProposals.map((proposal) => proposal.id));
    const rejectedProposals = proposals.filter((proposal) => !selectedProposalIds.has(proposal.id));
    const blockedProposalIds = rejectedProposals
      .filter((proposal) => scoreProposalForCandidate(proposal, plan) <= -180)
      .map((proposal) => proposal.id);

    plan.governance.approvedProposalIds = selectedProposals.map((proposal) => proposal.id);
    plan.governance.rejectedProposalIds = rejectedProposals.map((proposal) => proposal.id);
    plan.governance.blockedProposalIds = blockedProposalIds;
    plan.governance.rationale = [
      ...plan.governance.rationale,
      `Approved ${selectedProposals.length} proposals under ${plan.selectedTreatment.family}.`,
      ...(blockedProposalIds.length > 0 ? [`Blocked ${blockedProposalIds.length} proposals that violated plan governance.`] : [])
    ];

    const tracks = selectedProposals
      .filter(isRenderableTrackProposal)
      .map((proposal, index) => ({
        id: `${proposal.type}-track-${String(index + 1).padStart(3, "0")}-${hashString(`${moment.id}|${proposal.id}`)}`,
        type: proposal.type,
        startMs: proposal.startMs,
        endMs: proposal.endMs,
        zIndex: zIndexForProposal(proposal, plan),
        payload: {
          ...proposal.payload,
          decisionPlanId: plan.audit.id,
          treatmentFamily: plan.selectedTreatment.family,
          rhetoricalPurpose: plan.rhetoricalPurpose,
          emotionalSpine: plan.emotionalSpine
        },
        dependencies: proposal.compatibleWith?.length ? proposal.compatibleWith : undefined
      }));

    const decision: DirectorDecision = {
      momentId: moment.id,
      selectedProposalIds: selectedProposals.map((proposal) => proposal.id),
      rejectedProposalIds: rejectedProposals.map((proposal) => proposal.id),
      finalTreatment: plan.selectedTreatment.finalTreatment,
      reasoning: [
        `Rhetorical purpose: ${plan.rhetoricalPurpose}.`,
        `Emotional spine: ${plan.emotionalSpine}.`,
        `Selected ${plan.selectedTreatment.family} because it scored ${plan.scoringBreakdown.finalScore.toFixed(3)} with ${plan.negativeGrammarViolations.length} active violations.`
      ].join(" "),
      decisionPlanId: plan.audit.id,
      rhetoricalPurpose: plan.rhetoricalPurpose,
      emotionalSpine: plan.emotionalSpine,
      treatmentFamily: plan.selectedTreatment.family,
      confidence: plan.confidence,
      negativeGrammarViolations: plan.negativeGrammarViolations.map((violation) => violation.message)
    };

    return {
      decision,
      plan,
      selectedProposals,
      rejectedProposals,
      tracks,
      trace: [
        ...plan.trace,
        createTraceEntry("agent-orchestration", "Governed agent proposals under the selected treatment family.", {
          approvedProposalIds: plan.governance.approvedProposalIds,
          blockedProposalIds: plan.governance.blockedProposalIds
        })
      ]
    };
  }
}
