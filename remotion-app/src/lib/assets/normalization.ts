import path from "node:path";

import {sha256Text} from "../hash";

import {resolveMetadataMatches} from "./metadata-sources";
import type {AssetDiscoveryRecord, NormalizedAssetDocument} from "./types";
import {buildSearchTerms, inferMoodTags, motionLevelToTier, normalizeAssetText, slugifyAssetValue, uniqueStrings} from "./text-utils";

const ASSET_METADATA_VERSION = "unified-assets-v1";

const resolvePublicPath = (record: AssetDiscoveryRecord, assetId: string): string => {
  const normalizedAbsolutePath = record.absolutePath.replace(/\\/g, "/");
  const publicMarker = "/public/";
  const publicIndex = normalizedAbsolutePath.lastIndexOf(publicMarker);
  if (publicIndex >= 0) {
    return `/${normalizedAbsolutePath.slice(publicIndex + publicMarker.length)}`;
  }

  return `/retrieval-assets/${assetId}/${record.filename}`;
};

const resolveDurationClass = (record: AssetDiscoveryRecord): string => {
  if (!record.durationSeconds || !Number.isFinite(record.durationSeconds)) {
    return record.detectedAssetType === "static_image" ? "still" : "timeless";
  }
  if (record.durationSeconds <= 1.5) {
    return "micro";
  }
  if (record.durationSeconds <= 4) {
    return "short";
  }
  return "extended";
};

const resolveDominantRole = (record: AssetDiscoveryRecord, metadataDominantRole: string): string => {
  const pool = normalizeAssetText(`${metadataDominantRole} ${record.relativePath}`);
  if (/(background|texture|wallpaper)/.test(pool)) {
    return "background-support";
  }
  if (/(headline|quote|word|typography|text)/.test(pool)) {
    return "headline-support";
  }
  if (/(ring|circle|halo|focus|accent|underlay)/.test(pool)) {
    return "underlay-accent";
  }
  if (/(transition|sweep|burst)/.test(pool)) {
    return "transition-accent";
  }
  return metadataDominantRole || "scene-support";
};

