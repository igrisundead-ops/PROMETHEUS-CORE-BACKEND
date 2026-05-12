import type {CaptionChunk, CaptionStyleProfileId, MotionTier, TranscribedWord, VideoMetadata} from "../lib/types";
import type {SequenceDirectorPlan} from "../lib/sequence-director-engine";
import type {
  AgentJudgmentDirective,
  AssetFingerprint,
  CreatorStyleProfile,
  EditDecisionPlan,
  EmotionalSpine,
  EscalationHistoryEntry,
  FeedbackLogEntry,
  JudgmentAuditRecord,
  MotionGraphicsMetadata,
  CreativeContrastRecord,
  SequenceDecisionSummary,
  SequenceMetrics,
  SequenceVisualPattern,
  TreatmentFingerprint,
  RetrievalResult,
  RhetoricalPurpose,
  SceneAnalysis,
  SpeakerMetadata,
  SubjectSegmentation,
  TreatmentFamily,
  TypographyMetadata,
  GsapAnimationMetadata
} from "./judgment/types";

export type CreativeMomentType =
  | "hook"
  | "keyword"
  | "question"
  | "list"
  | "explanation"
  | "transition"
  | "payoff"
  | "title"
  | "ambient";

export type CreativeIntensity = "minimal" | "medium" | "high" | "hero";

export type CreativeMoment = {
  id: string;
  startMs: number;
  endMs: number;
  transcriptText: string;
  words: TranscribedWord[];
  momentType: CreativeMomentType;
  energy: number;
  importance: number;
  density: number;
  suggestedIntensity: CreativeIntensity;
  chunkIds?: string[];
};

export type CreativeAsset = {
  id: string;
  name: string;
  type: "svg" | "image" | "lottie" | "video" | "three-scene" | "icon" | "shape" | "ui-card";
  tags: string[];
  keywords: string[];
  semanticDescription: string;
  visualStyle: string[];
  colors: string[];
  aspectRatio?: string;
  hasTextSlot?: boolean;
  textSlotIds?: string[];
  motionCompatible?: boolean;
  supportsTransparency?: boolean;
  renderCost: "low" | "medium" | "high";
  defaultDurationMs?: number;
  filePath?: string;
  metadata?: Record<string, unknown>;
};

export type CreativeAudioFeatures = {
  rhythmBeatsMs?: number[];
  energyEnvelope?: number[];
  averageSpeechRate?: number;
  peakMomentsMs?: number[];
};

export type CreativePatternMemory = {
  id: string;
  patternName: string;
  appliesToMomentTypes: CreativeMomentType[];
  preferredAnimations: string[];
  preferredAssets: string[];
  preferredSounds: string[];
  avoidWhen: string[];
  usageCount: number;
  successScore?: number;
  notes?: string;
};

export type CreativeContext = {
  jobId: string;
  sourceJobId?: string;
  captionProfileId?: CaptionStyleProfileId | null;
  motionTier?: MotionTier | null;
  renderMode: "audio-preview" | "overlay-preview" | "final-video";
  chunks: CaptionChunk[];
  videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null;
  audioFeatures?: CreativeAudioFeatures | null;
  availableAssets?: CreativeAsset[];
  patternMemory?: CreativePatternMemory[];
  judgmentInput?: {
    speakerMetadataByMoment?: Record<string, SpeakerMetadata>;
    sceneAnalysisByMoment?: Record<string, SceneAnalysis>;
    subjectSegmentationByMoment?: Record<string, SubjectSegmentation>;
    creatorStyleProfile?: CreatorStyleProfile;
    previousOutputMemory?: {
      recentTreatmentFamilies: TreatmentFamily[];
      repeatedKeywords: string[];
      recentlyUsedAssetIds: string[];
      recentlyUsedProposalIds: string[];
    };
    assetFingerprints?: AssetFingerprint[];
    typographyMetadata?: TypographyMetadata;
    motionGraphicsMetadata?: MotionGraphicsMetadata;
    gsapAnimationMetadata?: GsapAnimationMetadata;
    retrievalResultsByMoment?: Record<string, RetrievalResult[]>;
    feedbackHistory?: FeedbackLogEntry[];
    recentSelectedTreatments?: EditDecisionPlan["selectedTreatment"][];
    recentDecisionPlans?: SequenceDecisionSummary[];
    recentVisualPatterns?: SequenceVisualPattern[];
    recentSequenceMetrics?: SequenceMetrics;
    recentTreatmentFingerprintHistory?: TreatmentFingerprint[];
    recentCreativeContrastHistory?: CreativeContrastRecord[];
    recentEscalationHistory?: EscalationHistoryEntry[];
  };
  judgmentDirectives?: Record<string, AgentJudgmentDirective>;
  sequencePlan?: SequenceDirectorPlan;
  featureFlags?: {
    creativeOrchestrationV1?: boolean;
  };
  revisionPass?: number;
};

