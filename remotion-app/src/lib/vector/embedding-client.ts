import {sha256Text} from "../hash";

import type {VectorConfig} from "./config";

export type EmbeddingClient = {
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

const createLocalTestEmbeddingClient = (config: VectorConfig): EmbeddingClient => ({
  provider: "local-test",
  model: config.EMBEDDING_MODEL,
  dimensions: config.EMBEDDING_DIMENSIONS,
  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map((text) => buildDeterministicVector(text, config.EMBEDDING_DIMENSIONS));
  }
});

const createOpenAiEmbeddingClient = (config: VectorConfig): EmbeddingClient => ({
  provider: "openai",
  model: config.EMBEDDING_MODEL,
  dimensions: config.EMBEDDING_DIMENSIONS,
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!config.embeddingApiKey) {
      throw new Error("EMBEDDING_API_KEY or OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai.");
    }

    const response = await fetch(`${config.OPENAI_BASE_URL.replace(/\/+$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.embeddingApiKey}`
      },
      body: JSON.stringify({
        model: config.EMBEDDING_MODEL,
        input: texts,
        dimensions: config.EMBEDDING_DIMENSIONS
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Embedding request failed (${response.status} ${response.statusText}): ${body}`);
    }

    const payload = await response.json() as {data?: Array<{embedding?: number[]}>};
    const vectors = payload.data?.map((entry) => entry.embedding ?? []) ?? [];
    if (vectors.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, received ${vectors.length}.`);
    }

    return vectors;
  }
});

export const createEmbeddingClient = (config: VectorConfig): EmbeddingClient => {
  if (config.EMBEDDING_PROVIDER === "local-test") {
    return createLocalTestEmbeddingClient(config);
  }
  return createOpenAiEmbeddingClient(config);
};
