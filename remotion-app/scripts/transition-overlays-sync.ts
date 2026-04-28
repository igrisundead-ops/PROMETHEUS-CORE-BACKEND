import {execFileSync} from "node:child_process";
import {copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {TransitionOverlayAsset, TransitionOverlayBlendMode, TransitionOverlayFadePreference, TransitionOverlayOrientation, TransitionOverlayTrimWindow} from "../src/lib/types";

type SourceDefinition = {
  match: RegExp;
  meta: Partial<TransitionOverlayAsset>;
};

type ProbedVideoMetadata = {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "..");
const sourceDir = path.resolve(repoRoot, "TRANSITION");
const publicDir = path.resolve(appRoot, "public", "transitions");
const dataFile = path.resolve(appRoot, "src", "data", "transition-overlays.local.json");

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

const sourceDefinitions: SourceDefinition[] = [
  {
    match: /fast paced video/i,
    meta: {
      id: "fast-paced-video",
      label: "Fast Paced Video",
      orientation: "vertical",
      orientationSource: "filename-tag",
      category: "montage",
      styleTags: ["fast-intro", "rapid", "kinetic"],
      recommendedDurationSeconds: 1.32,
      preferredTrimWindow: {startSeconds: 0.72, endSeconds: 11.35},
      blendMode: "screen",
      fadePreference: "snappy",
      opacity: 0.97
    }
  },
  {
    match: /abstract flare/i,
    meta: {
      id: "light-hero-abstract-flare",
      label: "Light Hero Abstract Flare",
      orientation: "vertical",
      orientationSource: "filename-tag",
      category: "flare",
      styleTags: ["abstract", "flare", "premium", "glow"],
      recommendedDurationSeconds: 1.38,
      preferredTrimWindow: {startSeconds: 0.35, endSeconds: 7.95},
      blendMode: "screen",
      fadePreference: "balanced",
      opacity: 0.93
    }
  },
  {
    match: /klickpin/i,
    meta: {
      id: "click-pin-motion",
      label: "Click Pin Motion",
      orientation: "vertical",
      orientationSource: "filename-tag",
      category: "click-pin",
      styleTags: ["click", "pin", "impact", "kinetic"],
      recommendedDurationSeconds: 1.3,
      preferredTrimWindow: {startSeconds: 0.25, endSeconds: 11.4},
      blendMode: "overlay",
      fadePreference: "snappy",
      opacity: 0.97
    }
  },
  {
    match: /landscape burn transition/i,
    meta: {
      id: "landscape-burn-transition",
      label: "Landscape Burn Transition",
      orientation: "landscape",
      orientationSource: "filename-tag",
      category: "burn",
      styleTags: ["burn", "landscape", "organic", "heat"],
      recommendedDurationSeconds: 1.72,
      preferredTrimWindow: {startSeconds: 2.0, endSeconds: 18.5},
      blendMode: "screen",
      fadePreference: "soft",
      opacity: 0.93
    }
  },
  {
    match: /landscape light leak transition/i,
    meta: {
      id: "landscape-light-leak-transition",
      label: "Landscape Light Leak Transition",
      orientation: "landscape",
      orientationSource: "filename-tag",
      category: "light-leak",
      styleTags: ["leak", "landscape", "light", "glow"],
      recommendedDurationSeconds: 1.58,
      preferredTrimWindow: {startSeconds: 0.85, endSeconds: 10.8},
      blendMode: "screen",
      fadePreference: "soft",
      opacity: 0.92
    }
  },
  {
    match: /landscape rough burn transition/i,
    meta: {
      id: "landscape-rough-burn-transition",
      label: "Landscape Rough Burn Transition",
      orientation: "landscape",
      orientationSource: "filename-tag",
      category: "rough-burn",
      styleTags: ["rough", "burn", "landscape", "grit"],
      recommendedDurationSeconds: 1.78,
      preferredTrimWindow: {startSeconds: 1.85, endSeconds: 15.8},
      blendMode: "screen",
      fadePreference: "soft",
      opacity: 0.91
    }
  },
  {
    match: /landscape transition/i,
    meta: {
      id: "landscape-transition",
      label: "Landscape Transition",
      orientation: "landscape",
      orientationSource: "filename-tag",
      category: "normal",
      styleTags: ["landscape", "neutral", "clean"],
      recommendedDurationSeconds: 1.38,
      preferredTrimWindow: {startSeconds: 0.55, endSeconds: 14.5},
      blendMode: "normal",
      fadePreference: "balanced",
      opacity: 0.95
    }
  },
  {
    match: /light burn/i,
    meta: {
      id: "light-burn",
      label: "Light Burn",
      orientation: "vertical",
      orientationSource: "filename-tag",
      category: "burn",
      styleTags: ["burn", "light", "glow"],
      recommendedDurationSeconds: 1.62,
      preferredTrimWindow: {startSeconds: 0.1, endSeconds: 5.8},
      blendMode: "screen",
      fadePreference: "soft",
      opacity: 0.94
    }
  },
  {
    match: /light leak/i,
    meta: {
      id: "light-leak",
      label: "Light Leak",
      orientation: "vertical",
      orientationSource: "filename-tag",
      category: "light-leak",
      styleTags: ["leak", "light", "glow"],
      recommendedDurationSeconds: 1.54,
      preferredTrimWindow: {startSeconds: 0.2, endSeconds: 7.2},
      blendMode: "screen",
      fadePreference: "soft",
      opacity: 0.93
    }
  }
];

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const slugify = (value: string): string => {
  const slug = normalizeText(value).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "transition-asset";
};

const inferOrientation = (fileName: string): TransitionOverlayOrientation => {
  if (/landscape/i.test(fileName)) {
    return "landscape";
  }
  return "vertical";
};

const inferCategory = (fileName: string): string => {
  const text = normalizeText(fileName);
  if (text.includes("click pin") || text.includes("clickpin") || text.includes("pin")) {
    return "click-pin";
  }
  if (text.includes("light leak") || text.includes("leak")) {
    return "light-leak";
  }
  if (text.includes("rough burn") || text.includes("rough")) {
    return "rough-burn";
  }
  if (text.includes("light burn") || text.includes("burn")) {
    return "burn";
  }
  if (text.includes("flare") || text.includes("abstract")) {
    return "flare";
  }
  if (text.includes("fast paced")) {
    return "montage";
  }
  return "normal";
};

const inferFadePreference = (category: string): TransitionOverlayFadePreference => {
  if (category === "click-pin" || category === "montage") {
    return "snappy";
  }
  if (category.includes("burn") || category.includes("leak") || category === "flare") {
    return "soft";
  }
  return "balanced";
};

const inferBlendMode = (category: string): TransitionOverlayBlendMode => {
  if (category.includes("burn") || category.includes("leak") || category === "flare" || category === "montage") {
    return "screen";
  }
  if (category === "click-pin") {
    return "overlay";
  }
  return "normal";
};

const inferTrimWindow = (durationSeconds: number, category: string): TransitionOverlayTrimWindow => {
  if (category === "montage") {
    return {startSeconds: Math.max(0, durationSeconds * 0.05), endSeconds: Math.max(0.75, durationSeconds * 0.56)};
  }
  if (category === "click-pin") {
    return {startSeconds: Math.max(0, durationSeconds * 0.04), endSeconds: Math.max(0.9, durationSeconds * 0.5)};
  }
  if (category.includes("burn")) {
    return {startSeconds: Math.max(0, durationSeconds * 0.08), endSeconds: Math.max(1.4, durationSeconds * 0.68)};
  }
  if (category.includes("leak")) {
    return {startSeconds: Math.max(0, durationSeconds * 0.06), endSeconds: Math.max(1.2, durationSeconds * 0.64)};
  }
  if (category === "flare") {
    return {startSeconds: Math.max(0, durationSeconds * 0.05), endSeconds: Math.max(1.0, durationSeconds * 0.6)};
  }
  return {startSeconds: Math.max(0, durationSeconds * 0.06), endSeconds: Math.max(1.0, durationSeconds * 0.62)};
};

const inferStyleTags = (fileName: string, category: string, orientation: TransitionOverlayOrientation): string[] => {
  const tags = new Set<string>([category, orientation, "cinematic", "transition"]);
  const text = normalizeText(fileName);

  if (category === "click-pin") {
    tags.add("impact");
    tags.add("kinetic");
  }
  if (category === "montage") {
    tags.add("fast-intro");
    tags.add("rapid");
  }
  if (text.includes("abstract")) {
    tags.add("abstract");
  }
  if (category.includes("burn")) {
    tags.add("organic");
    tags.add("heat");
  }
  if (category.includes("leak")) {
    tags.add("light");
    tags.add("glow");
  }
  if (category === "flare") {
    tags.add("glow");
    tags.add("premium");
  }

  return [...tags];
};

const probeVideoMetadata = (filePath: string): ProbedVideoMetadata => {
  const output = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,avg_frame_rate,r_frame_rate",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filePath
    ],
    {encoding: "utf8"}
  );
  const parsed = JSON.parse(output) as {
    streams?: Array<{width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string}>;
    format?: {duration?: string};
  };
  const stream = parsed.streams?.[0];
  const width = stream?.width ?? 0;
  const height = stream?.height ?? 0;
  const frameRateText = stream?.avg_frame_rate && stream.avg_frame_rate !== "0/0" ? stream.avg_frame_rate : stream?.r_frame_rate ?? "30/1";
  const [numerator, denominator] = frameRateText.split("/").map((value) => Number(value));
  const fps = denominator > 0 ? numerator / denominator : 30;
  const durationSeconds = Number(parsed.format?.duration ?? "0");

  return {
    width,
    height,
    fps: Number.isFinite(fps) && fps > 0 ? Number(fps.toFixed(3)) : 30,
    durationSeconds: Number.isFinite(durationSeconds) ? Number(durationSeconds.toFixed(3)) : 0
  };
};

