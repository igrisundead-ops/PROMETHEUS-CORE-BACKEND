import type {BackendEnv} from "../config";

type EmbeddingClient = {
  embedTexts(texts: string[]): Promise<number[][]>;
};

type VectorSearchRequest = {
  queryText: string;
};

type VectorSearchResponse = Record<string, unknown>;

type VectorRuntime = {
  config: {
    EMBEDDING_PROVIDER: string;
    EMBEDDING_MODEL: string;
    EMBEDDING_DIMENSIONS: number;
    MILVUS_COLLECTION: string;
  };
  embeddingClient: EmbeddingClient;
  parseRequest: (body: unknown) => VectorSearchRequest;
  createClient: (config: unknown) => unknown;
  search: (input: {
    client: unknown;
    config: unknown;
    queryVector: number[];
    request: unknown;
  }) => Promise<VectorSearchResponse>;
};

const loadVectorModule = async (): Promise<any> =>
  Function("return import('../../../remotion-app/src/lib/vector')")() as Promise<any>;

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
  private readonly enabled: boolean;
  private runtimePromise: Promise<VectorRuntime> | null;
  private readonly env: BackendEnv;

  constructor(env: BackendEnv) {
    this.env = env;
    this.enabled = env.ASSET_MILVUS_ENABLED;
    this.runtimePromise = null;
  }

  private async getRuntime(): Promise<VectorRuntime> {
    if (this.runtimePromise) {
      return this.runtimePromise;
    }

    this.runtimePromise = (async () => {
      try {
        const vectorModule = await loadVectorModule();
        const config = vectorModule.loadVectorConfig(toVectorOverrides(this.env)) as VectorRuntime["config"];
        const embeddingClient = vectorModule.createEmbeddingClient(config) as EmbeddingClient;
        console.log(
          `[vector:retrieve] Initialized provider=${config.EMBEDDING_PROVIDER} model=${config.EMBEDDING_MODEL} ` +
          `dims=${config.EMBEDDING_DIMENSIONS} collection=${config.MILVUS_COLLECTION}.`
        );
        return {
          config,
          embeddingClient,
          parseRequest: (body: unknown) => vectorModule.vectorSearchRequestSchema.parse(body) as VectorSearchRequest,
          createClient: (runtimeConfig: unknown) => vectorModule.createMilvusCreativeClient(runtimeConfig),
          search: async ({client, config: runtimeConfig, queryVector, request}) =>
            vectorModule.searchCreativeAssetRecords({
              client,
              config: runtimeConfig,
              queryVector,
              request
            }) as Promise<VectorSearchResponse>
        };
      } catch (error) {
        this.runtimePromise = null;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          "Vector retrieval is unavailable because the shared remotion-app sources could not be loaded. " +
          `Deploy the repo root or include remotion-app alongside backend. Original error: ${message}`
        );
      }
    })();

    return this.runtimePromise;
  }

  async retrieve(body: unknown): Promise<VectorSearchResponse> {
    if (!this.enabled) {
      throw new Error("ASSET_MILVUS_ENABLED=false");
    }

    const runtime = await this.getRuntime();
    const request = runtime.parseRequest(body);
    const [queryVector] = await runtime.embeddingClient.embedTexts([request.queryText]);
    const client = runtime.createClient(runtime.config);
    return runtime.search({
      client,
      config: runtime.config,
      queryVector,
      request
    });
  }
}
