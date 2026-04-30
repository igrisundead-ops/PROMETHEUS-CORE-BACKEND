import {classifyEmotionalSpine} from "../rules/emotional-spine";
import {determineEmphasisTargets, resolveMinimalismLevel} from "../rules/emphasis";
import {resolveEditorialDoctrine} from "../rules/editorial-doctrine";
import {classifyRhetoricalPurpose} from "../rules/rhetorical-purpose";
import {selectAllowedTreatmentFamilies} from "../rules/treatment-selection";
import {rankVisualPriorities} from "../rules/visual-priority";
import {FrameConstraintEngine} from "./frame-constraint-engine";
import {NegativeGrammarEngine} from "./negative-grammar-engine";
import {RetrievalPolicyEngine} from "./retrieval-policy-engine";
import {CandidateTreatmentEngine} from "./candidate-treatment-engine";
import {ScoringEngine} from "./scoring-engine";
import {FeedbackLoggingLayer} from "./feedback-logging-layer";
import {SequenceMemoryEngine} from "./sequence-memory-engine";
import {AntiRepetitionEngine} from "./anti-repetition-engine";
import {PairwiseTasteCriticEngine} from "./pairwise-taste-critic-engine";
import {VectorRetrievalEngine} from "./vector-retrieval-engine";
import {SteppingStonePlanner} from "../planning/stepping-stone-planner";
import {deriveConfidence} from "../utils/confidence";
import {appendTrace, createTraceEntry} from "../utils/trace";
import {hashString} from "../../utils";
import {agentGovernanceSchema, editDecisionPlanSchema, judgmentAuditRecordSchema, preJudgmentSnapshotSchema, type EditDecisionPlan, type JudgmentEngineInput, type PreJudgmentSnapshot, type TraceEntry} from "../types";

type CandidateEvaluation = {
  candidate: EditDecisionPlan["selectedTreatment"];
  antiRepetition: EditDecisionPlan["antiRepetitionSummary"];
  violations: EditDecisionPlan["negativeGrammarViolations"];
  scoring: EditDecisionPlan["scoringBreakdown"];
  blocked: boolean;
};

const clampCriticScore = (
  baseScore: number,
  comparisons: EditDecisionPlan["pairwiseTasteComparisons"],
  candidateId: string
): number => {
  const wins = comparisons.filter((comparison) => comparison.winnerCandidateId === candidateId);
  const averageMargin = wins.length > 0
    ? wins.reduce((sum, comparison) => sum + comparison.margin, 0) / wins.length
    : 0;
  return Math.min(1, baseScore + averageMargin * 0.05);
};

export class CoreJudgmentEngine {
  private readonly frameConstraintEngine = new FrameConstraintEngine();
  private readonly negativeGrammarEngine = new NegativeGrammarEngine();
  private readonly retrievalPolicyEngine = new RetrievalPolicyEngine();
  private readonly candidateTreatmentEngine = new CandidateTreatmentEngine();
  private readonly scoringEngine = new ScoringEngine();
  private readonly feedbackLoggingLayer = new FeedbackLoggingLayer();
  private readonly sequenceMemoryEngine = new SequenceMemoryEngine();
  private readonly antiRepetitionEngine = new AntiRepetitionEngine();
  private readonly pairwiseTasteCriticEngine = new PairwiseTasteCriticEngine();
  private readonly vectorRetrievalEngine: VectorRetrievalEngine;
  private readonly steppingStonePlanner = new SteppingStonePlanner();

  constructor(deps: {
    vectorRetrievalEngine?: VectorRetrievalEngine;
  } = {}) {
    this.vectorRetrievalEngine = deps.vectorRetrievalEngine ?? new VectorRetrievalEngine();
  }