const resolveDefinition = (fileName: string): Partial<TransitionOverlayAsset> | null => {
  return sourceDefinitions.find((definition) => definition.match.test(fileName))?.meta ?? null;
};

const inferAsset = (fileName: string, metadata: ProbedVideoMetadata): TransitionOverlayAsset => {
  const definition = resolveDefinition(fileName);
  const orientation = (definition?.orientation ?? inferOrientation(fileName)) as TransitionOverlayOrientation;
  const category = definition?.category ?? inferCategory(fileName);
  const blendMode = (definition?.blendMode ?? inferBlendMode(category)) as TransitionOverlayBlendMode;
  const fadePreference = (definition?.fadePreference ?? inferFadePreference(category)) as TransitionOverlayFadePreference;
  const trimWindow = definition?.preferredTrimWindow ?? inferTrimWindow(metadata.durationSeconds, category);
  const recommendedDurationSeconds = definition?.recommendedDurationSeconds ?? (
    category === "burn" || category === "rough-burn"
      ? 1.65
      : category === "light-leak"
        ? 1.55
        : category === "flare"
          ? 1.38
          : category === "montage"
            ? 1.32
            : 1.38
  );

  const label = definition?.label ?? fileName.replace(/\.[^.]+$/, "").replace(/\b\w/g, (value) => value.toUpperCase());
  const id = definition?.id ?? slugify(fileName.replace(/\.[^.]+$/, ""));

  return {
    id,
    label,
    src: `transitions/${id}${path.extname(fileName).toLowerCase()}`,
    originalFileName: fileName,
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    durationSeconds: metadata.durationSeconds,
    orientation,
    orientationSource: definition?.orientationSource ?? (/landscape/i.test(fileName) ? "filename-tag" : "manual"),
    category,
    styleTags: definition?.styleTags ?? inferStyleTags(fileName, category, orientation),
    recommendedDurationSeconds,
    preferredTrimWindow: trimWindow,
    blendMode,
    fadePreference,
    opacity: definition?.opacity ?? (category === "click-pin" ? 0.97 : category.includes("burn") || category.includes("leak") ? 0.93 : 0.95)
  };
};

if (!existsSync(sourceDir)) {
  throw new Error(`Source transition directory not found: ${sourceDir}`);
}

const supportedFiles = readdirSync(sourceDir)
  .filter((fileName) => VIDEO_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
  .sort((left, right) => left.localeCompare(right));

mkdirSync(publicDir, {recursive: true});
mkdirSync(path.dirname(dataFile), {recursive: true});

const assets = supportedFiles.map((fileName) => {
  const sourcePath = path.join(sourceDir, fileName);
  const metadata = probeVideoMetadata(sourcePath);
  const asset = inferAsset(fileName, metadata);
  const destinationPath = path.join(publicDir, path.basename(asset.src));

  copyFileSync(sourcePath, destinationPath);
  return asset;
});

writeFileSync(dataFile, `${JSON.stringify(assets, null, 2)}\n`, "utf8");

console.log(
  [
    `synced ${assets.length} transition overlays`,
    `source=${sourceDir}`,
    `public=${publicDir}`,
    `data=${dataFile}`
  ].join(" | ")
);
