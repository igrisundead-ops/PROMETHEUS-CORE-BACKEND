import {spawn} from "node:child_process";
import path from "node:path";

import {sha256File, sha256Text} from "../hash";

import type {FontPipelineConfig} from "./config";
import type {FontManifestRecord, FontObservedMetadata} from "./types";
import {slugify} from "./utils";

import type {ExtractedFontCandidate} from "./zip";

type RawMetadataResponse = {
  file_path: string;
  status: "ok" | "fallback";
  warnings?: string[];
  errors?: string[];
  observed?: Omit<FontObservedMetadata, "sourceFilename" | "sourceZipPath" | "extractedRelativePath" | "extractedAbsolutePath" | "filename" | "extension"> & {
    licenseTexts?: string[];
  };
};

export type MetadataProbeRunner = (input: {
  config: FontPipelineConfig;
  fontPaths: string[];
}) => Promise<RawMetadataResponse[]>;

const defaultMetadataProbeRunner: MetadataProbeRunner = async ({config, fontPaths}) => {
  if (fontPaths.length === 0) {
    return [];
  }

  const payload = JSON.stringify({
    font_paths: fontPaths
  });

  return new Promise<RawMetadataResponse[]>((resolve, reject) => {
    const child = spawn(
      config.FONT_INTELLIGENCE_PYTHON_BIN,
      ["-u", config.FONT_INTELLIGENCE_METADATA_SCRIPT],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUTF8: process.env.PYTHONUTF8 ?? "1"
        }
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Font metadata probe exited with code ${code ?? "unknown"}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as RawMetadataResponse[]);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    child.stdin.end(payload, "utf8");
  });
};

const inferItalicFromNames = (candidate: ExtractedFontCandidate): boolean | null => {
  const probe = `${candidate.entryName} ${path.basename(candidate.absolutePath)}`;
  const normalized = probe
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
  if (/\b(italic|oblique|slanted)\b/.test(normalized)) {
    return true;
  }
  if (/\b(regular|roman)\b/.test(normalized)) {
    return false;
  }
  return null;
};

const inferWeightFromNames = (candidate: ExtractedFontCandidate): number | null => {
  const probe = `${candidate.entryName} ${path.basename(candidate.absolutePath)}`
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
  if (/\b(thin|hairline)\b/.test(probe)) return 100;
  if (/\b(extra light|ultra light)\b/.test(probe)) return 200;
  if (/\b(light)\b/.test(probe)) return 300;
  if (/\b(book|regular|roman)\b/.test(probe)) return 400;
  if (/\b(medium)\b/.test(probe)) return 500;
  if (/\b(semi bold|demi bold)\b/.test(probe)) return 600;
  if (/\b(extra bold|ultra bold)\b/.test(probe)) return 800;
  if (/\b(black|heavy)\b/.test(probe)) return 900;
  if (/\b(bold)\b/.test(probe)) return 700;
  return null;
};

const inferWidthFromNames = (candidate: ExtractedFontCandidate): number | null => {
  const probe = `${candidate.entryName} ${path.basename(candidate.absolutePath)}`
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
  if (/\b(condensed|compressed|narrow)\b/.test(probe)) return 3;
  if (/\b(expanded|extended|wide)\b/.test(probe)) return 7;
  return null;
};

const buildFallbackObservedMetadata = async (candidate: ExtractedFontCandidate): Promise<FontObservedMetadata> => {
  const filename = path.basename(candidate.absolutePath);
  const basename = path.basename(filename, candidate.extension);
  const familyGuess = basename
    .replace(/[-_]+/g, " ")
    .replace(/\b(regular|italic|bold|black|condensed|light|medium|semibold|extrabold)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    sourceFilename: candidate.sourceZipFilename,
    sourceZipPath: candidate.sourceZipPath,
    extractedRelativePath: candidate.relativePath,
    extractedAbsolutePath: candidate.absolutePath,
    filename,
    extension: candidate.extension,
    postscriptName: slugify(basename),
    familyName: familyGuess || basename,
    subfamilyName: null,
    fullName: basename,
    weightClass: inferWeightFromNames(candidate),
    widthClass: inferWidthFromNames(candidate),
    italic: inferItalicFromNames(candidate),
    glyphCount: null,
    unicodeRanges: [],
    ascent: null,
    descent: null,
    capHeight: null,
    xHeight: null,
    licenseTexts: [],
    variationAxes: []
  };
};

