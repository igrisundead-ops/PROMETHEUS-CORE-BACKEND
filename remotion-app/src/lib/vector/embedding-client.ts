import {createEmbeddingProvider, type EmbeddingProvider} from "../embeddings/provider";

import type {VectorConfig} from "./config";

export type EmbeddingClient = EmbeddingProvider;

export const createEmbeddingClient = (config: VectorConfig): EmbeddingClient => {
  return createEmbeddingProvider({
    provider: config.EMBEDDING_PROVIDER,
    model: config.EMBEDDING_MODEL,
    dimensions: config.EMBEDDING_DIMENSIONS,
    apiKey: config.embeddingApiKey,
    baseUrl: config.OPENAI_BASE_URL,
    pythonBin: config.EMBEDDING_PROVIDER === "bge-m3-local"
      ? config.BGE_M3_LOCAL_PYTHON_BIN
      : config.LOCAL_EMBEDDING_PYTHON_BIN,
    useFp16: config.EMBEDDING_PROVIDER === "bge-m3-local"
      ? config.BGE_M3_LOCAL_USE_FP16
      : config.LOCAL_EMBEDDING_USE_FP16,
    localBatchSize: Math.max(1, Math.min(config.EMBEDDING_BATCH_SIZE, 32))
  });
};
