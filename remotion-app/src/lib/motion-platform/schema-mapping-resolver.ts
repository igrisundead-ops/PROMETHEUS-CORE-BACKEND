import schemaMappingRows from "../../data/claude-schema-mapping.generated.json" with {type: "json"};
import type {MotionAssetManifest, MotionPrimitiveId, MotionSceneKind} from "../types";

export type CinematicTextAnimationPreset =
  | "split-stagger"
  | "blur-to-sharp"
  | "focus-frame"
  | "rotating-emphasis";

export type StageUnderlayEffect =
  | "soft-radial-glow"
  | "light-sweep"
  | "ring-focus"
  | "depth-haze";

type SchemaMappingRow = {
  asset_id?: string;
  filename?: string;
  html_title?: string;
  name_semantic_prior?: string;
  object_type?: string;
  family?: string;
  literal_tags?: string;
  intent_tags?: string;
  contexts?: string;
  anti_contexts?: string;
  constraints?: string;
  retrieval_caption?: string;
  semantic_confidence?: string;
};

export type SchemaMappingEntry = {
  id: string;
  filename: string;
  htmlTitle: string;
  semanticName: string;
  objectType: string;
  family: string;
  literalTags: string[];
  intentTags: string[];
  contexts: string[];
  antiContexts: string[];
  retrievalCaption: string;
  semanticConfidence: number;
  constraints: Record<string, string | number | boolean>;
  searchableTerms: string[];
};