export const loadObservedFontMetadata = async ({
  config,
  candidates,
  runner = defaultMetadataProbeRunner
}: {
  config: FontPipelineConfig;
  candidates: ExtractedFontCandidate[];
  runner?: MetadataProbeRunner;
}): Promise<Array<{
  candidate: ExtractedFontCandidate;
  observed: FontObservedMetadata;
  status: "ok" | "fallback";
  metadataWarnings: string[];
  metadataErrors: string[];
  fileHash: string;
}>> => {
  const canonicalCandidates = candidates.filter((candidate) => candidate.duplicateOfHash === null);
  const rawResponses = await runner({
    config,
    fontPaths: canonicalCandidates.map((candidate) => candidate.absolutePath)
  }).catch(() => []);
  const responseByPath = new Map(rawResponses.map((response) => [path.resolve(response.file_path), response]));
  const results: Array<{
    candidate: ExtractedFontCandidate;
    observed: FontObservedMetadata;
    status: "ok" | "fallback";
    metadataWarnings: string[];
    metadataErrors: string[];
    fileHash: string;
  }> = [];

  for (const candidate of canonicalCandidates) {
    const fileHash = await sha256File(candidate.absolutePath);
    const response = responseByPath.get(path.resolve(candidate.absolutePath));
    if (!response?.observed) {
      results.push({
        candidate,
        observed: await buildFallbackObservedMetadata(candidate),
        status: "fallback",
        metadataWarnings: ["Metadata probe did not return an observed payload. Using filename-based fallback."],
        metadataErrors: response?.errors ?? [],
        fileHash
      });
      continue;
    }

    const observed: FontObservedMetadata = {
      sourceFilename: candidate.sourceZipFilename,
      sourceZipPath: candidate.sourceZipPath,
      extractedRelativePath: candidate.relativePath,
      extractedAbsolutePath: candidate.absolutePath,
      filename: path.basename(candidate.absolutePath),
      extension: candidate.extension,
      postscriptName: response.observed.postscriptName ?? null,
      familyName: response.observed.familyName ?? null,
      subfamilyName: response.observed.subfamilyName ?? null,
      fullName: response.observed.fullName ?? null,
      weightClass: response.observed.weightClass ?? null,
      widthClass: response.observed.widthClass ?? null,
      italic: response.observed.italic ?? null,
      glyphCount: response.observed.glyphCount ?? null,
      unicodeRanges: response.observed.unicodeRanges ?? [],
      ascent: response.observed.ascent ?? null,
      descent: response.observed.descent ?? null,
      capHeight: response.observed.capHeight ?? null,
      xHeight: response.observed.xHeight ?? null,
      licenseTexts: response.observed.licenseTexts ?? [],
      variationAxes: response.observed.variationAxes ?? []
    };

    const isThinObserved = Object.values(observed).some((value) => {
      return Array.isArray(value) ? value.length > 0 : value !== null && value !== "";
    });
    if (!isThinObserved) {
      results.push({
        candidate,
        observed: await buildFallbackObservedMetadata(candidate),
        status: "fallback",
        metadataWarnings: ["Metadata probe returned an empty payload. Using filename-based fallback."],
        metadataErrors: response.errors ?? [],
        fileHash
      });
      continue;
    }

    results.push({
      candidate,
      observed,
      status: response.status ?? "ok",
      metadataWarnings: response.warnings ?? [],
      metadataErrors: response.errors ?? [],
      fileHash
    });
  }

  return results;
};

export const resolveFontIdentity = ({
  observed,
  fileHash
}: {
  observed: FontObservedMetadata;
  fileHash: string;
}): Pick<FontManifestRecord, "fontId" | "familyId" | "contentHash"> => {
  const familySeed = slugify(observed.familyName ?? observed.postscriptName ?? observed.fullName ?? observed.filename);
  const fontSeed = slugify(observed.postscriptName ?? observed.fullName ?? observed.filename);
  return {
    familyId: `family_${familySeed}_${sha256Text(familySeed).slice(0, 8)}`,
    fontId: `font_${fontSeed}_${fileHash.slice(0, 12)}`,
    contentHash: fileHash
  };
};
