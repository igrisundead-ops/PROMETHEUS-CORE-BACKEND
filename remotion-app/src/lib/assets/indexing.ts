import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import type {MotionAssetManifest} from "../types";
import {sha256Text} from "../hash";

import {createAssetEmbeddingProvider} from "./embedding";
import {discoverAssetFiles} from "./discovery";
import {loadAssetPipelineConfig, type AssetPipelineConfig} from "./config";
import {normalizeDiscoveredAsset} from "./normalization";
import {createMilvusAssetClient, ensureMilvusAssetCollection, upsertMilvusAssetDocuments} from "./milvus";
import {toMotionAssetManifest} from "./runtime-catalog";
import type {AssetIndexState, NormalizedAssetDocument} from "./types";

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
      durationClass: document.duration_class
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
  const normalizedDocuments = discovered.map(normalizeDiscoveredAsset);
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
  const {documents, runtimeCatalog, warnings} = await scanUnifiedAssets(config);
  const provider = createAssetEmbeddingProvider(config);
  const previousState = (await readJsonIfExists<AssetIndexState>(config.ASSET_INDEX_STATE_PATH)) ?? {
    version: "unified-assets-v1",
    provider: provider.provider,
    model: provider.model,
    dimensions: provider.dimensions,
    records: []
  };
  const previousMap = new Map(previousState.records.map((record) => [record.asset_id, record]));
  const documentsToEmbed = forceFull || config.ASSET_REINDEX_MODE === "full"
    ? documents
    : documents.filter((document) => previousMap.get(document.asset_id)?.content_hash !== document.content_hash);
  const batchSize = config.ASSET_EMBEDDING_BATCH_SIZE;
  const embeddings = new Map<string, number[]>();

  for (let index = 0; index < documentsToEmbed.length; index += batchSize) {
    const batch = documentsToEmbed.slice(index, index + batchSize);
    const batchVectors = await provider.embedTexts(batch.map((document) => document.embedding_text));
    batch.forEach((document, offset) => {
      embeddings.set(document.asset_id, batchVectors[offset]);
    });
  }

  if (config.ASSET_MILVUS_ENABLED) {
    const client = createMilvusAssetClient(config);
    await ensureMilvusAssetCollection({
      client,
      config,
      reset: forceFull || config.ASSET_REINDEX_MODE === "full"
    });
    await upsertMilvusAssetDocuments({
      client,
      config,
      documents: documentsToEmbed,
      embeddings: documentsToEmbed.map((document) => embeddings.get(document.asset_id) ?? [])
    });
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

  return {
    embeddedCount: documentsToEmbed.length,
    insertedCount: config.ASSET_MILVUS_ENABLED ? documentsToEmbed.length : 0,
    documentCount: documents.length,
    runtimeCatalogCount: runtimeCatalog.length,
    skippedCount: Math.max(0, documents.length - documentsToEmbed.length),
    warnings
  };
};
