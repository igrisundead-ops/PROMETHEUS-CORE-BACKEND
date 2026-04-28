import {readdir, stat} from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {probeVideoMetadata} from "../video-probe";

import type {AssetPipelineConfig} from "./config";
import type {AssetDiscoveryRecord, UnifiedAssetSourceLibrary, UnifiedAssetType} from "./types";
import {normalizeAssetText} from "./text-utils";

const SUPPORTED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".html",
  ".json",
  ".lottie",
  ".mp4",
  ".webm",
  ".mov"
]);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);

const inferSourceLibrary = (rootDir: string): UnifiedAssetSourceLibrary => {
  const normalized = normalizeAssetText(rootDir);
  if (normalized.includes("static assets")) {
    return "static-assets-root";
  }
  if (normalized.includes("structured animation")) {
    return "structured-animation-root";
  }
  if (normalized.includes("gsap stories")) {
    return "gsap-stories-root";
  }
  if (normalized.includes("gsap three")) {
    return "gsap-three-root";
  }
  if (normalized.includes("svg animations")) {
    return "svg-animations-root";
  }
  if (normalized.includes("public motion assets")) {
    return "public-motion-assets";
  }
  if (normalized.includes("public showcase assets")) {
    return "public-showcase-assets";
  }
  if (normalized.includes("public showcase source")) {
    return "public-showcase-source";
  }
  return "workspace-assets-root";
};

const inferAssetType = ({
  extension,
  relativePath
}: {
  extension: string;
  relativePath: string;
}): UnifiedAssetType => {
  const normalized = normalizeAssetText(relativePath);

  if (extension === ".html") {
    if (/(text|headline|quote|word|typography|highlight|reveal)/.test(normalized)) {
      return "typography_effect";
    }
    return "motion_graphic";
  }
  if (extension === ".json" || extension === ".lottie" || VIDEO_EXTENSIONS.has(extension)) {
    if (/(overlay|transition|accent|ring|sweep|glow)/.test(normalized)) {
      return "animated_overlay";
    }
    return "motion_graphic";
  }
  if (/(icon|logo|symbol)/.test(normalized)) {
    return "icon";
  }
  if (/(background|wallpaper|cover|texture)/.test(normalized)) {
    return "background";
  }
  if (/(accent|ring|circle|halo|glow|shape|underlay)/.test(normalized)) {
    return "accent";
  }
  if (/(card|panel|hud|ui|glass)/.test(normalized)) {
    return "ui_card";
  }
  return "static_image";
};

const probeAssetDimensions = async (absolutePath: string, extension: string): Promise<{
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  durationSeconds?: number | null;
}> => {
  try {
    if (IMAGE_EXTENSIONS.has(extension)) {
      const metadata = await sharp(absolutePath, {animated: false}).metadata();
      if (metadata.width && metadata.height) {
        return {
          width: metadata.width,
          height: metadata.height,
          aspectRatio: Number((metadata.width / metadata.height).toFixed(3)),
          durationSeconds: null
        };
      }
    }

    if (VIDEO_EXTENSIONS.has(extension)) {
      const metadata = await probeVideoMetadata(absolutePath);
      return {
        width: metadata.width,
        height: metadata.height,
        aspectRatio: Number((metadata.width / metadata.height).toFixed(3)),
        durationSeconds: metadata.durationSeconds
      };
    }
  } catch {
    // Keep discovery resilient. Unsupported files or missing ffprobe should not stop indexing.
  }

  return {
    width: null,
    height: null,
    aspectRatio: null,
    durationSeconds: null
  };
};

const walkRoot = async (rootDir: string): Promise<string[]> => {
  const entries = await readdir(rootDir, {withFileTypes: true});
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkRoot(absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }
    files.push(absolutePath);
  }

  return files;
};

export const discoverAssetFiles = async (config: AssetPipelineConfig): Promise<AssetDiscoveryRecord[]> => {
  const results: AssetDiscoveryRecord[] = [];

  for (const rootDir of config.assetRootDirs) {
    try {
      const rootStats = await stat(rootDir);
      if (!rootStats.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const sourceLibrary = inferSourceLibrary(rootDir);
    const filePaths = await walkRoot(rootDir);

    for (const absolutePath of filePaths) {
      const fileStats = await stat(absolutePath);
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/");
      const filename = path.basename(absolutePath);
      const fileExtension = path.extname(filename).toLowerCase();
      const folderPath = path.dirname(relativePath).replace(/\\/g, "/");
      const parentFolders = folderPath === "." ? [] : folderPath.split("/").filter(Boolean);
      const folderName = parentFolders[parentFolders.length - 1] ?? path.basename(rootDir);
      const measured = await probeAssetDimensions(absolutePath, fileExtension);

      results.push({
        absolutePath,
        relativePath,
        rootDir,
        rootLabel: path.basename(rootDir),
        sourceLibrary,
        folderName,
        parentFolders,
        filename,
        fileExtension,
        fileSizeBytes: fileStats.size,
        modifiedTimeMs: fileStats.mtimeMs,
        detectedAssetType: inferAssetType({
          extension: fileExtension,
          relativePath: `${path.basename(rootDir)}/${relativePath}`
        }),
        width: measured.width,
        height: measured.height,
        aspectRatio: measured.aspectRatio,
        durationSeconds: measured.durationSeconds
      });
    }
  }

  return results.sort((a, b) => a.absolutePath.localeCompare(b.absolutePath));
};
