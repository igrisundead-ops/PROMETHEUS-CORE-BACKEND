import type {CaptionChunk, MotionAssetManifest, MotionShowcaseCueSource} from "../types";

export type EditorialTypographySystem =
  | "sgt-v1"
  | "docked-inverse"
  | "filtered-keyword"
  | "accent-emphasis"
  | "microtext";

export type EditorialGlassMode = "none" | "single-layer";

export type EditorialTypographyRolePlan = {
  primaryStatement: EditorialTypographySystem;
  secondarySupport: EditorialTypographySystem | null;
  accent: EditorialTypographySystem | null;
  structuralDocked: EditorialTypographySystem | null;
  filteredCaption: EditorialTypographySystem | null;
  glassMode: EditorialGlassMode;
  rationale: string[];
};

const FILLER_EDITORIAL_PHRASES = new Set([
  "key idea",
  "move",
  "sidecall",
  "support cue",
  "trend signal",
  "key metric",
  "time marker",
  "process cue",
  "keyword cue",
  "reference person",
  "reference figure",
  "named cue",
  "title keyword",
  "named reference",
  "fluid sequence",
  "graphic asset",
  "current marker",
  "sequence",
  "active trace",
  "node"
]);

/**
 * Editorial composition guardrails.
 *
 * Bad pattern:
 * - Outer glass card.
 * - Inner glass card.
 * - Filler labels like "KEY IDEA", "SIDECALL", or "MOVE".
 * - Decorative lines that do not add meaning.
 * Why it is bad:
 * - It duplicates hierarchy, wastes contrast, and makes every moment feel like the same template.
 *
 * Corrected pattern:
 * - One glass shell only when the moment genuinely needs a contained sidecall.
 * - One primary statement with a clear supporting phrase.
 * - No extra labels unless they communicate real context.
 *
 * Premium mixed-typography pattern:
 * - `sgt-v1` carries the main declaration.
 * - `docked-inverse` handles the face-adjacent anchor or lower-third support.
 * - `accent-emphasis` is reserved for one emotionally loaded word.
 * - `filtered-keyword` is used only when a phrase deserves extraction, not as the global default.
 *
 * One-glass-card-enough case:
 * - A structured animation or data cue needs a single container so the real asset and its support line read as one thought.
 *
 * No-glass-card case:
 * - Speaker-adjacent keyword accents, docked lower-thirds, or filtered caption moments where typography already carries the beat.
 */

const normalizeEditorialText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanEditorialText = (value: string): string => value.replace(/\s+/g, " ").trim();

export const sanitizeEditorialText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const cleaned = cleanEditorialText(value);
  if (!cleaned) {
    return null;
  }

  const normalized = normalizeEditorialText(cleaned);
  if (!normalized || FILLER_EDITORIAL_PHRASES.has(normalized)) {
    return null;
  }

  if (/^(key|move|note|idea|label|tag|header|title)\s+\d+$/i.test(cleaned)) {
    return null;
  }

  return cleaned;
};

export const isMeaningfulEditorialText = (value: string | null | undefined): boolean => {
  return sanitizeEditorialText(value) !== null;
};

export const sanitizeDistinctEditorialText = (
  value: string | null | undefined,
  existingValues: Array<string | null | undefined> = []
): string | null => {
  const cleaned = sanitizeEditorialText(value);
  if (!cleaned) {
    return null;
  }

  const normalized = normalizeEditorialText(cleaned);
  const existing = new Set(
    existingValues
      .map((entry) => sanitizeEditorialText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .map(normalizeEditorialText)
  );

  return existing.has(normalized) ? null : cleaned;
};

export const sanitizeEditorialKeywords = (
  values: Array<string | null | undefined>,
  limit = values.length
): string[] => {
  const sanitized: string[] = [];

  for (const value of values) {
    const cleaned = sanitizeDistinctEditorialText(value, sanitized);
    if (!cleaned) {
      continue;
    }

    sanitized.push(cleaned);
    if (sanitized.length >= limit) {
      break;
    }
  }

  return sanitized;
};

export const buildEditorialTypographyRolePlan = ({
  chunk,
  decisionMode,
  hasMeaningfulSupport,
  hasGraphicAsset
}: {
  chunk: CaptionChunk;
  decisionMode: "normal" | "escalated" | "keyword-only";
  hasMeaningfulSupport: boolean;
  hasGraphicAsset: boolean;
}): EditorialTypographyRolePlan => {
  const hasAccentSignal =
    (chunk.emphasisWordIndices?.length ?? 0) > 0 ||
    chunk.semantic?.intent === "punch-emphasis";
  const needsStructuralAnchor =
    chunk.semantic?.intent === "name-callout" ||
    chunk.words.length >= 7 ||
    hasGraphicAsset;

  return {
    primaryStatement: decisionMode === "keyword-only" ? "filtered-keyword" : "sgt-v1",
    secondarySupport: hasMeaningfulSupport
      ? decisionMode === "normal"
        ? "docked-inverse"
        : "microtext"
      : null,
    accent: hasAccentSignal ? "accent-emphasis" : null,
    structuralDocked: needsStructuralAnchor ? "docked-inverse" : null,
    filteredCaption: decisionMode === "keyword-only" || chunk.semantic?.intent === "punch-emphasis"
      ? "filtered-keyword"
      : null,
    glassMode: hasGraphicAsset ? "single-layer" : "none",
    rationale: [
      decisionMode === "keyword-only" ? "filtered-primary" : "sgt-primary",
      hasMeaningfulSupport ? "support-earned" : "support-subtracted",
      hasAccentSignal ? "accent-available" : "accent-muted",
      needsStructuralAnchor ? "structural-anchor-available" : "structural-anchor-skipped",
      hasGraphicAsset ? "single-glass-shell-allowed" : "no-glass-needed"
    ]
  };
};

export const isStructuredAnimationAsset = (asset: MotionAssetManifest | null | undefined): boolean => {
  if (!asset) {
    return false;
  }

  return asset.sourceKind === "authoring-batch" ||
    Boolean(asset.sourceHtml) ||
    /structured animation|svg animations/i.test(asset.sourceBatch ?? "");
};

export const buildMotionAssetRepetitionSignature = (asset: MotionAssetManifest | null | undefined): string | null => {
  if (!asset) {
    return null;
  }

  return [
    asset.sourceKind ?? "unknown",
    asset.templateGraphicCategory ?? "no-template",
    asset.sourceBatch ?? asset.sourceId ?? asset.canonicalLabel ?? asset.id
  ].join("|");
};

export const shouldUseGlassCard = ({
  cueSource,
  templateGraphicCategory
}: {
  cueSource: MotionShowcaseCueSource;
  templateGraphicCategory?: string | null;
}): boolean => {
  return cueSource === "template-graphic" || Boolean(templateGraphicCategory);
};