const buildEmbeddingText = ({
  record,
  labels,
  tags,
  retrievalCaption,
  semanticDescription,
  animationFamily,
  subject,
  category,
  contexts,
  antiContexts,
  constraints,
  dominantRole,
  motionIntensity
}: {
  record: AssetDiscoveryRecord;
  labels: string[];
  tags: string[];
  retrievalCaption: string;
  semanticDescription: string;
  animationFamily: string;
  subject: string;
  category: string;
  contexts: string[];
  antiContexts: string[];
  constraints: string[];
  dominantRole: string;
  motionIntensity: string;
}): string => {
  const folderMeaning = uniqueStrings([
    record.rootLabel,
    ...record.parentFolders
  ]).join(" > ");

  return [
    `Asset type: ${record.detectedAssetType}.`,
    `Filename meaning: ${labels.join(", ")}.`,
    `Folder hierarchy: ${folderMeaning}.`,
    `Semantic description: ${semanticDescription}.`,
    `Retrieval caption: ${retrievalCaption}.`,
    `Animation family: ${animationFamily}.`,
    `Motion intensity: ${motionIntensity}.`,
    `Dominant role: ${dominantRole}.`,
    `Subject: ${subject}.`,
    `Category: ${category}.`,
    `Tags: ${tags.join(", ")}.`,
    contexts.length > 0 ? `Best contexts: ${contexts.join(", ")}.` : "",
    antiContexts.length > 0 ? `Avoid contexts: ${antiContexts.join(", ")}.` : "",
    constraints.length > 0 ? `Constraints: ${constraints.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
};

export const normalizeDiscoveredAsset = (record: AssetDiscoveryRecord): NormalizedAssetDocument => {
  const metadata = resolveMetadataMatches(record);
  const rawLabels = uniqueStrings([
    ...metadata.labels,
    record.folderName,
    record.filename.replace(record.fileExtension, "")
  ]);
  const labels = rawLabels.map((label) => normalizeAssetText(label)).filter(Boolean);
  const subject = normalizeAssetText(metadata.subject || record.folderName || record.filename) || record.folderName;
  const category = normalizeAssetText(metadata.category || record.detectedAssetType) || record.detectedAssetType;
  const dominantRole = resolveDominantRole(record, normalizeAssetText(metadata.dominantRole));
  const motionIntensity = motionLevelToTier([
    metadata.animationFamily,
    metadata.category,
    metadata.dominantRole,
    ...metadata.tags
  ].join(" "));
  const baseId = slugifyAssetValue([
    record.rootLabel,
    ...record.parentFolders,
    record.filename.replace(record.fileExtension, "")
  ].join(" "));
  const assetId = baseId || `asset-${sha256Text(record.absolutePath).slice(0, 12)}`;
  const tags = uniqueStrings([
    ...metadata.tags,
    ...labels,
    ...buildSearchTerms(record.filename, record.folderName)
  ]).map((tag) => normalizeAssetText(tag)).filter(Boolean);
  const contexts = metadata.contexts.map((entry) => normalizeAssetText(entry)).filter(Boolean);
  const antiContexts = metadata.antiContexts.map((entry) => normalizeAssetText(entry)).filter(Boolean);
  const constraints = metadata.constraints.map((entry) => normalizeAssetText(entry)).filter(Boolean);
  const retrievalCaption = metadata.retrievalCaption || `${labels[0] ?? record.filename} for ${dominantRole}.`;
  const semanticDescription = metadata.semanticDescription || `${category} asset from ${record.folderName}`;
  const mood = inferMoodTags([
    ...tags,
    metadata.animationFamily,
    dominantRole
  ]);
  const publicPath = resolvePublicPath(record, assetId);
  const durationClass = resolveDurationClass(record);
  const aspectRatio = record.aspectRatio ? String(record.aspectRatio) : record.width && record.height ? `${record.width}:${record.height}` : "";
  const embeddingText = buildEmbeddingText({
    record,
    labels,
    tags,
    retrievalCaption,
    semanticDescription,
    animationFamily: metadata.animationFamily,
    subject,
    category,
    contexts,
    antiContexts,
    constraints,
    dominantRole,
    motionIntensity
  });
  const contentHash = sha256Text(JSON.stringify({
    absolutePath: record.absolutePath,
    modifiedTimeMs: record.modifiedTimeMs,
    fileSizeBytes: record.fileSizeBytes,
    retrievalCaption,
    semanticDescription,
    labels,
    tags,
    contexts,
    antiContexts,
    constraints,
    publicPath,
    motionIntensity,
    dominantRole,
    durationClass
  }));

  return {
    asset_id: assetId,
    asset_type: record.detectedAssetType,
    source_library: record.sourceLibrary,
    absolute_path: record.absolutePath,
    relative_path: record.relativePath,
    public_path: publicPath,
    folder_name: record.folderName,
    filename: record.filename,
    file_extension: record.fileExtension,
    tags,
    labels,
    retrieval_caption: retrievalCaption,
    semantic_description: semanticDescription,
    animation_family: normalizeAssetText(metadata.animationFamily || record.detectedAssetType),
    motion_intensity: motionIntensity,
    mood,
    subject,
    category,
    contexts,
    anti_contexts: antiContexts,
    constraints,
    duration_class: durationClass,
    aspect_ratio: aspectRatio,
    dominant_visual_role: dominantRole,
    confidence: Math.max(0.38, Math.min(0.99, metadata.confidence || 0.56)),
    source_mapping_reference: metadata.sourceReferences,
    embedding_text: embeddingText,
    content_hash: contentHash,
    metadata_version: ASSET_METADATA_VERSION,
    file_size_bytes: record.fileSizeBytes,
    modified_time_ms: record.modifiedTimeMs,
    width: record.width ?? null,
    height: record.height ?? null,
    duration_seconds: record.durationSeconds ?? null,
    extension_is_animated: [".html", ".json", ".lottie", ".mp4", ".webm", ".mov"].includes(record.fileExtension)
  };
};
