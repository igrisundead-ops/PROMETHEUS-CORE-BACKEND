import remoteMotionAssetCache from "../../data/motion-assets.remote.json" with {type: "json"};
import authoringMotionAssetCache from "../../data/motion-assets.authoring.generated.json" with {type: "json"};
import godMotionAssetCache from "../../data/god-assets.generated.json" with {type: "json"};
import {captionPolicy} from "../caption-policy";
import type {
  CaptionVerticalBias,
  MotionAssetDurationPolicy,
  MotionAssetFamily,
  MotionAssetManifest,
  MotionAssetPlacementZone,
  MotionAssetSafeArea,
  MotionAssetSource,
  MotionAssetSourceKind,
  MotionMoodTag,
  MotionTier
} from "../types";
import {motionAssetLibrary} from "./asset-manifests";
import {enrichMotionAssetManifest} from "./motion-asset-taxonomy";

export type MotionAssetSourceRecord = {
  id?: string;
  image_id?: string;
  asset_id?: string;
  image_url?: string;
  src?: string;
  url?: string;
  family?: string;
  tier?: string;
  primary_emotion?: string | string[];
  secondary_emotion?: string | string[];
  trigger_keywords?: string | string[] | null;
  visual_cues?: string | string[] | null;
  concepts?: string | string[] | null;
  composition_notes?: string | string[] | null;
  placement_zone?: string;
  placementZone?: string;
  duration_policy?: string;
  durationPolicy?: string;
  safe_area?: string;
  safeArea?: string;
  blend_mode?: string;
  blendMode?: string;
  opacity?: number | string;
  loopable?: boolean;
  source?: MotionAssetSource;
  source_id?: string;
  sourceId?: string;
  remoteUrl?: string;
  score?: number;
  semantic_tags?: string | string[] | null;
  semanticTags?: string | string[] | null;
  subject_tags?: string | string[] | null;
  subjectTags?: string | string[] | null;
  emotional_tags?: string | string[] | null;
  emotionalTags?: string | string[] | null;
  lifecycle?: string;
  access_policy?: string | string[] | null;
  accessPolicy?: string | string[] | null;
  render_mode?: string;
  renderMode?: string;
  source_kind?: string;
  sourceKind?: string;
  source_html?: string;
  sourceHtml?: string;
  source_file?: string;
  sourceFile?: string;
  source_batch?: string;
  sourceBatch?: string;
  search_terms?: string | string[] | null;
  searchTerms?: string | string[] | null;
  primary_words?: string | string[] | null;
  secondary_words?: string | string[] | null;
  emotional_sentiment?: string | string[] | null;
};

export type MotionAssetCatalogSummary = {
  remoteEnabled: boolean;
  localCount: number;
  remoteCount: number;
  totalCount: number;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

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

const singularizeSearchToken = (value: string): string => {
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

const buildTextTerms = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(" ")
    .map(singularizeSearchToken)
    .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token));

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

const buildSearchTermsFromRecord = (record: MotionAssetSourceRecord): string[] => {
  const values = [
    record.search_terms,
    record.searchTerms,
    record.primary_words,
    record.secondary_words,
    record.emotional_sentiment,
    record.semantic_tags,
    record.semanticTags,
    record.subject_tags,
    record.subjectTags,
    record.emotional_tags,
    record.emotionalTags,
    record.primary_emotion,
    record.secondary_emotion,
    record.trigger_keywords,
    record.visual_cues,
    record.concepts,
    record.composition_notes,
    record.lifecycle,
    record.access_policy,
    record.accessPolicy,
    record.render_mode,
    record.renderMode,
    record.source_kind,
    record.sourceKind,
    record.source_html,
    record.sourceHtml,
    record.source_file,
    record.sourceFile,
    record.source_batch,
    record.sourceBatch,
    record.family,
    record.tier,
    record.id,
    record.image_id,
    record.asset_id,
    record.source_id,
    record.sourceId
  ];

  const terms = new Set<string>();
  values.flatMap((value) => toList(value)).forEach((value) => {
    buildTextTerms(value).forEach((term) => terms.add(term));
  });
  return [...terms];
};