export type SchemaStageEffectRoute = {
  animationPreset: CinematicTextAnimationPreset;
  underlayEffect: StageUnderlayEffect;
  renderTreatment: "kinetic-typography" | "glass-card" | "data-template" | "quote-card" | "floating-showcase";
  focusWordOnly: boolean;
  preferAssetContain: boolean;
  ringAccent: boolean;
  reasoning: string;
  confidence: number;
  matches: SchemaMappingEntry[];
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
  "being",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
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

const splitDelimitedList = (value?: string): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(/[|,;/]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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
    .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token));
};

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const parseConstraints = (value?: string): Record<string, string | number | boolean> => {
  if (!value?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<string, string | number | boolean>>((accumulator, [key, entry]) => {
      if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
        accumulator[key] = entry;
      }
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

const buildSearchableTerms = (entry: {
  filename: string;
  htmlTitle: string;
  semanticName: string;
  objectType: string;
  family: string;
  literalTags: string[];
  intentTags: string[];
  contexts: string[];
  antiContexts: string[];
  retrievalCaption: string;
}): string[] => {
  const terms = new Set<string>();
  [
    entry.filename,
    entry.htmlTitle,
    entry.semanticName,
    entry.objectType,
    entry.family,
    entry.retrievalCaption,
    ...entry.literalTags,
    ...entry.intentTags,
    ...entry.contexts,
    ...entry.antiContexts
  ].forEach((value) => {
    const tokenList = tokenize(value);
    if (tokenList.length === 0) {
      return;
    }
    terms.add(tokenList.join(" "));
    tokenList.forEach((token, index) => {
      terms.add(token);
      if (index < tokenList.length - 1) {
        terms.add(`${token} ${tokenList[index + 1]}`);
      }
    });
  });

  return [...terms];
};

const schemaCatalog: SchemaMappingEntry[] = (schemaMappingRows as SchemaMappingRow[]).map((row) => {
  const filename = row.filename?.trim() ?? "";
  const htmlTitle = row.html_title?.trim() ?? "";
  const semanticName = row.name_semantic_prior?.trim() ?? "";
  const objectType = row.object_type?.trim() ?? "";
  const family = row.family?.trim() ?? "";
  const literalTags = unique(splitDelimitedList(row.literal_tags).map(normalizeText));
  const intentTags = unique(splitDelimitedList(row.intent_tags).map(normalizeText));
  const contexts = unique(splitDelimitedList(row.contexts).map(normalizeText));
  const antiContexts = unique(splitDelimitedList(row.anti_contexts).map(normalizeText));
  const retrievalCaption = row.retrieval_caption?.trim() ?? "";
  const semanticConfidence = Number.parseFloat(row.semantic_confidence ?? "0") || 0;

  return {
    id: row.asset_id?.trim() ?? filename ?? semanticName ?? objectType ?? family,
    filename,
    htmlTitle,
    semanticName,
    objectType,
    family,
    literalTags,
    intentTags,
    contexts,
    antiContexts,
    retrievalCaption,
    semanticConfidence,
    constraints: parseConstraints(row.constraints),
    searchableTerms: buildSearchableTerms({
      filename,
      htmlTitle,
      semanticName,
      objectType,
      family,
      literalTags,
      intentTags,
      contexts,
      antiContexts,
      retrievalCaption
    })
  };
});

const primitivePresetMap: Partial<Record<MotionPrimitiveId, CinematicTextAnimationPreset>> = {
  "blur-reveal": "blur-to-sharp",
  "highlight-word": "focus-frame",
  "circle-reveal": "focus-frame",
  "blur-underline": "focus-frame",
  typewriter: "split-stagger"
};

const sceneContextHints = (sceneKind?: MotionSceneKind): string[] => {
  if (sceneKind === "comparison") {
    return ["comparison", "before after", "duality", "contrast", "cover slide"];
  }
  if (sceneKind === "quote") {
    return ["quote", "authority statement", "testimonial slide", "editorial moment"];
  }
  if (sceneKind === "stat") {
    return ["results section", "kpi slide", "revenue chart", "metric"];
  }
  if (sceneKind === "cta") {
    return ["directive text", "action hook", "cta overlay", "engagement"];
  }
  return ["hero section", "feature highlight", "headline reveal", "cover slide"];
};

const sceneAntiContextHints = (sceneKind?: MotionSceneKind): string[] => {
  if (sceneKind === "quote") {
    return ["data chart", "steps sequence"];
  }
  if (sceneKind === "stat") {
    return ["testimonial", "social icon"];
  }
  if (sceneKind === "comparison") {
    return ["quote only", "social icon"];
  }
  return [];
};

const hasWordCountConflict = (entry: SchemaMappingEntry, wordCount: number): boolean => {
  const raw = entry.constraints.word_count;
  if (raw === undefined) {
    return false;
  }

  if (typeof raw === "number") {
    return wordCount > raw;
  }

  if (typeof raw !== "string") {
    return false;
  }

  if (/^\d+$/.test(raw)) {
    return wordCount > Number.parseInt(raw, 10);
  }

  const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const minimum = Number.parseInt(rangeMatch[1], 10);
    const maximum = Number.parseInt(rangeMatch[2], 10);
    return wordCount < minimum || wordCount > maximum;
  }

  return false;
};

const scoreSchemaEntry = ({
  entry,
  queryTerms,
  contextTerms,
  antiContextTerms,
  wordCount,
  desiredFamilies
}: {
  entry: SchemaMappingEntry;
  queryTerms: Set<string>;
  contextTerms: Set<string>;
  antiContextTerms: Set<string>;
  wordCount: number;
  desiredFamilies?: Set<string>;
}): number => {
  if (desiredFamilies && desiredFamilies.size > 0 && !desiredFamilies.has(normalizeText(entry.family))) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = entry.semanticConfidence * 28;

  entry.literalTags.forEach((tag) => {
    if (queryTerms.has(tag)) {
      score += 18;
    }
  });

  entry.intentTags.forEach((tag) => {
    if (queryTerms.has(tag) || contextTerms.has(tag)) {
      score += 22;
    }
  });

  entry.contexts.forEach((tag) => {
    if (contextTerms.has(tag) || queryTerms.has(tag)) {
      score += 16;
    }
  });

  entry.searchableTerms.forEach((term) => {
    if (queryTerms.has(term) || contextTerms.has(term)) {
      score += term.includes(" ") ? 8 : 2;
    }
  });

  entry.antiContexts.forEach((tag) => {
    if (antiContextTerms.has(tag) || queryTerms.has(tag)) {
      score -= 24;
    }
  });

  if (hasWordCountConflict(entry, wordCount)) {
    score -= 18;
  }

  if (entry.family === "text_animation" || entry.family === "text_effect") {
    score += 8;
  }

  return score;
};

export const getSchemaMappingCatalog = (): SchemaMappingEntry[] => schemaCatalog;

export const resolveSchemaMappings = ({
  text,
  contextHints = [],
  antiContextHints = [],
  sceneKind,
  desiredFamilies,
  maxResults = 5
}: {
  text: string;
  contextHints?: string[];
  antiContextHints?: string[];
  sceneKind?: MotionSceneKind;
  desiredFamilies?: string[];
  maxResults?: number;
}): SchemaMappingEntry[] => {
  const queryTerms = new Set(tokenize(text));
  const contextTerms = new Set(unique([...contextHints, ...sceneContextHints(sceneKind)]).flatMap(tokenize));
  const antiContextTerms = new Set(unique([...antiContextHints, ...sceneAntiContextHints(sceneKind)]).flatMap(tokenize));
  const familyFilter = desiredFamilies ? new Set(desiredFamilies.map(normalizeText)) : undefined;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return [...schemaCatalog]
    .map((entry) => ({
      entry,
      score: scoreSchemaEntry({
        entry,
        queryTerms,
        contextTerms,
        antiContextTerms,
        wordCount,
        desiredFamilies: familyFilter
      })
    }))
    .filter((candidate) => Number.isFinite(candidate.score) && candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
    .slice(0, maxResults)
    .map((candidate) => candidate.entry);
};

const hasTag = (entry: SchemaMappingEntry, patterns: string[]): boolean => {
  const normalizedPatterns = patterns.map(normalizeText);
  return [...entry.literalTags, ...entry.intentTags, ...entry.contexts, ...entry.searchableTerms].some((tag) => {
    return normalizedPatterns.some((pattern) => tag.includes(pattern));
  });
};

const inferAnimationPreset = ({
  matches,
  primitiveId
}: {
  matches: SchemaMappingEntry[];
  primitiveId?: MotionPrimitiveId;
}): CinematicTextAnimationPreset => {
  const primitivePreset = primitiveId ? primitivePresetMap[primitiveId] : undefined;
  if (primitivePreset) {
    return primitivePreset;
  }

  const primary = matches[0];
  if (!primary) {
    return "split-stagger";
  }

  if (hasTag(primary, ["carousel", "slider", "rotation", "auto scroll", "morph"])) {
    return "rotating-emphasis";
  }
  if (hasTag(primary, ["circle", "highlight", "selection", "underline", "focus"])) {
    return "focus-frame";
  }
  if (hasTag(primary, ["blur", "quote", "testimonial"])) {
    return "blur-to-sharp";
  }
  if (hasTag(primary, ["split text", "syllable", "word reveal", "triptych", "three words"])) {
    return "split-stagger";
  }
  return primary.family === "text_effect" ? "focus-frame" : "split-stagger";
};

const inferUnderlayEffect = (matches: SchemaMappingEntry[], preset: CinematicTextAnimationPreset): StageUnderlayEffect => {
  const primary = matches[0];
  if (!primary) {
    return preset === "focus-frame" ? "ring-focus" : "soft-radial-glow";
  }

  if (hasTag(primary, ["circle", "ring", "selection", "focus"])) {
    return "ring-focus";
  }
  if (hasTag(primary, ["underline", "sweep", "line", "timeline"])) {
    return "light-sweep";
  }
  if (hasTag(primary, ["graph", "chart", "steps", "timeline", "calendar"])) {
    return "depth-haze";
  }
  return "soft-radial-glow";
};

const inferRenderTreatment = (matches: SchemaMappingEntry[]): SchemaStageEffectRoute["renderTreatment"] => {
  const primary = matches[0];
  if (!primary) {
    return "kinetic-typography";
  }
  if (["chart", "steps", "hierarchy"].includes(normalizeText(primary.family))) {
    return "data-template";
  }
  if (["testimonial"].includes(normalizeText(primary.family)) || primary.objectType === "quote_card") {
    return "quote-card";
  }
  if (["card", "social_proof"].includes(normalizeText(primary.family))) {
    return "glass-card";
  }
  if (hasTag(primary, ["carousel", "slider", "rotation"])) {
    return "floating-showcase";
  }
  return "kinetic-typography";
};

export const resolveSchemaStageEffectRoute = ({
  text,
  subtext,
  sceneKind,
  primitiveId
}: {
  text: string;
  subtext?: string;
  sceneKind?: MotionSceneKind;
  primitiveId?: MotionPrimitiveId;
}): SchemaStageEffectRoute => {
  const matches = resolveSchemaMappings({
    text: `${text} ${subtext ?? ""}`.trim(),
    contextHints: [text, subtext ?? ""],
    sceneKind,
    desiredFamilies: [
      "text_animation",
      "text_effect",
      "card",
      "testimonial",
      "chart",
      "steps",
      "social_proof"
    ],
    maxResults: 4
  });
  const hasRotatingCueSignal = /\b(vs|versus|compare|comparison|before|after)\b/i.test(text) ||
    /[,|/]/.test(text) ||
    sceneKind === "comparison";
  const baseAnimationPreset = inferAnimationPreset({matches, primitiveId});
  const animationPreset = !primitiveId && hasRotatingCueSignal && baseAnimationPreset === "split-stagger"
    ? "rotating-emphasis"
    : baseAnimationPreset;
  const underlayEffect = inferUnderlayEffect(matches, animationPreset);
  const renderTreatment = inferRenderTreatment(matches);
  const primary = matches[0];

  return {
    animationPreset,
    underlayEffect,
    renderTreatment,
    focusWordOnly: primary ? hasTag(primary, ["word count", "single word", "word reveal", "underline", "circle"]) : false,
    preferAssetContain: primary ? hasTag(primary, ["card", "quote", "phone", "ui", "glass", "panel"]) : false,
    ringAccent: underlayEffect === "ring-focus" || Boolean(primary && hasTag(primary, ["circle", "selection"])),
    reasoning: primary
      ? `${primary.id} -> ${animationPreset} / ${underlayEffect}`
      : `fallback -> ${animationPreset} / ${underlayEffect}`,
    confidence: primary?.semanticConfidence ?? 0.54,
    matches
  };
};

export const getSchemaAssetScoreBoost = ({
  asset,
  text,
  sceneKind
}: {
  asset: Pick<
    MotionAssetManifest,
    | "id"
    | "canonicalLabel"
    | "searchTerms"
    | "semanticTags"
    | "functionalTags"
    | "subjectTags"
    | "sourceHtml"
    | "sourceFile"
    | "templateGraphicCategory"
  >;
  text: string;
  sceneKind?: MotionSceneKind;
}): number => {
  const matches = resolveSchemaMappings({
    text,
    sceneKind,
    maxResults: 4
  });
  if (matches.length === 0) {
    return 0;
  }

  const assetTerms = new Set(
    unique([
      asset.id,
      asset.canonicalLabel ?? "",
      ...(asset.searchTerms ?? []),
      ...(asset.semanticTags ?? []),
      ...(asset.functionalTags ?? []),
      ...(asset.subjectTags ?? [])
    ].flatMap(tokenize))
  );

  const boost = matches.reduce((best, entry) => {
    let score = 0;
    entry.searchableTerms.forEach((term) => {
      if (assetTerms.has(term)) {
        score += term.includes(" ") ? 7 : 3;
      }
    });
    if (asset.sourceHtml && ["text_animation", "card", "steps", "chart"].includes(normalizeText(entry.family))) {
      score += 10;
    }
    if (asset.templateGraphicCategory && ["chart", "steps", "hierarchy"].includes(normalizeText(entry.family))) {
      score += 12;
    }
    return Math.max(best, score * Math.max(0.3, entry.semanticConfidence));
  }, 0);

  return Math.round(boost);
};