  buildPreJudgmentSnapshot(input: JudgmentEngineInput): PreJudgmentSnapshot {
    let trace: TraceEntry[] = [];
    const sequenceContext = this.sequenceMemoryEngine.build(input);
    const sequenceAwareInput: JudgmentEngineInput = {
      ...input,
      ...sequenceContext
    };
    trace = appendTrace(trace, createTraceEntry("sequence-memory", "Loaded recent treatment history for sequence-aware judgment.", {
      recentDecisionPlanCount: sequenceContext.recentDecisionPlans.length,
      repetitionPressure: sequenceContext.recentSequenceMetrics.repetitionPressure,
      surpriseBudgetRemaining: sequenceContext.recentSequenceMetrics.surpriseBudgetRemaining
    }));
    const rhetoricalPurpose = classifyRhetoricalPurpose(sequenceAwareInput);
    trace = appendTrace(trace, createTraceEntry("rhetorical-purpose", `Resolved rhetorical purpose to ${rhetoricalPurpose}.`, {
      rhetoricalPurpose
    }));
    const emotionalSpine = classifyEmotionalSpine(sequenceAwareInput);
    trace = appendTrace(trace, createTraceEntry("emotional-spine", `Resolved emotional spine to ${emotionalSpine}.`, {
      emotionalSpine
    }));
    const minimalismLevel = resolveMinimalismLevel(sequenceAwareInput);
    const emphasisTargets = determineEmphasisTargets(sequenceAwareInput, minimalismLevel);
    const visualPriorityRanking = rankVisualPriorities(sequenceAwareInput);
    const editorialDoctrine = resolveEditorialDoctrine(sequenceAwareInput, {
      rhetoricalPurpose,
      minimalismLevel,
      emphasisTargets,
      visualPriorityRanking
    });
    const spatialConstraints = this.frameConstraintEngine.evaluate(sequenceAwareInput);
    trace = appendTrace(trace, createTraceEntry("frame-constraints", "Computed safe zones and restraint requirements.", {
      busyFrame: spatialConstraints.busyFrame,
      safeZones: spatialConstraints.safeZones,
      behindSubjectTextLegal: spatialConstraints.behindSubjectTextLegal
    }));
    trace = appendTrace(trace, createTraceEntry("editorial-doctrine", `Resolved ${editorialDoctrine.captain} captain with ${editorialDoctrine.conceptReductionMode}.`, {
      captain: editorialDoctrine.captain,
      conceptReductionMode: editorialDoctrine.conceptReductionMode,
      heroText: editorialDoctrine.heroText,
      supportToolBudget: editorialDoctrine.supportToolBudget
    }));
    const familySelection = selectAllowedTreatmentFamilies({
      segmentId: input.segmentId,
      rhetoricalPurpose,
      emotionalSpine,
      editorialDoctrine,
      visualPriorityRanking,
      emphasisTargets,
      minimalismLevel,
      spatialConstraints,
      retrievalDecision: {
        needed: false,
        action: "skip",
        skipReason: null,
        targets: [],
        matchStrategy: "single-strong",
        noveltyBias: sequenceAwareInput.creatorStyleProfile?.noveltyPreference ?? 0.45,
        consistencyBias: sequenceAwareInput.creatorStyleProfile?.consistencyPreference ?? 0.55,
        allowedLibraries: []
      },
      recentSelectedTreatments: sequenceContext.recentSelectedTreatments,
      recentDecisionPlans: sequenceContext.recentDecisionPlans,
      recentVisualPatterns: sequenceContext.recentVisualPatterns,
      recentSequenceMetrics: sequenceContext.recentSequenceMetrics,
      recentTreatmentFingerprintHistory: sequenceContext.recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory: sequenceContext.recentCreativeContrastHistory,
      recentEscalationHistory: sequenceContext.recentEscalationHistory,
      trace
    }, sequenceAwareInput);
    const retrievalDecision = this.retrievalPolicyEngine.evaluate(sequenceAwareInput, {
      segmentId: input.segmentId,
      rhetoricalPurpose,
      emotionalSpine,
      editorialDoctrine,
      visualPriorityRanking,
      emphasisTargets,
      minimalismLevel,
      spatialConstraints,
      allowedTreatmentFamilies: familySelection.allowed,
      blockedTreatmentFamilies: familySelection.blocked,
      recentSelectedTreatments: sequenceContext.recentSelectedTreatments,
      recentDecisionPlans: sequenceContext.recentDecisionPlans,
      recentVisualPatterns: sequenceContext.recentVisualPatterns,
      recentSequenceMetrics: sequenceContext.recentSequenceMetrics,
      recentTreatmentFingerprintHistory: sequenceContext.recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory: sequenceContext.recentCreativeContrastHistory,
      recentEscalationHistory: sequenceContext.recentEscalationHistory,
      trace
    });
    trace = appendTrace(trace, createTraceEntry("retrieval-policy", `Retrieval action resolved to ${retrievalDecision.action}.`, {
      needed: retrievalDecision.needed,
      allowedLibraries: retrievalDecision.allowedLibraries,
      matchStrategy: retrievalDecision.matchStrategy
    }));

    return preJudgmentSnapshotSchema.parse({
      segmentId: input.segmentId,
      rhetoricalPurpose,
      emotionalSpine,
      editorialDoctrine,
      visualPriorityRanking,
      emphasisTargets,
      minimalismLevel,
      spatialConstraints,
      retrievalDecision,
      allowedTreatmentFamilies: familySelection.allowed,
      blockedTreatmentFamilies: familySelection.blocked,
      recentSelectedTreatments: sequenceContext.recentSelectedTreatments,
      recentDecisionPlans: sequenceContext.recentDecisionPlans,
      recentVisualPatterns: sequenceContext.recentVisualPatterns,
      recentSequenceMetrics: sequenceContext.recentSequenceMetrics,
      recentTreatmentFingerprintHistory: sequenceContext.recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory: sequenceContext.recentCreativeContrastHistory,
      recentEscalationHistory: sequenceContext.recentEscalationHistory,
      trace
    });
  }

