import path from "node:path";

import {config as loadDotenv} from "dotenv";
import {z} from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  STORAGE_DIR: z.string().default(path.join(process.cwd(), "data")),
  MAX_UPLOAD_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(500 * 1024 * 1024),
  CORS_ORIGINS: z
    .string()
    .default(
      "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3010,http://127.0.0.1:3010,http://localhost:3101,http://127.0.0.1:3101,http://localhost:4101,http://127.0.0.1:4101,http://localhost:5173,http://127.0.0.1:5173"
    ),
  ASSEMBLYAI_API_KEY: z.string().default(""),
  GROQ_API_KEY: z.string().default(""),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  GROQ_MAX_TOKENS: z.coerce.number().int().positive().default(1600),
  JOB_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  GOD_PROVIDER_KIND: z.string().default("local-template"),
  GOD_PROVIDER_ENDPOINT: z.string().default(""),
  GOD_PROVIDER_API_KEY: z.string().default(""),
  GOD_PROVIDER_MODEL: z.string().default(""),
  GOD_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  GOD_COLLECTION_DIR: z.string().default(path.join(process.cwd(), "..", "remotion-app", "public", "motion-assets", "god")),
  GOD_COLLECTION_MANIFEST_PATH: z.string().default(path.join(process.cwd(), "..", "remotion-app", "src", "data", "god-assets.generated.json")),
  GOD_REVIEW_DIR: z.string().default(path.join(process.cwd(), "data", "god")),
  GOD_MIN_TECHNICAL_SCORE: z.coerce.number().min(0).max(1).default(0.78),
  GOD_MIN_COMPOSITING_SCORE: z.coerce.number().min(0).max(1).default(0.82),
  GOD_MIN_AESTHETIC_SCORE: z.coerce.number().min(0).max(1).default(0.74),
  GOD_MIN_STYLE_SCORE: z.coerce.number().min(0).max(1).default(0.7),
  GOD_MIN_MOTION_SCORE: z.coerce.number().min(0).max(1).default(0.68),
  GOD_MIN_REUSE_SCORE: z.coerce.number().min(0).max(1).default(0.66),
  GOD_MIN_OVERALL_SCORE: z.coerce.number().min(0).max(1).default(0.75),
  GOD_MAX_BRIEF_SIMILARITY: z.coerce.number().min(0).max(1).default(0.88),
  GOD_AUTO_PROMOTE: z.string().default("false"),
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ENDPOINT: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_UPLOAD_BUCKET: z.string().default("prometheus-uploads"),
  R2_PUBLIC_UPLOADS_BASE: z.string().default(""),
  R2_UPLOAD_URL_EXPIRES_SECONDS: z.coerce.number().int().positive().default(600),
  ASSET_MILVUS_ENABLED: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  MILVUS_ADDRESS: z.string().default("127.0.0.1:19530"),
  MILVUS_USERNAME: z.string().default(""),
  MILVUS_PASSWORD: z.string().default(""),
  MILVUS_TOKEN: z.string().default(""),
  MILVUS_DATABASE: z.string().default("default"),
  MILVUS_COLLECTION: z.string().default("prometheus_creative_assets"),
  MILVUS_COLLECTION_ASSETS: z.string().default("unified_motion_graphics_assets"),
  EMBEDDING_PROVIDER: z.enum(["openai", "local-test"]).default("local-test"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  EMBEDDING_API_KEY: z.string().default(""),
  ASSET_EMBEDDING_PROVIDER: z.enum(["openai", "local-test"]).default("openai"),
  ASSET_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  ASSET_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  ASSET_EMBEDDING_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1")
});

export type BackendEnv = z.infer<typeof envSchema>;

let cachedEnv: BackendEnv | null = null;

const loadDotenvFallbacks = (): void => {
  loadDotenv();
  loadDotenv({
    path: path.resolve(process.cwd(), "..", ".env")
  });
  loadDotenv({
    path: path.resolve(process.cwd(), "..", "remotion-app", ".env")
  });
};

export const loadEnv = (overrides?: Partial<NodeJS.ProcessEnv>): BackendEnv => {
  if (!cachedEnv || overrides) {
    loadDotenvFallbacks();
    const mergedEnv = {
      ...process.env,
      ...overrides
    };
    cachedEnv = envSchema.parse(mergedEnv);
  }
  return cachedEnv;
};

export const clearCachedEnv = (): void => {
  cachedEnv = null;
};
