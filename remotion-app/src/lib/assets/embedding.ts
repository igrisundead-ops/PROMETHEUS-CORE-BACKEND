import {sha256Text} from "../hash";

import type {AssetPipelineConfig} from "./config";

export type AssetEmbeddingProvider = {
  provider: string;
  model: string;
  dimensions: number;
  embedTexts(texts: string[]): Promise<number[][]>;
};

const buildDeterministicVector = (text: string, dimensions: number): number[] => {
  const vector = new Array<number>(dimensions);
  for (let index = 0; index < dimensions; index += 1) {
    const digest = sha256Text(`${text}|${index}`);
    const sample = Number.parseInt(digest.slice(0, 8), 16);
    vector[index] = ((sample % 2000) / 1000) - 1;
  }
  return vector;
};

const createLocalTestProvider = (config: AssetPipelineConfig): AssetEmbeddingProvider => ({
  provider: "local-test",
  model: config.ASSET_EMBEDDING_MODEL,
  dimensions: config.ASSET_EMBEDDING_DIMENSIONS,
  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map((text) => buildDeterministicVector(text, config.ASSET_EMBEDDING_DIMENSIONS));
  }
});

const createOpenAiProvider = (config: AssetPipelineConfig): AssetEmbeddingProvider => ({
  provider: "openai",
  model: config.ASSET_EMBEDDING_MODEL,
  dimensions: config.ASSET_EMBEDDING_DIMENSIONS,
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!config.embeddingApiKey) {
      throw new Error("ASSET_EMBEDDING_API_KEY or OPENAI_API_KEY is required when ASSET_EMBEDDING_PROVIDER=openai.");
    }

    const response = await fetch(`${config.OPENAI_BASE_URL.replace(/\/+$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.embeddingApiKey}`
      },
      body: JSON.stringify({
        model: config.ASSET_EMBEDDING_MODEL,
        input: texts,
        dimensions: config.ASSET_EMBEDDING_DIMENSIONS
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI embeddings request failed (${response.status} ${response.statusText}): ${body}`);
    }

    const payload = await response.json() as {
      data?: Array<{embedding?: number[]}>;
    };
    const embeddings = payload.data?.map((entry) => entry.embedding ?? []) ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, received ${embeddings.length}.`);
    }

    return embeddings;
  }
});

export const createAssetEmbeddingProvider = (config: AssetPipelineConfig): AssetEmbeddingProvider => {
  if (config.ASSET_EMBEDDING_PROVIDER === "local-test") {
    return createLocalTestProvider(config);
  }

  return createOpenAiProvider(config);
};
