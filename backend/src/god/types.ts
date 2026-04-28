import {z} from "zod";

export const GOD_VISION_MODES = ["orb", "panel", "frame", "flare", "texture", "symbol", "text-glow", "ui-fragment"] as const;
export const GOD_DECISIONS = [
  "use_existing_asset",
  "generate_new_asset",
  "generate_asset_variation",
  "escalate_for_manual_review"
] as const;
export const GOD_ASSET_ROLES = ["background", "showcase"] as const;
export const GOD_ASSET_RENDER_MODES = ["image", "iframe"] as const;
export const GOD_ASSET_TIERS = ["minimal", "editorial", "premium", "hero"] as const;
export const GOD_ASSET_MOOD_TAGS = ["neutral", "warm", "cool", "calm", "kinetic", "authority", "heroic"] as const;
export const GOD_ASSET_PLACEMENT_ZONES = [
  "full-frame",
  "edge-frame",
  "upper-perimeter",
  "side-panels",
  "lower-third",
  "background-depth",
  "foreground-cross"
] as const;
export const GOD_ASSET_SAFE_AREAS = ["avoid-caption-region", "edge-safe", "full-frame"] as const;
export const GOD_ASSET_DURATION_POLICIES = ["scene-span", "entry-only", "exit-only", "ping-pong"] as const;
export const GOD_ASSET_ALPHA_MODES = ["opaque", "straight", "premultiplied", "luma-mask"] as const;

export type GodVisionMode = (typeof GOD_VISION_MODES)[number];
export type GodDecision = (typeof GOD_DECISIONS)[number];
export type GodAssetRole = (typeof GOD_ASSET_ROLES)[number];
export type GodAssetRenderMode = (typeof GOD_ASSET_RENDER_MODES)[number];
export type GodAssetTier = (typeof GOD_ASSET_TIERS)[number];
export type GodMoodTag = (typeof GOD_ASSET_MOOD_TAGS)[number];
export type GodPlacementZone = (typeof GOD_ASSET_PLACEMENT_ZONES)[number];
export type GodSafeArea = (typeof GOD_ASSET_SAFE_AREAS)[number];
export type GodDurationPolicy = (typeof GOD_ASSET_DURATION_POLICIES)[number];
export type GodAlphaMode = (typeof GOD_ASSET_ALPHA_MODES)[number];

export const godAssetNeedDecisionSchema = z.enum(GOD_DECISIONS);
export const godVisionModeSchema = z.enum(GOD_VISION_MODES);
export const godAssetRoleSchema = z.enum(GOD_ASSET_ROLES);
export const godAssetRenderModeSchema = z.enum(GOD_ASSET_RENDER_MODES);
export const godAssetTierSchema = z.enum(GOD_ASSET_TIERS);
export const godMoodTagSchema = z.enum(GOD_ASSET_MOOD_TAGS);
export const godPlacementZoneSchema = z.enum(GOD_ASSET_PLACEMENT_ZONES);
export const godSafeAreaSchema = z.enum(GOD_ASSET_SAFE_AREAS);
export const godDurationPolicySchema = z.enum(GOD_ASSET_DURATION_POLICIES);
export const godAlphaModeSchema = z.enum(GOD_ASSET_ALPHA_MODES);

export const godReferenceAssetSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  sourceKind: z.string().optional(),
  assetRole: godAssetRoleSchema.optional(),
  family: z.string().optional(),
  tier: godAssetTierSchema.optional(),
  src: z.string().optional(),
  sourceFile: z.string().optional(),
  sourceHtml: z.string().optional(),
  sourceBatch: z.string().optional(),
  themeTags: z.array(godMoodTagSchema).default([]),
  semanticTags: z.array(z.string()).default([]),
  subjectTags: z.array(z.string()).default([]),
  emotionalTags: z.array(godMoodTagSchema).default([]),
  functionalTags: z.array(z.string()).default([]),
  placementZone: godPlacementZoneSchema.optional(),
  safeArea: godSafeAreaSchema.optional(),
  durationPolicy: godDurationPolicySchema.optional(),
  renderMode: godAssetRenderModeSchema.optional(),
  loopable: z.boolean().optional(),
  blendMode: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  metadataConfidence: z.number().min(0).max(1).optional(),
  idealDurationMs: z.number().positive().optional(),
  searchTerms: z.array(z.string()).default([]),
  score: z.number().optional()
});

