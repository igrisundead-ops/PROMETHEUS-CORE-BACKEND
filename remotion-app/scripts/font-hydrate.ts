import {createHash} from "node:crypto";
import {mkdir, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import path from "node:path";

import {unzipSync} from "fflate";

import {loadFontPipelineConfig, slugify, writeJson, type FontManifestRecord} from "../src/lib/font-intelligence";

type SupportedFontExtension = ".ttf" | ".otf" | ".woff" | ".woff2";
type FontFormat = "ttf" | "otf" | "woff" | "woff2";
type MatchedBy = "hash" | "zip-entry" | "relative-path" | "filename" | "unknown";

type SourceAsset = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: ".zip" | SupportedFontExtension;
};

type SourceCandidate = {
  kind: "zip-entry" | "file";
  sourcePath: string;
  sourceRelativePath: string;
  sourceFileName: string;
  sourceZipFilename: string | null;
  entryName: string | null;
  originalFileName: string;
  extension: SupportedFontExtension;
  format: FontFormat;
  contentHash: string;
  zipSlug: string | null;
  entryStemSlug: string;
};

type MatchResult = {
  candidate: SourceCandidate | null;
  matchedBy: MatchedBy | null;
  warnings: string[];
};

type HydrationSelection = {
  record: FontManifestRecord;
  match: MatchResult & {candidate: SourceCandidate; matchedBy: MatchedBy};
  score: number;
};

type RuntimeManifestRecord = {
  fontId: string;
  familyId: string;
  familyName: string;
  fileName: string;
  originalFileName: string | null;
  weight: number | null;
  style: string;
  format: FontFormat;
  publicUrl: string;
  localPublicPath: string;
  license: {
    licenseTexts: string[];
    canonicalSourceZip: string;
    sourceZips: string[];
    duplicateSourceZips: string[];
    duplicateCount: number;
  };
  needsManualLicenseReview: boolean;
  source: "hydrated-font-library";
  renderable: true;
  matchedBy: MatchedBy;
  warnings: string[];
};

type HydrationReport = {
  generatedAt: string;
  totalMetadataRecordsRead: number;
  sourceFilesFoundInFontsDir: number;
  sourceZipCount: number;
  sourceDirectFontFileCount: number;
  matchedMetadataRecords: number;
  fontsHydrated: number;
  renderableManifestEntries: number;
  skippedForLicenseReview: number;
  missing: number;
  notSelectedDueToLimit: number;
  includeLicenseReview: boolean;
  limit: number;
  ghostFontsSummary: {
    unmatchedRecordCount: number;
    sampleFontIds: string[];
    sampleFamilies: string[];
  };
  matchedBy: Record<MatchedBy, number>;
  hydratedFormats: Partial<Record<FontFormat, number>>;
  warnings: string[];
  outputPaths: {
    libraryDir: string;
    manifestPath: string;
    reportPath: string;
  };
};

const SUPPORTED_FONT_EXTENSIONS = new Set<SupportedFontExtension>([".ttf", ".otf", ".woff", ".woff2"]);
const SUPPORTED_SOURCE_EXTENSIONS = new Set([".zip", ".ttf", ".otf", ".woff", ".woff2"]);
const JUNK_SEGMENTS = new Set(["__macosx"]);
const JUNK_FILENAMES = new Set([".ds_store", "thumbs.db"]);
const FORMAT_PRIORITY: Record<FontFormat, number> = {
  woff2: 4,
  woff: 3,
  ttf: 2,
  otf: 1
};
const MATCH_PRIORITY: Record<MatchedBy, number> = {
  hash: 5,
  "relative-path": 4,
  "zip-entry": 3,
  filename: 2,
  unknown: 1
};

const normalizeSlash = (value: string): string => value.replace(/\\/g, "/");

const normalizeEntryName = (value: string): string => normalizeSlash(value).replace(/^\/+/, "");

const toFormat = (extension: SupportedFontExtension): FontFormat => extension.slice(1) as FontFormat;

const hashBuffer = (value: Uint8Array): string => createHash("sha256").update(Buffer.from(value)).digest("hex");

const stripGeneratedHashSuffix = (value: string): string => value.replace(/-[a-f0-9]{12,64}$/i, "");