const coerceSourceKind = (
  record: MotionAssetSourceRecord,
  source: MotionAssetSource
): MotionAssetSourceKind => {
  const manifestRecord = record as Partial<MotionAssetManifest>;
  const explicit = record.sourceKind ?? record.source_kind;
  if (
    explicit === "local-public" ||
    explicit === "authoring-batch" ||
    explicit === "showcase-cache" ||
    explicit === "remote-cache" ||
    explicit === "generated-placeholder"
  ) {
    return explicit;
  }

  if (explicit && typeof explicit === "string") {
    const normalized = normalizeText(explicit);
    if (normalized === "authoring batch" || normalized === "authoring" || normalized === "source batch") {
      return "authoring-batch";
    }
    if (normalized === "showcase cache" || normalized === "showcase") {
      return "showcase-cache";
    }
    if (normalized === "generated placeholder" || normalized === "placeholder") {
      return "generated-placeholder";
    }
    if (normalized === "local public" || normalized === "local") {
      return "local-public";
    }
    if (normalized === "remote cache" || normalized === "remote") {
      return "remote-cache";
    }
  }

  if (manifestRecord.sourceHtml || manifestRecord.sourceBatch) {
    return "authoring-batch";
  }
  if (manifestRecord.assetRole === "showcase") {
    return "showcase-cache";
  }
  if (source === "local") {
    return "local-public";
  }
  return "remote-cache";
};

const toList = (value: MotionAssetSourceRecord[keyof MotionAssetSourceRecord]): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,|;/]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const inferFamilyFromText = (text: string): MotionAssetFamily => {
  const normalized = normalizeText(text);
  if (/(foreground|arc|cross|subject)/.test(normalized)) {
    return "foreground-element";
  }
  if (/(depth|mask|shadow|layer|parallax)/.test(normalized)) {
    return "depth-mask";
  }
  if (/(panel|side|slice|edge)/.test(normalized)) {
    return "panel";
  }
  if (/(grid|mesh|matrix|lattice)/.test(normalized)) {
    return "grid";
  }
  if (/(flare|halo|bloom|glow|lens)/.test(normalized)) {
    return "flare";
  }
  if (/(beam|sweep|streak|light|shine|ribbon)/.test(normalized)) {
    return "light-sweep";
  }
  return "frame";
};

const inferTierFromText = (value: string): MotionTier => {
  const normalized = normalizeText(value);
  if (/(hero|heroic|cinematic|epic|big)/.test(normalized)) {
    return "hero";
  }
  if (/(premium|luxury|warm|authority|bold)/.test(normalized)) {
    return "premium";
  }
  if (/(editorial|cool|kinetic|modern|tech)/.test(normalized)) {
    return "editorial";
  }
  return "minimal";
};

const inferPlacementZone = (family: MotionAssetFamily): MotionAssetPlacementZone => {
  if (family === "panel") {
    return "side-panels";
  }
  if (family === "grid") {
    return "background-depth";
  }
  if (family === "flare" || family === "texture" || family === "depth-mask") {
    return "background-depth";
  }
  if (family === "foreground-element") {
    return "foreground-cross";
  }
  if (family === "light-sweep") {
    return "lower-third";
  }
  return "edge-frame";
};

const inferDurationPolicy = (family: MotionAssetFamily): MotionAssetDurationPolicy => {
  if (family === "panel" || family === "grid" || family === "flare" || family === "depth-mask") {
    return "scene-span";
  }
  if (family === "foreground-element") {
    return "entry-only";
  }
  if (family === "light-sweep") {
    return "entry-only";
  }
  return "scene-span";
};

const inferSafeArea = (family: MotionAssetFamily): MotionAssetSafeArea => {
  if (family === "foreground-element") {
    return "edge-safe";
  }
  return "avoid-caption-region";
};

const inferBlendMode = (family: MotionAssetFamily): string => {
  if (family === "depth-mask") {
    return "multiply";
  }
  if (family === "grid") {
    return "soft-light";
  }
  return "screen";
};

const inferOpacity = (family: MotionAssetFamily): number => {
  if (family === "depth-mask") {
    return 0.5;
  }
  if (family === "foreground-element") {
    return 0.8;
  }
  if (family === "light-sweep") {
    return 0.56;
  }
  return 0.68;
};

