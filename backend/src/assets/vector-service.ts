import type {BackendEnv} from "../config";
import {
  createEmbeddingClient,
  createMilvusCreativeClient,
  loadVectorConfig,
  searchCreativeAssetRecords,
  vectorSearchRequestSchema,
  type EmbeddingClient,
  type VectorConfig,
  type VectorSearchResponse
} from "../../../remotion-app/src/lib/vector";

const toVectorOverrides = (env: BackendEnv): Partial<NodeJS.ProcessEnv> => ({
  MILVUS_ADDRESS: env.MILVUS_ADDRESS,
  MILVUS_USERNAME: env.MILVUS_USERNAME,
  MILVUS_PASSWORD: env.MILVUS_PASSWORD,
  MILVUS_TOKEN: env.MILVUS_TOKEN,
  MILVUS_DATABASE: env.MILVUS_DATABASE,
  MILVUS_COLLECTION: env.MILVUS_COLLECTION || env.MILVUS_COLLECTION_ASSETS,
  EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER || env.ASSET_EMBEDDING_PROVIDER,
  EMBEDDING_MODEL: env.EMBEDDING_MODEL || env.ASSET_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS: String(env.EMBEDDING_DIMENSIONS || env.ASSET_EMBEDDING_DIMENSIONS),
  EMBEDDING_API_KEY: env.EMBEDDING_API_KEY || env.ASSET_EMBEDDING_API_KEY,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  OPENAI_BASE_URL: env.OPENAI_BASE_URL,
  LOCAL_EMBEDDING_PYTHON_BIN: env.LOCAL_EMBEDDING_PYTHON_BIN,
  LOCAL_EMBEDDING_MODEL_NAME: env.LOCAL_EMBEDDING_MODEL_NAME,
  LOCAL_EMBEDDING_DIMENSIONS: String(env.LOCAL_EMBEDDING_DIMENSIONS),
  LOCAL_EMBEDDING_USE_FP16: String(env.LOCAL_EMBEDDING_USE_FP16),
  BGE_M3_LOCAL_PYTHON_BIN: env.BGE_M3_LOCAL_PYTHON_BIN,
  BGE_M3_LOCAL_MODEL_NAME: env.BGE_M3_LOCAL_MODEL_NAME,
  BGE_M3_LOCAL_USE_FP16: String(env.BGE_M3_LOCAL_USE_FP16)
});

export class VectorRetrievalService {
  private readonly config: VectorConfig;
  private readonly enabled: boolean;
  private readonly embeddingClient: EmbeddingClient;

  constructor(env: BackendEnv) {
    this.enabled = env.ASSET_MILVUS_ENABLED;
    this.config = loadVectorConfig(toVectorOverrides(env));
    this.embeddingClient = createEmbeddingClient(this.config);
    console.log(
      `[vector:retrieve] Initialized provider=${this.config.EMBEDDING_PROVIDER} model=${this.config.EMBEDDING_MODEL} ` +
      `dims=${this.config.EMBEDDING_DIMENSIONS} collection=${this.config.MILVUS_COLLECTION}.`
    );
  }

  async retrieve(body: unknown): Promise<VectorSearchResponse> {
    if (!this.enabled) {
      throw new Error("ASSET_MILVUS_ENABLED=false");
    }

    const request = vectorSearchRequestSchema.parse(body);
    const [queryVector] = await this.embeddingClient.embedTexts([request.queryText]);
    const client = createMilvusCreativeClient(this.config);
    return searchCreativeAssetRecords({
      client,
      config: this.config,
      queryVector,
      request
    });
  }
}
