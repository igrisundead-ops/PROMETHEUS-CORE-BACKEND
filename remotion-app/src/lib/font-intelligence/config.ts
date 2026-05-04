import path from "node:path";

import {config as loadDotenv} from "dotenv";
import {z} from "zod";

import {resolveFontPipelinePaths} from "./paths";
import type {FontPipelinePaths} from "./types";

const configSchema = z.object({
  FONT_INTELLIGENCE_SOURCE_ZIP_DIR: z.string().default(path.join("..", "FONTS")),
  FONT_INTELLIGENCE_WORKSPACE_DIR: z.string().default(path.join("..", "font-intelligence")),
  FONT_INTELLIGENCE_EMBEDDING_PROVIDER: z.enum(["openai", "local-test", "local-hf", "bge-m3-local"]).default("local-hf"),
  FONT_INTELLIGENCE_EMBEDDING_MODEL: z.string().default("BAAI/bge-small-en-v1.5"),
  FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  FONT_INTELLIGENCE_EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(8),
  FONT_INTELLIGENCE_PYTHON_BIN: z.string().default("python"),
  FONT_INTELLIGENCE_METADATA_SCRIPT: z.string().default(path.join("scripts", "font_metadata_probe.py")),
  LOCAL_EMBEDDING_PYTHON_BIN: z.string().default("python"),
  LOCAL_EMBEDDING_USE_FP16: z.union([z.literal("true"), z.literal("false"), z.boolean()]).transform((value) => value === true || value === "true").default(false),
  LOCAL_EMBEDDING_MODEL_NAME: z.string().default("BAAI/bge-small-en-v1.5"),
  BGE_M3_LOCAL_PYTHON_BIN: z.string().default("python"),
  BGE_M3_LOCAL_MODEL_NAME: z.string().default("BAAI/bge-m3"),
  BGE_M3_LOCAL_USE_FP16: z.union([z.literal("true"), z.literal("false"), z.boolean()]).transform((value) => value === true || value === "true").default(false),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  ASSET_EMBEDDING_API_KEY: z.string().default(""),
  MILVUS_ADDRESS: z.string().default("127.0.0.1:19530"),
  MILVUS_TOKEN: z.string().default(""),
  MILVUS_DATABASE: z.string().default("default"),
  MILVUS_INDEX_TYPE: z.string().default("HNSW"),
  MILVUS_METRIC_TYPE: z.string().default("COSINE"),
  FONT_INTELLIGENCE_MILVUS_COLLECTION: z.string().default("prometheus_typography_fonts"),
  FONT_INTELLIGENCE_TOP_MATCHES_PER_FONT: z.coerce.number().int().positive().default(12)
});

let dotenvLoaded = false;

const loadDotenvFallbacks = (): void => {
  if (dotenvLoaded) {
    return;
  }

  dotenvLoaded = true;
  loadDotenv();
  loadDotenv({path: path.resolve(process.cwd(), ".env.local"), override: true});
  loadDotenv({path: path.resolve(process.cwd(), "..", ".env"), override: false});
  loadDotenv({path: path.resolve(process.cwd(), "..", ".env.local"), override: true});
};

const normalizeMilvusAddress = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }
  return trimmed.includes(":") ? trimmed : `${trimmed}:19530`;
};

export type FontPipelineConfig = z.infer<typeof configSchema> & {
  paths: FontPipelinePaths;
  embeddingApiKey: string;
};

export const loadFontPipelineConfig = (overrides?: Partial<NodeJS.ProcessEnv>): FontPipelineConfig => {
  loadDotenvFallbacks();
  const parsed = configSchema.parse({
    ...process.env,
    ...overrides
  });
  const paths = resolveFontPipelinePaths(parsed.FONT_INTELLIGENCE_WORKSPACE_DIR, parsed.FONT_INTELLIGENCE_SOURCE_ZIP_DIR);

  return {
    ...parsed,
    MILVUS_ADDRESS: normalizeMilvusAddress(parsed.MILVUS_ADDRESS),
    FONT_INTELLIGENCE_METADATA_SCRIPT: path.resolve(process.cwd(), parsed.FONT_INTELLIGENCE_METADATA_SCRIPT),
    paths,
    embeddingApiKey: parsed.ASSET_EMBEDDING_API_KEY || parsed.OPENAI_API_KEY
  };
};