const inferMoodTags = (record: MotionAssetSourceRecord): MotionMoodTag[] => {
  const tokens = [
    ...toList(record.primary_emotion),
    ...toList(record.secondary_emotion),
    ...toList(record.trigger_keywords),
    ...toList(record.visual_cues),
    ...toList(record.concepts),
    ...toList(record.composition_notes)
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  const tags = new Set<MotionMoodTag>(["neutral"]);
  if (tokens.some((value) => /(warm|fire|gold|glow|sun|amber|vibrant)/.test(value))) {
    tags.add("warm");
  }
  if (tokens.some((value) => /(cool|blue|steel|clean|editorial|steel|ice)/.test(value))) {
    tags.add("cool");
  }
  if (tokens.some((value) => /(calm|soft|gentle|quiet|minimal|rest)/.test(value))) {
    tags.add("calm");
  }
  if (tokens.some((value) => /(kinetic|motion|fast|pulse|impact|streak|sweep)/.test(value))) {
    tags.add("kinetic");
  }
  if (tokens.some((value) => /(authority|power|premium|coach|leader|luxury|strong)/.test(value))) {
    tags.add("authority");
  }
  if (tokens.some((value) => /(hero|heroic|cinematic|spotlight|foreground)/.test(value))) {
    tags.add("heroic");
  }

  return [...tags];
};

const getAssetId = (record: MotionAssetSourceRecord, source: MotionAssetSource): string => {
  const explicitId = record.id ?? record.image_id ?? record.asset_id ?? record.source_id ?? record.sourceId;
  if (explicitId) {
    return explicitId;
  }
  const seed = [
    record.image_url ?? record.src ?? record.url ?? "",
    record.family ?? "",
    record.tier ?? "",
    record.placementZone ?? record.placement_zone ?? "",
    source
  ].join("|");
  return `motion-asset-${hashString(seed).toString(36)}`;
};

const coerceTier = (record: MotionAssetSourceRecord, fallbackText: string): MotionTier => {
  const explicit = record.tier ? normalizeText(record.tier) : "";
  if (explicit === "minimal" || explicit === "editorial" || explicit === "premium" || explicit === "hero") {
    return explicit;
  }
  return inferTierFromText(fallbackText);
};

const coerceFamily = (record: MotionAssetSourceRecord, fallbackText: string): MotionAssetFamily => {
  const explicit = record.family ? normalizeText(record.family) : "";
  if (
    explicit === "frame" ||
    explicit === "light-sweep" ||
    explicit === "panel" ||
    explicit === "grid" ||
    explicit === "texture" ||
    explicit === "flare" ||
    explicit === "depth-mask" ||
    explicit === "foreground-element"
  ) {
    return explicit;
  }
  return inferFamilyFromText(fallbackText);
};

const coercePlacementZone = (record: MotionAssetSourceRecord, family: MotionAssetFamily): MotionAssetPlacementZone => {
  const explicit = record.placementZone ?? record.placement_zone;
  if (
    explicit === "full-frame" ||
    explicit === "edge-frame" ||
    explicit === "upper-perimeter" ||
    explicit === "side-panels" ||
    explicit === "lower-third" ||
    explicit === "background-depth" ||
    explicit === "foreground-cross"
  ) {
    return explicit;
  }
  return inferPlacementZone(family);
};

const coerceDurationPolicy = (record: MotionAssetSourceRecord, family: MotionAssetFamily): MotionAssetDurationPolicy => {
  const explicit = record.durationPolicy ?? record.duration_policy;
  if (explicit === "scene-span" || explicit === "entry-only" || explicit === "exit-only" || explicit === "ping-pong") {
    return explicit;
  }
  return inferDurationPolicy(family);
};

const coerceSafeArea = (record: MotionAssetSourceRecord, family: MotionAssetFamily): MotionAssetSafeArea => {
  const explicit = record.safeArea ?? record.safe_area;
  if (explicit === "avoid-caption-region" || explicit === "edge-safe" || explicit === "full-frame") {
    return explicit;
  }
  return inferSafeArea(family);
};

const coerceBlendMode = (record: MotionAssetSourceRecord, family: MotionAssetFamily): string => {
  return record.blendMode ?? record.blend_mode ?? inferBlendMode(family);
};

const coerceOpacity = (record: MotionAssetSourceRecord, family: MotionAssetFamily): number => {
  const explicit = typeof record.opacity === "string" ? Number(record.opacity) : record.opacity;
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return Math.max(0, Math.min(1, explicit));
  }
  return inferOpacity(family);
};

const resolveAssetSrc = (record: MotionAssetSourceRecord): string => {
  return record.remoteUrl ?? record.image_url ?? record.src ?? record.url ?? "";
};

