import {createEmbeddingProvider, type EmbeddingProvider} from "../embeddings/provider";

import type {AssetPipelineConfig} from "./config";

export type AssetEmbeddingProvider = EmbeddingProvider;

export const createAssetEmbeddingProvider = (config: AssetPipelineConfig): AssetEmbeddingProvider => {
  return createEmbeddingProvider({
    provider: config.ASSET_EMBEDDING_PROVIDER,
    model: config.ASSET_EMBEDDING_MODEL,
    dimensions: config.ASSET_EMBEDDING_DIMENSIONS,
    apiKey: config.embeddingApiKey,
    baseUrl: config.OPENAI_BASE_URL,
    pythonBin: config.ASSET_EMBEDDING_PROVIDER === "bge-m3-local"
      ? config.BGE_M3_LOCAL_PYTHON_BIN
      : config.LOCAL_EMBEDDING_PYTHON_BIN,
    useFp16: config.ASSET_EMBEDDING_PROVIDER === "bge-m3-local"
      ? config.BGE_M3_LOCAL_USE_FP16
      : config.LOCAL_EMBEDDING_USE_FP16,
    localBatchSize: Math.max(1, Math.min(config.ASSET_EMBEDDING_BATCH_SIZE, 32))
  });
};
