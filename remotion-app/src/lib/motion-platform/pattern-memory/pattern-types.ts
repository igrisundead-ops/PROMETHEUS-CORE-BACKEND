import type {AnimationLayeringRule, AnimationTriggerType, MotionAssetManifest, MotionTier, MotionSceneKind} from "../../types";

export type PatternSemanticIntent =
  | "comparison"
  | "sequence"
  | "numeric-emphasis"
  | "cause-effect"
  | "implied-term"
  | "restraint-needed"
  | "call"
  | "growth"
  | "list"
  | "quote"
  | "cta"
  | "focus"
  | "highlight"
  | "underline"
  | "circle"
  | "replaceable-word"
  | "bubble-card"
  | "counter"
  | "progress"
  | "workflow"
  | "timeline"
  | "unknown";

export type PatternSceneType = MotionSceneKind | "list" | "growth" | "call" | "restraint" | "bubble-card";

export type PatternSemanticRole = "primary" | "secondary" | "decorative";

export type PatternPatternType =
  | "motion-primitive"
  | "motion-composite"
  | "svg-variant"
  | "overlay"
  | "camera-focus"
  | "layout"
  | "constraint"
  | "motion-asset";

export type PatternRejectionReason =
  | "redundancy"
  | "clutter-risk"
  | "visual-conflict"
  | "poor-hierarchy"
  | "timing-conflict"
  | "caption-collision"
  | "speaker-obstruction"
  | "too-many-simultaneous-effects"
  | "semantic-mismatch"
  | "repetition-limit"
  | "budget-blocked"
  | "density-blocked"
  | "duplicate-semantic-emphasis"
  | "low-impact"
  | "stale-pattern"
  | "unsupported-target"
  | "overuse"
  | "conflict-with-constraint"
  | "unknown";

export type PatternTimingProfile = {
  entryMs: number;
  holdMs: number;
  exitMs: number;
  totalMs: number;
  easing: string;
  loop: boolean;
};

export type PatternConstraintBudget = {
  underlinesPerMinute: number;
  circlesPerMinute: number;
  highAttentionPerMinute: number;
  bubbleCardsPerFiveMinutes: number;
  heavyAssetsMinSpacingMs: number;
  duplicateNumericEmphasis: boolean;
  subtitleProtectionMarginPx: number;
  faceSafeMarginPx: number;
};

export type PatternMemoryEntry = {
  id: string;
  patternType: PatternPatternType;
  semanticIntent: PatternSemanticIntent;
  sceneType: PatternSceneType;
  triggerContext: string[];
  detectedMomentType: string;
  semanticRole: PatternSemanticRole;
  layoutUsed: string;
  effectStack: string[];
  animationStyle: string[];
  timingProfile: PatternTimingProfile;
  entryBehavior: string;
  exitBehavior: string;
  visualWeight: number;
  redundancyRiskScore: number;
  clutterRiskScore: number;
  successScore: number;
  rejectionReasons: PatternRejectionReason[];
  compatibilityRules: string[];
  antiPatterns: string[];
  compatibleWith: string[];
  assetRefs: string[];
  tagSet: string[];
  confidenceScore: number;
  reuseCount: number;
  failureCount: number;
  lastUsedAt: string | null;
  sourceVideoId: string | null;
  active: boolean;
  notes: string;
  source: "seed" | "curated" | "learned";
  category: string;
  layeringRules?: AnimationLayeringRule[];
  triggerType?: AnimationTriggerType | AnimationTriggerType[];
  assetMetadata?: MotionAssetManifest[];
};

