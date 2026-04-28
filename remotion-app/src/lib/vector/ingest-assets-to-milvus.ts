import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {createEmbeddingClient} from "./embedding-client";
import {loadVectorConfig, type VectorConfig} from "./config";
import {isWeakEmbeddingText} from "./build-embedding-text";
import {
  normalizeGsapAnimationMetadata,
  normalizeMotionGraphicMetadata,
  normalizeReferenceMetadata,
  normalizeStaticImageMetadata,
  normalizeTypographyAssets
} from "./normalize-asset-metadata";
import {createMilvusCreativeClient, ensureCreativeAssetCollection, upsertCreativeAssetRecords} from "./milvus-client";
import {milvusIngestionReportSchema, type MilvusIngestionReport, type VectorAssetRecord} from "./schemas";

const readJson = async <T,>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
};

const writeReport = async (filePath: string, content: string): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, content, "utf-8");
};

const unique = <T,>(values: T[]): T[] => [...new Set(values)];

const toMarkdownReport = (report: MilvusIngestionReport): string => {
  const lines: string[] = [
    "# Milvus Ingestion Report",
    "",
    `- Total static assets indexed: ${report.totalStaticAssets}`,
    `- Total motion graphics indexed: ${report.totalMotionGraphics}`,
    `- Total GSAP modules indexed: ${report.totalGsapModules}`,
    `- Total typography assets indexed: ${report.totalTypographyAssets}`,
    `- Total reference assets indexed: ${report.totalReferenceAssets}`,
    `- Failed records: ${report.failedRecords.length}`,
    `- Weak vectorSearchText records: ${report.weakVectorSearchTextRecords.length}`,
    `- Duplicate IDs: ${report.duplicateIds.length}`,
    `- Missing required fields: ${report.missingRequiredFields.length}`,
    `- Collection status: ${report.collectionStatus}`,
    `- Index status: ${report.indexStatus}`,
    "",
    "## Partition Status",
    ...Object.entries(report.partitionStatus).map(([partition, status]) => `- ${partition}: ${status}`)
  ];

  if (report.failedRecords.length > 0) {
    lines.push("", "## Failed Records", ...report.failedRecords.map((entry) => `- ${entry.id}: ${entry.reason}`));
  }
  if (report.weakVectorSearchTextRecords.length > 0) {
    lines.push("", "## Weak Vector Text", ...report.weakVectorSearchTextRecords.map((entry) => `- ${entry.id}: ${entry.reason}`));
  }
  if (report.duplicateIds.length > 0) {
    lines.push("", "## Duplicate IDs", ...report.duplicateIds.map((entry) => `- ${entry}`));
  }
  if (report.missingRequiredFields.length > 0) {
    lines.push("", "## Missing Required Fields", ...report.missingRequiredFields.map((entry) => `- ${entry.id}: ${entry.reason}`));
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
};

const detectDuplicateIds = (records: VectorAssetRecord[]): string[] => {
  const counts = new Map<string, number>();
  records.forEach((record) => {
    counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort((left, right) => left.localeCompare(right));
};

const loadReferenceAssets = async (config: VectorConfig): Promise<VectorAssetRecord[]> => {
  if (!config.REFERENCE_SOURCE_ENABLED) {
    return [];
  }
  try {
    const references = await readJson<Array<Record<string, unknown>>>(config.REFERENCE_METADATA_PATH);
    return normalizeReferenceMetadata(references as Array<{
      id: string;
      canonicalLabel?: string;
      src?: string;
      remoteUrl?: string;
      searchTerms?: string[];
      themeTags?: string[];
      showcasePlacementHint?: string;
      family?: string;
      tier?: string;
      safeArea?: string;
    }>);
  } catch {
    return [];
  }
};

export const ingestAssetsToMilvus = async ({
  config = loadVectorConfig(),
  dryRun = false
}: {
  config?: VectorConfig;
  dryRun?: boolean;
} = {}): Promise<MilvusIngestionReport> => {
  const staticCatalog = await readJson<{assets: Array<Record<string, unknown>>}>(config.STATIC_IMAGE_METADATA_PATH);
  const motionCatalog = await readJson<{assets: Array<Record<string, unknown>>}>(config.MOTION_GRAPHICS_METADATA_PATH);
  const gsapCatalog = await readJson<{modules: Array<Record<string, unknown>>}>(config.GSAP_ANIMATION_METADATA_PATH);

  const records = [
    ...staticCatalog.assets.map((asset) => normalizeStaticImageMetadata(asset as never)),
    ...motionCatalog.assets.map((asset) => normalizeMotionGraphicMetadata(asset as never)),
    ...gsapCatalog.modules.map((asset) => normalizeGsapAnimationMetadata(asset as never)),
    ...(config.TYPOGRAPHY_SOURCE_ENABLED ? normalizeTypographyAssets() : []),
    ...(await loadReferenceAssets(config))
  ];
  const duplicateIds = detectDuplicateIds(records);
  const weakVectorSearchTextRecords = records
    .filter((record) => isWeakEmbeddingText(record.vectorSearchText))
    .map((record) => ({id: record.id, reason: "Embedding text is too sparse or too short for reliable retrieval."}));
  const missingRequiredFields = records
    .filter((record) => !record.assetId || !record.title || !record.vectorSearchText)
    .map((record) => ({id: record.id, reason: "Missing one of assetId, title, or vectorSearchText."}));

  if (!dryRun) {
    const embeddingClient = createEmbeddingClient(config);
    const vectors: number[][] = [];
    for (let index = 0; index < records.length; index += config.EMBEDDING_BATCH_SIZE) {
      const batch = records.slice(index, index + config.EMBEDDING_BATCH_SIZE);
      const batchVectors = await embeddingClient.embedTexts(batch.map((record) => record.vectorSearchText));
      vectors.push(...batchVectors);
    }
    const client = createMilvusCreativeClient(config);
    await ensureCreativeAssetCollection({client, config});
    await upsertCreativeAssetRecords({
      client,
      config,
      records,
      embeddings: vectors
    });
  }

  const report = milvusIngestionReportSchema.parse({
    totalRecords: records.length,
    totalStaticAssets: records.filter((record) => record.assetType === "static_image").length,
    totalMotionGraphics: records.filter((record) => record.assetType === "motion_graphic").length,
    totalGsapModules: records.filter((record) => record.assetType === "gsap_animation_logic").length,
    totalTypographyAssets: records.filter((record) => record.assetType === "typography").length,
    totalReferenceAssets: records.filter((record) => record.assetType === "reference").length,
    failedRecords: [],
    weakVectorSearchTextRecords,
    duplicateIds,
    missingRequiredFields,
    collectionStatus: dryRun ? "dry-run (not written to Milvus)" : "collection ready",
    partitionStatus: Object.fromEntries(unique(records.map((record) => record.partition)).map((partition) => [partition, dryRun ? "validated" : "indexed"])),
    indexStatus: dryRun ? "dry-run (index creation skipped)" : "HNSW cosine index ready"
  });

  await writeReport(config.VECTOR_REPORT_PATH, toMarkdownReport(report));
  return report;
};
