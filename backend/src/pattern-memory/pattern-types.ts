export type PatternOutcome = "success" | "partial-success" | "rejected" | "blocked" | "deprecated";

export type PatternMemoryEntry = {
  id: string;
  semanticIntent: string;
  sceneType: string;
  semanticRole?: string;
  tagSet: string[];
  effectStack: string[];
  compatibleWith: string[];
  successScore: number;
  confidenceScore: number;
  reuseCount: number;
  failureCount: number;
  active: boolean;
  notes?: string;
  sourceVideoId?: string | null;
  lastUsedAt?: string | null;
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
  semanticIntent?: string;
  secondaryIntents?: string[];
  sceneType?: string;
  detectedMomentType?: string;
  semanticRole?: string;
  visualDensity?: number;
  captionDensity?: number;
  speakerDominance?: number;
  motionTier?: string;
  activeEffectIds?: string[];
  activeAssetIds?: string[];
  activeTagIds?: string[];
  assetTags?: string[];
  momentTags?: string[];
  semanticSignals?: string[];
  minuteBucket?: number;
  timelinePositionMs?: number;
  timelineWindowMs?: number;
  importance?: number;
  hasPause?: boolean;
  isDenseScene?: boolean;
  isLongForm?: boolean;
  selectionMode?: string;
  targetRef?: string;
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

export type PatternUpdatePayload = {
  patternId: string;
  context: PatternContext;
  outcome: PatternOutcome;
  humanApproved?: boolean;
  rejectedReason?: string;
  notes?: string;
  appliedEffectIds?: string[];
  appliedAssetIds?: string[];
  visualScore?: number;
  hierarchyScore?: number;
  clarityScore?: number;
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
  constraint: {
    allowed: boolean;
    hardBlocked: boolean;
    reasonCodes: string[];
    message: string;
  } | null;
  humanApproved: boolean;
  beforeFingerprint?: string;
  afterFingerprint?: string;
  notes?: string;
};

export type PatternMemorySummary = {
  fingerprint: string;
  version: string;
  rulesVersion: string;
  active_entries: number;
  top_patterns: Array<{
    id: string;
    semantic_intent: string;
    scene_type: string;
    success_score: number;
    confidence_score: number;
  }>;
};

export type PatternMemoryStorePaths = {
  rootDir: string;
  ledgerPath: string;
  snapshotPath: string;
  mirrorSnapshotPath: string;
  indexPath: string;
};

export type PatternMemoryStoreState = {
  snapshot: PatternMemorySnapshot;
  ledger: PatternMemoryLedgerEvent[];
  paths: PatternMemoryStorePaths;
};