export type PatternContext = {
  jobId?: string;
  videoId?: string;
  sourceVideoId?: string;
  sceneId?: string;
  momentId?: string;
  sourceVideoHash?: string;
  prompt?: string;
  transcriptText?: string;
  chunkText?: string;
  momentText?: string;
  semanticIntent: PatternSemanticIntent;
  secondaryIntents: PatternSemanticIntent[];
  sceneType: PatternSceneType;
  detectedMomentType: string;
  semanticRole: PatternSemanticRole;
  visualDensity: number;
  captionDensity: number;
  speakerDominance: number;
  motionTier: MotionTier;
  activeEffectIds: string[];
  activeAssetIds: string[];
  activeTagIds: string[];
  assetTags: string[];
  momentTags: string[];
  semanticSignals: string[];
  minuteBucket: number;
  timelinePositionMs: number;
  timelineWindowMs: number;
  importance: number;
  hasPause: boolean;
  isDenseScene: boolean;
  isLongForm: boolean;
  selectionMode?: string;
  targetRef?: string;
};

export type PatternScore = {
  clarity: number;
  hierarchy: number;
  focus: number;
  elegance: number;
  clutterRisk: number;
  compatibility: number;
  readability: number;
  sceneAppropriateness: number;
  redundancyRisk: number;
  repetitionPenalty: number;
  semanticFit: number;
  timingFit: number;
  total: number;
};

export type PatternRecommendationAction = "apply" | "avoid" | "defer" | "replace" | "reinforce" | "deprecate" | "pair";

export type PatternRecommendation = {
  patternId: string;
  action: PatternRecommendationAction;
  confidence: number;
  effectStack: string[];
  assetRefs: string[];
  reasons: string[];
  pairedPatternIds: string[];
};

export type AestheticConstraintDecision = {
  allowed: boolean;
  hardBlocked: boolean;
  reasonCodes: PatternRejectionReason[];
  message: string;
  budgets: PatternConstraintBudget;
  similarPatternIds: string[];
  suppressedEffectIds: string[];
  recommendedReplacementPatternIds: string[];
};

export type PatternMatchResult = {
  entry: PatternMemoryEntry;
  score: PatternScore;
  recommendation: PatternRecommendation;
  constraint: AestheticConstraintDecision;
  reasons: string[];
  warnings: string[];
};

export type PatternOutcome = "success" | "partial-success" | "rejected" | "blocked" | "deprecated";

export type PatternUpdatePayload = {
  patternId: string;
  context: PatternContext;
  outcome: PatternOutcome;
  humanApproved?: boolean;
  rejectedReason?: PatternRejectionReason;
  notes?: string;
  appliedEffectIds?: string[];
  appliedAssetIds?: string[];
  visualScore?: number;
  hierarchyScore?: number;
  clarityScore?: number;
};

export type PatternMemoryIndex = {
  byId: Record<string, number>;
  bySemanticIntent: Record<string, string[]>;
  bySceneType: Record<string, string[]>;
  byEffectId: Record<string, string[]>;
  byAssetId: Record<string, string[]>;
  byTag: Record<string, string[]>;
  bySourceVideoId: Record<string, string[]>;
};

export type PatternMemorySnapshot = {
  version: string;
  generatedAt: string;
  fingerprint: string;
  rulesVersion: string;
  entries: PatternMemoryEntry[];
  index: PatternMemoryIndex;
  notes: string[];
};

export type PatternMemoryLedgerEventType =
  | "seed"
  | "apply"
  | "update"
  | "reject"
  | "reinforce"
  | "deprecate";

export type PatternMemoryLedgerEvent = {
  id: string;
  type: PatternMemoryLedgerEventType;
  at: string;
  patternId: string;
  context: PatternContext;
  outcome: PatternOutcome;
  reasons: string[];
  recommendation: PatternRecommendation | null;
  constraint: AestheticConstraintDecision | null;
  humanApproved: boolean;
  beforeFingerprint?: string;
  afterFingerprint?: string;
  notes?: string;
};

export type PatternMemoryStorePaths = {
  rootDir: string;
  ledgerPath: string;
  snapshotPath: string;
  indexPath: string;
};

export type PatternMemoryStoreState = {
  snapshot: PatternMemorySnapshot;
  ledger: PatternMemoryLedgerEvent[];
  paths: PatternMemoryStorePaths;
};
