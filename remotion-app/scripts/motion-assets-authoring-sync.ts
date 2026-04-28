import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

import type {MotionAssetManifest, MotionMoodTag, MotionShowcasePlacementHint, MotionTier} from "../src/lib/types";
import {enrichMotionAssetManifest} from "../src/lib/motion-platform/motion-asset-taxonomy";

type AuthoringAssetRecord = {
  assetId: string;
  displayName?: string;
  filename: string;
  type?: string;
  macro?: string;
  keywords?: string[];
  description?: string;
  format?: string;
  imageSlots?: number;
  imageSlotNames?: string[];
  imageSlotRoles?: string[];
  textSlots?: number;
  textSlotNames?: string[];
  textSlotRoles?: string[];
  textArtifacts?: Array<{
    id?: string;
    role?: string;
    category?: string;
    slot?: string;
    text?: string;
    charCount?: number;
  }>;
  version?: string;
};

type AuthoringBatchManifest = {
  version?: number;
  assets?: AuthoringAssetRecord[];
};

const ROOT = process.cwd();
const WORKSPACE_ROOT = path.resolve(ROOT, "..");
const SOURCE_BATCH_DIR = path.join(WORKSPACE_ROOT, "SVG animations");
const SOURCE_MANIFEST_PATH = path.join(SOURCE_BATCH_DIR, "assets.json");
const GENERATED_MANIFEST_PATH = path.join(ROOT, "src", "data", "motion-assets.authoring.generated.json");
const PUBLIC_AUTHORING_DIR = path.join(ROOT, "public", "motion-assets", "authoring");
const PUBLIC_SOURCE_DIR = path.join(ROOT, "public", "motion-assets", "authoring-source");
const PUBLIC_VENDOR_DIR = path.join(ROOT, "public", "motion-assets", "vendor");
const LOCAL_GSAP_BUNDLE = path.join(ROOT, "node_modules", "gsap", "dist", "gsap.min.js");
const REMOTE_GSAP_SRC = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
const LOCAL_VENDOR_GSAP_SRC = "/motion-assets/vendor/gsap.min.js";

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const singularizeToken = (value: string): string => {
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

const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map(singularizeToken)
    .filter((token) => token.length > 1);
};

const buildTextTerms = (value: string): string[] => {
  const tokens = tokenize(value);
  if (tokens.length === 0) {
    return [];
  }

  const terms = new Set<string>();
  terms.add(tokens.join(" "));
  tokens.forEach((token, index) => {
    terms.add(token);
    if (index < tokens.length - 1) {
      terms.add(`${token} ${tokens[index + 1]}`);
    }
  });

  return [...terms];
};

const readJson = async <T,>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const ensureDir = async (filePath: string): Promise<void> => {
  await mkdir(filePath, {recursive: true});
};

