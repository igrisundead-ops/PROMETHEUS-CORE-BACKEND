import path from "node:path";

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
  EMBEDDING_PROVIDER: z.enum(["openai", "local-test"]).default("local-test"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(24),
  EMBEDDING_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
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

export const loadVectorConfig = (overrides?: Partial<NodeJS.ProcessEnv>): VectorConfig => {
  const parsed = configSchema.parse({
    ...process.env,
    ...overrides
  });
  const milvusToken = parsed.MILVUS_TOKEN || (
    parsed.MILVUS_USERNAME && parsed.MILVUS_PASSWORD
      ? `${parsed.MILVUS_USERNAME}:${parsed.MILVUS_PASSWORD}`
      : ""
  );

  return {
    ...parsed,
    milvusToken,
    embeddingApiKey: parsed.EMBEDDING_API_KEY || parsed.OPENAI_API_KEY
  };
};
