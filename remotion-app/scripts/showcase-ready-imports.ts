import {copyFile, mkdir, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";

import type {MotionAssetManifest, MotionMoodTag, MotionShowcasePlacementHint, MotionTier} from "../src/lib/types.ts";

type ReadyImportArgs = {
  inputDir: string;
  batch: string;
  sourceDir: string;
  outputDir: string;
  manifestPath: string;
  catalogPath: string;
};

type ReadyImportDescriptor = {
  assetId: string;
  canonicalLabel: string;
  placementHint: MotionShowcasePlacementHint;
  tier: MotionTier;
  themeTags: MotionMoodTag[];
  searchTerms: string[];
  notes: string;
};

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "src", "data");

const parseArgs = (): ReadyImportArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
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

  const batch = readArgValue("--batch") ?? toSlug(path.basename(inputDir));

  return {
    inputDir: path.resolve(inputDir),
    batch,
    sourceDir: path.resolve(
      readArgValue("--source-dir") ?? path.join(PUBLIC_DIR, "showcase-source", "imports", batch)
    ),
    outputDir: path.resolve(
      readArgValue("--output-dir") ?? path.join(PUBLIC_DIR, "showcase-assets", "imports", batch)
    ),
    manifestPath: path.resolve(
      readArgValue("--manifest") ?? path.join(DATA_DIR, `showcase-imports.${batch}.json`)
    ),
    catalogPath: path.resolve(
      readArgValue("--catalog") ?? path.join(DATA_DIR, `showcase-assets.imports.${batch}.local.json`)
    )
  };
};

