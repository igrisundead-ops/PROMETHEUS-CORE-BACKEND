import path from "node:path";

import {config as loadDotenv} from "dotenv";
import {z} from "zod";

import type {AssetEmbeddingTextMode} from "./types";

const DEFAULT_ASSET_ROOTS = [
  path.resolve(process.cwd(), "..", "STATIC ASSETS"),
  path.resolve(process.cwd(), "..", "STRUCTURED ANIMATION"),
  path.resolve(process.cwd(), "..", "GSAP STORIES"),
  path.resolve(process.cwd(), "..", "GSAP THREE JS ANIMATIONS"),
  path.resolve(process.cwd(), "..", "SVG animations"),
  path.resolve(process.cwd(), "public", "motion-assets"),
  path.resolve(process.cwd(), "public", "showcase-assets"),
  path.resolve(process.cwd(), "public", "showcase-source")
];

const configSchema = z.object({
  MILVUS_ADDRESS: z.string().default("127.0.0.1:19530"),
  MILVUS_TOKEN: z.string().default(""),
  MILVUS_DATABASE: z.string().default("default"),
  MILVUS_COLLECTION_ASSETS: z.string().default("unified_motion_graphics_assets"),
  MILVUS_INDEX_TYPE: z.string().default("HNSW"),
  MILVUS_METRIC_TYPE: z.string().default("COSINE"),
  ASSET_MILVUS_ENABLED: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ASSET_EMBEDDING_PROVIDER: z.enum(["openai", "local-test", "local-hf", "bge-m3-local"]).default("local-hf"),
  ASSET_EMBEDDING_MODEL: z.string().default("BAAI/bge-small-en-v1.5"),
  ASSET_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  ASSET_EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(8),
  ASSET_EMBEDDING_TEXT_MODE: z.enum(["compact", "full"]).default("compact"),
  ASSET_EMBEDDING_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  LOCAL_EMBEDDING_PYTHON_BIN: z.string().default("python"),
  LOCAL_EMBEDDING_MODEL_NAME: z.string().default("BAAI/bge-small-en-v1.5"),
  LOCAL_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  LOCAL_EMBEDDING_USE_FP16: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  BGE_M3_LOCAL_PYTHON_BIN: z.string().default("python"),
  BGE_M3_LOCAL_MODEL_NAME: z.string().default("BAAI/bge-m3"),
  BGE_M3_LOCAL_USE_FP16: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ASSET_REINDEX_MODE: z.enum(["incremental", "full"]).default("incremental"),
  ASSET_ROOT_DIRS: z.string().default(DEFAULT_ASSET_ROOTS.join("|")),
  ASSET_PUBLIC_CACHE_DIR: z.string().default(path.join(process.cwd(), "public", "retrieval-assets")),
  ASSET_SCAN_SNAPSHOT_PATH: z.string().default(path.join(process.cwd(), "src", "data", "unified-asset-documents.generated.json")),
  ASSET_RUNTIME_CATALOG_PATH: z.string().default(path.join(process.cwd(), "src", "data", "unified-motion-assets.generated.json")),
  ASSET_INDEX_STATE_PATH: z.string().default(path.join(process.cwd(), "src", "data", "unified-asset-index-state.generated.json")),
  ASSET_QUERY_LIMIT: z.coerce.number().int().positive().default(12)
});

export type AssetPipelineConfig = z.infer<typeof configSchema> & {
  assetRootDirs: string[];
  embeddingApiKey: string;
  ASSET_EMBEDDING_TEXT_MODE: AssetEmbeddingTextMode;
};

let dotenvLoaded = false;

const normalizeMilvusAddress = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  if (!trimmed.includes(":")) {
    return `${trimmed}:19530`;
  }

  return trimmed;
};

const loadDotenvFallbacks = (): void => {
  if (dotenvLoaded) {
    return;
  }

  dotenvLoaded = true;
  loadDotenv();
  loadDotenv({
    path: path.resolve(process.cwd(), "..", ".env")
  });
  loadDotenv({
    path: path.resolve(process.cwd(), ".env.local"),
    override: true
  });
  loadDotenv({
    path: path.resolve(process.cwd(), "..", ".env.local"),
    override: true
  });
};

const splitRootDirs = (value: string): string[] => {
  return value
    .split(/[|;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(process.cwd(), entry));
};

export const loadAssetPipelineConfig = (overrides?: Partial<NodeJS.ProcessEnv>): AssetPipelineConfig => {
  loadDotenvFallbacks();
  const parsed = configSchema.parse({
    ...process.env,
    ...overrides
  });
  const embeddingModel = parsed.ASSET_EMBEDDING_PROVIDER === "bge-m3-local"
    ? parsed.BGE_M3_LOCAL_MODEL_NAME
    : parsed.ASSET_EMBEDDING_PROVIDER === "local-hf"
      ? parsed.LOCAL_EMBEDDING_MODEL_NAME
      : parsed.ASSET_EMBEDDING_MODEL;
  const embeddingDimensions = parsed.ASSET_EMBEDDING_PROVIDER === "bge-m3-local"
    ? 1024
    : parsed.ASSET_EMBEDDING_PROVIDER === "local-hf"
      ? parsed.LOCAL_EMBEDDING_DIMENSIONS
      : parsed.ASSET_EMBEDDING_DIMENSIONS;

  return {
    ...parsed,
    MILVUS_ADDRESS: normalizeMilvusAddress(parsed.MILVUS_ADDRESS),
    ASSET_EMBEDDING_MODEL: embeddingModel,
    ASSET_EMBEDDING_DIMENSIONS: embeddingDimensions,
    assetRootDirs: splitRootDirs(parsed.ASSET_ROOT_DIRS),
    embeddingApiKey: parsed.ASSET_EMBEDDING_API_KEY || parsed.OPENAI_API_KEY
  };
};
