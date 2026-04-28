import {z} from "zod";

export const vectorAssetTypeSchema = z.enum([
  "static_image",
  "motion_graphic",
  "gsap_animation_logic",
  "typography",
  "reference"
]);

export type VectorAssetType = z.infer<typeof vectorAssetTypeSchema>;

export const vectorPartitionSchema = z.enum([
  "static_images",
  "motion_graphics",
  "gsap_animation_logic",
  "typography",
  "references"
]);

export type VectorPartition = z.infer<typeof vectorPartitionSchema>;

export const vectorRenderComplexitySchema = z.enum(["low", "medium", "high", "unknown"]);
export type VectorRenderComplexity = z.infer<typeof vectorRenderComplexitySchema>;

export const retrievalTraceEntrySchema = z.object({
  step: z.string(),
  summary: z.string(),
  data: z.record(z.string(), z.unknown()).default({})
});

export type RetrievalTraceEntry = z.infer<typeof retrievalTraceEntrySchema>;

export const retrievalTraceSchema = z.object({
  action: z.string(),
  requestCount: z.number().int().nonnegative().default(0),
  warnings: z.array(z.string()).default([]),
  entries: z.array(retrievalTraceEntrySchema).default([]),
  approvedCandidateIds: z.array(z.string()).default([]),
  rejectedCandidateIds: z.array(z.string()).default([])
});

export type RetrievalTrace = z.infer<typeof retrievalTraceSchema>;

export const vectorAssetRecordSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  assetType: vectorAssetTypeSchema,
  partition: vectorPartitionSchema,
  sourceLibrary: z.string(),
  title: z.string(),
  relativePath: z.string().default(""),
  absolutePath: z.string().default(""),
  publicPath: z.string().default(""),
  vectorSearchText: z.string(),
  literalTags: z.array(z.string()).default([]),
  semanticTags: z.array(z.string()).default([]),
  rhetoricalRoles: z.array(z.string()).default([]),
  emotionalRoles: z.array(z.string()).default([]),
  motionTags: z.array(z.string()).default([]),
  styleFamily: z.array(z.string()).default([]),
  creatorFit: z.array(z.string()).default([]),
  sceneUseCases: z.array(z.string()).default([]),
  symbolicMeaning: z.array(z.string()).default([]),
  compatibility: z.array(z.string()).default([]),
  negativeGrammar: z.array(z.string()).default([]),
  renderComplexity: vectorRenderComplexitySchema.default("unknown"),
  visualEnergy: z.string().default("unknown"),
  supportedAspectRatios: z.array(z.string()).default([]),
  replaceableSlots: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  metadataJson: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type VectorAssetRecord = z.infer<typeof vectorAssetRecordSchema>;

export const vectorSearchFiltersSchema = z.object({
  assetTypes: z.array(vectorAssetTypeSchema).default([]),
  sourceLibraries: z.array(z.string()).default([]),
  rhetoricalRoles: z.array(z.string()).default([]),
  emotionalRoles: z.array(z.string()).default([]),
  motionTags: z.array(z.string()).default([]),
  styleFamily: z.array(z.string()).default([]),
  creatorFit: z.array(z.string()).default([]),
  sceneUseCases: z.array(z.string()).default([]),
  compatibility: z.array(z.string()).default([]),
  negativeGrammar: z.array(z.string()).default([]),
  forbiddenTags: z.array(z.string()).default([]),
  supportedAspectRatio: z.string().nullable().default(null),
  renderComplexityMax: z.enum(["low", "medium", "high"]).nullable().default(null),
  matteRelatedOnly: z.boolean().default(false),
  inspirationOnly: z.boolean().default(false)
});

const defaultVectorSearchFilters: {
  assetTypes: VectorAssetType[];
  sourceLibraries: string[];
  rhetoricalRoles: string[];
  emotionalRoles: string[];
  motionTags: string[];
  styleFamily: string[];
  creatorFit: string[];
  sceneUseCases: string[];
  compatibility: string[];
  negativeGrammar: string[];
  forbiddenTags: string[];
  supportedAspectRatio: string | null;
  renderComplexityMax: "low" | "medium" | "high" | null;
  matteRelatedOnly: boolean;
  inspirationOnly: boolean;
} = {
  assetTypes: [],
  sourceLibraries: [],
  rhetoricalRoles: [],
  emotionalRoles: [],
  motionTags: [],
  styleFamily: [],
  creatorFit: [],
  sceneUseCases: [],
  compatibility: [],
  negativeGrammar: [],
  forbiddenTags: [],
  supportedAspectRatio: null,
  renderComplexityMax: null,
  matteRelatedOnly: false,
  inspirationOnly: false
};