export type GodReferenceAsset = z.infer<typeof godReferenceAssetSchema>;

export const godSceneContextSchema = z.object({
  jobId: z.string().trim().optional(),
  editSessionId: z.string().trim().optional(),
  sceneId: z.string().trim().optional(),
  sceneLabel: z.string().trim().optional(),
  prompt: z.string().trim().default(""),
  exactMoment: z.string().trim().optional(),
  semanticRole: z.string().trim().default("editorial-accent"),
  assetRole: godAssetRoleSchema.default("showcase"),
  toneTarget: z.string().trim().default("cinematic-premium-clean"),
  visualTone: z.string().trim().default("premium glassmorphism"),
  motionLanguage: z.string().trim().default("cinematic flat motion with easing-out"),
  compositionNeed: z.string().trim().default("overlay compositing"),
  presentationMode: z.enum(["reel", "long-form"]).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  isOverlayAsset: z.boolean().default(true),
  isSceneSpecific: z.boolean().default(false),
  variationRequested: z.boolean().default(false),
  variationOfAssetId: z.string().trim().optional(),
  manualReviewRequested: z.boolean().default(false),
  preferredForm: godVisionModeSchema.default("orb"),
  requiredText: z.string().trim().optional(),
  requiredElements: z.array(z.string()).default([]),
  forbiddenElements: z.array(z.string()).default([]),
  compositionConstraints: z.array(z.string()).default([]),
  paletteGuidance: z.array(z.string()).default([]),
  brandRules: z.array(z.string()).default([]),
  reusabilityGoal: z.string().trim().default("Reusable modular overlay asset for future edits."),
  projectId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  templateFamily: z.string().trim().optional(),
  sourceJobId: z.string().trim().optional(),
  existingAssets: z.array(godReferenceAssetSchema).default([]),
  backgroundAssets: z.array(godReferenceAssetSchema).default([]),
  referenceTags: z.array(z.string()).default([]),
  notes: z.string().trim().optional()
});

export type GodSceneContext = z.infer<typeof godSceneContextSchema>;

export const godNeedCandidateSchema = z.object({
  asset: godReferenceAssetSchema,
  score: z.number().min(0).max(1),
  semanticFit: z.number().min(0).max(1),
  stylisticFit: z.number().min(0).max(1),
  motionFit: z.number().min(0).max(1),
  compositionFit: z.number().min(0).max(1),
  emotionalFit: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([])
});

export type GodNeedCandidate = z.infer<typeof godNeedCandidateSchema>;

export const godNeedAssessmentSchema = z.object({
  decision: godAssetNeedDecisionSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  preferredForm: godVisionModeSchema,
  shouldGenerateVariation: z.boolean(),
  shouldEscalate: z.boolean(),
  topCandidates: z.array(godNeedCandidateSchema).default([]),
  chosenAssetId: z.string().nullable(),
  insufficientAspects: z.array(z.string()).default([]),
  needScore: z.number().min(0).max(1),
  premiumThresholdHit: z.boolean(),
  backgroundLibraryConsidered: z.boolean()
});

export type GodNeedAssessment = z.infer<typeof godNeedAssessmentSchema>;

export const godMotionMetadataSchema = z.object({
  recommendedEntranceStyle: z.string(),
  recommendedHoverStyle: z.string(),
  recommendedDurationRangeMs: z.tuple([z.number().positive(), z.number().positive()]),
  recommendedZLayerUsage: z.string(),
  recommendedBlendModes: z.array(z.string()).default([]),
  recommendedOpacityRange: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  recommendedLoopStyle: z.string().optional()
});

export type GodMotionMetadata = z.infer<typeof godMotionMetadataSchema>;

