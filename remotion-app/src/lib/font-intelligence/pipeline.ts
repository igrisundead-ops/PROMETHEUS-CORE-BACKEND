import {mkdir, readdir} from "node:fs/promises";

import {buildDescriptorHash, buildFontDescriptorText, buildFontHeuristicProfile, determineMetadataConfidence, needsManualLicenseReview} from "./descriptor";
import {descriptorsFromManifest, embedFontDescriptors} from "./embedding";
import {buildFontCompatibilityGraph} from "./graph";
import {readJsonlIfExists, writeJsonl} from "./jsonl";
import {loadObservedFontMetadata, resolveFontIdentity} from "./metadata";
import {createFontSpecimen} from "./specimens";
import type {FontPipelineConfig} from "./config";
import type {FontCompatibilityGraph, FontDescriptorRecord, FontEmbeddingRecord, FontIngestionReport, FontManifestRecord} from "./types";
import {readJsonIfExists, toIsoTimestamp, writeJson} from "./utils";
import {safeExtractFontZips} from "./zip";

const ensureWorkspaceDirs = async (config: FontPipelineConfig): Promise<void> => {
  await Promise.all([
    mkdir(config.paths.workspaceDir, {recursive: true}),
    mkdir(config.paths.rawZipsDir, {recursive: true}),
    mkdir(config.paths.extractedFontsDir, {recursive: true}),
    mkdir(config.paths.specimensDir, {recursive: true}),
    mkdir(config.paths.outputsDir, {recursive: true})
  ]);
};

const sortManifest = (fonts: FontManifestRecord[]): FontManifestRecord[] => {
  return [...fonts].sort((left, right) => {
    const familyCompare = (left.observed.familyName ?? left.familyId).localeCompare(right.observed.familyName ?? right.familyId);
    return familyCompare || left.fontId.localeCompare(right.fontId);
  });
};

export const ingestFonts = async (config: FontPipelineConfig): Promise<{
  manifest: FontManifestRecord[];
  descriptors: FontDescriptorRecord[];
  report: FontIngestionReport;
}> => {
  await ensureWorkspaceDirs(config);
  const extraction = await safeExtractFontZips({
    sourceZipDir: config.paths.sourceZipDir,
    extractedFontsDir: config.paths.extractedFontsDir
  });
  const observedRecords = await loadObservedFontMetadata({
    config,
    candidates: extraction.candidates
  });
  const duplicatesByHash = new Map<string, string[]>();
  for (const candidate of extraction.candidates.filter((entry) => entry.duplicateOfHash)) {
    const bucket = duplicatesByHash.get(candidate.contentHash) ?? [];
    bucket.push(candidate.sourceZipFilename);
    duplicatesByHash.set(candidate.contentHash, bucket);
  }

  const manifest: FontManifestRecord[] = [];
  const now = toIsoTimestamp();
  for (const record of observedRecords) {
    const inferred = buildFontHeuristicProfile(record.observed);
    const descriptor = buildFontDescriptorText({
      observed: record.observed,
      inferred
    });
    const ids = resolveFontIdentity({
      observed: record.observed,
      fileHash: record.fileHash
    });
    const duplicateSourceZips = [...new Set(duplicatesByHash.get(record.candidate.contentHash) ?? [])].sort((left, right) => left.localeCompare(right));
    const manifestRecord: FontManifestRecord = {
      fontId: ids.fontId,
      familyId: ids.familyId,
      fileHash: record.fileHash,
      contentHash: ids.contentHash,
      descriptorHash: buildDescriptorHash(descriptor),
      status: record.status,
      metadataConfidence: determineMetadataConfidence(record.observed, record.status),
      needsManualLicenseReview: needsManualLicenseReview(record.observed),
      canonicalSourceZip: record.candidate.sourceZipFilename,
      sourceZips: [record.candidate.sourceZipFilename, ...duplicateSourceZips],
      duplicateSourceZips,
      duplicateCount: duplicateSourceZips.length,
      observed: record.observed,
      inferred,
      descriptor,
      specimenPath: null,
      metadataWarnings: record.metadataWarnings,
      metadataErrors: record.metadataErrors,
      createdAt: now,
      updatedAt: now
    };
    manifestRecord.specimenPath = await createFontSpecimen({
      font: manifestRecord,
      specimensDir: config.paths.specimensDir
    });
    manifest.push(manifestRecord);
  }

  const sortedManifest = sortManifest(manifest);
  const descriptors = descriptorsFromManifest(sortedManifest);
  const report: FontIngestionReport = {
    ...extraction.report,
    successfulDescriptors: descriptors.length,
    specimenCount: sortedManifest.filter((font) => font.specimenPath !== null).length,
    generatedAt: toIsoTimestamp()
  };
  await writeJson(config.paths.fontManifestPath, sortedManifest);
  await writeJsonl(config.paths.fontDescriptorsPath, descriptors);
  await writeJson(config.paths.fontIngestionReportPath, report);
  return {
    manifest: sortedManifest,
    descriptors,
    report
  };
};

export const loadManifest = async (config: FontPipelineConfig): Promise<FontManifestRecord[]> => {
  return (await readJsonIfExists<FontManifestRecord[]>(config.paths.fontManifestPath)) ?? [];
};

export const loadDescriptors = async (config: FontPipelineConfig): Promise<FontDescriptorRecord[]> => {
  const existing = await readJsonlIfExists<FontDescriptorRecord>(config.paths.fontDescriptorsPath);
  if (existing.length > 0) {
    return existing;
  }
  return descriptorsFromManifest(await loadManifest(config));
};

export const buildFontEmbeddings = async (config: FontPipelineConfig): Promise<FontEmbeddingRecord[]> => {
  const descriptors = await loadDescriptors(config);
  return embedFontDescriptors({
    config,
    descriptors
  });
};

export const buildGraphArtifacts = async (config: FontPipelineConfig): Promise<FontCompatibilityGraph> => {
  const manifest = await loadManifest(config);
  const embeddings = await readJsonlIfExists<FontEmbeddingRecord>(config.paths.fontEmbeddingsPath);
  const graph = buildFontCompatibilityGraph({
    fonts: manifest,
    embeddings,
    topMatchesPerFont: config.FONT_INTELLIGENCE_TOP_MATCHES_PER_FONT
  });
  await writeJson(config.paths.fontCompatibilityGraphPath, graph);
  return graph;
};

export const runFontPipelineAll = async (config: FontPipelineConfig): Promise<{
  manifest: FontManifestRecord[];
  embeddings: FontEmbeddingRecord[];
  graph: FontCompatibilityGraph;
}> => {
  const {manifest} = await ingestFonts(config);
  const embeddings = await buildFontEmbeddings(config);
  const graph = await buildGraphArtifacts(config);
  return {
    manifest,
    embeddings,
    graph
  };
};

export const summarizeWorkspace = async (config: FontPipelineConfig): Promise<{zipCount: number}> => {
  const entries = await readdir(config.paths.sourceZipDir, {withFileTypes: true}).catch(() => []);
  return {
    zipCount: entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip")).length
  };
};
