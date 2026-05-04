import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import sharp from "sharp";

import {
  buildShowcaseAssetManifest,
  isConcreteShowcaseLabel,
  normalizeShowcaseAssetSeedRow,
  parseShowcaseCsvRows,
  type ShowcaseAssetCsvRow
} from "../src/lib/motion-platform/showcase-asset-catalog";
import type {MotionAssetSource} from "../src/lib/types";

const ROOT = process.cwd();
export const DEFAULT_CSV_PATH = path.join(ROOT, "src", "data", "showcase-assets.csv");
export const DEFAULT_OUTPUT_JSON = path.join(ROOT, "src", "data", "showcase-assets.remote.json");
export const DEFAULT_PUBLIC_DIR = path.join(ROOT, "public");
export const DEFAULT_CACHE_DIR = path.join(DEFAULT_PUBLIC_DIR, "showcase-assets");

type UpsertRecord = Record<string, unknown>;
type SyncPaths = {
  csvPath: string;
  outputJson: string;
  publicDir: string;
  cacheDir: string;
  publish: boolean;
};

export type ShowcaseAssetSyncOptions = Partial<SyncPaths>;
export type ShowcaseAssetSyncResult = {
  csvPath: string;
  outputJson: string;
  publicDir: string;
  cacheDir: string;
  publish: boolean;
  manifests: ReturnType<typeof buildShowcaseAssetManifest>[];
  seedRowCount: number;
  normalizedRowCount: number;
  cachedFileCount: number;
  supabaseRows: number;
  warnings: string[];
};

const getEnv = (key: string): string => {
  return (process.env[key] ?? "").trim();
};

const getOptionalPath = (value: string, fallback: string): string => {
  return value ? path.resolve(ROOT, value) : fallback;
};

export const resolveSyncPaths = (options: ShowcaseAssetSyncOptions = {}): SyncPaths => {
  if (Object.keys(options).length > 0) {
    return {
      csvPath: options.csvPath ? path.resolve(ROOT, options.csvPath) : DEFAULT_CSV_PATH,
      outputJson: options.outputJson ? path.resolve(ROOT, options.outputJson) : DEFAULT_OUTPUT_JSON,
      publicDir: options.publicDir ? path.resolve(ROOT, options.publicDir) : DEFAULT_PUBLIC_DIR,
      cacheDir: options.cacheDir ? path.resolve(ROOT, options.cacheDir) : DEFAULT_CACHE_DIR,
      publish: options.publish ?? false
    };
  }

  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | null => {
    const index = args.indexOf(flag);
    return index >= 0 ? (args[index + 1] ?? null) : null;
  };

  return {
    csvPath: getOptionalPath(readArgValue("--csv") ?? getEnv("SHOWCASE_ASSET_CSV_PATH"), DEFAULT_CSV_PATH),
    outputJson: getOptionalPath(readArgValue("--output-json") ?? getEnv("SHOWCASE_ASSET_OUTPUT_JSON"), DEFAULT_OUTPUT_JSON),
    publicDir: getOptionalPath(readArgValue("--public-dir") ?? getEnv("SHOWCASE_ASSET_PUBLIC_DIR"), DEFAULT_PUBLIC_DIR),
    cacheDir: getOptionalPath(readArgValue("--cache-dir") ?? getEnv("SHOWCASE_ASSET_CACHE_DIR"), DEFAULT_CACHE_DIR),
    publish: (readArgValue("--publish") ?? getEnv("SHOWCASE_ASSET_PUBLISH") ?? "true").toLowerCase() !== "false"
  };
};

const parseArgs = (): SyncPaths => {
  return resolveSyncPaths();
};

