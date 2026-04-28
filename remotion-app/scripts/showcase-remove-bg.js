import "dotenv/config";

import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "src", "data");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
const ABSTRACT_LABELS = new Set([
  "amusement",
  "anticipation",
  "anxiety",
  "arrogance",
  "authority",
  "calm",
  "confidence",
  "contemplation",
  "content",
  "control",
  "curiosity",
  "defiance",
  "determination",
  "discount",
  "distress",
  "doing",
  "elegance",
  "emotion",
  "empowerment",
  "energy",
  "escape",
  "fear",
  "focus",
  "gift",
  "growth",
  "help",
  "hope",
  "hurry",
  "important",
  "impossible",
  "improve",
  "improvement",
  "increase",
  "intensity",
  "joy",
  "longing",
  "love",
  "mystery",
  "narcissism",
  "nostalgia",
  "patience",
  "payment",
  "peace",
  "power",
  "price",
  "read",
  "reading",
  "reflection",
  "resources",
  "safe",
  "schedule",
  "secure",
  "security",
  "sell",
  "send",
  "serenity",
  "star",
  "stability",
  "strategy",
  "strength",
  "strong",
  "success",
  "time",
  "trust",
  "unease",
  "verified",
  "vetrified",
  "withdraw",
  "wonder",
  "wrong"
]);
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "of",
  "the",
  "to",
  "with"
]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const readArgValue = (flag) => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  const inputDir = readArgValue("--input-dir");
  if (!inputDir) {
    throw new Error("Missing required --input-dir argument.");
  }

  const batchSlug = readArgValue("--batch") ?? toSlug(path.basename(inputDir));
  return {
    inputDir: path.resolve(inputDir),
    batchSlug,
    sourceDir: path.resolve(
      readArgValue("--source-dir") ?? path.join(PUBLIC_DIR, "showcase-source", "imports", batchSlug)
    ),
    outputDir: path.resolve(
      readArgValue("--output-dir") ?? path.join(PUBLIC_DIR, "showcase-assets", "imports", batchSlug)
    ),
    manifestPath: path.resolve(
      readArgValue("--manifest") ?? path.join(DATA_DIR, `showcase-imports.${batchSlug}.json`)
    ),
    apiKeys: parseApiKeys(readArgValue("--api-keys") ?? process.env.REMOVE_BG_API_KEYS ?? process.env.REMOVE_BG_API_KEY ?? ""),
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force")
  };
};

const parseApiKeys = (value) => {
  return value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toSlug = (value) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const tokenizeName = (value) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
};

const unique = (values) => [...new Set(values)];

const suggestSearchTerms = (fileName) => {
  const base = path.parse(fileName).name;
  return unique(
    tokenizeName(base).filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
};

const suggestAssetId = (fileName) => {
  const terms = suggestSearchTerms(fileName);
  return toSlug(terms.join("-")) || toSlug(path.parse(fileName).name) || "showcase-import";
};

const suggestCanonicalLabel = (terms) => {
  return terms.find((term) => !ABSTRACT_LABELS.has(term)) ?? null;
};

const mimeForExtension = (extension) => {
  const normalized = extension.toLowerCase();
  if (normalized === ".png") {
    return "image/png";
  }
  if (normalized === ".webp") {
    return "image/webp";
  }
  if (normalized === ".bmp") {
    return "image/bmp";
  }
  return "image/jpeg";
};

const relativeFromRoot = (filePath) => path.relative(ROOT, filePath).replace(/\\/g, "/");

const createStableNameMap = async (inputDir) => {
  const {readdir} = await import("node:fs/promises");
  const entries = await readdir(inputDir, {withFileTypes: true});
  const counters = new Map();
  const mapped = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    const sourcePath = path.join(inputDir, entry.name);
    const terms = suggestSearchTerms(entry.name);
    const assetIdBase = suggestAssetId(entry.name);
    const nextCount = (counters.get(assetIdBase) ?? 0) + 1;
    counters.set(assetIdBase, nextCount);
    const stableId = nextCount === 1 ? assetIdBase : `${assetIdBase}-${String(nextCount).padStart(2, "0")}`;
    mapped.push({
      originalName: entry.name,
      originalPath: sourcePath,
      extension,
      supported: SUPPORTED_IMAGE_EXTENSIONS.has(extension),
      assetId: stableId,
      searchTerms: terms,
      canonicalLabel: suggestCanonicalLabel(terms),
      stagedSourceName: `${stableId}${extension}`,
      outputName: `${stableId}.png`
    });
  }

  return mapped.sort((a, b) => a.originalName.localeCompare(b.originalName));
};

const postRemoveBg = async ({filePath, apiKey}) => {
  const extension = path.extname(filePath).toLowerCase();
  const bytes = await readFile(filePath);
  const formData = new FormData();
  formData.append("image_file", new Blob([bytes], {type: mimeForExtension(extension)}), path.basename(filePath));
  formData.append("size", "auto");
  formData.append("format", "png");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey
    },
    body: formData
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  if (response.ok) {
    return {
      ok: true,
      buffer,
      status: response.status,
      error: null
    };
  }

  return {
    ok: false,
    buffer: null,
    status: response.status,
    error: buffer.toString("utf-8") || response.statusText
  };
};

const isRotateWorthyStatus = (status) => status === 402 || status === 403 || status === 429;

