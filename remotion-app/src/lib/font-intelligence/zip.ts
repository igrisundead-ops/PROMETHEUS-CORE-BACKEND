import {mkdir, readdir, writeFile} from "node:fs/promises";
import path from "node:path";

import {unzipSync} from "fflate";

import {sha256Text} from "../hash";

import type {FontIngestionReport} from "./types";
import {slugify, unique} from "./utils";

const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const JUNK_SEGMENTS = new Set(["__macosx"]);
const JUNK_FILENAMES = new Set([".ds_store", "thumbs.db"]);

export type ExtractedFontCandidate = {
  sourceZipPath: string;
  sourceZipFilename: string;
  entryName: string;
  relativePath: string;
  absolutePath: string;
  extension: ".ttf" | ".otf" | ".woff" | ".woff2";
  contentHash: string;
  duplicateOfHash: string | null;
  duplicateSourceZips: string[];
};

const normalizeEntryName = (value: string): string => value.replace(/\\/g, "/").replace(/^\/+/, "");

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

const sanitizeRelativeEntryPath = (entryName: string): string | null => {
  const normalized = normalizeEntryName(entryName);
  if (!normalized || normalized.endsWith("/")) {
    return null;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    return null;
  }
  const filename = parts[parts.length - 1] ?? "";
  const extension = path.extname(filename).toLowerCase();
  if (!FONT_EXTENSIONS.has(extension)) {
    return null;
  }
  return parts.join("/");
};

export const safeExtractFontZips = async ({
  sourceZipDir,
  extractedFontsDir
}: {
  sourceZipDir: string;
  extractedFontsDir: string;
}): Promise<{
  candidates: ExtractedFontCandidate[];
  report: FontIngestionReport;
}> => {
  const entries = await readdir(sourceZipDir, {withFileTypes: true}).catch(() => []);
  const zipPaths = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
    .map((entry) => path.join(sourceZipDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const seenHashes = new Map<string, ExtractedFontCandidate>();
  const candidates: ExtractedFontCandidate[] = [];
  const failures: FontIngestionReport["failures"] = [];
  const warnings: string[] = [];

  for (const zipPath of zipPaths) {
    const zipFilename = path.basename(zipPath);
    const zipBuffer = await import("node:fs/promises").then(({readFile}) => readFile(zipPath));
    let archive: Record<string, Uint8Array>;
    try {
      archive = unzipSync(new Uint8Array(zipBuffer));
    } catch (error) {
      failures.push({
        sourceZipPath: zipPath,
        entryName: zipFilename,
        reason: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    for (const [entryName, bytes] of Object.entries(archive)) {
      if (isJunkEntry(entryName)) {
        continue;
      }
      const relativeEntryPath = sanitizeRelativeEntryPath(entryName);
      if (!relativeEntryPath) {
        if (normalizeEntryName(entryName).includes("..")) {
          failures.push({
            sourceZipPath: zipPath,
            entryName,
            reason: "Skipped suspicious zip entry with path traversal segments."
          });
        }
        continue;
      }
      const extension = path.extname(relativeEntryPath).toLowerCase() as ExtractedFontCandidate["extension"];
      const contentHash = sha256Text(Buffer.from(bytes).toString("base64"));
      const existing = seenHashes.get(contentHash);
      if (existing) {
        existing.duplicateSourceZips = unique([...existing.duplicateSourceZips, zipFilename]);
        candidates.push({
          sourceZipPath: zipPath,
          sourceZipFilename: zipFilename,
          entryName,
          relativePath: existing.relativePath,
          absolutePath: existing.absolutePath,
          extension,
          contentHash,
          duplicateOfHash: contentHash,
          duplicateSourceZips: [...existing.duplicateSourceZips]
        });
        continue;
      }

      const targetDir = path.join(extractedFontsDir, slugify(path.basename(zipFilename, ".zip")));
      const targetFilename = `${slugify(path.basename(relativeEntryPath, extension))}-${contentHash.slice(0, 12)}${extension}`;
      const absolutePath = path.join(targetDir, targetFilename);
      await mkdir(targetDir, {recursive: true});
      await writeFile(absolutePath, Buffer.from(bytes));
      const candidate: ExtractedFontCandidate = {
        sourceZipPath: zipPath,
        sourceZipFilename: zipFilename,
        entryName,
        relativePath: path.relative(path.dirname(extractedFontsDir), absolutePath).replace(/\\/g, "/"),
        absolutePath,
        extension,
        contentHash,
        duplicateOfHash: null,
        duplicateSourceZips: []
      };
      seenHashes.set(contentHash, candidate);
      candidates.push(candidate);
    }
  }

  if (zipPaths.length === 0) {
    warnings.push(`No zip files found in ${sourceZipDir}.`);
  }

  return {
    candidates,
    report: {
      sourceZipDir,
      workspaceDir: path.dirname(extractedFontsDir),
      scannedZipCount: zipPaths.length,
      extractedFontCount: candidates.length,
      canonicalFontCount: [...seenHashes.values()].length,
      duplicatesSkipped: candidates.filter((candidate) => candidate.duplicateOfHash !== null).length,
      failedFonts: failures.length,
      successfulDescriptors: 0,
      specimenCount: 0,
      generatedAt: new Date().toISOString(),
      warnings,
      failures
    }
  };
};