  async plan(input: JudgmentEngineInput): Promise<EditDecisionPlan> {
    let trace: TraceEntry[] = [];
    const snapshot = this.buildPreJudgmentSnapshot(input);
    const sequenceAwareInput: JudgmentEngineInput = {
      ...input,
      recentSelectedTreatments: snapshot.recentSelectedTreatments,
      recentDecisionPlans: snapshot.recentDecisionPlans,
      recentVisualPatterns: snapshot.recentVisualPatterns,
      recentSequenceMetrics: snapshot.recentSequenceMetrics,
      recentTreatmentFingerprintHistory: snapshot.recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory: snapshot.recentCreativeContrastHistory,
      recentEscalationHistory: snapshot.recentEscalationHistory
    };
    trace = snapshot.trace.slice();
    const plannerDecision = this.steppingStonePlanner.plan({
      judgmentInput: sequenceAwareInput,
      snapshot
    });
    trace = [
      ...trace,
      ...plannerDecision.audit.trace
    ];
    const candidates = plannerDecision.shortlist.length > 0
      ? plannerDecision.shortlist
      : this.candidateTreatmentEngine.generate(sequenceAwareInput, snapshot);
    trace = appendTrace(trace, createTraceEntry("candidate-generation", `Generated ${candidates.length} legal candidate treatment families.`, {
      families: candidates.map((candidate) => candidate.family),
      plannerFallbackUsed: plannerDecision.audit.fallbackUsed
    }));

    const evaluations: CandidateEvaluation[] = candidates.map((candidate) => {
      const antiRepetition = this.antiRepetitionEngine.evaluate({
        snapshot,
        candidate
      });
      const violations = this.negativeGrammarEngine.validateCandidate({
        input: sequenceAwareInput,
        snapshot,
        candidate,
        antiRepetition
      });
      const scoring = this.scoringEngine.scoreCandidate({
        input: sequenceAwareInput,
        snapshot,
        candidate,
        violations,
        antiRepetition
      });
      return {
        candidate,
        antiRepetition,
        violations,
        scoring,
        blocked: violations.some((violation) => violation.blocking)
      };
    }).sort((left, right) => right.scoring.finalScore - left.scoring.finalScore || Number(left.blocked) - Number(right.blocked));

    const legalEvaluations = evaluations.filter((evaluation) => !evaluation.blocked);
    const criticPool = (legalEvaluations.length > 0 ? legalEvaluations : evaluations).slice(0, 4);
    const criticSelection = this.pairwiseTasteCriticEngine.rankCandidates({
      judgmentInput: sequenceAwareInput,
      snapshot,
      evaluations: criticPool
    });
    const bestLegal = evaluations.find((evaluation) => evaluation.candidate.id === criticSelection.selectedCandidateId) ??
      evaluations.find((evaluation) => !evaluation.blocked) ??
      evaluations[0];
    const runnerUp = evaluations.find((evaluation) => evaluation.candidate.id === criticSelection.runnerUpCandidateId) ??
      evaluations.find((evaluation) => evaluation.candidate.id !== bestLegal?.candidate.id);
    const selected = bestLegal ?? {
      candidate: candidates[0],
      violations: [],
      scoring: {
        readabilityScore: 0.5,
        semanticAlignmentScore: 0.5,
        rhetoricalAlignmentScore: 0.5,
        emotionalAlignmentScore: 0.5,
        premiumFeelScore: 0.5,
        eleganceScore: 0.5,
        nonRepetitionScore: 0.5,
        noveltyScore: 0.5,
        clutterPenalty: 0.5,
        breathingRoomScore: 0.5,
        visualHierarchyScore: 0.5,
        renderabilityScore: 0.5,
        timingAlignmentScore: 0.5,
        retentionPotentialScore: 0.5,
        creatorStyleAdherenceScore: 0.5,
        humanMadeFeelScore: 0.5,
        sequenceContrastScore: 0.5,
        escalationFitScore: 0.5,
        surprisePreservationScore: 0.5,
        repetitionPenalty: 0.5,
        pacingVariationScore: 0.5,
        restraintBalanceScore: 0.5,
        emotionalProgressionScore: 0.5,
        climaxBudgetScore: 0.5,
        noveltyAcrossSequenceScore: 0.5,
        finalScore: 0.5
      },
      antiRepetition: {
        repeatedTreatmentFamilyCount: 0,
        repeatedTypographyModeCount: 0,
        repeatedMotionModeCount: 0,
        repeatedPlacementModeCount: 0,
        repeatedEmphasisModeCount: 0,
        repeatedMatteUsageCount: 0,
        repeatedHeroBackgroundTextCount: 0,
        repeatedVisualDensityCount: 0,
        repeatedRhetoricalPurposeCount: 0,
        repeatedEmotionalSpineCount: 0,
        repeatedVisualClimaxCount: 0,
        repeatedPremiumTrickCount: 0,
        repeatedHeroMomentCount: 0,
        consecutiveLoudBeatCount: 0,
        repetitionPenalty: 0,
        recommendRestraint: false,
        forceContrast: false,
        reasons: [],
        diversityRecommendations: [],
        preferredContrastDirections: [],
        escalationWarnings: [],
        restraintRecommendations: []
      },
      blocked: false
    };
    trace = appendTrace(trace, createTraceEntry("scoring", `Selected ${selected.candidate.family} with score ${selected.scoring.finalScore.toFixed(3)}.`, {
      selectedCandidateId: selected.candidate.id,
      selectedScore: selected.scoring.finalScore,
      runnerUpScore: runnerUp?.scoring.finalScore ?? null,
      blocked: selected.blocked
    }));
    trace = appendTrace(trace, createTraceEntry("pairwise-taste-critic", `Pairwise critic selected ${criticSelection.selectedCandidateId || selected.candidate.id} after ${criticSelection.pairwiseTasteComparisons.length} comparison(s).`, {
      criticSelectedCandidateId: criticSelection.selectedCandidateId || selected.candidate.id,
      comparisonCount: criticSelection.pairwiseTasteComparisons.length,
      rationale: criticSelection.criticRationale,
      tasteRiskFlags: criticSelection.tasteRiskFlags
    }));
    trace = appendTrace(trace, createTraceEntry("anti-repetition", "Applied sequence memory and repetition penalties to candidate ranking.", {
      repetitionPenalty: selected.antiRepetition.repetitionPenalty,
      recommendRestraint: selected.antiRepetition.recommendRestraint,
      forceContrast: selected.antiRepetition.forceContrast
    }));
    const retrievalResult = await this.vectorRetrievalEngine.retrieve({
      input: sequenceAwareInput,
      snapshot,
      selectedTreatment: selected.candidate
    });
    trace = [
      ...trace,
      ...retrievalResult.retrievalTrace.entries
    ];
    trace = appendTrace(trace, createTraceEntry("vector-retrieval", `Approved ${retrievalResult.selectedAssetCandidateIds.length} retrieved asset candidate(s) for governed execution.`, {
      selectedAssetCandidateIds: retrievalResult.selectedAssetCandidateIds,
      approvedCandidateCount: retrievalResult.rankedAssetCandidates.length,
      rejectedCandidateCount: retrievalResult.rejectedAssetCandidates.length
    }));

    const governance = agentGovernanceSchema.parse({
      approvedProposalIds: [],
      rejectedProposalIds: [],
      blockedProposalIds: [],
      allowedAgentTypes: selected.candidate.allowedProposalTypes,
      blockedAgentTypes: selected.candidate.blockedProposalTypes,
      rationale: [
        `The ${selected.candidate.family} family best balanced rhetorical alignment, readability, premium restraint, and sequence contrast.`,
        ...criticSelection.criticRationale,
        ...retrievalResult.assetRankingRationale.slice(0, 4)
      ]
    });
    const confidence = deriveConfidence({
      selectedScore: clampCriticScore(selected.scoring.finalScore, criticSelection.pairwiseTasteComparisons, selected.candidate.id),
      runnerUpScore: runnerUp?.scoring.finalScore,
      blockingViolationCount: selected.violations.filter((violation) => violation.blocking).length,
      traceCount: trace.length,
      proposalConfidence: input.agentProposals.length > 0
        ? input.agentProposals.reduce((sum, proposal) => sum + proposal.confidence, 0) / input.agentProposals.length
        : 0.5
    });

    const rejectedTreatments = evaluations
      .filter((evaluation) => evaluation.candidate.id !== selected.candidate.id)
      .map((evaluation) => {
        const comparison = criticSelection.pairwiseTasteComparisons.find((entry) => (
          entry.winnerCandidateId === selected.candidate.id && entry.loserCandidateId === evaluation.candidate.id
        ));
        return {
          candidateId: evaluation.candidate.id,
          family: evaluation.candidate.family,
          reason: evaluation.blocked
            ? "Candidate was blocked by negative grammar."
            : comparison?.reasons[0] ?? "Candidate lost on scoring against a better balanced legal option.",
          violations: evaluation.violations,
          score: evaluation.scoring.finalScore
        };
      });

    const partialPlan = {
      segmentId: input.segmentId,
      selectedTreatment: selected.candidate,
      scoringBreakdown: selected.scoring,
      confidence,
      rejectedTreatments
    };
    const feedbackSignals = this.feedbackLoggingLayer.buildSignals(sequenceAwareInput, partialPlan);
    const audit = judgmentAuditRecordSchema.parse({
      id: `judgment-${hashString(`${input.segmentId}|${selected.candidate.id}|${selected.scoring.finalScore.toFixed(3)}`)}`,
      segmentId: input.segmentId,
      selectedCandidateId: selected.candidate.id,
      selectedTreatmentFamily: selected.candidate.family,
      confidence,
      sequenceMetrics: snapshot.recentSequenceMetrics,
      antiRepetitionSummary: selected.antiRepetition,
      pairwiseTasteComparisons: criticSelection.pairwiseTasteComparisons,
      criticSelectedCandidateId: criticSelection.selectedCandidateId || selected.candidate.id,
      criticRationale: criticSelection.criticRationale,
      tasteRiskFlags: criticSelection.tasteRiskFlags,
      retrievalEnforcementSummary: retrievalResult.retrievalEnforcementSummary,
      milvusSearchRequests: retrievalResult.milvusSearchRequests,
      milvusSearchResults: retrievalResult.milvusSearchResults,
      rankedAssetCandidates: retrievalResult.rankedAssetCandidates,
      rejectedAssetCandidates: retrievalResult.rejectedAssetCandidates,
      selectedAssetCandidateIds: retrievalResult.selectedAssetCandidateIds,
      plannerAudit: plannerDecision.audit,
      retrievalTrace: retrievalResult.retrievalTrace,
      trace,
      createdAt: new Date().toISOString()
    });

    return editDecisionPlanSchema.parse({
      segmentId: input.segmentId,
      rhetoricalPurpose: snapshot.rhetoricalPurpose,
      emotionalSpine: snapshot.emotionalSpine,
      editorialDoctrine: snapshot.editorialDoctrine,
      visualPriorityRanking: snapshot.visualPriorityRanking,
      emphasisTargets: snapshot.emphasisTargets,
      foregroundAssignments: snapshot.visualPriorityRanking.slice(0, 2).map((entry) => entry.subject),
      midgroundAssignments: snapshot.visualPriorityRanking.slice(2, 5).map((entry) => entry.subject),
      backgroundAssignments: snapshot.visualPriorityRanking.slice(5).map((entry) => entry.subject),
      minimalismLevel: snapshot.minimalismLevel,
      retrievalDecision: snapshot.retrievalDecision,
      retrievalTargets: snapshot.retrievalDecision.targets,
      candidateTreatments: candidates,
      selectedTreatment: selected.candidate,
      rejectedTreatments,
      rejectionReasons: rejectedTreatments.map((entry) => entry.reason),
      pairwiseTasteComparisons: criticSelection.pairwiseTasteComparisons,
      criticSelectedCandidateId: criticSelection.selectedCandidateId || selected.candidate.id,
      criticRationale: criticSelection.criticRationale,
      tasteRiskFlags: criticSelection.tasteRiskFlags,
      recentSelectedTreatments: snapshot.recentSelectedTreatments,
      recentDecisionPlans: snapshot.recentDecisionPlans,
      recentVisualPatterns: snapshot.recentVisualPatterns,
      recentSequenceMetrics: snapshot.recentSequenceMetrics,
      recentTreatmentFingerprintHistory: snapshot.recentTreatmentFingerprintHistory,
      recentCreativeContrastHistory: snapshot.recentCreativeContrastHistory,
      recentEscalationHistory: snapshot.recentEscalationHistory,
      antiRepetitionSummary: selected.antiRepetition,
      negativeGrammarViolations: selected.violations,
      spatialConstraints: snapshot.spatialConstraints,
      assetSelectionHints: [
        `Prefer libraries: ${snapshot.retrievalDecision.allowedLibraries.join(", ") || "none"}.`,
        ...selected.candidate.preferredLibraries.map((library) => `Bias asset selection toward ${library}.`),
        ...retrievalResult.rankedAssetCandidates.slice(0, 3).map((candidate) => `Approved asset candidate ${candidate.assetId} scored ${candidate.finalScore.toFixed(2)}.`)
      ],
      typographySelectionHints: [
        `Typography mode: ${selected.candidate.typographyMode}.`,
        `Captain: ${snapshot.editorialDoctrine.captain}; reduction: ${snapshot.editorialDoctrine.conceptReductionMode}.`,
        snapshot.emphasisTargets.isolatePunchWord && snapshot.emphasisTargets.punchWord
          ? `Isolate punch word "${snapshot.emphasisTargets.punchWord}".`
          : "Keep typography subordinate to frame clarity.",
        ...retrievalResult.rankedAssetCandidates.filter((candidate) => candidate.assetType === "typography").slice(0, 2).map((candidate) => `Typography candidate ${candidate.assetId} is approved for execution.`)
      ],
      motionSelectionHints: [
        `Motion mode: ${selected.candidate.motionMode}.`,
        `Support-tool budget: ${snapshot.editorialDoctrine.supportToolBudget}.`,
        selected.candidate.intensity === "expressive"
          ? "Use motion as a deliberate accent, not constant spectacle."
          : "Stay restrained and preserve breathing room.",
        ...retrievalResult.rankedAssetCandidates.filter((candidate) => candidate.assetType === "motion_graphic" || candidate.assetType === "gsap_animation_logic").slice(0, 2).map((candidate) => `Motion candidate ${candidate.assetId} is approved for execution.`)
      ],
      retrievalEnforcementSummary: retrievalResult.retrievalEnforcementSummary,
      milvusSearchRequests: retrievalResult.milvusSearchRequests,
      milvusSearchResults: retrievalResult.milvusSearchResults,
      rankedAssetCandidates: retrievalResult.rankedAssetCandidates,
      rejectedAssetCandidates: retrievalResult.rejectedAssetCandidates,
      selectedAssetCandidateIds: retrievalResult.selectedAssetCandidateIds,
      assetRankingRationale: retrievalResult.assetRankingRationale,
      retrievalTrace: retrievalResult.retrievalTrace,
      scoringBreakdown: selected.scoring,
      feedbackSignals,
      confidence,
      governance,
      plannerAudit: plannerDecision.audit,
      trace,
      audit
    });
  }
}