const saveOutputPng = async (buffer, outputPath) => {
  await sharp(buffer)
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toFile(outputPath);
};

const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const main = async () => {
  const args = parseArgs();
  const mappedFiles = await createStableNameMap(args.inputDir);
  const supportedFiles = mappedFiles.filter((file) => file.supported);
  const skippedFiles = mappedFiles.filter((file) => !file.supported);

  await mkdir(args.sourceDir, {recursive: true});
  await mkdir(args.outputDir, {recursive: true});

  const manifest = {
    batch: args.batchSlug,
    inputDir: args.inputDir,
    stagedSourceDir: args.sourceDir,
    outputDir: args.outputDir,
    createdAt: new Date().toISOString(),
    dryRun: args.dryRun,
    totalFiles: mappedFiles.length,
    supportedFiles: supportedFiles.length,
    skippedFiles: skippedFiles.length,
    processedFiles: 0,
    cachedFiles: 0,
    failedFiles: 0,
    items: []
  };

  for (const file of skippedFiles) {
    manifest.items.push({
      originalName: file.originalName,
      status: "skipped",
      reason: `Unsupported extension: ${file.extension}`,
      assetId: file.assetId,
      searchTerms: file.searchTerms,
      suggestedCanonicalLabel: file.canonicalLabel
    });
  }

  if (!args.dryRun && args.apiKeys.length === 0) {
    throw new Error("No remove.bg API keys were provided. Use REMOVE_BG_API_KEYS or --api-keys.");
  }

  let keyIndex = 0;
  for (const file of supportedFiles) {
    const stagedSourcePath = path.join(args.sourceDir, file.stagedSourceName);
    const outputPath = path.join(args.outputDir, file.outputName);
    await copyFile(file.originalPath, stagedSourcePath);

    if (args.dryRun) {
      manifest.items.push({
        originalName: file.originalName,
        status: "dry-run",
        assetId: file.assetId,
        searchTerms: file.searchTerms,
        suggestedCanonicalLabel: file.canonicalLabel,
        stagedSourcePath: relativeFromRoot(stagedSourcePath),
        outputPath: relativeFromRoot(outputPath)
      });
      continue;
    }

    if (!args.force) {
      try {
        await readFile(outputPath);
        manifest.cachedFiles += 1;
        manifest.items.push({
          originalName: file.originalName,
          status: "cached",
          assetId: file.assetId,
          searchTerms: file.searchTerms,
          suggestedCanonicalLabel: file.canonicalLabel,
          stagedSourcePath: relativeFromRoot(stagedSourcePath),
          outputPath: relativeFromRoot(outputPath)
        });
        continue;
      } catch {
        // Keep processing.
      }
    }

    let saved = false;
    let lastError = "Unknown remove.bg failure.";
    let lastStatus = null;
    const triedKeyIndices = new Set();

    while (!saved && keyIndex < args.apiKeys.length) {
      const currentKeyIndex = keyIndex;
      triedKeyIndices.add(currentKeyIndex);
      const result = await postRemoveBg({
        filePath: stagedSourcePath,
        apiKey: args.apiKeys[currentKeyIndex]
      });

      if (result.ok) {
        await saveOutputPng(result.buffer, outputPath);
        manifest.processedFiles += 1;
        manifest.items.push({
          originalName: file.originalName,
          status: "processed",
          assetId: file.assetId,
          searchTerms: file.searchTerms,
          suggestedCanonicalLabel: file.canonicalLabel,
          stagedSourcePath: relativeFromRoot(stagedSourcePath),
          outputPath: relativeFromRoot(outputPath),
          apiKeySlot: currentKeyIndex + 1
        });
        saved = true;
        break;
      }

      lastError = result.error;
      lastStatus = result.status;
      if (isRotateWorthyStatus(result.status) && currentKeyIndex < args.apiKeys.length - 1) {
        keyIndex += 1;
        continue;
      }
      break;
    }

    if (!saved) {
      manifest.failedFiles += 1;
      manifest.items.push({
        originalName: file.originalName,
        status: "failed",
        assetId: file.assetId,
        searchTerms: file.searchTerms,
        suggestedCanonicalLabel: file.canonicalLabel,
        stagedSourcePath: relativeFromRoot(stagedSourcePath),
        outputPath: relativeFromRoot(outputPath),
        apiKeySlotsTried: [...triedKeyIndices].map((value) => value + 1),
        errorStatus: lastStatus,
        error: lastError
      });
      if (isRotateWorthyStatus(lastStatus) && keyIndex >= args.apiKeys.length - 1) {
        break;
      }
    }
  }

  manifest.completedAt = new Date().toISOString();
  await writeJson(args.manifestPath, manifest);

  console.log(`Batch: ${args.batchSlug}`);
  console.log(`Supported images: ${manifest.supportedFiles}`);
  console.log(`Skipped files: ${manifest.skippedFiles}`);
  console.log(`Processed files: ${manifest.processedFiles}`);
  console.log(`Cached files: ${manifest.cachedFiles}`);
  console.log(`Failed files: ${manifest.failedFiles}`);
  console.log(`Manifest: ${args.manifestPath}`);
  console.log(`Staged source dir: ${args.sourceDir}`);
  console.log(`Processed output dir: ${args.outputDir}`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