const isLocalReference = (value: string): boolean => {
  return !/^(https?:|data:|#|javascript:)/i.test(value);
};

const extractReferencedFiles = (content: string): string[] => {
  const refs = new Set<string>();
  const attributePattern = /(?:href|xlink:href|src)\s*=\s*["']([^"']+)["']/gi;
  const urlPattern = /url\((['"]?)([^'")]+)\1\)/gi;

  for (const match of content.matchAll(attributePattern)) {
    const ref = match[1]?.trim();
    if (ref && isLocalReference(ref)) {
      refs.add(ref);
    }
  }

  for (const match of content.matchAll(urlPattern)) {
    const ref = match[2]?.trim();
    if (ref && isLocalReference(ref)) {
      refs.add(ref);
    }
  }

  return [...refs];
};

const extractStyles = (content: string): string[] => {
  const styles: string[] = [];
  for (const match of content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = match[1]?.trim();
    if (css) {
      styles.push(css);
    }
  }
  return styles;
};

const extractSvgBlock = (content: string): string | null => {
  const match = content.match(/<svg[\s\S]*<\/svg>/i);
  return match?.[0] ?? null;
};

const buildRuntimeSvg = (html: string): string => {
  const svgBlock = extractSvgBlock(html);
  if (!svgBlock) {
    throw new Error("The source HTML does not contain an <svg> block.");
  }

  const styles = extractStyles(html);
  if (styles.length === 0) {
    return svgBlock;
  }

  return svgBlock.replace(
    /^(<svg\b[^>]*>)/i,
    `$1\n<style type="text/css">\n${styles.join("\n\n")}\n</style>\n`
  );
};

const replaceGsapSrc = (content: string): string => {
  if (content.includes(REMOTE_GSAP_SRC) && fs.existsSync(LOCAL_GSAP_BUNDLE)) {
    return content.replaceAll(REMOTE_GSAP_SRC, LOCAL_VENDOR_GSAP_SRC);
  }
  return content;
};

const normalizeLabel = (value: string): string => {
  return normalizeText(value).replace(/\s+/g, " ").trim();
};

const resolveCanonicalLabel = (record: AuthoringAssetRecord): string => {
  const fallbackLabel = normalizeLabel(record.displayName ?? record.assetId);
  const type = normalizeText(record.type ?? "");
  const keywords = normalizeText([record.macro ?? "", ...(record.keywords ?? [])].join(" "));
  const textArtifacts = normalizeText((record.textArtifacts ?? []).map((artifact) => artifact.text ?? "").join(" "));
  const pool = `${fallbackLabel} ${type} ${keywords} ${textArtifacts}`;

  if (/(folder|stack|container|project)/.test(pool)) {
    return "folder";
  }
  if (/(education|book|manual|guide|learn)/.test(pool)) {
    return "education";
  }
  if (/(analytics|chart|graph|metric|kpi|budget|finance|money|counter)/.test(pool)) {
    return "analytics";
  }
  if (/(profile|showcase|portrait|card|box|badge)/.test(pool)) {
    return "showcase";
  }
  if (/(typography|poster|headline)/.test(pool)) {
    return "poster";
  }
  if (/(command|bar|ui|interface)/.test(pool)) {
    return "command";
  }
  if (/(workflow|blueprint|process|plan|system)/.test(pool)) {
    return "workflow";
  }
  if (/(camera|lens|photo|image|media)/.test(pool)) {
    return "camera";
  }

  return fallbackLabel.split(" ")[0] ?? record.assetId;
};

const resolvePlacementHint = (record: AuthoringAssetRecord): MotionShowcasePlacementHint => {
  const pool = normalizeText([record.type ?? "", record.displayName ?? "", ...(record.keywords ?? [])].join(" "));
  if (/(left|balance|timeline|workflow|blueprint)/.test(pool)) {
    return "left";
  }
  if (/(right|analytics|chart|profile|camera|hero)/.test(pool)) {
    return "right";
  }
  if (/(center|poster|headline|showcase|folder)/.test(pool)) {
    return "center";
  }
  if (/(corner)/.test(pool)) {
    return "corner";
  }
  return "auto";
};

const resolveTier = (record: AuthoringAssetRecord): MotionTier => {
  const pool = normalizeText([record.type ?? "", record.displayName ?? "", ...(record.keywords ?? [])].join(" "));
  if (/(folder|camera|hero|cinematic|command|showcase)/.test(pool)) {
    return "hero";
  }
  if (/(analytics|finance|budget|poster|workflow|education|typography)/.test(pool)) {
    return "premium";
  }
  return "editorial";
};

const resolveMoodTags = (record: AuthoringAssetRecord): MotionMoodTag[] => {
  const pool = normalizeText([record.displayName ?? "", record.type ?? "", record.macro ?? "", ...(record.keywords ?? [])].join(" "));
  const tags = new Set<MotionMoodTag>(["neutral"]);
  if (/(warm|red|gold|orange|amber|glow|sun)/.test(pool)) {
    tags.add("warm");
  }
  if (/(cool|blue|glass|clean|steel|editorial)/.test(pool)) {
    tags.add("cool");
  }
  if (/(calm|soft|minimal|quiet|frosted)/.test(pool)) {
    tags.add("calm");
  }
  if (/(motion|animated|gsap|transition|sweep|drift|pulse)/.test(pool)) {
    tags.add("kinetic");
  }
  if (/(authority|premium|hero|cinematic|executive|power|bold)/.test(pool)) {
    tags.add("authority");
  }
  if (/(hero|cinematic|spotlight|reveal|monumental)/.test(pool)) {
    tags.add("heroic");
  }
  return [...tags];
};

const resolveSearchTerms = (record: AuthoringAssetRecord, canonicalLabel: string): string[] => {
  const artifacts = (record.textArtifacts ?? []).map((artifact) => artifact.text ?? "");
  return unique([
    record.assetId,
    record.displayName,
    record.type,
    record.macro,
    ...(record.keywords ?? []),
    canonicalLabel,
    record.description,
    ...artifacts
  ].flatMap((value) => buildTextTerms(String(value ?? ""))));
};

const resolvePreloadPriority = (record: AuthoringAssetRecord): number => {
  const pool = normalizeText([record.displayName ?? "", record.type ?? "", record.macro ?? "", ...(record.keywords ?? [])].join(" "));
  let score = 48;
  if (record.imageSlots && record.imageSlots > 0) {
    score += 16 + record.imageSlots * 4;
  }
  if (record.textSlots && record.textSlots > 0) {
    score += Math.min(12, record.textSlots * 2);
  }
  if (/(folder|project|container|education)/.test(pool)) {
    score += 18;
  }
  if (/(analytics|workflow|poster|command|showcase)/.test(pool)) {
    score += 10;
  }
  if (/(hero|cinematic|premium|authority)/.test(pool)) {
    score += 8;
  }
  return Math.max(0, Math.min(100, score));
};

const resolveRuntimeParams = (record: AuthoringAssetRecord) => {
  const depth = record.imageSlots && record.imageSlots > 0 ? 0.22 : 0.12;
  const parallax = record.imageSlots && record.imageSlots > 0 ? 0.08 : 0.04;
  return {
    opacity: 1,
    depth,
    parallax,
    loop: record.format === "svg+gsap",
    reveal: 1,
    timingOffsetMs: 0
  };
};

const buildAuthoringRuntimeAsset = async (record: AuthoringAssetRecord): Promise<MotionAssetManifest> => {
  const htmlPath = path.join(SOURCE_BATCH_DIR, record.filename);
  const htmlContent = await readFile(htmlPath, "utf8");
  const runtimeAssetDir = path.join(PUBLIC_AUTHORING_DIR, record.assetId);
  const sourceAssetDir = path.join(PUBLIC_SOURCE_DIR, record.assetId);
  const runtimeSvgPath = path.join(runtimeAssetDir, "asset.svg");
  const sourceHtmlPath = path.join(sourceAssetDir, "asset.html");

  await ensureDir(runtimeAssetDir);
  await ensureDir(sourceAssetDir);

  const runtimeSvg = buildRuntimeSvg(htmlContent);
  const sourceHtml = replaceGsapSrc(htmlContent);
  await writeFile(runtimeSvgPath, runtimeSvg, "utf8");
  await writeFile(sourceHtmlPath, sourceHtml, "utf8");

  const referencedFiles = extractReferencedFiles(htmlContent);
  for (const ref of referencedFiles) {
    const sourceRefPath = path.join(path.dirname(htmlPath), ref);
    const runtimeRefPath = path.join(runtimeAssetDir, ref);
    const sourceArchiveRefPath = path.join(sourceAssetDir, ref);
    await ensureDir(path.dirname(runtimeRefPath));
    await ensureDir(path.dirname(sourceArchiveRefPath));
    await copyFile(sourceRefPath, runtimeRefPath);
    await copyFile(sourceRefPath, sourceArchiveRefPath);
  }

  const canonicalLabel = resolveCanonicalLabel(record);
  const placementHint = resolvePlacementHint(record);
  const searchTerms = resolveSearchTerms(record, canonicalLabel);
  const themeTags = resolveMoodTags(record);
  const manifest = enrichMotionAssetManifest({
    id: record.assetId,
    assetRole: "showcase",
    canonicalLabel,
    showcasePlacementHint: placementHint,
    family: "foreground-element",
    tier: resolveTier(record),
    src: path.posix.join("motion-assets", "authoring", record.assetId, "asset.svg"),
    alphaMode: "straight",
    placementZone: "foreground-cross",
    durationPolicy: record.imageSlots && record.imageSlots > 0 ? "scene-span" : "entry-only",
    themeTags,
    searchTerms,
    safeArea: "full-frame",
    loopable: record.format === "svg+gsap",
    blendMode: "normal",
    opacity: 1,
    source: "local",
    sourceKind: "authoring-batch",
    sourceId: record.assetId,
    sourceFile: path.posix.join("motion-assets", "authoring-source", record.assetId, "asset.html"),
    sourceHtml: path.posix.join("motion-assets", "authoring-source", record.assetId, "asset.html"),
    sourceBatch: "SVG animations/assets.json",
    renderMode: "image",
    preloadPriority: resolvePreloadPriority(record),
    runtimeParams: resolveRuntimeParams(record)
  });

  return manifest;
};

const copyVendorAssets = async (): Promise<void> => {
  if (!fs.existsSync(LOCAL_GSAP_BUNDLE)) {
    return;
  }
  await ensureDir(PUBLIC_VENDOR_DIR);
  await copyFile(LOCAL_GSAP_BUNDLE, path.join(PUBLIC_VENDOR_DIR, "gsap.min.js"));
};

const run = async (): Promise<void> => {
  const manifest = await readJson<AuthoringBatchManifest>(SOURCE_MANIFEST_PATH);
  const assets = manifest.assets ?? [];

  await ensureDir(path.dirname(GENERATED_MANIFEST_PATH));
  await ensureDir(PUBLIC_AUTHORING_DIR);
  await ensureDir(PUBLIC_SOURCE_DIR);
  await copyVendorAssets();

  const runtimeAssets: MotionAssetManifest[] = [];
  for (const record of assets) {
    const htmlPath = path.join(SOURCE_BATCH_DIR, record.filename);
    if (!fs.existsSync(htmlPath)) {
      console.warn(`Skipping ${record.assetId}: missing ${htmlPath}`);
      continue;
    }

    const runtimeAsset = await buildAuthoringRuntimeAsset(record);
    runtimeAssets.push(runtimeAsset);
  }

  runtimeAssets.sort((left, right) => {
    return (right.preloadPriority ?? 0) - (left.preloadPriority ?? 0) || left.id.localeCompare(right.id);
  });

  await writeJson(GENERATED_MANIFEST_PATH, runtimeAssets);

  console.log(`Authoring motion catalog synced: ${runtimeAssets.length} assets`);
  console.log(`Manifest: ${GENERATED_MANIFEST_PATH}`);
  console.log(`Runtime assets: ${PUBLIC_AUTHORING_DIR}`);
  console.log(`Source archive: ${PUBLIC_SOURCE_DIR}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