export type AgentProposal = {
  id: string;
  agentId: string;
  momentId: string;
  type:
    | "text"
    | "asset"
    | "motion"
    | "sound"
    | "background"
    | "camera"
    | "matting"
    | "layout"
    | "transition"
    | "render"
    | "memory";
  startMs: number;
  endMs: number;
  priority: number;
  confidence: number;
  renderCost: "low" | "medium" | "high";
  requiresMatting?: boolean;
  requiresVideoFrames?: boolean;
  compatibleWith?: string[];
  conflictsWith?: string[];
  payload: Record<string, unknown>;
  reasoning: string;
};

export interface CreativeAgent<TContext = CreativeContext> {
  id: string;
  label: string;
  propose(context: TContext, moment: CreativeMoment): Promise<AgentProposal[]>;
}

export type DirectorDecision = {
  momentId: string;
  selectedProposalIds: string[];
  rejectedProposalIds: string[];
  finalTreatment:
    | "no-treatment"
    | "caption-only"
    | "keyword-emphasis"
    | "asset-supported"
    | "asset-led"
    | "title-card"
    | "background-overlay"
    | "cinematic-transition"
    | "behind-speaker-depth";
  reasoning: string;
  decisionPlanId?: string;
  rhetoricalPurpose?: RhetoricalPurpose;
  emotionalSpine?: EmotionalSpine;
  treatmentFamily?: TreatmentFamily;
  confidence?: number;
  negativeGrammarViolations?: string[];
  governedPhysics?: {
    aggression: number;
    motion: number;
    scale: number;
    dominance: number;
    opacity: number;
    timing: number;
    pacing: number;
    silence: number;
  };
};

export type CreativeTrack = {
  id: string;
  type: "text" | "asset" | "background" | "motion" | "sound" | "camera" | "matting";
  startMs: number;
  endMs: number;
  zIndex: number;
  payload: Record<string, unknown>;
  dependencies?: string[];
};

export type CreativeDiagnostics = {
  proposalCount: number;
  approvedCount: number;
  rejectedCount: number;
  renderCost: "low" | "medium" | "high";
  mattingWindows: Array<{startMs: number; endMs: number; reason: string}>;
  warnings: string[];
};

export type CreativeTimeline = {
  id: string;
  sourceJobId: string;
  durationMs: number;
  moments: CreativeMoment[];
  decisions: DirectorDecision[];
  tracks: CreativeTrack[];
  sequencePlan?: SequenceDirectorPlan;
  editDecisionPlans?: EditDecisionPlan[];
  judgmentAuditTrail?: JudgmentAuditRecord[];
  feedbackSignals?: FeedbackLogEntry[];
  diagnostics: CreativeDiagnostics;
};

export type CriticReview = {
  status: "approved" | "needs-revision";
  score: number;
  issues: Array<{
    severity: "low" | "medium" | "high";
    momentId?: string;
    trackId?: string;
    issue: string;
    suggestedFix: string;
  }>;
};

export type CreativeOrchestrationDebugReport = {
  jobId: string;
  moments: CreativeMoment[];
  allProposals: AgentProposal[];
  directorDecisions: DirectorDecision[];
  editDecisionPlans: EditDecisionPlan[];
  judgmentAuditTrail: JudgmentAuditRecord[];
  feedbackSignals: FeedbackLogEntry[];
  criticReview: CriticReview;
  finalCreativeTimeline: CreativeTimeline;
};

export type CreativeOrchestrationResult = {
  jobId: string;
  enabled: boolean;
  moments: CreativeMoment[];
  allProposals: AgentProposal[];
  directorDecisions: DirectorDecision[];
  editDecisionPlans: EditDecisionPlan[];
  judgmentAuditTrail: JudgmentAuditRecord[];
  feedbackSignals: FeedbackLogEntry[];
  criticReview: CriticReview;
  finalCreativeTimeline: CreativeTimeline;
  captionChunks: CaptionChunk[];
  debugReport: CreativeOrchestrationDebugReport;
};
