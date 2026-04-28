import showcaseAssetCache from "../../data/showcase-assets.remote.json" with {type: "json"};
import showcaseImportedAssetCache from "../../data/showcase-assets.imports.local.json" with {type: "json"};
import showcaseConcreteImportedAssetCache from "../../data/showcase-assets.imports.prometheus-concrete.local.json" with {type: "json"};
import authoringMotionAssetCache from "../../data/motion-assets.authoring.generated.json" with {type: "json"};
import godMotionAssetCache from "../../data/god-assets.generated.json" with {type: "json"};
import unifiedMotionAssetCache from "../../data/unified-motion-assets.generated.json" with {type: "json"};
import type {
  MotionAssetManifest,
  MotionAssetRole,
  MotionAssetSource,
  MotionMoodTag,
  MotionShowcasePlacement,
  MotionShowcasePlacementHint,
  MotionTier
} from "../types";
import {enrichMotionAssetManifest} from "./motion-asset-taxonomy";

const ABSTRACT_LABELS = new Set([
  "amusement",
  "anticipation",
  "anxiety",
  "authority",
  "calm",
  "confidence",
  "contemplation",
  "control",
  "curiosity",
  "defiance",
  "determination",
  "distress",
  "elegance",
  "emotion",
  "empowerment",
  "fear",
  "focus",
  "hope",
  "intensity",
  "joy",
  "longing",
  "love",
  "mystery",
  "nostalgia",
  "patience",
  "peace",
  "power",
  "reflection",
  "serenity",
  "stability",
  "strength",
  "trust",
  "unease",
  "wonder"
]);

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "by",
  "for",
  "from",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "their",
  "these",
  "those",
  "to",
  "was",
  "were",
  "with",
  "you",
  "your"
]);

export type ShowcaseAssetCsvRow = {
  assetId?: string;
  canonicalLabel?: string;
  sourceFile?: string;
  sourceUrl?: string;
  searchTerms?: string;
  placementHint?: string;
  notes?: string;
};

export type ShowcaseAssetCatalogSummary = {
  totalCount: number;
  localCount: number;
  driveCount: number;
  supabaseCount: number;
  assetRoleCount: number;
};

type ShowcaseNormalizedSeed = {
  assetId: string;
  canonicalLabel: string;
  sourceFile?: string;
  sourceUrl?: string;
  searchTerms: string[];
  placementHint: MotionShowcasePlacementHint;
  notes?: string;
};

