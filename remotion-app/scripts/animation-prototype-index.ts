import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {
  DEFAULT_ANIMATION_PROTOTYPE_COVERAGE_OUTPUT,
  DEFAULT_ANIMATION_PROTOTYPE_OUTPUT,
  DEFAULT_ANIMATION_PROTOTYPE_ROOT,
  inferAnimationPrototypeRecord,
  type AnimationPrototypeRecord
} from "../src/lib/motion-platform/animation-prototype-catalog";

type ScanFileResult = {
  filePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  supported: boolean;
  unsupportedReason: string | null;
  content: string;
};

export type AnimationPrototypeCoverageFile = {
  filePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  supported: boolean;
  unsupportedReason: string | null;
  metadataConfidence: number | null;
  coverageStatus: AnimationPrototypeRecord["coverageStatus"] | "unsupported";
  tagCount: number;
  structuralRegionCount: number;
  flaggedForReview: boolean;
};

export type AnimationPrototypeCoverageReport = {
  version: string;
  generatedAt: string;
  sourceRoot: string;
  totalFiles: number;
  supportedFiles: number;
  unsupportedFiles: number;
  fullyTaggedCount: number;
  partiallyTaggedCount: number;
  untaggedCount: number;
  flaggedForReviewCount: number;
  invalidMetadataCount: number;
  records: AnimationPrototypeCoverageFile[];
  unsupportedFileTypes: Record<string, number>;
  notes: string[];
};

export type AnimationPrototypeIndexOptions = {
  sourceRoot?: string;
  outputPath?: string;
  coverageOutputPath?: string;
};

const readArgValue = (args: string[], flag: string): string | null => {
  const index = args.indexOf(flag);
  return index >= 0 ? (args[index + 1] ?? null) : null;
};

const resolveScanPaths = (options: AnimationPrototypeIndexOptions = {}): {sourceRoot: string; outputPath: string; coverageOutputPath: string} => {
  const args = process.argv.slice(2);
  return {
    sourceRoot: options.sourceRoot ?? readArgValue(args, "--source-root") ?? DEFAULT_ANIMATION_PROTOTYPE_ROOT,
    outputPath: options.outputPath ?? readArgValue(args, "--output") ?? DEFAULT_ANIMATION_PROTOTYPE_OUTPUT,
    coverageOutputPath: options.coverageOutputPath ?? readArgValue(args, "--coverage-output") ?? DEFAULT_ANIMATION_PROTOTYPE_COVERAGE_OUTPUT
  };
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const scanDirectory = async (sourceRoot: string, currentDir: string = sourceRoot): Promise<ScanFileResult[]> => {
  const entries = await readdir(currentDir, {withFileTypes: true});
  const results: ScanFileResult[] = [];

  for (const entry of entries) {
    const filePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await scanDirectory(sourceRoot, filePath));
      continue;
    }

    results.push({
      filePath,
      relativePath: path.relative(sourceRoot, filePath).split(path.sep).join("/"),
      fileName: entry.name,
      extension: path.extname(entry.name).toLowerCase(),
      supported: /\.html?$/i.test(entry.name),
      unsupportedReason: /\.html?$/i.test(entry.name) ? null : "unsupported-extension",
      content: /\.html?$/i.test(entry.name) ? await readFile(filePath, "utf-8") : ""
    });
  }

  return results;
};

export const scanAnimationPrototypeDirectory = async (sourceRoot: string): Promise<AnimationPrototypeRecord[]> => {
  try {
    const files = await scanDirectory(sourceRoot);
    return files
      .filter((file) => file.supported)
      .map((file) =>
        inferAnimationPrototypeRecord({
          ...file,
          sourceRoot
        })
      )
      .sort((left, right) => left.id.localeCompare(right.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Animation prototype scan skipped for ${sourceRoot}: ${message}`);
    return [];
  }
};

export const buildAnimationPrototypeCoverageReport = ({
  sourceRoot,
  files,
  records,
  generatedAt = new Date().toISOString()
}: {
  sourceRoot: string;
  files: ScanFileResult[];
  records: AnimationPrototypeRecord[];
  generatedAt?: string;
}): AnimationPrototypeCoverageReport => {
  const recordByRelativePath = new Map(records.map((record) => [record.relativePath, record] as const));
  const coverageRecords: AnimationPrototypeCoverageFile[] = files.map((file) => {
    const record = recordByRelativePath.get(file.relativePath);
    const tagCount = record ? new Set([
      ...(record.graphTags ?? []),
      ...(record.functionalTags ?? []),
      ...(record.semanticTriggers ?? []),
      ...(record.placementPreference ?? []),
      ...(record.conflictRules ?? []),
      ...(record.aliases ?? [])
    ]).size : 0;
    const structuralRegionCount = record?.structuralRegions?.length ?? 0;
    const metadataConfidence = record?.metadataConfidence ?? null;
    const coverageStatus = file.supported
      ? record?.coverageStatus ?? "review"
      : "unsupported";
    return {
      filePath: file.filePath,
      relativePath: file.relativePath,
      fileName: file.fileName,
      extension: file.extension,
      supported: file.supported,
      unsupportedReason: file.unsupportedReason,
      metadataConfidence,
      coverageStatus,
      tagCount,
      structuralRegionCount,
      flaggedForReview: coverageStatus !== "complete" || (metadataConfidence !== null && metadataConfidence < 0.75)
    };
  });

  const unsupportedFileTypes = coverageRecords.reduce<Record<string, number>>((accumulator, file) => {
    if (file.supported) {
      return accumulator;
    }
    const key = file.extension || "unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    version: "2026-04-15-animation-prototype-audit-v1",
    generatedAt,
    sourceRoot,
    totalFiles: coverageRecords.length,
    supportedFiles: coverageRecords.filter((record) => record.supported).length,
    unsupportedFiles: coverageRecords.filter((record) => !record.supported).length,
    fullyTaggedCount: coverageRecords.filter((record) => record.coverageStatus === "complete").length,
    partiallyTaggedCount: coverageRecords.filter((record) => record.coverageStatus === "partial" || record.coverageStatus === "review").length,
    untaggedCount: coverageRecords.filter((record) => record.coverageStatus === "untagged").length,
    flaggedForReviewCount: coverageRecords.filter((record) => record.flaggedForReview).length,
    invalidMetadataCount: coverageRecords.filter((record) => record.supported && (!record.metadataConfidence || record.tagCount === 0)).length,
    records: coverageRecords,
    unsupportedFileTypes,
    notes: [
      "Coverage audit flags unsupported file types and low-confidence tag sets.",
      "Support for newly added files is inferred from filename, content, and data-* cues."
    ]
  };
};

export const runAnimationPrototypeIndex = async (options: AnimationPrototypeIndexOptions = {}): Promise<AnimationPrototypeRecord[]> => {
  const {sourceRoot, outputPath, coverageOutputPath} = resolveScanPaths(options);
  const files = await scanDirectory(sourceRoot);
  const records = files
    .filter((file) => file.supported)
    .map((file) =>
      inferAnimationPrototypeRecord({
        ...file,
        sourceRoot
      })
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  await writeJson(outputPath, records);
  await writeJson(coverageOutputPath, buildAnimationPrototypeCoverageReport({
    sourceRoot,
    files,
    records
  }));
  console.log(`Indexed ${records.length} animation prototypes from ${sourceRoot}`);
  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${coverageOutputPath}`);
  return records;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runAnimationPrototypeIndex().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
