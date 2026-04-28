import type {BackendEnv} from "../config";
import {
  createEmbeddingClient,
  createMilvusCreativeClient,
  loadVectorConfig,
  searchCreativeAssetRecords,
  vectorSearchRequestSchema,
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
  OPENAI_BASE_URL: env.OPENAI_BASE_URL
});

export class VectorRetrievalService {
  private readonly config: VectorConfig;

  constructor(env: BackendEnv) {
    this.config = loadVectorConfig(toVectorOverrides(env));
  }

  async retrieve(body: unknown): Promise<VectorSearchResponse> {
    const request = vectorSearchRequestSchema.parse(body);
    const embeddingClient = createEmbeddingClient(this.config);
    const [queryVector] = await embeddingClient.embedTexts([request.queryText]);
    const client = createMilvusCreativeClient(this.config);
    return searchCreativeAssetRecords({
      client,
      config: this.config,
      queryVector,
      request
    });
  }
}