type ShowcaseCsvLegacyImage = {
  sourceFile?: string;
  sourceUrl?: string;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const normalizeShowcaseText = (value: string): string => {
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

const splitList = (value?: string): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(/[\n,;|/]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const normalizeShowcaseLabel = (value: string): string => {
  return normalizeShowcaseText(value).split(" ")[0] ?? "";
};

export const isConcreteShowcaseLabel = (value: string): boolean => {
  const normalized = normalizeShowcaseLabel(value);
  if (!normalized) {
    return false;
  }
  if (normalized.includes(" ")) {
    return false;
  }
  if (!/^[a-z][a-z0-9_-]*$/i.test(normalized)) {
    return false;
  }
  return !ABSTRACT_LABELS.has(normalized);
};

export const normalizeShowcasePlacementHint = (value?: string): MotionShowcasePlacementHint => {
  const normalized = normalizeShowcaseText(value ?? "");
  if (normalized === "left" || normalized === "right" || normalized === "center" || normalized === "corner") {
    return normalized;
  }
  return "auto";
};

export const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((entry) => entry.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((entry) => entry.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
};

const parseLegacyImageCell = (value: string): ShowcaseCsvLegacyImage => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  const match = trimmed.match(/^(.+?)\s*\((https?:\/\/.+)\)$/);
  if (match) {
    return {
      sourceFile: match[1].trim(),
      sourceUrl: match[2].trim()
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      sourceUrl: trimmed
    };
  }

  return {
    sourceFile: trimmed
  };
};

const mapHeaders = (headers: string[]): Record<string, number> => {
  return headers.reduce<Record<string, number>>((accumulator, header, index) => {
    accumulator[normalizeShowcaseText(header).replace(/[^a-z0-9]+/g, "")] = index;
    return accumulator;
  }, {});
};

const readCell = (row: string[], headers: Record<string, number>, key: string): string => {
  const normalizedKey = normalizeShowcaseText(key).replace(/[^a-z0-9]+/g, "");
  const index = headers[normalizedKey];
  return typeof index === "number" ? (row[index] ?? "").trim() : "";
};

export const parseShowcaseCsvRows = (content: string): ShowcaseAssetCsvRow[] => {
  const rows = parseCsv(content);
  if (rows.length === 0) {
    return [];
  }

  const headers = mapHeaders(rows[0]);
  return rows.slice(1).map((row) => {
    const hasCanonicalLabel = headers.canonicallabel !== undefined;
    const canonicalLabel = hasCanonicalLabel
      ? readCell(row, headers, "canonicalLabel")
      : readCell(row, headers, "description") || readCell(row, headers, "label") || readCell(row, headers, "concept");
    const assetId = readCell(row, headers, "assetId") || readCell(row, headers, "id") || normalizeShowcaseLabel(canonicalLabel);
    const sourceFile = readCell(row, headers, "sourceFile") || readCell(row, headers, "file") || readCell(row, headers, "localFile");
    const sourceUrl = readCell(row, headers, "sourceUrl") || readCell(row, headers, "imageUrl") || readCell(row, headers, "url");
    const searchTerms = readCell(row, headers, "searchTerms") || readCell(row, headers, "triggerKeywords");
    const placementHint = readCell(row, headers, "placementHint") || readCell(row, headers, "placement");
    const notes = readCell(row, headers, "notes") || readCell(row, headers, "descriptionNotes");

    if (!hasCanonicalLabel && headers.description !== undefined && headers.image !== undefined) {
      const legacyImage = parseLegacyImageCell(readCell(row, headers, "image"));
      return {
        assetId,
        canonicalLabel,
        sourceFile: sourceFile || legacyImage.sourceFile,
        sourceUrl: sourceUrl || legacyImage.sourceUrl,
        searchTerms,
        placementHint,
        notes
      };
    }

    return {
      assetId,
      canonicalLabel,
      sourceFile,
      sourceUrl,
      searchTerms,
      placementHint,
      notes
    };
  });
};

export const normalizeShowcaseSearchTerms = (value: string | string[] | undefined, label: string, notes?: string): string[] => {
  const terms = new Set<string>();

  const addTerms = (entry: string): void => {
    const normalized = normalizeShowcaseText(entry);
    if (!normalized) {
      return;
    }
    const tokens = normalized
      .split(" ")
      .map(singularizeToken)
      .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token));
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
  };

  splitList(Array.isArray(value) ? value.join(";") : value ?? "").forEach(addTerms);
  addTerms(label);
  if (notes) {
    addTerms(notes);
  }

  return [...terms];
};

export const inferShowcaseMoodTags = (label: string, searchTerms: string[]): MotionMoodTag[] => {
  const tags = new Set<MotionMoodTag>(["neutral"]);
  const joined = normalizeShowcaseText([label, ...searchTerms].join(" "));

  if (/(camera|phone|building|brain|watch|bottle|astronaut|king|coin|bill|money|calendar)/.test(joined)) {
    tags.add("cool");
  }
  if (/(bill|coin|king|mortarboard|suit|building|watch|crown|money|expert|professional|home)/.test(joined)) {
    tags.add("authority");
  }
  if (/(camera|brain|hourglass|building|watch|astronaut|home|money)/.test(joined)) {
    tags.add("heroic");
  }
  if (/(hoodie|shirt|camera|phone|bottle|coin|thinking|calendar)/.test(joined)) {
    tags.add("calm");
  }

  return [...tags];
};

export const inferShowcaseTier = (label: string): MotionTier => {
  const normalized = normalizeShowcaseLabel(label);
  if (/(camera|brain|hourglass|watch|astronaut|building|phone|home)/.test(normalized)) {
    return "hero";
  }
  if (/(suit|king|mortarboard|bill|bottle|coin|money|expert|calendar|thinking)/.test(normalized)) {
    return "premium";
  }
  return "editorial";
};

export const inferShowcasePlacementZone = (placementHint: MotionShowcasePlacementHint): MotionShowcasePlacementHint => {
  return placementHint;
};

export const buildShowcaseAssetManifest = ({
  assetId,
  canonicalLabel,
  sourceFile,
  sourceUrl,
  searchTerms,
  placementHint,
  notes,
  src,
  source,
  sourceId
}: ShowcaseNormalizedSeed & {
  src: string;
  source: MotionAssetSource;
  sourceId?: string;
}): MotionAssetManifest => {
  const canonical = normalizeShowcaseLabel(canonicalLabel);
  const normalizedSearchTerms = normalizeShowcaseSearchTerms(searchTerms, canonical, notes);
  const family = "foreground-element";
  const tier = inferShowcaseTier(canonical);
  const idSeed = `${assetId}|${canonical}|${src}`;

  return enrichMotionAssetManifest({
    id: assetId || `showcase-${hashString(idSeed).toString(36)}`,
    assetRole: "showcase",
    canonicalLabel: canonical,
    showcasePlacementHint: placementHint,
    family,
    tier,
    src,
    alphaMode: "straight",
    placementZone: "foreground-cross",
    durationPolicy: "scene-span",
    themeTags: inferShowcaseMoodTags(canonical, normalizedSearchTerms),
    searchTerms: normalizedSearchTerms,
    safeArea: "full-frame",
    loopable: false,
    blendMode: "normal",
    opacity: 1,
    source,
    sourceId: sourceId ?? assetId,
    remoteUrl: sourceUrl ?? sourceFile ?? src,
    score: hashString(`${canonical}|${assetId}`) % 100
  } as MotionAssetManifest);
};

export const normalizeShowcaseAssetSeedRow = (row: ShowcaseAssetCsvRow): ShowcaseNormalizedSeed | null => {
  const canonicalLabel = normalizeShowcaseLabel(row.canonicalLabel ?? "");
  const assetId = row.assetId?.trim() || (canonicalLabel ? `showcase-${canonicalLabel}` : "");
  if (!canonicalLabel || !assetId) {
    return null;
  }
  if (!isConcreteShowcaseLabel(canonicalLabel)) {
    return null;
  }

  return {
    assetId,
    canonicalLabel,
    sourceFile: row.sourceFile?.trim() || undefined,
    sourceUrl: row.sourceUrl?.trim() || undefined,
    searchTerms: splitList(row.searchTerms),
    placementHint: normalizeShowcasePlacementHint(row.placementHint),
    notes: row.notes?.trim() || undefined
  };
};

export const normalizeShowcaseAssetCatalog = (records: MotionAssetManifest[]): MotionAssetManifest[] => {
  return records.reduce<MotionAssetManifest[]>((accumulator, record) => {
    if (!record || record.assetRole !== "showcase") {
      return accumulator;
    }
    if (accumulator.some((entry) => entry.id === record.id)) {
      return accumulator;
    }
    accumulator.push(record);
    return accumulator;
  }, []);
};

const showcaseAssetCatalog = normalizeShowcaseAssetCatalog(
  [
    ...(showcaseAssetCache as MotionAssetManifest[]),
    ...(showcaseImportedAssetCache as MotionAssetManifest[]),
    ...(showcaseConcreteImportedAssetCache as MotionAssetManifest[]),
    ...(authoringMotionAssetCache as MotionAssetManifest[]),
    ...(godMotionAssetCache as MotionAssetManifest[]),
    ...(unifiedMotionAssetCache as MotionAssetManifest[])
  ]
    .map((record) => ({
      ...record,
      assetRole: record.assetRole ?? "showcase"
    }))
    .map((record) => enrichMotionAssetManifest(record))
);

export const getShowcaseAssetCatalog = (): MotionAssetManifest[] => showcaseAssetCatalog;

export const getShowcaseAssetCatalogSummary = (): ShowcaseAssetCatalogSummary => {
  return showcaseAssetCatalog.reduce<ShowcaseAssetCatalogSummary>(
    (summary, record) => ({
      totalCount: summary.totalCount + 1,
      localCount: summary.localCount + (record.source === "local" ? 1 : 0),
      driveCount: summary.driveCount + (record.source === "drive" ? 1 : 0),
      supabaseCount: summary.supabaseCount + (record.source === "supabase" ? 1 : 0),
      assetRoleCount: summary.assetRoleCount + (record.assetRole === "showcase" ? 1 : 0)
    }),
    {
      totalCount: 0,
      localCount: 0,
      driveCount: 0,
      supabaseCount: 0,
      assetRoleCount: 0
    }
  );
};

export const resolveShowcasePlacement = ({
  aspectRatio,
  captionBias,
  placementHint
}: {
  aspectRatio: number;
  captionBias: "top" | "middle" | "bottom";
  placementHint: MotionShowcasePlacementHint;
}): MotionShowcasePlacement => {
  const landscape = aspectRatio >= 1.1;
  if (landscape) {
    if (placementHint === "left") {
      return "landscape-left";
    }
    if (placementHint === "right") {
      return "landscape-right";
    }
    return captionBias === "top" ? "landscape-right" : "landscape-left";
  }

  if (placementHint === "left") {
    return captionBias === "bottom" ? "portrait-top-left" : "portrait-bottom-left";
  }
  if (placementHint === "right") {
    return captionBias === "bottom" ? "portrait-top-right" : "portrait-bottom-right";
  }
  if (placementHint === "center") {
    return "portrait-center";
  }
  if (captionBias === "top") {
    return "portrait-bottom-right";
  }
  if (captionBias === "bottom") {
    return "portrait-top-right";
  }
  return "portrait-center";
};
