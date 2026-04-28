import type {CreativeAsset} from "../../creative-orchestration/types";
import type {MotionAssetManifest, MotionTier} from "../types";

export type UnifiedAssetType =
  | "static_image"
  | "motion_graphic"
  | "animated_overlay"
  | "typography_effect"
  | "icon"
  | "background"
  | "accent"
  | "ui_card";

export type UnifiedAssetSourceLibrary =
  | "static-assets-root"
  | "structured-animation-root"
  | "gsap-stories-root"
  | "gsap-three-root"
  | "svg-animations-root"
  | "public-motion-assets"
  | "public-showcase-assets"
  | "public-showcase-source"
  | "workspace-assets-root";

export type AssetDiscoveryRecord = {
  absolutePath: string;
  relativePath: string;
  rootDir: string;
  rootLabel: string;
  sourceLibrary: UnifiedAssetSourceLibrary;
  folderName: string;
  parentFolders: string[];
  filename: string;
  fileExtension: string;
  fileSizeBytes: number;
  modifiedTimeMs: number;
  detectedAssetType: UnifiedAssetType;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  durationSeconds?: number | null;
};

export type NormalizedAssetDocument = {
  asset_id: string;
  asset_type: UnifiedAssetType;
  source_library: UnifiedAssetSourceLibrary;
  absolute_path: string;
  relative_path: string;
  public_path: string;
  folder_name: string;
  filename: string;
  file_extension: string;
  tags: string[];
  labels: string[];
  retrieval_caption: string;
  semantic_description: string;
  animation_family: string;
  motion_intensity: MotionTier;
  mood: string[];
  subject: string;
  category: string;
  contexts: string[];
  anti_contexts: string[];
  constraints: string[];
  duration_class: string;
  aspect_ratio: string;
  dominant_visual_role: string;
  confidence: number;
  source_mapping_reference: string[];
  embedding_text: string;
  content_hash: string;
  metadata_version: string;
  file_size_bytes: number;
  modified_time_ms: number;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  extension_is_animated: boolean;
};

export type AssetIndexStateRecord = {
  asset_id: string;
  content_hash: string;
  embedding_hash: string;
  indexed_at: string;
};

export type AssetIndexState = {
  version: string;
  provider: string;
  model: string;
  dimensions: number;
  records: AssetIndexStateRecord[];
};

export type AssetEmbeddingPayload = {
  asset_id: string;
  embedding: number[];
  dimensions: number;
};

export type AssetSearchRequest = {
  queryText: string;
  sceneIntent?: string;
  desiredAssetTypes?: UnifiedAssetType[];
  sourceLibraries?: UnifiedAssetSourceLibrary[];
  mood?: string[];
  contexts?: string[];
  antiContexts?: string[];
  constraints?: string[];
  motionLevel?: string;
  positionRole?: string;
  compositionHints?: string[];
  timeWindowStartMs?: number;
  timeWindowEndMs?: number;
  requireAnimated?: boolean;
  requireStatic?: boolean;
  limit?: number;
};

export type AssetSearchResult = {
  asset_id: string;
  score: number;
  vector_score: number;
  rerank_score: number;
  asset_type: UnifiedAssetType;
  path: string;
  public_path: string;
  tags: string[];
  labels: string[];
  retrieval_caption: string;
  semantic_description: string;
  why_it_matched: string;
  recommended_usage: string;
  confidence: number;
  motion_asset?: MotionAssetManifest;
  creative_asset?: CreativeAsset;
};

export type AssetSearchResponse = {
  backend: "milvus" | "snapshot";
  query: string;
  totalCandidates: number;
  results: AssetSearchResult[];
  warnings: string[];
};