export type VectorSearchFilters = z.infer<typeof vectorSearchFiltersSchema>;

export const vectorSearchRequestSchema = z.object({
  requestId: z.string(),
  action: z.string(),
  partitions: z.array(vectorPartitionSchema).default([]),
  queryText: z.string().min(1),
  topK: z.number().int().positive().max(48).default(12),
  overfetchMultiplier: z.number().int().positive().max(12).default(4),
  filters: vectorSearchFiltersSchema.default(() => ({...defaultVectorSearchFilters})),
  context: z.record(z.string(), z.unknown()).default({})
});

export type VectorSearchRequest = z.infer<typeof vectorSearchRequestSchema>;

export const vectorSearchHitSchema = vectorAssetRecordSchema.extend({
  vectorScore: z.number().min(0).max(1),
  backendScore: z.number().default(0)
});

export type VectorSearchHit = z.infer<typeof vectorSearchHitSchema>;

export const vectorSearchResponseSchema = z.object({
  requestId: z.string(),
  backend: z.enum(["milvus"]),
  collection: z.string(),
  partitions: z.array(vectorPartitionSchema).default([]),
  totalCandidates: z.number().int().nonnegative(),
  warnings: z.array(z.string()).default([]),
  results: z.array(vectorSearchHitSchema).default([])
});

export type VectorSearchResponse = z.infer<typeof vectorSearchResponseSchema>;

export const rankedAssetCandidateSchema = vectorSearchHitSchema.extend({
  judgmentScore: z.number().min(0).max(1),
  finalScore: z.number().min(0).max(1),
  selected: z.boolean().default(false),
  inspirationOnly: z.boolean().default(false),
  rejectionReasons: z.array(z.string()).default([]),
  rankingRationale: z.array(z.string()).default([])
});

export type RankedAssetCandidate = z.infer<typeof rankedAssetCandidateSchema>;

export const retrievalEnforcementSummarySchema = z.object({
  action: z.string(),
  requestedPartitions: z.array(vectorPartitionSchema).default([]),
  searchedPartitions: z.array(vectorPartitionSchema).default([]),
  blockedPartitions: z.array(vectorPartitionSchema).default([]),
  approvedCandidateCount: z.number().int().nonnegative().default(0),
  rejectedCandidateCount: z.number().int().nonnegative().default(0),
  inspirationOnlyCount: z.number().int().nonnegative().default(0),
  bypassPrevented: z.boolean().default(false),
  notes: z.array(z.string()).default([])
});

export type RetrievalEnforcementSummary = z.infer<typeof retrievalEnforcementSummarySchema>;

export const ingestionIssueSchema = z.object({
  id: z.string(),
  reason: z.string()
});

export type IngestionIssue = z.infer<typeof ingestionIssueSchema>;

export const milvusIngestionReportSchema = z.object({
  totalRecords: z.number().int().nonnegative(),
  totalStaticAssets: z.number().int().nonnegative(),
  totalMotionGraphics: z.number().int().nonnegative(),
  totalGsapModules: z.number().int().nonnegative(),
  totalTypographyAssets: z.number().int().nonnegative(),
  totalReferenceAssets: z.number().int().nonnegative(),
  failedRecords: z.array(ingestionIssueSchema).default([]),
  weakVectorSearchTextRecords: z.array(ingestionIssueSchema).default([]),
  duplicateIds: z.array(z.string()).default([]),
  missingRequiredFields: z.array(ingestionIssueSchema).default([]),
  collectionStatus: z.string(),
  partitionStatus: z.record(z.string(), z.string()).default({}),
  indexStatus: z.string()
});

export type MilvusIngestionReport = z.infer<typeof milvusIngestionReportSchema>;