export const godGenerationBriefSchema = z.object({
  briefId: z.string(),
  briefVersion: z.string(),
  createdAt: z.string(),
  sceneContext: godSceneContextSchema,
  needAssessment: godNeedAssessmentSchema,
  assetPurpose: z.string(),
  semanticRole: z.string(),
  visualTone: z.string(),
  preferredForm: godVisionModeSchema,
  motionLanguage: z.string(),
  transparencyRequired: z.boolean(),
  noBackgroundRequired: z.boolean(),
  paletteGuidance: z.array(z.string()).default([]),
  aspectRatio: z.string(),
  sizeGuidance: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    safeMarginPx: z.number().int().nonnegative()
  }),
  exportConstraints: z.array(z.string()).default([]),
  reusabilityGoal: z.string(),
  brandRules: z.array(z.string()).default([]),
  forbiddenElements: z.array(z.string()).default([]),
  requiredElements: z.array(z.string()).default([]),
  compositionConstraints: z.array(z.string()).default([]),
  motionMetadata: godMotionMetadataSchema,
  referenceNotes: z.array(z.string()).default([]),
  existingAssetReferences: z.array(z.object({
    id: z.string(),
    label: z.string().optional(),
    score: z.number().min(0).max(1),
    reason: z.string()
  })).default([]),
  backgroundReferences: z.array(z.object({
    id: z.string(),
    label: z.string().optional(),
    themeTags: z.array(godMoodTagSchema).default([]),
    score: z.number().min(0).max(1).optional()
  })).default([]),
  promptText: z.string(),
  systemPrompt: z.string(),
  userPrompt: z.string(),
  providerHints: z.record(z.string(), z.unknown()).default({})
});

export type GodGenerationBrief = z.infer<typeof godGenerationBriefSchema>;

export const godProviderAttemptSchema = z.object({
  providerId: z.string(),
  providerKind: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
  status: z.enum(["success", "failed", "fallback", "skipped"]),
  confidence: z.number().min(0).max(1).nullable(),
  warningCount: z.number().int().nonnegative().default(0),
  error: z.string().nullable(),
  summary: z.string(),
  responseHash: z.string().nullable().optional(),
  responsePreview: z.string().nullable().optional()
});

export type GodProviderAttempt = z.infer<typeof godProviderAttemptSchema>;

export const godGeneratedAssetDraftSchema = z.object({
  title: z.string(),
  label: z.string(),
  assetRole: godAssetRoleSchema,
  family: z.string(),
  tier: godAssetTierSchema,
  renderMode: godAssetRenderModeSchema,
  preferredForm: godVisionModeSchema,
  html: z.string(),
  css: z.string().optional(),
  svg: z.string().optional(),
  themeTags: z.array(godMoodTagSchema).default([]),
  semanticTags: z.array(z.string()).default([]),
  subjectTags: z.array(z.string()).default([]),
  emotionalTags: z.array(godMoodTagSchema).default([]),
  functionalTags: z.array(z.string()).default([]),
  placementZone: godPlacementZoneSchema,
  safeArea: godSafeAreaSchema,
  durationPolicy: godDurationPolicySchema,
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z.string().default("normal"),
  loopable: z.boolean().default(true),
  transparencyRequired: z.boolean().default(true),
  noBackgroundRequired: z.boolean().default(true),
  paletteGuidance: z.array(z.string()).default([]),
  reusabilityGoal: z.string().default(""),
  forbiddenElements: z.array(z.string()).default([]),
  motionMetadata: godMotionMetadataSchema,
  sourceProvider: z.string(),
  providerConfidence: z.number().min(0).max(1).nullable().default(null),
  briefHash: z.string(),
  draftHash: z.string(),
  preferredSize: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  previewCopy: z.string().optional(),
  notes: z.array(z.string()).default([])
});

export type GodGeneratedAssetDraft = z.infer<typeof godGeneratedAssetDraftSchema>;

export const godValidationCheckSchema = z.object({
  id: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  notes: z.array(z.string()).default([])
});