export const normalizeMotionAssetRecord = (
  record: MotionAssetSourceRecord,
  source: MotionAssetSource = "local"
): MotionAssetManifest | null => {
  const src = resolveAssetSrc(record);
  if (!src) {
    return null;
  }
  const family = coerceFamily(record, [
    record.family ?? "",
    record.primary_emotion ?? "",
    record.secondary_emotion ?? "",
    record.visual_cues ?? "",
    record.composition_notes ?? "",
    src
  ]
    .flatMap((value) => toList(value as string))
    .join(" "));
  const tier = coerceTier(record, [
    record.tier ?? "",
    record.primary_emotion ?? "",
    record.secondary_emotion ?? "",
    record.visual_cues ?? "",
    record.composition_notes ?? "",
    src
  ]
    .flatMap((value) => toList(value as string))
    .join(" "));
  const id = getAssetId(record, source);
  const textSeed = [
    record.primary_emotion ?? "",
    record.secondary_emotion ?? "",
    record.trigger_keywords ?? "",
    record.visual_cues ?? "",
    record.concepts ?? "",
    record.composition_notes ?? "",
    src
  ]
    .map((value) => toList(value as string).join(" "))
    .join(" ");
  const sourceKind = coerceSourceKind(record, source);

  return enrichMotionAssetManifest({
    id,
    assetRole: (record as MotionAssetManifest).assetRole,
    canonicalLabel: (record as MotionAssetManifest).canonicalLabel,
    showcasePlacementHint: (record as MotionAssetManifest).showcasePlacementHint,
    templateGraphicCategory: (record as MotionAssetManifest).templateGraphicCategory,
    virtualAsset: (record as MotionAssetManifest).virtualAsset,
    family,
    tier,
    src,
    alphaMode: "straight",
    placementZone: coercePlacementZone(record, family),
    durationPolicy: coerceDurationPolicy(record, family),
    themeTags: inferMoodTags(record),
    searchTerms: buildSearchTermsFromRecord(record),
    safeArea: coerceSafeArea(record, family),
    loopable: record.loopable === true || family !== "foreground-element",
    blendMode: coerceBlendMode(record, family),
    opacity: coerceOpacity(record, family),
    source,
    sourceId: record.sourceId ?? record.source_id ?? record.image_id ?? record.asset_id ?? id,
    remoteUrl: record.remoteUrl ?? record.image_url ?? record.url ?? record.src ?? src,
    score: record.score ?? hashString(textSeed) % 100,
    sourceKind,
    sourceFile: record.sourceFile ?? record.source_file,
    sourceHtml: record.sourceHtml ?? record.source_html,
    sourceBatch: record.sourceBatch ?? record.source_batch
  });
};

export const normalizeMotionAssetCatalog = (
  records: Array<MotionAssetSourceRecord | MotionAssetManifest>
): MotionAssetManifest[] => {
  const normalized = records
    .map((record) => {
      const source = (record as MotionAssetSourceRecord).source ?? "local";
      return normalizeMotionAssetRecord(record as MotionAssetSourceRecord, source);
    })
    .filter((record): record is MotionAssetManifest => record !== null);

  return normalized.reduce<MotionAssetManifest[]>((accumulator, entry) => {
    if (accumulator.some((candidate) => candidate.id === entry.id)) {
      return accumulator;
    }
    accumulator.push(entry);
    return accumulator;
  }, []);
};

const isAssetBrainEnabled = (): boolean => {
  return typeof process !== "undefined" && process.env.ASSET_BRAIN_ENABLED === "true";
};

const remoteMotionAssetRecords = normalizeMotionAssetCatalog(remoteMotionAssetCache as Array<MotionAssetSourceRecord>);
const authoringMotionAssetRecords = normalizeMotionAssetCatalog(
  authoringMotionAssetCache as unknown as Array<MotionAssetSourceRecord | MotionAssetManifest>
);
const godMotionAssetRecords = normalizeMotionAssetCatalog(
  godMotionAssetCache as unknown as Array<MotionAssetSourceRecord | MotionAssetManifest>
);

export const getMotionAssetCatalog = (): MotionAssetManifest[] => {
  const localCatalog = normalizeMotionAssetCatalog([
    ...motionAssetLibrary,
    ...authoringMotionAssetRecords,
    ...godMotionAssetRecords
  ]);

  if (!isAssetBrainEnabled()) {
    return localCatalog;
  }
  return normalizeMotionAssetCatalog([...localCatalog, ...remoteMotionAssetRecords]);
};

export const getMotionAssetCatalogSummary = (): MotionAssetCatalogSummary => {
  return {
    remoteEnabled: isAssetBrainEnabled(),
    localCount: motionAssetLibrary.length + authoringMotionAssetRecords.length + godMotionAssetRecords.length,
    remoteCount: remoteMotionAssetRecords.length,
    totalCount: getMotionAssetCatalog().length
  };
};

export const getMotionAssetCatalogDefaults = (): {
  defaultBias: CaptionVerticalBias;
  defaultTier: MotionTier;
} => {
  return {
    defaultBias: "middle",
    defaultTier: captionPolicy.styling.uppercaseByDefault ? "editorial" : "minimal"
  };
};
