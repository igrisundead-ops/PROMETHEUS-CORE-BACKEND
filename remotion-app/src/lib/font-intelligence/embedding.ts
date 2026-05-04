import {createEmbeddingProvider} from "../embeddings/provider";

import type {FontPipelineConfig} from "./config";
import {readJsonlIfExists, writeJsonl} from "./jsonl";
import type {FontDescriptorRecord, FontEmbeddingRecord, FontManifestRecord} from "./types";

export const embedFontDescriptors = async ({
  config,
  descriptors
}: {
  config: FontPipelineConfig;
  descriptors: FontDescriptorRecord[];
}): Promise<FontEmbeddingRecord[]> => {
  const existing = await readJsonlIfExists<FontEmbeddingRecord>(config.paths.fontEmbeddingsPath);
  const existingById = new Map(existing.map((entry) => [entry.font_id, entry]));
  const reused: FontEmbeddingRecord[] = [];
  const toEmbed: FontDescriptorRecord[] = [];

  for (const descriptor of descriptors) {
    const previous = existingById.get(descriptor.fontId);
    if (
      previous &&
      previous.descriptor_hash === descriptor.descriptorHash &&
      previous.embedding_model === config.FONT_INTELLIGENCE_EMBEDDING_MODEL
    ) {
      reused.push(previous);
      continue;
    }
    toEmbed.push(descriptor);
  }

  if (toEmbed.length === 0) {
    const output = [...reused].sort((left, right) => left.font_id.localeCompare(right.font_id));
    await writeJsonl(config.paths.fontEmbeddingsPath, output);
    return output;
  }

  const provider = createEmbeddingProvider({
    provider: config.FONT_INTELLIGENCE_EMBEDDING_PROVIDER,
    model: config.FONT_INTELLIGENCE_EMBEDDING_MODEL,
    dimensions: config.FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS,
    apiKey: config.embeddingApiKey,
    baseUrl: config.OPENAI_BASE_URL,
    pythonBin: config.FONT_INTELLIGENCE_EMBEDDING_PROVIDER === "bge-m3-local"
      ? config.BGE_M3_LOCAL_PYTHON_BIN
      : config.LOCAL_EMBEDDING_PYTHON_BIN,
    useFp16: config.FONT_INTELLIGENCE_EMBEDDING_PROVIDER === "bge-m3-local"
      ? config.BGE_M3_LOCAL_USE_FP16
      : config.LOCAL_EMBEDDING_USE_FP16,
    localBatchSize: config.FONT_INTELLIGENCE_EMBEDDING_BATCH_SIZE
  });

  try {
    const freshEmbeddings: FontEmbeddingRecord[] = [];
    const batchSize = Math.max(1, Math.min(config.FONT_INTELLIGENCE_EMBEDDING_BATCH_SIZE, 16));
    for (let index = 0; index < toEmbed.length; index += batchSize) {
      const chunk = toEmbed.slice(index, index + batchSize);
      const vectors = await provider.embedTexts(chunk.map((entry) => entry.descriptor));
      freshEmbeddings.push(...chunk.map((entry, offset) => ({
        font_id: entry.fontId,
        family_id: entry.familyId,
        embedding_model: config.FONT_INTELLIGENCE_EMBEDDING_MODEL,
        embedding_provider: config.FONT_INTELLIGENCE_EMBEDDING_PROVIDER,
        embedding_dimensions: config.FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS,
        descriptor_hash: entry.descriptorHash,
        embedding: vectors[offset] ?? [],
        descriptor: entry.descriptor,
        metadata: entry.metadata
      })));
    }
    const output = [...reused, ...freshEmbeddings].sort((left, right) => left.font_id.localeCompare(right.font_id));
    await writeJsonl(config.paths.fontEmbeddingsPath, output);
    return output;
  } finally {
    await provider.dispose?.();
  }
};

export const descriptorsFromManifest = (fonts: FontManifestRecord[]): FontDescriptorRecord[] => {
  return fonts.map((font) => ({
    fontId: font.fontId,
    familyId: font.familyId,
    descriptorHash: font.descriptorHash,
    descriptor: font.descriptor,
    filePath: font.observed.extractedAbsolutePath,
    metadata: font
  }));
};