const readJsonIfExists = async <T,>(filePath: string): Promise<T | null> => {
  try {
    const contents = await readFile(filePath, "utf-8");
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const resolveSourcePath = (publicDir: string, sourceFile: string): string => {
  return path.isAbsolute(sourceFile) ? sourceFile : path.join(publicDir, sourceFile);
};

const toDriveThumbnailUrl = (url: string): string => {
  const idMatch = url.match(/\/file\/d\/([^/]+)/i) ?? url.match(/[?&]id=([^&]+)/i);
  if (!idMatch) {
    return url;
  }
  const fileId = idMatch[1];
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
};

const fetchBytes = async (url: string): Promise<{bytes: Uint8Array; contentType: string}> => {
  const resolvedUrl = /drive\.google\.com\/file\/d\//i.test(url) ? toDriveThumbnailUrl(url) : url;
  const response = await fetch(resolvedUrl, {
    headers: {
      Accept: "image/*,application/octet-stream;q=0.9,*/*;q=0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${resolvedUrl} (${response.status} ${response.statusText})`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? ""
  };
};

const contentTypeToExt = (contentType: string): string => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("png")) {
    return ".png";
  }
  if (normalized.includes("webp")) {
    return ".webp";
  }
  if (normalized.includes("gif")) {
    return ".gif";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return ".jpg";
  }
  if (normalized.includes("svg")) {
    return ".svg";
  }
  return ".jpg";
};

const inferExtFromPath = (value: string): string => {
  const ext = path.extname(value).toLowerCase();
  if (ext) {
    return ext;
  }
  return ".jpg";
};

const colorDistance = ({
  red,
  green,
  blue
}: {
  red: number;
  green: number;
  blue: number;
}, reference: {
  red: number;
  green: number;
  blue: number;
}): number => {
  return Math.sqrt(
    (red - reference.red) ** 2 +
      (green - reference.green) ** 2 +
      (blue - reference.blue) ** 2
  );
};

const collectBorderSamples = (data: Uint8Array, width: number, height: number, channels: number): Array<{
  red: number;
  green: number;
  blue: number;
  alpha: number;
}> => {
  const samples: Array<{red: number; green: number; blue: number; alpha: number}> = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 32));

  const pushPixel = (x: number, y: number): void => {
    const index = (y * width + x) * channels;
    samples.push({
      red: data[index],
      green: data[index + 1],
      blue: data[index + 2],
      alpha: data[index + 3]
    });
  };

  for (let x = 0; x < width; x += step) {
    pushPixel(x, 0);
    pushPixel(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    pushPixel(0, y);
    pushPixel(width - 1, y);
  }

  return samples;
};

const removeBorderBackground = (data: Uint8Array, width: number, height: number, channels: number): boolean => {
  const borderSamples = collectBorderSamples(data, width, height, channels);
  const opaqueSamples = borderSamples.filter((sample) => sample.alpha > 24);

  if (opaqueSamples.length < 8) {
    return false;
  }

  const average = opaqueSamples.reduce(
    (accumulator, sample) => ({
      red: accumulator.red + sample.red,
      green: accumulator.green + sample.green,
      blue: accumulator.blue + sample.blue,
      alpha: accumulator.alpha + sample.alpha
    }),
    {red: 0, green: 0, blue: 0, alpha: 0}
  );

  const background = {
    red: average.red / opaqueSamples.length,
    green: average.green / opaqueSamples.length,
    blue: average.blue / opaqueSamples.length
  };

  const variance =
    opaqueSamples.reduce((sum, sample) => {
      return sum + colorDistance(sample, background);
    }, 0) / opaqueSamples.length;

  if (variance > 28) {
    return false;
  }

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let touched = false;
  while (queue.length > 0) {
    const pixelIndex = queue.shift() as number;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const dataIndex = pixelIndex * channels;
    const alpha = data[dataIndex + 3];
    if (alpha <= 8) {
      continue;
    }

    const distance = colorDistance(
      {
        red: data[dataIndex],
        green: data[dataIndex + 1],
        blue: data[dataIndex + 2]
      },
      background
    );

    if (distance > 42) {
      continue;
    }

    touched = true;
    const fade =
      distance <= 22
        ? 0
        : Math.round(((distance - 22) / Math.max(1, 42 - 22)) * alpha * 0.45);
    data[dataIndex + 3] = fade;

    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return touched;
};

const processRasterAsset = async ({
  input,
  outputPath
}: {
  input: string | Uint8Array;
  outputPath: string;
}): Promise<void> => {
  const prepared = sharp(input, {animated: false}).ensureAlpha();
  const raw = await prepared.raw().toBuffer({resolveWithObject: true});
  const pixelData = new Uint8Array(raw.data);

  removeBorderBackground(pixelData, raw.info.width, raw.info.height, raw.info.channels);

  await sharp(pixelData, {
    raw: {
      width: raw.info.width,
      height: raw.info.height,
      channels: raw.info.channels
    }
  })
    .trim()
    .png()
    .toFile(outputPath);
};

const createFallbackSvg = (label: string, assetId: string): string => {
  const safeLabel = label.toUpperCase();
  const safeId = assetId.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#162443"/>
      <stop offset="100%" stop-color="#09101f"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="rgba(84, 137, 255, 0.28)"/>
      <stop offset="100%" stop-color="rgba(84, 137, 255, 0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <circle cx="600" cy="420" r="420" fill="url(#glow)"/>
  <rect x="120" y="790" width="960" height="220" rx="48" fill="rgba(9, 16, 31, 0.52)" stroke="rgba(180, 206, 255, 0.24)" stroke-width="4"/>
  <text x="600" y="555" fill="#f7fbff" font-family="DM Sans, Arial, sans-serif" font-size="94" font-weight="800" letter-spacing="12" text-anchor="middle">${safeLabel}</text>
  <text x="600" y="670" fill="#8fb1ff" font-family="DM Sans, Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="8" text-anchor="middle">${safeId}</text>
</svg>`;
};

const ensureSeedRows = (rows: ShowcaseAssetCsvRow[]): ShowcaseAssetCsvRow[] => {
  const normalized = rows
    .map((row) => normalizeShowcaseAssetSeedRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof normalizeShowcaseAssetSeedRow>> => row !== null)
    .filter((row) => isConcreteShowcaseLabel(row.canonicalLabel));

  return normalized.map((row) => ({
    assetId: row.assetId,
    canonicalLabel: row.canonicalLabel,
    sourceFile: row.sourceFile,
    sourceUrl: row.sourceUrl,
    searchTerms: row.searchTerms.join("; "),
    placementHint: row.placementHint,
    notes: row.notes
  }));
};

const upsertToSupabase = async (records: UpsertRecord[]): Promise<number> => {
  const supabaseUrl = getEnv("SHOWCASE_SUPABASE_URL") || getEnv("SUPABASE_URL");
  const table = getEnv("SHOWCASE_SUPABASE_ASSETS_TABLE") || getEnv("SUPABASE_ASSETS_TABLE");
  const token =
    getEnv("SHOWCASE_SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SHOWCASE_SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !table || !token) {
    return 0;
  }

  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set("on_conflict", "id");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(records)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase upsert failed (${response.status} ${response.statusText}): ${text}`);
  }

  return records.length;
};

export const syncShowcaseAssetCache = async (
  options: ShowcaseAssetSyncOptions = {}
): Promise<ShowcaseAssetSyncResult> => {
  const {csvPath, outputJson, publicDir, cacheDir, publish} = resolveSyncPaths(options);
  const csvContent = await readFile(csvPath, "utf-8");
  const csvRows = ensureSeedRows(parseShowcaseCsvRows(csvContent));
  const warnings: string[] = [];

  await mkdir(cacheDir, {recursive: true});
  await mkdir(path.dirname(outputJson), {recursive: true});

  const normalizedRecords = [];
  const upsertRecords: UpsertRecord[] = [];

  for (const row of csvRows) {
    const seed = normalizeShowcaseAssetSeedRow(row);
    if (!seed) {
      continue;
    }

    const sourcePath = seed.sourceFile ? resolveSourcePath(publicDir, seed.sourceFile) : null;
    const hasLocalSource = sourcePath !== null && sourcePath.length > 0;
    const sourceExt = seed.sourceUrl
      ? inferExtFromPath(seed.sourceUrl)
      : sourcePath
        ? inferExtFromPath(sourcePath)
        : ".svg";
    const rasterSource = [".png", ".jpg", ".jpeg", ".webp"].includes(sourceExt);
    const cachedExt = rasterSource ? ".png" : sourceExt;
    const cachedPath = path.join(cacheDir, `${seed.assetId}${cachedExt}`);
    let finalSrc = path.relative(publicDir, cachedPath).replace(/\\/g, "/");
    let source: MotionAssetSource = seed.sourceUrl ? "drive" : "local";
    let remoteUrl = seed.sourceUrl || seed.sourceFile || finalSrc;

    try {
      if (sourcePath && hasLocalSource) {
        if (rasterSource) {
          await processRasterAsset({
            input: sourcePath,
            outputPath: cachedPath
          });
        } else {
          await copyFile(sourcePath, cachedPath);
        }
      } else if (seed.sourceUrl) {
        const {bytes, contentType} = await fetchBytes(seed.sourceUrl);
        const ext = contentTypeToExt(contentType);
        const resolvedCachedPath = path.join(cacheDir, `${seed.assetId}${ext}`);
        if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
          const rasterCachedPath = path.join(cacheDir, `${seed.assetId}.png`);
          await processRasterAsset({
            input: bytes,
            outputPath: rasterCachedPath
          });
          finalSrc = path.relative(publicDir, rasterCachedPath).replace(/\\/g, "/");
        } else {
          await writeFile(resolvedCachedPath, bytes);
          finalSrc = path.relative(publicDir, resolvedCachedPath).replace(/\\/g, "/");
        }
      } else {
        const fallbackPath = path.join(cacheDir, `${seed.assetId}.svg`);
        await writeFile(fallbackPath, createFallbackSvg(seed.canonicalLabel, seed.assetId), "utf-8");
        finalSrc = path.relative(publicDir, fallbackPath).replace(/\\/g, "/");
        source = "local";
      }
    } catch (error) {
      const fallbackPath = path.join(cacheDir, `${seed.assetId}.svg`);
      await writeFile(fallbackPath, createFallbackSvg(seed.canonicalLabel, seed.assetId), "utf-8");
      finalSrc = path.relative(publicDir, fallbackPath).replace(/\\/g, "/");
      source = "local";
      remoteUrl = seed.sourceUrl || seed.sourceFile || finalSrc;
      warnings.push(
        `Showcase asset fallback created for ${seed.assetId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const manifest = buildShowcaseAssetManifest({
      ...seed,
      src: finalSrc,
      source
    });

    normalizedRecords.push(manifest);
    upsertRecords.push({
      id: manifest.id,
      asset_role: manifest.assetRole,
      canonical_label: manifest.canonicalLabel,
      family: manifest.family,
      tier: manifest.tier,
      src: manifest.src,
      alpha_mode: manifest.alphaMode,
      placement_zone: manifest.placementZone,
      duration_policy: manifest.durationPolicy,
      theme_tags: manifest.themeTags,
      search_terms: manifest.searchTerms,
      safe_area: manifest.safeArea,
      loopable: manifest.loopable,
      blend_mode: manifest.blendMode,
      opacity: manifest.opacity,
      source: manifest.source,
      source_id: manifest.sourceId,
      remote_url: manifest.remoteUrl,
      score: manifest.score,
      showcase_placement_hint: manifest.showcasePlacementHint
    });
  }

  const deduped = normalizedRecords.reduce<typeof normalizedRecords>((accumulator, record) => {
    if (accumulator.some((entry) => entry.id === record.id)) {
      return accumulator;
    }
    accumulator.push(record);
    return accumulator;
  }, []);

  await writeJson(outputJson, deduped);

  let supabaseRows = 0;
  if (publish) {
    try {
      supabaseRows = await upsertToSupabase(upsertRecords);
    } catch (error) {
      warnings.push(`Supabase publish skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    csvPath,
    outputJson,
    publicDir,
    cacheDir,
    publish,
    manifests: deduped,
    seedRowCount: csvRows.length,
    normalizedRowCount: deduped.length,
    cachedFileCount: normalizedRecords.length,
    supabaseRows,
    warnings
  };
};

const runCli = async (): Promise<void> => {
  const result = await syncShowcaseAssetCache(parseArgs());

  console.log(`Showcase asset cache updated at ${result.outputJson}`);
  console.log(`Seed rows: ${result.seedRowCount}`);
  console.log(`Normalized rows: ${result.normalizedRowCount}`);
  console.log(`Cached files: ${result.cachedFileCount}`);
  console.log(`Supabase rows: ${result.supabaseRows}`);
  result.warnings.forEach((warning) => {
    console.warn(warning);
  });
};

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMainModule) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