export const godValidationResultSchema = z.object({
  passed: z.boolean(),
  hardErrors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  checks: z.array(godValidationCheckSchema).default([]),
  technicalScore: z.number().min(0).max(1),
  compositingScore: z.number().min(0).max(1),
  aestheticScore: z.number().min(0).max(1),
  styleScore: z.number().min(0).max(1),
  motionScore: z.number().min(0).max(1),
  reuseScore: z.number().min(0).max(1),
  overallScore: z.number().min(0).max(1),
  contentHash: z.string(),
  fileHash: z.string(),
  normalizedHtmlPath: z.string().optional(),
  previewPath: z.string().optional()
});

export type GodValidationCheck = z.infer<typeof godValidationCheckSchema>;
export type GodValidationResult = z.infer<typeof godValidationResultSchema>;

export const godBenchmarkResultSchema = z.object({
  passed: z.boolean(),
  overallScore: z.number().min(0).max(1),
  technicalScore: z.number().min(0).max(1),
  compositingScore: z.number().min(0).max(1),
  aestheticScore: z.number().min(0).max(1),
  styleScore: z.number().min(0).max(1),
  motionScore: z.number().min(0).max(1),
  reuseScore: z.number().min(0).max(1),
  userApproved: z.boolean().default(false),
  gates: z.object({
    technical: z.boolean(),
    compositing: z.boolean(),
    aesthetic: z.boolean(),
    style: z.boolean(),
    motion: z.boolean(),
    reuse: z.boolean(),
    approval: z.boolean()
  }),
  reasons: z.array(z.string()).default([]),
  thresholds: z.record(z.string(), z.number()).default({})
});

export type GodBenchmarkResult = z.infer<typeof godBenchmarkResultSchema>;

export const godPromotionStateSchema = z.enum([
  "draft",
  "pending_user_approval",
  "approved_scene_only",
  "approved_pending_promotion",
  "promoted",
  "rejected"
]);

export type GodPromotionState = z.infer<typeof godPromotionStateSchema>;

export const godGeneratedAssetRecordSchema = z.object({
  reviewId: z.string(),
  assetId: z.string(),
  sceneId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: godPromotionStateSchema,
  decision: godAssetNeedDecisionSchema,
  context: godSceneContextSchema,
  assessment: godNeedAssessmentSchema,
  brief: godGenerationBriefSchema,
  providerAttempts: z.array(godProviderAttemptSchema).default([]),
  draft: godGeneratedAssetDraftSchema,
  validation: godValidationResultSchema,
  benchmark: godBenchmarkResultSchema,
  userApproval: z.object({
    approved: z.boolean(),
    sceneOnly: z.boolean(),
    reuseEligible: z.boolean(),
    promoteToCollection: z.boolean(),
    overrideBenchmarkFailures: z.boolean().default(false),
    approvedBy: z.string().nullable().optional(),
    approvedAt: z.string().nullable().optional(),
    notes: z.string().nullable().optional()
  }).optional(),
  promotion: z.object({
    promotedAt: z.string().nullable().optional(),
    permanentManifestPath: z.string().nullable().optional(),
    permanentAssetDir: z.string().nullable().optional(),
    catalogPath: z.string().nullable().optional()
  }).optional(),
  files: z.object({
    reviewDir: z.string(),
    assetHtml: z.string(),
    previewHtml: z.string().optional(),
    metadataJson: z.string(),
    benchmarkJson: z.string(),
    manifestJson: z.string()
  }),
  dedupeKey: z.string(),
  briefHash: z.string(),
  contentHash: z.string(),
  notes: z.array(z.string()).default([]),
  error: z.string().nullable().optional()
});

export type GodGeneratedAssetRecord = z.infer<typeof godGeneratedAssetRecordSchema>;

export const godReviewUpdateSchema = z.object({
  approved: z.boolean(),
  sceneOnly: z.boolean().default(false),
  reuseEligible: z.boolean().default(true),
  promoteToCollection: z.boolean().default(true),
  overrideBenchmarkFailures: z.boolean().default(false),
  approvedBy: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export type GodReviewUpdate = z.infer<typeof godReviewUpdateSchema>;

export const godGenerateRequestSchema = godSceneContextSchema.extend({
  forceGeneration: z.boolean().default(false),
  requestVariation: z.boolean().default(false),
  variationOfAssetId: z.string().trim().optional()
});

export type GodGenerateRequest = z.infer<typeof godGenerateRequestSchema>;