const trimOrFallback = (value: string | null | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const normalizeBrowserStyle = (record: FontManifestRecord): string => {
  const subfamily = trimOrFallback(record.observed.subfamilyName, "").toLowerCase();
  if (subfamily.includes("oblique")) {
    return "oblique";
  }
  if (record.observed.italic) {
    return "italic";
  }
  return "normal";
};

const parseArgs = (): {limit: number; includeLicenseReview: boolean} => {
  const args = process.argv.slice(2);
  let limit = 20;
  let includeLicenseReview = false;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--limit") {
      const next = args[index + 1];
      const parsed = Number.parseInt(next ?? "", 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Expected a positive integer after --limit, received "${next ?? ""}".`);
      }
      limit = parsed;
      index += 1;
      continue;
    }
    if (current === "--include-license-review") {
      includeLicenseReview = true;
      continue;
    }
    throw new Error(`Unknown argument: ${current}`);
  }

  return {
    limit,
    includeLicenseReview
  };
};

const isJunkEntry = (entryName: string): boolean => {
  const normalized = normalizeEntryName(entryName).toLowerCase();
  if (!normalized) {
    return true;
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => JUNK_SEGMENTS.has(segment))) {
    return true;
  }
  const filename = segments[segments.length - 1] ?? "";
  return JUNK_FILENAMES.has(filename);
};

const sanitizeZipEntryPath = (entryName: string): string | null => {
  const normalized = normalizeEntryName(entryName);
  if (!normalized || normalized.endsWith("/")) {
    return null;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    return null;
  }
  const fileName = parts[parts.length - 1] ?? "";
  const extension = path.extname(fileName).toLowerCase() as SupportedFontExtension;
  if (!SUPPORTED_FONT_EXTENSIONS.has(extension)) {
    return null;
  }
  return parts.join("/");
};

const walkSourceAssets = async (rootDir: string, currentDir = rootDir): Promise<SourceAsset[]> => {
  const entries = await readdir(currentDir, {withFileTypes: true});
  const assets: SourceAsset[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      assets.push(...(await walkSourceAssets(rootDir, absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_SOURCE_EXTENSIONS.has(extension)) {
      continue;
    }
    assets.push({
      absolutePath,
      relativePath: normalizeSlash(path.relative(rootDir, absolutePath)),
      fileName: entry.name,
      extension: extension as SourceAsset["extension"]
    });
  }

  return assets.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};

const deriveMetadataStemSlug = (record: FontManifestRecord): string => {
  const extractedFilename = record.observed.filename || path.basename(record.observed.extractedRelativePath || "");
  const extension = record.observed.extension;
  const stem = extractedFilename.toLowerCase().endsWith(extension) ? extractedFilename.slice(0, -extension.length) : path.basename(extractedFilename, extension);
  return slugify(stripGeneratedHashSuffix(stem));
};

const deriveMetadataRelativeKey = (record: FontManifestRecord): string | null => {
  const extractedRelativePath = normalizeSlash(record.observed.extractedRelativePath || "");
  const extension = record.observed.extension;
  if (!extractedRelativePath || !SUPPORTED_FONT_EXTENSIONS.has(extension)) {
    return null;
  }
  const zipDirName = path.basename(path.dirname(extractedRelativePath));
  const zipSlug = slugify(zipDirName);
  const stemSlug = deriveMetadataStemSlug(record);
  if (!zipSlug || !stemSlug) {
    return null;
  }
  return `${zipSlug}/${stemSlug}${extension}`;
};

const pickPreferredCandidate = (candidates: SourceCandidate[], record: FontManifestRecord): SourceCandidate => {
  const canonicalSourceZip = record.canonicalSourceZip.toLowerCase();
  const preferred = candidates.find((candidate) => candidate.sourceFileName.toLowerCase() === canonicalSourceZip);
  return preferred ?? candidates[0]!;
};

const buildIndexes = (candidates: SourceCandidate[]) => {
  const hashIndex = new Map<string, SourceCandidate[]>();
  const relativePathIndex = new Map<string, SourceCandidate[]>();
  const zipEntryIndex = new Map<string, SourceCandidate[]>();
  const fileNameIndex = new Map<string, SourceCandidate[]>();

  for (const candidate of candidates) {
    const hashBucket = hashIndex.get(candidate.contentHash) ?? [];
    hashBucket.push(candidate);
    hashIndex.set(candidate.contentHash, hashBucket);

    if (candidate.zipSlug) {
      const relativeKey = `${candidate.zipSlug}/${candidate.entryStemSlug}${candidate.extension}`;
      const relativeBucket = relativePathIndex.get(relativeKey) ?? [];
      relativeBucket.push(candidate);
      relativePathIndex.set(relativeKey, relativeBucket);
    }

    if (candidate.sourceZipFilename) {
      const zipEntryKey = `${candidate.sourceZipFilename.toLowerCase()}|${candidate.entryStemSlug}${candidate.extension}`;
      const zipEntryBucket = zipEntryIndex.get(zipEntryKey) ?? [];
      zipEntryBucket.push(candidate);
      zipEntryIndex.set(zipEntryKey, zipEntryBucket);
    }

    const fileNameKey = `${candidate.entryStemSlug}${candidate.extension}`;
    const fileNameBucket = fileNameIndex.get(fileNameKey) ?? [];
    fileNameBucket.push(candidate);
    fileNameIndex.set(fileNameKey, fileNameBucket);
  }

  return {
    hashIndex,
    relativePathIndex,
    zipEntryIndex,
    fileNameIndex
  };
};

const matchRecordToCandidate = (
  record: FontManifestRecord,
  indexes: ReturnType<typeof buildIndexes>
): MatchResult => {
  const warnings: string[] = [];
  const hashCandidates = indexes.hashIndex.get(record.contentHash);
  if (hashCandidates && hashCandidates.length > 0) {
    return {
      candidate: pickPreferredCandidate(hashCandidates, record),
      matchedBy: "hash",
      warnings
    };
  }

  const relativeKey = deriveMetadataRelativeKey(record);
  if (relativeKey) {
    const relativeCandidates = indexes.relativePathIndex.get(relativeKey);
    if (relativeCandidates && relativeCandidates.length > 0) {
      warnings.push(`Matched ${record.fontId} by derived extracted relative path instead of content hash.`);
      return {
        candidate: pickPreferredCandidate(relativeCandidates, record),
        matchedBy: "relative-path",
        warnings
      };
    }
  }

  const stemSlug = deriveMetadataStemSlug(record);
  const zipEntryKey = `${record.canonicalSourceZip.toLowerCase()}|${stemSlug}${record.observed.extension}`;
  const zipEntryCandidates = indexes.zipEntryIndex.get(zipEntryKey);
  if (zipEntryCandidates && zipEntryCandidates.length > 0) {
    warnings.push(`Matched ${record.fontId} by canonical zip + entry stem instead of content hash.`);
    return {
      candidate: pickPreferredCandidate(zipEntryCandidates, record),
      matchedBy: "zip-entry",
      warnings
    };
  }

  const fileNameKey = `${stemSlug}${record.observed.extension}`;
  const fileNameCandidates = indexes.fileNameIndex.get(fileNameKey);
  if (fileNameCandidates && fileNameCandidates.length > 0) {
    warnings.push(`Matched ${record.fontId} by filename stem instead of content hash.`);
    return {
      candidate: pickPreferredCandidate(fileNameCandidates, record),
      matchedBy: "filename",
      warnings
    };
  }

  warnings.push(`No physical source candidate matched ${record.fontId}.`);
  return {
    candidate: null,
    matchedBy: null,
    warnings
  };
};

const computeSelectionScore = (record: FontManifestRecord, matchedBy: MatchedBy): number => {
  const formatScore = FORMAT_PRIORITY[toFormat(record.observed.extension)] * 100;
  const confidenceScore = record.metadataConfidence === "high" ? 30 : record.metadataConfidence === "medium" ? 20 : 10;
  const clarityScore = [
    record.fontId,
    record.familyId,
    record.observed.familyName?.trim(),
    record.observed.subfamilyName?.trim(),
    record.observed.weightClass
  ].filter(Boolean).length * 5;
  const regularBonus = record.observed.weightClass === 400 ? 4 : 0;
  const styleBonus = normalizeBrowserStyle(record) === "normal" ? 4 : 2;
  const matchScore = MATCH_PRIORITY[matchedBy] * 10;
  return formatScore + confidenceScore + clarityScore + regularBonus + styleBonus + matchScore;
};

const selectFontsToHydrate = ({
  matchedRecords,
  limit,
  includeLicenseReview
}: {
  matchedRecords: Array<HydrationSelection>;
  limit: number;
  includeLicenseReview: boolean;
}): {
  selected: HydrationSelection[];
  skippedForLicenseReview: number;
  notSelectedDueToLimit: number;
} => {
  const eligible = matchedRecords.filter((entry) => includeLicenseReview || !entry.record.needsManualLicenseReview);
  const skippedForLicenseReview = includeLicenseReview ? 0 : matchedRecords.length - eligible.length;

  const familyBest = new Map<string, HydrationSelection>();
  for (const entry of eligible) {
    const existing = familyBest.get(entry.record.familyId);
    if (!existing || entry.score > existing.score || (entry.score === existing.score && entry.record.fontId.localeCompare(existing.record.fontId) < 0)) {
      familyBest.set(entry.record.familyId, entry);
    }
  }

  const selected: HydrationSelection[] = [];
  const selectedFontIds = new Set<string>();
  const familyFirstPass = [...familyBest.values()].sort((left, right) => {
    return right.score - left.score || left.record.familyId.localeCompare(right.record.familyId);
  });

  for (const entry of familyFirstPass) {
    if (selected.length >= limit) {
      break;
    }
    selected.push(entry);
    selectedFontIds.add(entry.record.fontId);
  }

  if (selected.length < limit) {
    const remaining = eligible
      .filter((entry) => !selectedFontIds.has(entry.record.fontId))
      .sort((left, right) => right.score - left.score || left.record.fontId.localeCompare(right.record.fontId));
    for (const entry of remaining) {
      if (selected.length >= limit) {
        break;
      }
      selected.push(entry);
      selectedFontIds.add(entry.record.fontId);
    }
  }

  return {
    selected,
    skippedForLicenseReview,
    notSelectedDueToLimit: Math.max(eligible.length - selected.length, 0)
  };
};

const buildFamilyFolderMap = (entries: HydrationSelection[]): Map<string, string> => {
  const byBaseFolder = new Map<string, string[]>();
  for (const entry of entries) {
    const baseFolder = slugify(trimOrFallback(entry.record.observed.familyName, entry.record.familyId));
    const bucket = byBaseFolder.get(baseFolder) ?? [];
    bucket.push(entry.record.familyId);
    byBaseFolder.set(baseFolder, bucket);
  }

  const folderMap = new Map<string, string>();
  for (const [baseFolder, familyIds] of byBaseFolder) {
    const uniqueFamilyIds = [...new Set(familyIds)].sort((left, right) => left.localeCompare(right));
    if (uniqueFamilyIds.length === 1) {
      folderMap.set(uniqueFamilyIds[0]!, baseFolder);
      continue;
    }
    for (const familyId of uniqueFamilyIds) {
      folderMap.set(familyId, `${baseFolder}-${familyId.slice(-8)}`);
    }
  }
  return folderMap;
};

const readCandidateBytes = async (candidate: SourceCandidate): Promise<Buffer> => {
  if (candidate.kind === "file") {
    return readFile(candidate.sourcePath);
  }

  const archive = unzipSync(new Uint8Array(await readFile(candidate.sourcePath)));
  const entryName = candidate.entryName;
  if (!entryName) {
    throw new Error(`Zip candidate ${candidate.sourcePath} is missing an entry name.`);
  }
  const fileBytes = archive[entryName];
  if (!fileBytes) {
    throw new Error(`Unable to locate zip entry ${entryName} in ${candidate.sourcePath}.`);
  }
  return Buffer.from(fileBytes);
};

const scanSourceCandidates = async (sourceZipDir: string): Promise<{
  sourceAssets: SourceAsset[];
  candidates: SourceCandidate[];
}> => {
  const sourceAssets = await walkSourceAssets(sourceZipDir);
  const candidates: SourceCandidate[] = [];

  for (const asset of sourceAssets) {
    if (asset.extension === ".zip") {
      const archive = unzipSync(new Uint8Array(await readFile(asset.absolutePath)));
      for (const [entryName, bytes] of Object.entries(archive)) {
        if (isJunkEntry(entryName)) {
          continue;
        }
        const relativeEntryPath = sanitizeZipEntryPath(entryName);
        if (!relativeEntryPath) {
          continue;
        }
        const extension = path.extname(relativeEntryPath).toLowerCase() as SupportedFontExtension;
        const originalFileName = path.basename(relativeEntryPath);
        candidates.push({
          kind: "zip-entry",
          sourcePath: asset.absolutePath,
          sourceRelativePath: asset.relativePath,
          sourceFileName: asset.fileName,
          sourceZipFilename: asset.fileName,
          entryName,
          originalFileName,
          extension,
          format: toFormat(extension),
          contentHash: hashBuffer(bytes),
          zipSlug: slugify(path.basename(asset.fileName, ".zip")),
          entryStemSlug: slugify(path.basename(relativeEntryPath, extension))
        });
      }
      continue;
    }

    const extension = asset.extension as SupportedFontExtension;
    const bytes = await readFile(asset.absolutePath);
    candidates.push({
      kind: "file",
      sourcePath: asset.absolutePath,
      sourceRelativePath: asset.relativePath,
      sourceFileName: asset.fileName,
      sourceZipFilename: null,
      entryName: null,
      originalFileName: asset.fileName,
      extension,
      format: toFormat(extension),
      contentHash: hashBuffer(bytes),
      zipSlug: slugify(path.dirname(asset.relativePath)),
      entryStemSlug: slugify(path.basename(asset.fileName, extension))
    });
  }

  return {
    sourceAssets,
    candidates
  };
};

const main = async (): Promise<void> => {
  const {limit, includeLicenseReview} = parseArgs();
  const config = loadFontPipelineConfig();
  const sourceZipDir = config.paths.sourceZipDir;
  const ingestionReportPath = config.paths.fontIngestionReportPath;
  const fontManifestPath = config.paths.fontManifestPath;
  const libraryDir = path.join(process.cwd(), "public", "fonts", "library");
  const runtimeManifestPath = path.join(libraryDir, "font-manifest-urls.json");
  const hydrationReportPath = path.join(libraryDir, "font-hydration-report.json");

  const sourceDirStats = await stat(sourceZipDir).catch(() => null);
  if (!sourceDirStats?.isDirectory()) {
    throw new Error(`Expected FONTS source directory at ${sourceZipDir}.`);
  }

  const metadataReport = JSON.parse(await readFile(ingestionReportPath, "utf8")) as {canonicalFontCount?: number};
  const metadataRecords = JSON.parse(await readFile(fontManifestPath, "utf8")) as FontManifestRecord[];
  if (!Array.isArray(metadataRecords)) {
    throw new Error(`Expected an array in ${fontManifestPath}.`);
  }

  const {sourceAssets, candidates} = await scanSourceCandidates(sourceZipDir);
  const indexes = buildIndexes(candidates);

  const matches = metadataRecords.map((record) => ({
    record,
    match: matchRecordToCandidate(record, indexes)
  }));
  const matchedSelections: HydrationSelection[] = matches
    .filter((entry): entry is {record: FontManifestRecord; match: MatchResult & {candidate: SourceCandidate; matchedBy: MatchedBy}} => {
      return entry.match.candidate !== null && entry.match.matchedBy !== null;
    })
    .map((entry) => ({
      record: entry.record,
      match: entry.match,
      score: computeSelectionScore(entry.record, entry.match.matchedBy)
    }));

  const unmatched = matches.filter((entry) => entry.match.candidate === null);
  const warnings = unmatched.flatMap((entry) => entry.match.warnings);

  const selection = selectFontsToHydrate({
    matchedRecords: matchedSelections,
    limit,
    includeLicenseReview
  });

  await rm(libraryDir, {recursive: true, force: true});
  await mkdir(libraryDir, {recursive: true});

  const familyFolderMap = buildFamilyFolderMap(selection.selected);
  const runtimeManifest: RuntimeManifestRecord[] = [];
  const hydratedFormats: Partial<Record<FontFormat, number>> = {};
  const matchedByCounts: Record<MatchedBy, number> = {
    hash: 0,
    "relative-path": 0,
    "zip-entry": 0,
    filename: 0,
    unknown: 0
  };

  for (const entry of selection.selected) {
    const bytes = await readCandidateBytes(entry.match.candidate);
    const familyFolder = familyFolderMap.get(entry.record.familyId) ?? slugify(entry.record.familyId);
    const extension = entry.match.candidate.extension;
    const publicFormat = toFormat(extension);
    const originalFileName = entry.match.candidate.originalFileName || null;
    const originalStem = path.basename(originalFileName ?? entry.record.observed.filename, extension);
    const safeStem = slugify(originalStem) || slugify(entry.record.fontId);
    const targetFileName = `${safeStem}-${entry.record.fontId.slice(-12)}${extension}`;
    const localPublicPath = path.join(libraryDir, familyFolder, targetFileName);
    const publicUrl = `/fonts/library/${familyFolder}/${targetFileName}`;

    await mkdir(path.dirname(localPublicPath), {recursive: true});
    await writeFile(localPublicPath, bytes);

    matchedByCounts[entry.match.matchedBy] += 1;
    hydratedFormats[publicFormat] = (hydratedFormats[publicFormat] ?? 0) + 1;

    runtimeManifest.push({
      fontId: entry.record.fontId,
      familyId: entry.record.familyId,
      familyName: trimOrFallback(entry.record.observed.familyName, entry.record.familyId),
      fileName: targetFileName,
      originalFileName,
      weight: entry.record.observed.weightClass,
      style: normalizeBrowserStyle(entry.record),
      format: publicFormat,
      publicUrl,
      localPublicPath,
      license: {
        licenseTexts: entry.record.observed.licenseTexts,
        canonicalSourceZip: entry.record.canonicalSourceZip,
        sourceZips: entry.record.sourceZips,
        duplicateSourceZips: entry.record.duplicateSourceZips,
        duplicateCount: entry.record.duplicateCount
      },
      needsManualLicenseReview: entry.record.needsManualLicenseReview,
      source: "hydrated-font-library",
      renderable: true,
      matchedBy: entry.match.matchedBy,
      warnings: [...entry.record.metadataWarnings, ...entry.match.warnings]
    });
  }

  runtimeManifest.sort((left, right) => {
    const familyCompare = left.familyName.localeCompare(right.familyName);
    return familyCompare || left.fontId.localeCompare(right.fontId);
  });

  const report: HydrationReport = {
    generatedAt: new Date().toISOString(),
    totalMetadataRecordsRead: metadataRecords.length,
    sourceFilesFoundInFontsDir: sourceAssets.length,
    sourceZipCount: sourceAssets.filter((asset) => asset.extension === ".zip").length,
    sourceDirectFontFileCount: sourceAssets.filter((asset) => asset.extension !== ".zip").length,
    matchedMetadataRecords: matchedSelections.length,
    fontsHydrated: runtimeManifest.length,
    renderableManifestEntries: runtimeManifest.length,
    skippedForLicenseReview: selection.skippedForLicenseReview,
    missing: unmatched.length,
    notSelectedDueToLimit: selection.notSelectedDueToLimit,
    includeLicenseReview,
    limit,
    ghostFontsSummary: {
      unmatchedRecordCount: unmatched.length,
      sampleFontIds: unmatched.slice(0, 10).map((entry) => entry.record.fontId),
      sampleFamilies: unmatched.slice(0, 10).map((entry) => trimOrFallback(entry.record.observed.familyName, entry.record.familyId))
    },
    matchedBy: matchedByCounts,
    hydratedFormats,
    warnings,
    outputPaths: {
      libraryDir,
      manifestPath: runtimeManifestPath,
      reportPath: hydrationReportPath
    }
  };

  if (metadataReport.canonicalFontCount && metadataReport.canonicalFontCount !== metadataRecords.length) {
    report.warnings.push(
      `Metadata record count (${metadataRecords.length}) did not match canonicalFontCount from ingestion report (${metadataReport.canonicalFontCount}).`
    );
  }

  await writeJson(runtimeManifestPath, runtimeManifest);
  await writeJson(hydrationReportPath, report);

  console.log(
    JSON.stringify(
      {
        totalMetadataRecordsRead: report.totalMetadataRecordsRead,
        sourceFilesFoundInFontsDir: report.sourceFilesFoundInFontsDir,
        matchedMetadataRecords: report.matchedMetadataRecords,
        fontsHydrated: report.fontsHydrated,
        renderableManifestEntries: report.renderableManifestEntries,
        skippedForLicenseReview: report.skippedForLicenseReview,
        missing: report.missing,
        runtimeManifestPath,
        hydrationReportPath
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(`[font-hydrate] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
