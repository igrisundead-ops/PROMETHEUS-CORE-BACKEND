import path from "node:path";

import {config as loadDotenv} from "dotenv";
import {z} from "zod";

const DEFAULT_METADATA_ROOT = path.resolve(process.cwd(), "..", "static, motion, gsap MANHUNTER");

const boolStringSchema = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((value) => value === true || value === "true");

const configSchema = z.object({
  MILVUS_ADDRESS: z.string().default("127.0.0.1:19530"),
  MILVUS_USERNAME: z.string().default(""),
  MILVUS_PASSWORD: z.string().default(""),
  MILVUS_TOKEN: z.string().default(""),
  MILVUS_DATABASE: z.string().default("default"),
  MILVUS_COLLECTION: z.string().default("prometheus_creative_assets"),
  EMBEDDING_PROVIDER: z.enum(["openai", "local-test", "local-hf", "bge-m3-local"]).default("local-hf"),
  EMBEDDING_MODEL: z.string().default("BAAI/bge-small-en-v1.5"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(24),
  EMBEDDING_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  LOCAL_EMBEDDING_PYTHON_BIN: z.string().default("python"),
  LOCAL_EMBEDDING_MODEL_NAME: z.string().default("BAAI/bge-small-en-v1.5"),
  LOCAL_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  LOCAL_EMBEDDING_USE_FP16: boolStringSchema.default(false),
  BGE_M3_LOCAL_PYTHON_BIN: z.string().default("python"),
  BGE_M3_LOCAL_MODEL_NAME: z.string().default("BAAI/bge-m3"),
  BGE_M3_LOCAL_USE_FP16: boolStringSchema.default(false),
  STATIC_IMAGE_METADATA_PATH: z.string().default(path.join(DEFAULT_METADATA_ROOT, "PROMETHEUS_ASSET_METADATA_v2.json")),
  MOTION_GRAPHICS_METADATA_PATH: z.string().default(path.join(DEFAULT_METADATA_ROOT, "MOTION_GRAPHICS_METADATA.json")),
  GSAP_ANIMATION_METADATA_PATH: z.string().default(path.join(DEFAULT_METADATA_ROOT, "gsap-animation-metadata.json")),
  GSAP_MODULES_ROOT: z.string().default(path.join(DEFAULT_METADATA_ROOT, "GSAP_REPO")),
  REFERENCE_METADATA_PATH: z.string().default(path.join(process.cwd(), "src", "data", "showcase-assets.remote.json")),
  TYPOGRAPHY_SOURCE_ENABLED: boolStringSchema.default(true),
  REFERENCE_SOURCE_ENABLED: boolStringSchema.default(true),
  VECTOR_REPORT_PATH: z.string().default(path.join(process.cwd(), "MILVUS_INGESTION_REPORT.md"))
});

export type VectorConfig = z.infer<typeof configSchema> & {
  milvusToken: string;
  embeddingApiKey: string;
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

export const loadVectorConfig = (overrides?: Partial<NodeJS.ProcessEnv>): VectorConfig => {
  loadDotenvFallbacks();
  const parsed = configSchema.parse({
    ...process.env,
    ...overrides
  });
  const embeddingModel = parsed.EMBEDDING_PROVIDER === "bge-m3-local"
    ? parsed.BGE_M3_LOCAL_MODEL_NAME
    : parsed.EMBEDDING_PROVIDER === "local-hf"
      ? parsed.LOCAL_EMBEDDING_MODEL_NAME
      : parsed.EMBEDDING_MODEL;
  const embeddingDimensions = parsed.EMBEDDING_PROVIDER === "bge-m3-local"
    ? 1024
    : parsed.EMBEDDING_PROVIDER === "local-hf"
      ? parsed.LOCAL_EMBEDDING_DIMENSIONS
      : parsed.EMBEDDING_DIMENSIONS;
  const milvusToken = parsed.MILVUS_TOKEN || (
    parsed.MILVUS_USERNAME && parsed.MILVUS_PASSWORD
      ? `${parsed.MILVUS_USERNAME}:${parsed.MILVUS_PASSWORD}`
      : ""
  );

  return {
    ...parsed,
    MILVUS_ADDRESS: normalizeMilvusAddress(parsed.MILVUS_ADDRESS),
    EMBEDDING_MODEL: embeddingModel,
    EMBEDDING_DIMENSIONS: embeddingDimensions,
    milvusToken,
    embeddingApiKey: parsed.EMBEDDING_API_KEY || parsed.OPENAI_API_KEY
  };
};