const toSlug = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const singularize = (value: string): string => {
  if (value.length > 4 && /(ches|shes|xes|zes|ses)$/i.test(value)) {
    return value.slice(0, -2);
  }
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
};

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const buildSearchTerms = (values: string[]): string[] => {
  const terms = new Set<string>();

  values.forEach((entry) => {
    const normalized = normalizeText(entry);
    if (!normalized) {
      return;
    }

    const tokens = normalized
      .split(" ")
      .map(singularize)
      .filter((token) => token.length > 1);
    if (tokens.length === 0) {
      return;
    }

    terms.add(tokens.join(" "));
    tokens.forEach((token, index) => {
      terms.add(token);
      if (index < tokens.length - 1) {
        terms.add(`${token} ${tokens[index + 1]}`);
      }
    });
  });

  return [...terms];
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const relativeFromRoot = (filePath: string): string => path.relative(ROOT, filePath).replace(/\\/g, "/");

const describeFile = (fileName: string): ReadyImportDescriptor => {
  const lower = fileName.toLowerCase();

  if (/camera_vintage/.test(lower)) {
    return {
      assetId: "camera-concrete-vintage",
      canonicalLabel: "camera",
      placementHint: "right",
      tier: "hero",
      themeTags: ["neutral", "cool", "calm", "heroic"],
      searchTerms: ["camera", "vintage camera", "photography", "filming", "shooting", "content", "video"],
      notes: "Concrete vintage camera cutout for filming, photography, and video language."
    };
  }
  if (/^camera_3/.test(lower)) {
    return {
      assetId: "camera-concrete-tertiary",
      canonicalLabel: "camera",
      placementHint: "right",
      tier: "hero",
      themeTags: ["neutral", "cool", "calm", "heroic"],
      searchTerms: ["camera", "dslr", "lens", "photography", "filming", "shooting", "content"],
      notes: "Concrete DSLR camera cutout for filming, shooting, and content language."
    };
  }
  if (/^camera_2/.test(lower)) {
    return {
      assetId: "camera-concrete-secondary",
      canonicalLabel: "camera",
      placementHint: "right",
      tier: "hero",
      themeTags: ["neutral", "cool", "calm", "heroic"],
      searchTerms: ["camera", "mirrorless camera", "photography", "filming", "shooting", "content"],
      notes: "Concrete mirrorless camera cutout for filming and content creation language."
    };
  }
  if (/^camera/.test(lower)) {
    return {
      assetId: "camera-concrete-primary",
      canonicalLabel: "camera",
      placementHint: "right",
      tier: "hero",
      themeTags: ["neutral", "cool", "calm", "heroic"],
      searchTerms: ["camera", "dslr camera", "photography", "filming", "shooting", "video", "content"],
      notes: "Concrete primary camera cutout for video, filming, and photography language."
    };
  }
  if (/expert/.test(lower)) {
    return {
      assetId: "expert-concrete-professional",
      canonicalLabel: "expert",
      placementHint: "center",
      tier: "premium",
      themeTags: ["neutral", "authority"],
      searchTerms: ["expert", "professional", "coach", "mentor", "authority", "badge"],
      notes: "Concrete expert badge cutout for professional, coach, and authority language."
    };
  }
  if (/home__house/.test(lower)) {
    return {
      assetId: "home-concrete-house",
      canonicalLabel: "home",
      placementHint: "left",
      tier: "hero",
      themeTags: ["neutral", "authority", "heroic"],
      searchTerms: ["home", "house", "property", "household", "real estate"],
      notes: "Concrete house cutout for home, property, and household language."
    };
  }
  if (/home_image/.test(lower)) {
    return {
      assetId: "home-concrete-image",
      canonicalLabel: "home",
      placementHint: "left",
      tier: "hero",
      themeTags: ["neutral", "authority", "heroic"],
      searchTerms: ["home", "house", "property", "real estate", "living"],
      notes: "Concrete home illustration cutout for home-life and property language."
    };
  }
  if (/money purchase, pay/.test(lower)) {
    return {
      assetId: "money-concrete-purchase-pay",
      canonicalLabel: "money",
      placementHint: "center",
      tier: "premium",
      themeTags: ["neutral", "cool", "authority", "heroic"],
      searchTerms: ["money", "purchase", "pay", "payment", "cash", "finance", "currency"],
      notes: "Concrete money cutout for purchase, pay, and finance language."
    };
  }
  if (/money__purchase/.test(lower)) {
    return {
      assetId: "money-concrete-purchase",
      canonicalLabel: "money",
      placementHint: "center",
      tier: "premium",
      themeTags: ["neutral", "cool", "authority", "heroic"],
      searchTerms: ["money", "purchase", "payment", "cash", "finance", "currency"],
      notes: "Concrete money purchase cutout for payment and finance language."
    };
  }
  if (/months__calender.*year/.test(lower)) {
    return {
      assetId: "calendar-concrete-months-year",
      canonicalLabel: "calendar",
      placementHint: "center",
      tier: "premium",
      themeTags: ["neutral", "cool", "calm"],
      searchTerms: ["calendar", "month", "months", "year", "timeline", "schedule", "planning"],
      notes: "Concrete calendar cutout for month, year, and planning language."
    };
  }
  if (/thinking__choice__choose/.test(lower)) {
    return {
      assetId: "thinking-concrete-choice",
      canonicalLabel: "thinking",
      placementHint: "center",
      tier: "premium",
      themeTags: ["neutral", "calm"],
      searchTerms: ["thinking", "choice", "choose", "decision", "question", "idea"],
      notes: "Concrete thinking cutout for choice, question, and decision language."
    };
  }
  if (/^cap_/.test(lower)) {
    return {
      assetId: "cap-concrete",
      canonicalLabel: "cap",
      placementHint: "center",
      tier: "editorial",
      themeTags: ["neutral"],
      searchTerms: ["cap", "hat", "headwear"],
      notes: "Concrete cap cutout."
    };
  }

  const fallback = normalizeText(path.parse(fileName).name);
  return {
    assetId: toSlug(fallback) || `concrete-${hashString(fileName).toString(36)}`,
    canonicalLabel: fallback.split(" ")[0] ?? "asset",
    placementHint: "center",
    tier: "editorial",
    themeTags: ["neutral"],
    searchTerms: unique([fallback]),
    notes: `Concrete showcase cutout from ${fileName}.`
  };
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  await mkdir(args.sourceDir, {recursive: true});
  await mkdir(args.outputDir, {recursive: true});

  const entries = await readdir(args.inputDir, {withFileTypes: true});
  const files = entries
    .filter((entry) => entry.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));

  const manifestItems: Array<Record<string, unknown>> = [];
  const catalog: MotionAssetManifest[] = [];

  for (const entry of files) {
    const descriptor = describeFile(entry.name);
    const originalPath = path.join(args.inputDir, entry.name);
    const extension = path.extname(entry.name).toLowerCase() || ".png";
    const stagedSourcePath = path.join(args.sourceDir, `${descriptor.assetId}${extension}`);
    const outputPath = path.join(args.outputDir, `${descriptor.assetId}${extension}`);

    const sourceStats = await stat(originalPath);
    if (!sourceStats.isFile()) {
      continue;
    }

    await copyFile(originalPath, stagedSourcePath);
    await copyFile(originalPath, outputPath);

    const relativeSource = relativeFromRoot(stagedSourcePath);
    const relativeOutput = relativeFromRoot(outputPath);
    const publicRelativeOutput = relativeOutput.replace(/^public\//, "");

    manifestItems.push({
      originalName: entry.name,
      status: "cached",
      assetId: descriptor.assetId,
      searchTerms: descriptor.searchTerms,
      suggestedCanonicalLabel: descriptor.canonicalLabel,
      stagedSourcePath: relativeSource,
      outputPath: relativeOutput
    });

    catalog.push({
      id: descriptor.assetId,
      assetRole: "showcase",
      canonicalLabel: descriptor.canonicalLabel,
      showcasePlacementHint: descriptor.placementHint,
      family: "foreground-element",
      tier: descriptor.tier,
      src: publicRelativeOutput,
      alphaMode: "straight",
      placementZone: "foreground-cross",
      durationPolicy: "scene-span",
      themeTags: descriptor.themeTags,
      searchTerms: buildSearchTerms([
        ...descriptor.searchTerms,
        descriptor.canonicalLabel,
        descriptor.notes
      ]),
      safeArea: "full-frame",
      loopable: false,
      blendMode: "normal",
      opacity: 1,
      source: "local",
      sourceId: descriptor.assetId,
      remoteUrl: publicRelativeOutput,
      score: hashString(`${descriptor.canonicalLabel}|${descriptor.assetId}`) % 100
    });
  }

  catalog.sort((a, b) => a.id.localeCompare(b.id));
  manifestItems.sort((a, b) => String(a.assetId).localeCompare(String(b.assetId)));

  await writeJson(args.catalogPath, catalog);
  await writeJson(args.manifestPath, {
    batch: args.batch,
    inputDir: args.inputDir,
    stagedSourceDir: args.sourceDir,
    outputDir: args.outputDir,
    createdAt: new Date().toISOString(),
    dryRun: false,
    totalFiles: files.length,
    supportedFiles: files.length,
    skippedFiles: 0,
    processedFiles: 0,
    cachedFiles: files.length,
    failedFiles: 0,
    items: manifestItems
  });

  console.log(`Imported ${catalog.length} ready showcase assets into ${args.batch}.`);
  console.log(`Catalog: ${args.catalogPath}`);
  console.log(`Manifest: ${args.manifestPath}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
