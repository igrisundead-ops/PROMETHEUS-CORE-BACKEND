import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import type {MotionAssetManifest} from "../types";
import {sha256Text} from "../hash";

import {createAssetEmbeddingProvider} from "./embedding";
import {buildCompactAssetEmbeddingText} from "./embedding-text";
import {discoverAssetFiles} from "./discovery";
import {loadAssetPipelineConfig, type AssetPipelineConfig} from "./config";
import {normalizeDiscoveredAsset} from "./normalization";
import {createMilvusAssetClient, ensureMilvusAssetCollection, upsertMilvusAssetDocuments} from "./milvus";
import {toMotionAssetManifest} from "./runtime-catalog";
import type {AssetIndexState, NormalizedAssetDocument} from "./types";

const formatDurationMs = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

const readJsonIfExists = async <T,>(filePath: string): Promise<T | null> => {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const extractLocalReferences = (content: string): string[] => {
  const refs = new Set<string>();
  const attributePattern = /(?:href|xlink:href|src)\s*=\s*["']([^"']+)["']/gi;
  const urlPattern = /url\((['"]?)([^'")]+)\1\)/gi;

  for (const match of content.matchAll(attributePattern)) {
    const ref = match[1]?.trim();
    if (ref && !/^(https?:|data:|#|javascript:)/i.test(ref)) {
      refs.add(ref);
    }
  }

  for (const match of content.matchAll(urlPattern)) {
    const ref = match[2]?.trim();
    if (ref && !/^(https?:|data:|#|javascript:)/i.test(ref)) {
      refs.add(ref);
    }
  }

  return [...refs];
};

const ensurePublishedAsset = async ({
  document,
  config
}: {
  document: NormalizedAssetDocument;
  config: AssetPipelineConfig;
}): Promise<void> => {
  if (document.public_path.startsWith("/") && document.absolute_path.replace(/\\/g, "/").includes("/public/")) {
    return;
  }

  const targetPath = path.join(process.cwd(), document.public_path.replace(/^\//, ""));
  await mkdir(path.dirname(targetPath), {recursive: true});
  await copyFile(document.absolute_path, targetPath);

  if (document.file_extension !== ".html") {
    return;
  }

  try {
    const content = await readFile(document.absolute_path, "utf-8");
    const dependencies = extractLocalReferences(content);
    for (const dependency of dependencies) {
      const sourceDependencyPath = path.resolve(path.dirname(document.absolute_path), dependency);
      const targetDependencyPath = path.resolve(path.dirname(targetPath), dependency);
      await mkdir(path.dirname(targetDependencyPath), {recursive: true});
      await copyFile(sourceDependencyPath, targetDependencyPath).catch(() => undefined);
    }
  } catch {
    // HTML dependency copying is best-effort only.
  }
};

const buildRuntimeCatalog = (documents: NormalizedAssetDocument[]): MotionAssetManifest[] => {
  const seen = new Set<string>();
  return documents
    .map(toMotionAssetManifest)
    .filter((asset) => {
      if (seen.has(asset.id)) {
        return false;
      }
      seen.add(asset.id);
      return true;
    });
};

const withStableAssetId = (document: NormalizedAssetDocument, assetId: string): NormalizedAssetDocument => {
  const originalAssetId = document.asset_id;
  const publicPath = document.public_path.startsWith(`/retrieval-assets/${originalAssetId}/`)
    ? document.public_path.replace(`/retrieval-assets/${originalAssetId}/`, `/retrieval-assets/${assetId}/`)
    : document.public_path;

  return {
    ...document,
    asset_id: assetId,
    public_path: publicPath,
    embedding_text: document.embedding_text_mode === "compact"
      ? buildCompactAssetEmbeddingText({
        ...document,
        asset_id: assetId,
        public_path: publicPath
      })
      : document.embedding_text,
    content_hash: sha256Text(JSON.stringify({
      assetId,
      absolutePath: document.absolute_path,
      modifiedTimeMs: document.modified_time_ms,
      fileSizeBytes: document.file_size_bytes,
      retrievalCaption: document.retrieval_caption,
      semanticDescription: document.semantic_description,
      labels: document.labels,
      tags: document.tags,
      contexts: document.contexts,
      antiContexts: document.anti_contexts,
      constraints: document.constraints,
      publicPath,
      motionIntensity: document.motion_intensity,
      dominantRole: document.dominant_visual_role,
      durationClass: document.duration_class,
      embeddingTextMode: document.embedding_text_mode,
      embeddingText: document.embedding_text_mode === "compact"
        ? buildCompactAssetEmbeddingText({
          ...document,
          asset_id: assetId,
          public_path: publicPath
        })
        : document.embedding_text,
      metadataVersion: document.metadata_version
    }))
  };
};

const ensureUniqueAssetIds = (documents: NormalizedAssetDocument[]): {
  documents: NormalizedAssetDocument[];
  duplicateIds: string[];
} => {
  const counts = new Map<string, number>();
  const duplicateIds = new Set<string>();

  return {
    documents: documents.map((document) => {
      const seen = counts.get(document.asset_id) ?? 0;
      counts.set(document.asset_id, seen + 1);
      if (seen === 0) {
        return document;
      }

      duplicateIds.add(document.asset_id);
      const suffix = sha256Text(document.absolute_path).slice(0, 8);
      return withStableAssetId(document, `${document.asset_id}-${suffix}`);
    }),
    duplicateIds: [...duplicateIds].sort((left, right) => left.localeCompare(right))
  };
};

export const scanUnifiedAssets = async (config: AssetPipelineConfig = loadAssetPipelineConfig()): Promise<{
  documents: NormalizedAssetDocument[];
  runtimeCatalog: MotionAssetManifest[];
  stats: {
    discoveredCount: number;
    staticCount: number;
    motionCount: number;
    mappingBackedCount: number;
    orphanedCount: number;
    duplicateIdCount: number;
  };
  warnings: string[];
}> => {
  const discovered = await discoverAssetFiles(config);
  const normalizedDocuments = discovered.map((record) => normalizeDiscoveredAsset(record, config.ASSET_EMBEDDING_TEXT_MODE));
  const deduped = ensureUniqueAssetIds(normalizedDocuments);
  const documents = deduped.documents;

  for (const document of documents) {
    await ensurePublishedAsset({document, config});
  }

  const runtimeCatalog = buildRuntimeCatalog(documents);
  const staticCount = documents.filter((document) => !document.extension_is_animated).length;
  const motionCount = documents.length - staticCount;
  const mappingBackedCount = documents.filter((document) => document.source_mapping_reference.length > 0).length;
  const orphanedCount = documents.length - mappingBackedCount;
  const warnings = [
    ...(deduped.duplicateIds.length > 0
      ? [`Resolved duplicate asset ids: ${deduped.duplicateIds.slice(0, 12).join(", ")}${deduped.duplicateIds.length > 12 ? "..." : ""}`]
      : []),
    ...(orphanedCount > 0
      ? [`${orphanedCount} assets have no Claude/catalog metadata and were indexed from filesystem semantics only.`]
      : [])
  ];

  await writeJson(config.ASSET_SCAN_SNAPSHOT_PATH, documents);
  await writeJson(config.ASSET_RUNTIME_CATALOG_PATH, runtimeCatalog);

  return {
    documents,
    runtimeCatalog,
    stats: {
      discoveredCount: discovered.length,
      staticCount,
      motionCount,
      mappingBackedCount,
      orphanedCount,
      duplicateIdCount: deduped.duplicateIds.length
    },
    warnings
  };
};

export const indexUnifiedAssets = async ({
  config = loadAssetPipelineConfig(),
  forceFull = false
}: {
  config?: AssetPipelineConfig;
  forceFull?: boolean;
} = {}): Promise<{
  embeddedCount: number;
  insertedCount: number;
  documentCount: number;
  runtimeCatalogCount: number;
  skippedCount: number;
  warnings: string[];
}> => {
  const indexStartedAt = Date.now();
  console.log(`[assets:index] Scanning unified asset catalog...`);
  const {documents, runtimeCatalog, warnings} = await scanUnifiedAssets(config);
  console.log(
    `[assets:index] Scan complete: ${documents.length} documents, ${runtimeCatalog.length} runtime assets in ${formatDurationMs(Date.now() - indexStartedAt)}.`
  );
  const provider = createAssetEmbeddingProvider(config);
  console.log(
    `[assets:index] Embedding provider: ${provider.provider} (${provider.model}, ${provider.dimensions} dims). textMode=${config.ASSET_EMBEDDING_TEXT_MODE}.`
  );
  const previousState = (await readJsonIfExists<AssetIndexState>(config.ASSET_INDEX_STATE_PATH)) ?? {
    version: "unified-assets-v1",
    provider: provider.provider,
    model: provider.model,
    dimensions: provider.dimensions,
    records: []
  };
  const providerChanged = previousState.provider !== provider.provider ||
    previousState.model !== provider.model ||
    previousState.dimensions !== provider.dimensions;
  if (providerChanged) {
    console.log(
      `[assets:index] Provider mismatch detected. Previous=${previousState.provider}/${previousState.model}/${previousState.dimensions} ` +
      `Current=${provider.provider}/${provider.model}/${provider.dimensions}. Forcing full re-embed.`
    );
  }
  const previousMap = new Map(previousState.records.map((record) => [record.asset_id, record]));
  const documentsToEmbed = forceFull || config.ASSET_REINDEX_MODE === "full" || providerChanged
    ? documents
    : documents.filter((document) => previousMap.get(document.asset_id)?.content_hash !== document.content_hash);
  const batchSize = config.ASSET_EMBEDDING_BATCH_SIZE;
  const embeddings = new Map<string, number[]>();

  console.log(
    `[assets:index] ${documentsToEmbed.length} documents queued for embedding (${Math.max(0, documents.length - documentsToEmbed.length)} unchanged skipped candidates). ` +
    `batchSize=${batchSize} milvus=${config.ASSET_MILVUS_ENABLED} provider=${provider.provider} model=${provider.model}.`
  );

  try {
    for (let index = 0; index < documentsToEmbed.length; index += batchSize) {
      const batch = documentsToEmbed.slice(index, index + batchSize);
      const batchNumber = Math.floor(index / batchSize) + 1;
      const batchCount = Math.max(1, Math.ceil(documentsToEmbed.length / batchSize));
      const batchStartedAt = Date.now();
      console.log(
        `[assets:index] Embedding batch ${batchNumber}/${batchCount} (${batch.length} assets, ${Math.min(index + batch.length, documentsToEmbed.length)}/${documentsToEmbed.length} total)...`
      );
      const batchVectors = await provider.embedTexts(batch.map((document) => document.embedding_text));
      batch.forEach((document, offset) => {
        embeddings.set(document.asset_id, batchVectors[offset]);
      });
      console.log(
        `[assets:index] Batch ${batchNumber}/${batchCount} complete in ${formatDurationMs(Date.now() - batchStartedAt)}.`
      );
    }

    if (config.ASSET_MILVUS_ENABLED) {
      const client = createMilvusAssetClient(config);
      console.log(`[assets:index] Preparing Milvus collection ${config.MILVUS_COLLECTION_ASSETS}...`);
      await ensureMilvusAssetCollection({
        client,
        config,
        reset: forceFull || config.ASSET_REINDEX_MODE === "full"
      });
      console.log(
        `[assets:index] Milvus collection ready. Upserting ${documentsToEmbed.length} embedded documents...`
      );
      const milvusStartedAt = Date.now();
      await upsertMilvusAssetDocuments({
        client,
        config,
        documents: documentsToEmbed,
        embeddings: documentsToEmbed.map((document) => embeddings.get(document.asset_id) ?? [])
      });
      console.log(`[assets:index] Milvus upsert complete in ${formatDurationMs(Date.now() - milvusStartedAt)}.`);
    }
  } finally {
    await provider.dispose?.();
  }

  const records = documents.map((document) => ({
    asset_id: document.asset_id,
    content_hash: document.content_hash,
    embedding_hash: `${provider.provider}:${provider.model}:${document.content_hash}`,
    indexed_at: new Date().toISOString()
  }));
  await writeJson(config.ASSET_INDEX_STATE_PATH, {
    version: "unified-assets-v1",
    provider: provider.provider,
    model: provider.model,
    dimensions: provider.dimensions,
    records
  } satisfies AssetIndexState);

  console.log(
    `[assets:index] Finished in ${formatDurationMs(Date.now() - indexStartedAt)}.`
  );

  return {
    embeddedCount: documentsToEmbed.length,
    insertedCount: config.ASSET_MILVUS_ENABLED ? documentsToEmbed.length : 0,
    documentCount: documents.length,
    runtimeCatalogCount: runtimeCatalog.length,
    skippedCount: Math.max(0, documents.length - documentsToEmbed.length),
    warnings
  };
};
