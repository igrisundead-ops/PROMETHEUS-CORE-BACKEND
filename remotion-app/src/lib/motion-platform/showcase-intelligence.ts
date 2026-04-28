import type {
  CaptionChunk,
  CaptionStyleProfileId,
  GovernorDecision,
  MissingAssetCategoryRecord,
  MotionAssetManifest,
  MotionAssetSource,
  MotionShowcasePlacementHint,
  MotionTier,
  VideoMetadata
} from "../types";
import {isLongformSemanticSidecallCaptionStyleProfile} from "../stylebooks/caption-style-profiles";
import {
  buildSemanticSidecallGovernorDecision,
  semanticSidecallCinematicGovernorPolicy
} from "./semantic-sidecall-governor";
import {getSchemaAssetScoreBoost} from "./schema-mapping-resolver";
import {
  getShowcaseAssetCatalog,
  normalizeShowcaseLabel,
  normalizeShowcaseText
} from "./showcase-asset-catalog";

type TranscriptToken = {
  text: string;
  normalized: string;
  startMs: number;
  endMs: number;
  chunkId: string;
  chunkIndex: number;
  wordIndex: number;
  globalIndex: number;
};

type MotionIntentCategory =
  | "finance"
  | "marketplace"
  | "growth"
  | "home"
  | "planning"
  | "obstacle"
  | "decision"
  | "ambience"
  | "time"
  | "creation"
  | "expertise";

type MotionIntentDecision = "selected" | "flagged" | "suppressed";

type ShowcaseSelectionConfig = {
  targetPerMinute: number;
  maxPerMinute: number;
  targetCueRatio: number;
  maxCueRatio: number;
  minGapMs: number;
  minSelectedConfidence: number;
  minFlaggedConfidence: number;
  allowAbstractSelection: boolean;
};

type AssetOption = {
  asset: MotionAssetManifest;
  score: number;
};

type MatchedSpan = {
  startToken: TranscriptToken;
  endToken: TranscriptToken;
  matchedText: string;
  supportWords: string[];
  confidenceBoost?: number;
};

type MotionConceptRule = {
  id: string;
  label: string;
  category: MotionIntentCategory;
  placementHint: MotionShowcasePlacementHint;
  priority: number;
  abstract: boolean;
  suppressIfNearSameCategoryMs?: number;
  recommendedLabels: string[];
  assetSearchTerms: string[];
  emojiFallback?: string;
  match(tokens: TranscriptToken[], index: number): MatchedSpan | null;
};

export type MotionShowcaseIntent = {
  id: string;
  conceptId: string;
  conceptLabel: string;
  category: MotionIntentCategory;
  sourceChunkId: string;
  sourceChunkText: string;
  matchedText: string;
  matchedWordIndex: number;
  matchedStartMs: number;
  matchedEndMs: number;
  placementHint: MotionShowcasePlacementHint;
  confidence: number;
  reasoning: string;
  supportWords: string[];
  recommendedLabels: string[];
  assetSearchTerms: string[];
  matchedAsset: MotionAssetManifest | null;
  matchedAssetScore: number;
  assetOptions: Array<{
    assetId: string;
    canonicalLabel: string;
    score: number;
    source: MotionAssetSource | "local";
  }>;
  emojiFallback?: string;
  decision: MotionIntentDecision;
  governorDecision?: GovernorDecision | null;
  missingAssetCategory?: MissingAssetCategoryRecord | null;
  unresolvedReason?: string;
};

export type MotionShowcaseIntelligencePlan = {
  tier: MotionTier;
  targetCueRatio: number;
  maxCueRatio: number;
  targetCueCount: number;
  maxCueCount: number;
  minGapMs: number;
  assetCatalogCount: number;
  selectedIntents: MotionShowcaseIntent[];
  flaggedIntents: MotionShowcaseIntent[];
  suppressedIntents: MotionShowcaseIntent[];
  governorProfileId: string | null;
  governorVersion: string | null;
  selectedAssetCueCount: number;
  selectedTemplateCueCount: number;
  selectedTypographyCueCount: number;
  missingAssetCategories: MissingAssetCategoryRecord[];
  reasons: string[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "she",
  "so",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "with",
  "you",
  "your"
]);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

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

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const normalizeToken = (value: string): string => singularizeToken(normalizeShowcaseText(value));

const chunkWordsToTokens = (chunk: CaptionChunk, chunkIndex: number, globalStart: number): TranscriptToken[] => {
  const words = chunk.words.length > 0
    ? chunk.words
    : chunk.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, wordIndex, entries) => {
        const duration = Math.max(1, chunk.endMs - chunk.startMs);
        return {
          text: word,
          startMs: chunk.startMs + Math.round((duration / Math.max(1, entries.length)) * wordIndex),
          endMs: chunk.startMs + Math.round((duration / Math.max(1, entries.length)) * (wordIndex + 1))
        };
      });

  return words.map((word, wordIndex) => ({
    text: word.text,
    normalized: normalizeToken(word.text),
    startMs: word.startMs,
    endMs: word.endMs,
    chunkId: chunk.id,
    chunkIndex,
    wordIndex,
    globalIndex: globalStart + wordIndex
  }));
};

const buildTranscriptTokens = (chunks: CaptionChunk[]): TranscriptToken[] => {
  const tokens: TranscriptToken[] = [];
  let globalStart = 0;
  chunks.forEach((chunk, chunkIndex) => {
    const chunkTokens = chunkWordsToTokens(chunk, chunkIndex, globalStart);
    tokens.push(...chunkTokens);
    globalStart += chunkTokens.length;
  });
  return tokens;
};

const buildChunkTextMap = (chunks: CaptionChunk[]): Map<string, string> => {
  return new Map(chunks.map((chunk) => [chunk.id, chunk.text]));
};

const phraseFromTokens = (tokens: TranscriptToken[], startIndex: number, endIndex: number): string => {
  return tokens
    .slice(startIndex, endIndex + 1)
    .map((token) => token.text)
    .join(" ")
    .trim();
};

const isKeyword = (token: TranscriptToken, values: string[]): boolean => values.includes(token.normalized);

const findNearbyKeywordIndex = ({
  tokens,
  anchorIndex,
  maxDistance,
  keywords
}: {
  tokens: TranscriptToken[];
  anchorIndex: number;
  maxDistance: number;
  keywords: string[];
}): number => {
  const start = Math.max(0, anchorIndex - maxDistance);
  const end = Math.min(tokens.length - 1, anchorIndex + maxDistance);
  for (let index = start; index <= end; index += 1) {
    if (keywords.includes(tokens[index].normalized)) {
      return index;
    }
  }
  return -1;
};

const createSingleTokenMatch = ({
  tokens,
  index,
  supportWords,
  confidenceBoost
}: {
  tokens: TranscriptToken[];
  index: number;
  supportWords?: string[];
  confidenceBoost?: number;
}): MatchedSpan => ({
  startToken: tokens[index],
  endToken: tokens[index],
  matchedText: tokens[index].text,
  supportWords: unique([tokens[index].normalized, ...(supportWords ?? [])]),
  confidenceBoost
});

const createRangeMatch = ({
  tokens,
  startIndex,
  endIndex,
  supportWords,
  confidenceBoost
}: {
  tokens: TranscriptToken[];
  startIndex: number;
  endIndex: number;
  supportWords?: string[];
  confidenceBoost?: number;
}): MatchedSpan => ({
  startToken: tokens[startIndex],
  endToken: tokens[endIndex],
  matchedText: phraseFromTokens(tokens, startIndex, endIndex),
  supportWords: unique(
    tokens
      .slice(startIndex, endIndex + 1)
      .map((token) => token.normalized)
      .concat(supportWords ?? [])
  ),
  confidenceBoost
});

const financePurchaseKeywords = ["purchase", "purchased", "buy", "bought", "resold", "sold", "sale"];
const moneyKeywords = ["profit", "profits", "money", "cash", "income", "revenue", "expense", "expenses", "financial", "financials"];
const marketplaceKeywords = ["ebay", "amazon", "shopify", "etsy", "store", "storefront", "marketplace", "website"];
const growthKeywords = ["grow", "growth", "growing", "scale", "scaled", "scaling", "increase", "increased", "increasing"];
const obstacleKeywords = ["obstacle", "obstacles", "challenge", "challenges", "barrier", "barriers", "roadblock", "roadblocks", "problem", "problems"];
const homeKeywords = ["home", "house"];
const planningKeywords = ["track", "tracking", "tracked", "budget", "budgets", "expense", "expenses", "financial", "financials", "numbers"];
const processKeywords = ["process", "processes", "system", "systems", "step", "steps", "sequence", "workflow", "framework", "blueprint", "plan", "plans"];
const decisionKeywords = ["choice", "choose", "decision", "decide", "thinking", "wondering"];
const sunshineKeywords = ["sunshine", "sun", "sunny"];
const calendarKeywords = ["month", "months", "calendar", "year", "years", "annual"];
const cameraKeywords = ["camera", "photo", "photos", "photography", "photographer", "film", "filming", "shoot", "shooting", "video", "videos", "content"];
const expertiseKeywords = ["expert", "professional", "coach", "mentor", "authority"];

const conceptRules: MotionConceptRule[] = [
  {
    id: "commerce-purchase",
    label: "purchase",
    category: "finance",
    placementHint: "center",
    priority: 92,
    abstract: false,
    suppressIfNearSameCategoryMs: 8000,
    recommendedLabels: ["money", "bill", "coin"],
    assetSearchTerms: ["purchase", "purchased", "pay", "payment", "money", "cash", "currency", "bill"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], financePurchaseKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["finance", "purchase"],
        confidenceBoost: 6
      });
    }
  },
  {
    id: "money-profit",
    label: "profit",
    category: "finance",
    placementHint: "center",
    priority: 95,
    abstract: false,
    suppressIfNearSameCategoryMs: 7000,
    recommendedLabels: ["money", "coin", "bill"],
    assetSearchTerms: ["profit", "money", "cash", "income", "revenue", "currency"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], moneyKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["finance", "money"],
        confidenceBoost: 10
      });
    }
  },
  {
    id: "marketplace-platform",
    label: "marketplace",
    category: "marketplace",
    placementHint: "right",
    priority: 88,
    abstract: false,
    suppressIfNearSameCategoryMs: 12000,
    recommendedLabels: ["ebay", "amazon", "shopify", "storefront"],
    assetSearchTerms: ["ebay", "amazon", "shopify", "storefront", "website", "store", "marketplace"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], marketplaceKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["marketplace", tokens[index].normalized],
        confidenceBoost: tokens[index].normalized === "ebay" || tokens[index].normalized === "amazon" || tokens[index].normalized === "shopify" ? 12 : 4
      });
    }
  },
  {
    id: "planning-track-expenses",
    label: "tracking",
    category: "planning",
    placementHint: "left",
    priority: 84,
    abstract: true,
    suppressIfNearSameCategoryMs: 12000,
    recommendedLabels: ["notepad", "pen", "checklist"],
    assetSearchTerms: ["notepad", "pen", "checklist", "track", "budget", "notes"],
    emojiFallback: "📝",
    match(tokens, index) {
      if (!isKeyword(tokens[index], ["track", "tracking", "tracked"])) {
        return null;
      }
      const nearbyIndex = findNearbyKeywordIndex({
        tokens,
        anchorIndex: index,
        maxDistance: 4,
        keywords: ["expense", "expenses", "financial", "financials", "budget", "numbers", "system"]
      });
      if (nearbyIndex < 0) {
        return null;
      }
      return createRangeMatch({
        tokens,
        startIndex: Math.min(index, nearbyIndex),
        endIndex: Math.max(index, nearbyIndex),
        supportWords: ["tracking", "notes"],
        confidenceBoost: 12
      });
    }
  },
  {
    id: "process-blueprint",
    label: "plan",
    category: "planning",
    placementHint: "left",
    priority: 78,
    abstract: false,
    suppressIfNearSameCategoryMs: 10000,
    recommendedLabels: ["plan", "blueprint", "document"],
    assetSearchTerms: ["plan", "process", "system", "workflow", "blueprint", "document", "steps"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], processKeywords)) {
        return null;
      }
      const nearbyIndex = findNearbyKeywordIndex({
        tokens,
        anchorIndex: index,
        maxDistance: 3,
        keywords: ["build", "building", "create", "creating", "make", "making", "follow", "setup", "set", "sequence", "step", "steps"]
      });
      if (nearbyIndex < 0 && !["process", "system", "workflow", "blueprint", "plan"].includes(tokens[index].normalized)) {
        return null;
      }
      return createRangeMatch({
        tokens,
        startIndex: nearbyIndex < 0 ? index : Math.min(index, nearbyIndex),
        endIndex: nearbyIndex < 0 ? index : Math.max(index, nearbyIndex),
        supportWords: ["plan", "system", "process"],
        confidenceBoost: nearbyIndex < 0 ? 6 : 12
      });
    }
  },
  {
    id: "home-lifestyle",
    label: "home",
    category: "home",
    placementHint: "center",
    priority: 70,
    abstract: false,
    suppressIfNearSameCategoryMs: 15000,
    recommendedLabels: ["house", "home"],
    assetSearchTerms: ["house", "home", "household"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], homeKeywords)) {
        return null;
      }
      const previous = index > 0 ? tokens[index - 1].normalized : "";
      const boost = previous === "from" ? 8 : 0;
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["home"],
        confidenceBoost: boost
      });
    }
  },
  {
    id: "growth-graph",
    label: "growth",
    category: "growth",
    placementHint: "right",
    priority: 76,
    abstract: true,
    suppressIfNearSameCategoryMs: 12000,
    recommendedLabels: ["graph", "chart", "growth"],
    assetSearchTerms: ["graph", "chart", "growth", "upward", "scale"],
    emojiFallback: "📈",
    match(tokens, index) {
      if (!isKeyword(tokens[index], growthKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["growth"],
        confidenceBoost: 7
      });
    }
  },
  {
    id: "obstacle-barrier",
    label: "obstacle",
    category: "obstacle",
    placementHint: "left",
    priority: 80,
    abstract: true,
    suppressIfNearSameCategoryMs: 12000,
    recommendedLabels: ["obstacle", "barrier", "hurdle"],
    assetSearchTerms: ["obstacle", "barrier", "hurdle", "wall", "challenge"],
    emojiFallback: "🚧",
    match(tokens, index) {
      if (!isKeyword(tokens[index], obstacleKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["challenge", "obstacle"],
        confidenceBoost: 8
      });
    }
  },
  {
    id: "decision-thinking",
    label: "decision",
    category: "decision",
    placementHint: "center",
    priority: 62,
    abstract: true,
    suppressIfNearSameCategoryMs: 12000,
    recommendedLabels: ["thinking", "question", "idea"],
    assetSearchTerms: ["thinking", "question", "idea", "decision"],
    emojiFallback: "🤔",
    match(tokens, index) {
      if (!isKeyword(tokens[index], decisionKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["decision", "thinking"],
        confidenceBoost: 4
      });
    }
  },
  {
    id: "ambience-sunshine",
    label: "sunshine",
    category: "ambience",
    placementHint: "right",
    priority: 58,
    abstract: false,
    suppressIfNearSameCategoryMs: 16000,
    recommendedLabels: ["sun", "sunshine"],
    assetSearchTerms: ["sun", "sunshine", "bright"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], sunshineKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["sunshine"],
        confidenceBoost: 3
      });
    }
  },
  {
    id: "time-calendar",
    label: "calendar",
    category: "time",
    placementHint: "center",
    priority: 72,
    abstract: false,
    suppressIfNearSameCategoryMs: 14000,
    recommendedLabels: ["calendar", "month", "year"],
    assetSearchTerms: ["calendar", "month", "months", "year", "annual", "time"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], calendarKeywords)) {
        return null;
      }
      const previous = index > 0 ? tokens[index - 1] : undefined;
      const startIndex = previous && /\d/.test(previous.text) ? index - 1 : index;
      return createRangeMatch({
        tokens,
        startIndex,
        endIndex: index,
        supportWords: ["calendar", "time"],
        confidenceBoost: previous && /\d/.test(previous.text) ? 10 : 4
      });
    }
  },
  {
    id: "creation-camera",
    label: "camera",
    category: "creation",
    placementHint: "right",
    priority: 68,
    abstract: false,
    suppressIfNearSameCategoryMs: 12000,
    recommendedLabels: ["camera", "dslr", "photography"],
    assetSearchTerms: ["camera", "dslr", "lens", "photography", "filming", "shooting"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], cameraKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["camera", "creation"],
        confidenceBoost: 6
      });
    }
  },
  {
    id: "expertise-authority",
    label: "expert",
    category: "expertise",
    placementHint: "center",
    priority: 66,
    abstract: false,
    suppressIfNearSameCategoryMs: 12000,
    recommendedLabels: ["expert", "professional", "mortarboard"],
    assetSearchTerms: ["expert", "professional", "coach", "mentor", "authority", "graduation"],
    match(tokens, index) {
      if (!isKeyword(tokens[index], expertiseKeywords)) {
        return null;
      }
      return createSingleTokenMatch({
        tokens,
        index,
        supportWords: ["expert", "professional"],
        confidenceBoost: 6
      });
    }
  }
];

const tierConfig = {
  minimal: {
    targetPerMinute: 3,
    maxPerMinute: 4,
    targetCueRatio: 0.08,
    maxCueRatio: 0.12,
    minGapMs: 8500,
    minSelectedConfidence: 78,
    minFlaggedConfidence: 66,
    allowAbstractSelection: false
  },
  editorial: {
    targetPerMinute: 4,
    maxPerMinute: 5,
    targetCueRatio: 0.1,
    maxCueRatio: 0.15,
    minGapMs: 6800,
    minSelectedConfidence: 74,
    minFlaggedConfidence: 62,
    allowAbstractSelection: true
  },
  premium: {
    targetPerMinute: 5,
    maxPerMinute: 7,
    targetCueRatio: 0.12,
    maxCueRatio: 0.18,
    minGapMs: 5600,
    minSelectedConfidence: 70,
    minFlaggedConfidence: 58,
    allowAbstractSelection: true
  },
  hero: {
    targetPerMinute: 6,
    maxPerMinute: 8,
    targetCueRatio: 0.15,
    maxCueRatio: 0.22,
    minGapMs: 4600,
    minSelectedConfidence: 66,
    minFlaggedConfidence: 56,
    allowAbstractSelection: true
  }
} satisfies Record<MotionTier, ShowcaseSelectionConfig>;

const getShowcaseSelectionConfig = ({
  tier,
  captionProfileId
}: {
  tier: MotionTier;
  captionProfileId?: CaptionStyleProfileId;
}): ShowcaseSelectionConfig => {
  const base = tierConfig[tier];
  if (!isLongformSemanticSidecallCaptionStyleProfile(captionProfileId)) {
    return base;
  }

  return {
    ...base,
    targetPerMinute: Math.max(base.targetPerMinute, Number((base.targetPerMinute * 1.22).toFixed(2))),
    maxPerMinute: Math.max(base.maxPerMinute, Number((base.maxPerMinute * 1.22).toFixed(2))),
    targetCueRatio: Math.min(0.72, Number((base.targetCueRatio * 1.12).toFixed(3))),
    maxCueRatio: Math.min(0.86, Number((base.maxCueRatio * 1.1).toFixed(3))),
    minGapMs: Math.max(3200, Math.round(base.minGapMs * 0.8)),
    minSelectedConfidence: Math.max(52, base.minSelectedConfidence - 4),
    minFlaggedConfidence: Math.max(48, base.minFlaggedConfidence - 4)
  };
};

const buildConfidence = ({
  rule,
  span,
  tokens,
  index
}: {
  rule: MotionConceptRule;
  span: MatchedSpan;
  tokens: TranscriptToken[];
  index: number;
}): number => {
  const durationMs = Math.max(1, span.endToken.endMs - span.startToken.startMs);
  const spanLength = span.endToken.globalIndex - span.startToken.globalIndex + 1;
  const phraseBonus = spanLength > 1 ? 8 : 0;
  const durationBonus = durationMs >= 260 && durationMs <= 1400 ? 6 : durationMs < 180 ? -4 : 0;
  const properNounBonus = /^[A-Z0-9]/.test(tokens[index].text) ? 4 : 0;
  const base = rule.priority + phraseBonus + durationBonus + properNounBonus + (span.confidenceBoost ?? 0);

  return clamp(base, 0, 100);
};

const buildReasoning = ({
  rule,
  matchedText,
  assetOptions
}: {
  rule: MotionConceptRule;
  matchedText: string;
  assetOptions: AssetOption[];
}): string => {
  const assetReason = assetOptions[0]
    ? `matched ${assetOptions[0].asset.canonicalLabel ?? assetOptions[0].asset.id}`
    : `needs ${rule.recommendedLabels.join(" / ")}`;
  return `${rule.label} intent from "${matchedText}" | ${assetReason}`;
};

const buildAssetSearchPool = (intent: {
  conceptLabel: string;
  matchedText: string;
  supportWords: string[];
  recommendedLabels: string[];
  assetSearchTerms: string[];
}): string[] => {
  const raw = [
    intent.conceptLabel,
    ...intent.assetSearchTerms,
    ...intent.recommendedLabels,
    ...intent.supportWords,
    ...normalizeShowcaseText(intent.matchedText).split(" ")
  ];

  return unique(
    raw
      .map(normalizeToken)
      .filter((value) => value.length > 1 && !STOP_WORDS.has(value))
  );
};

const scoreAssetOption = ({
  asset,
  searchPool,
  recommendedLabels
}: {
  asset: MotionAssetManifest;
  searchPool: string[];
  recommendedLabels: string[];
}): number => {
  const assetTerms = unique(
    [
      normalizeShowcaseLabel(asset.canonicalLabel ?? asset.id),
      ...(asset.searchTerms ?? []).map(normalizeToken),
      normalizeToken(asset.id),
      normalizeToken(asset.sourceId ?? "")
    ].filter(Boolean)
  );
  const normalizedRecommendedLabels = recommendedLabels.map(normalizeToken);
  const schemaBoost = getSchemaAssetScoreBoost({
    asset,
    text: [...searchPool, ...recommendedLabels].join(" ")
  });

  let score = 0;
  searchPool.forEach((term) => {
    if (assetTerms.includes(term)) {
      score += normalizedRecommendedLabels.includes(term) ? 22 : 12;
    }
  });

  const label = normalizeShowcaseLabel(asset.canonicalLabel ?? asset.id);
  if (normalizedRecommendedLabels.includes(label)) {
    score += 30;
  }

  const importedCutoutBoost = asset.src.includes("showcase-assets/imports/prometheus-concrete/")
    ? 22
    : asset.src.includes("showcase-assets/imports/")
      ? 8
      : 0;
  if (importedCutoutBoost > 0) {
    score += importedCutoutBoost;
    if (normalizedRecommendedLabels.includes(label)) {
      score += importedCutoutBoost >= 20 ? 10 : 4;
    }
  }

  score += schemaBoost;

  return score;
};

const buildAssetOptions = ({
  intent,
  catalog
}: {
  intent: {
    conceptLabel: string;
    matchedText: string;
    supportWords: string[];
    recommendedLabels: string[];
    assetSearchTerms: string[];
  };
  catalog: MotionAssetManifest[];
}): AssetOption[] => {
  const searchPool = buildAssetSearchPool(intent);

  return catalog
    .map((asset) => ({
      asset,
      score: scoreAssetOption({
        asset,
        searchPool,
        recommendedLabels: intent.recommendedLabels
      })
    }))
    .filter((option) => option.score > 0)
    .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id))
    .slice(0, 4);
};

const buildCandidateKey = ({
  rule,
  span
}: {
  rule: MotionConceptRule;
  span: MatchedSpan;
}): string => `${rule.id}:${span.startToken.globalIndex}:${span.endToken.globalIndex}`;

const buildRawIntents = ({
  chunks,
  catalog
}: {
  chunks: CaptionChunk[];
  catalog: MotionAssetManifest[];
}): MotionShowcaseIntent[] => {
  const tokens = buildTranscriptTokens(chunks);
  const chunkTextMap = buildChunkTextMap(chunks);
  const seen = new Set<string>();
  const raw: MotionShowcaseIntent[] = [];

  tokens.forEach((token, index) => {
    conceptRules.forEach((rule) => {
      const span = rule.match(tokens, index);
      if (!span) {
        return;
      }

      const key = buildCandidateKey({rule, span});
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      const confidence = buildConfidence({rule, span, tokens, index});
      const assetOptions = buildAssetOptions({
        intent: {
          conceptLabel: rule.label,
          matchedText: span.matchedText,
          supportWords: span.supportWords,
          recommendedLabels: rule.recommendedLabels,
          assetSearchTerms: rule.assetSearchTerms
        },
        catalog
      });

      raw.push({
        id: `intent-${rule.id}-${span.startToken.globalIndex}`,
        conceptId: rule.id,
        conceptLabel: rule.label,
        category: rule.category,
        sourceChunkId: span.startToken.chunkId,
        sourceChunkText: chunkTextMap.get(span.startToken.chunkId) ?? span.matchedText,
        matchedText: span.matchedText,
        matchedWordIndex: span.startToken.globalIndex,
        matchedStartMs: span.startToken.startMs,
        matchedEndMs: span.endToken.endMs,
        placementHint: rule.placementHint,
        confidence,
        reasoning: buildReasoning({
          rule,
          matchedText: span.matchedText,
          assetOptions
        }),
        supportWords: span.supportWords,
        recommendedLabels: rule.recommendedLabels,
        assetSearchTerms: rule.assetSearchTerms,
        matchedAsset: assetOptions[0]?.asset ?? null,
        matchedAssetScore: assetOptions[0]?.score ?? 0,
        assetOptions: assetOptions.map((option) => ({
          assetId: option.asset.id,
          canonicalLabel: option.asset.canonicalLabel ?? option.asset.id,
          score: option.score,
          source: option.asset.source ?? "local"
        })),
        emojiFallback: rule.emojiFallback,
        decision: "flagged"
      });
    });
  });

  return raw.sort((a, b) => b.confidence - a.confidence || a.matchedStartMs - b.matchedStartMs || a.id.localeCompare(b.id));
};

const dedupeIntents = (intents: MotionShowcaseIntent[]): MotionShowcaseIntent[] => {
  const deduped: MotionShowcaseIntent[] = [];

  intents.forEach((intent) => {
    const existingIndex = deduped.findIndex((entry) => {
      return (
        entry.conceptId === intent.conceptId &&
        entry.sourceChunkId === intent.sourceChunkId &&
        Math.abs(entry.matchedStartMs - intent.matchedStartMs) < 400
      );
    });

    if (existingIndex < 0) {
      deduped.push(intent);
      return;
    }

    if (intent.confidence > deduped[existingIndex].confidence) {
      deduped[existingIndex] = intent;
    }
  });

  return deduped;
};

const countBudgetByDuration = ({
  durationSeconds,
  perMinute
}: {
  durationSeconds: number;
  perMinute: number;
}): number => Math.max(1, Math.round((durationSeconds / 60) * perMinute));

const chooseAssetVariant = ({
  intent,
  usedAssetIds,
  catalog
}: {
  intent: MotionShowcaseIntent;
  usedAssetIds: Set<string>;
  catalog: MotionAssetManifest[];
}): MotionAssetManifest | null => {
  if (!intent.matchedAsset) {
    return null;
  }

  const recommendedLabels = intent.recommendedLabels.map(normalizeToken);
  const bestUnseen = intent.assetOptions.find((option) => {
    if (usedAssetIds.has(option.assetId)) {
      return false;
    }

    const normalizedLabel = normalizeToken(option.canonicalLabel);
    return recommendedLabels.includes(normalizedLabel) || option.score >= 60;
  });
  if (!bestUnseen) {
    return usedAssetIds.has(intent.matchedAsset.id) ? null : intent.matchedAsset;
  }

  return catalog.find((asset) => asset.id === bestUnseen.assetId) ?? intent.matchedAsset;
};

const aggregateMissingAssetCategories = (
  records: Array<MissingAssetCategoryRecord | null | undefined>
): MissingAssetCategoryRecord[] => {
  const aggregated = new Map<string, MissingAssetCategoryRecord>();

  records.forEach((record) => {
    if (!record) {
      return;
    }

    const current = aggregated.get(record.categoryId);
    if (!current) {
      aggregated.set(record.categoryId, {
        ...record,
        aliases: unique(record.aliases)
      });
      return;
    }

    aggregated.set(record.categoryId, {
      ...current,
      label: record.label,
      aliases: unique([...current.aliases, ...record.aliases]).slice(0, 16),
      examplePhrase: record.examplePhrase || current.examplePhrase,
      requestedPack: record.requestedPack,
      count: current.count + record.count
    });
  });

  return [...aggregated.values()].sort((left, right) => {
    return right.count - left.count || left.categoryId.localeCompare(right.categoryId);
  });
};

const formatGovernorReason = (reasonCode: NonNullable<GovernorDecision["reasonCodes"]>[number]): string => {
  if (reasonCode === "semantic-weight-strong") {
    return "semantic weight came through strongly";
  }
  if (reasonCode === "semantic-weight-low") {
    return "semantic weight stayed too soft for a cue";
  }
  if (reasonCode === "title-context-match") {
    return "the phrase aligns with the sidecall keyword bank";
  }
  if (reasonCode === "emphasis-boost") {
    return "spoken emphasis boosted the cue";
  }
  if (reasonCode === "duration-strong") {
    return "the phrase held long enough to read cleanly";
  }
  if (reasonCode === "numeric-signal") {
    return "numeric language suggests a data graphic";
  }
  if (reasonCode === "asset-coverage-strong") {
    return "strong direct asset coverage is available";
  }
  if (reasonCode === "asset-coverage-weak") {
    return "direct asset coverage is weak";
  }
  if (reasonCode === "template-coverage-available") {
    return "a premium template graphic is available";
  }
  if (reasonCode === "template-preferred") {
    return "template routing is a better fit than cutout art";
  }
  if (reasonCode === "typography-fallback") {
    return "the governor held the moment as typography only";
  }
  if (reasonCode === "screen-pressure-high") {
    return "the current line is visually busy";
  }
  if (reasonCode === "cooldown-active") {
    return "a nearby cue already used this timing window";
  }
  if (reasonCode === "nearby-cue") {
    return "another cue already occupies this beat";
  }
  if (reasonCode === "repeated-category") {
    return "this category was already used too recently";
  }
  if (reasonCode === "repeated-asset") {
    return "the best matching asset was already used";
  }
  if (reasonCode === "abstract-held") {
    return "the current tier still prefers concrete visual support";
  }
  return "cue density was already at the governor budget";
};

const buildGovernorReasoning = ({
  baseReasoning,
  governorDecision
}: {
  baseReasoning: string;
  governorDecision: GovernorDecision;
}): string => {
  const actionLabel = governorDecision.action.replace(/-/g, " ");
  const reasonDetails = governorDecision.reasonCodes
    .map(formatGovernorReason)
    .slice(0, 3)
    .join("; ");

  return `${baseReasoning} | governor ${actionLabel} (${governorDecision.score})${reasonDetails ? ` | ${reasonDetails}` : ""}`;
};

const buildGovernorUnresolvedReason = ({
  governorDecision,
  missingAssetCategory
}: {
  governorDecision: GovernorDecision;
  missingAssetCategory: MissingAssetCategoryRecord | null;
}): string => {
  if (missingAssetCategory) {
    return `Coverage queued for ${missingAssetCategory.label}. Rendering stays restrained until a premium ${missingAssetCategory.requestedPack} asset family exists.`;
  }

  const reasonDetails = governorDecision.reasonCodes
    .map(formatGovernorReason)
    .slice(0, 2)
    .join("; ");
  return reasonDetails
    ? `Governor held this moment because ${reasonDetails}.`
    : "Governor held this moment for editorial restraint.";
};

export const buildMotionShowcaseIntelligencePlan = ({
  chunks,
  tier,
  videoMetadata,
  captionProfileId,
  catalog = getShowcaseAssetCatalog()
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  captionProfileId?: CaptionStyleProfileId;
  catalog?: MotionAssetManifest[];
}): MotionShowcaseIntelligencePlan => {
  const isSemanticSidecall = isLongformSemanticSidecallCaptionStyleProfile(captionProfileId);
  const config = getShowcaseSelectionConfig({
    tier,
    captionProfileId
  });
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const durationSeconds = videoMetadata?.durationSeconds
    ?? Math.max(1, chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0) / 1000);
  const targetCueCount = Math.min(
    countBudgetByDuration({durationSeconds, perMinute: config.targetPerMinute}),
    Math.max(1, Math.floor(chunks.length * config.targetCueRatio))
  );
  const maxCueCount = Math.min(
    countBudgetByDuration({durationSeconds, perMinute: config.maxPerMinute}),
    Math.max(1, Math.ceil(chunks.length * config.maxCueRatio))
  );
  const usedAssetIds = new Set<string>();
  const selectedIntents: MotionShowcaseIntent[] = [];
  const flaggedIntents: MotionShowcaseIntent[] = [];
  const suppressedIntents: MotionShowcaseIntent[] = [];
  const recentCategoryUse = new Map<string, number>();
  const rawIntents = dedupeIntents(buildRawIntents({chunks, catalog}));

  rawIntents.forEach((rawIntent) => {
    const conceptRule = conceptRules.find((rule) => rule.id === rawIntent.conceptId);
    const lastCategoryUse = recentCategoryUse.get(rawIntent.category) ?? Number.NEGATIVE_INFINITY;
    const selectionCooldownMs = isSemanticSidecall
      ? Math.max(config.minGapMs, semanticSidecallCinematicGovernorPolicy.cooldownMs)
      : config.minGapMs;
    const sameCategoryCooldownMs = isSemanticSidecall
      ? Math.max(
        conceptRule?.suppressIfNearSameCategoryMs ?? 0,
        semanticSidecallCinematicGovernorPolicy.cooldownMs
      )
      : conceptRule?.suppressIfNearSameCategoryMs;
    const nearSameCategory = sameCategoryCooldownMs
      ? rawIntent.matchedStartMs - lastCategoryUse < sameCategoryCooldownMs
      : false;
    const nearSelected = selectedIntents.some((intent) => {
      return Math.abs(intent.matchedStartMs - rawIntent.matchedStartMs) < selectionCooldownMs;
    });
    const canSelectAbstract = !conceptRule?.abstract || config.allowAbstractSelection;
    const chosenAsset = chooseAssetVariant({intent: rawIntent, usedAssetIds, catalog});
    const matchedAssetScore = chosenAsset
      ? rawIntent.assetOptions.find((option) => option.assetId === chosenAsset.id)?.score ?? rawIntent.matchedAssetScore
      : rawIntent.matchedAssetScore;
    const hasRenderableChosenAsset = chosenAsset !== null && matchedAssetScore >= 28;
    const requestedAssetAlreadyUsed = chosenAsset === null && rawIntent.matchedAsset !== null && usedAssetIds.has(rawIntent.matchedAsset.id);
    const baseReasoning = chosenAsset
      ? `${rawIntent.conceptLabel} intent from "${rawIntent.matchedText}" | matched ${chosenAsset.canonicalLabel ?? chosenAsset.id}`
      : rawIntent.reasoning;

    const selectedIntent: MotionShowcaseIntent = {
      ...rawIntent,
      matchedAsset: chosenAsset,
      matchedAssetScore,
      reasoning: baseReasoning
    };

    if (isSemanticSidecall) {
      const {decision: governorDecision, missingAssetCategory} = buildSemanticSidecallGovernorDecision({
        candidate: {
          conceptId: selectedIntent.conceptId,
          conceptLabel: selectedIntent.conceptLabel,
          category: selectedIntent.category,
          sourceChunkText: selectedIntent.sourceChunkText,
          matchedText: selectedIntent.matchedText,
          matchedStartMs: selectedIntent.matchedStartMs,
          matchedEndMs: selectedIntent.matchedEndMs,
          placementHint: selectedIntent.placementHint,
          confidence: selectedIntent.confidence,
          supportWords: selectedIntent.supportWords,
          recommendedLabels: selectedIntent.recommendedLabels,
          assetSearchTerms: selectedIntent.assetSearchTerms,
          matchedAsset: selectedIntent.matchedAsset,
          matchedAssetScore: selectedIntent.matchedAssetScore,
          assetOptions: selectedIntent.assetOptions
        },
        sourceChunk: chunkById.get(selectedIntent.sourceChunkId) ?? null,
        canSelectAbstract,
        nearSelected,
        nearSameCategory,
        requestedAssetAlreadyUsed,
        selectedCount: selectedIntents.length,
        maxCueCount
      });

      const governedIntent: MotionShowcaseIntent = {
        ...selectedIntent,
        governorDecision,
        missingAssetCategory,
        reasoning: buildGovernorReasoning({
          baseReasoning,
          governorDecision
        })
      };

      if (governorDecision.action !== "suppress") {
        governedIntent.decision = "selected";
        governedIntent.unresolvedReason = undefined;
        selectedIntents.push(governedIntent);
        recentCategoryUse.set(rawIntent.category, rawIntent.matchedStartMs);
        if (governorDecision.cueSource === "direct-asset" && governedIntent.matchedAsset) {
          usedAssetIds.add(governedIntent.matchedAsset.id);
        }
        return;
      }

      governedIntent.decision = missingAssetCategory ? "flagged" : "suppressed";
      governedIntent.unresolvedReason = buildGovernorUnresolvedReason({
        governorDecision,
        missingAssetCategory
      });
      if (governedIntent.decision === "flagged") {
        flaggedIntents.push(governedIntent);
      } else {
        suppressedIntents.push(governedIntent);
      }
      return;
    }

    if (selectedIntents.length < targetCueCount && !nearSelected && !nearSameCategory && hasRenderableChosenAsset && canSelectAbstract && rawIntent.confidence >= config.minSelectedConfidence) {
      selectedIntent.decision = "selected";
      selectedIntents.push(selectedIntent);
      recentCategoryUse.set(rawIntent.category, rawIntent.matchedStartMs);
      if (selectedIntent.matchedAsset) {
        usedAssetIds.add(selectedIntent.matchedAsset.id);
      }
      return;
    }

    if (rawIntent.confidence >= config.minFlaggedConfidence) {
      selectedIntent.decision = selectedIntents.length >= maxCueCount || nearSelected
        ? "suppressed"
        : "flagged";
      selectedIntent.unresolvedReason = !canSelectAbstract
        ? "Current tier prefers concrete visuals, so this abstract cue was held back."
        : !hasRenderableChosenAsset && requestedAssetAlreadyUsed
          ? "The closest matching asset variant was already used earlier, so this cue needs a different image variant."
        : !hasRenderableChosenAsset
          ? "No suitable showcase asset is currently available for this semantic moment."
          : nearSameCategory
            ? "A similar semantic category was already used nearby, so this cue was held back."
            : nearSelected
              ? "A nearby cue already occupies this moment, so the engine skipped this one for readability."
              : selectedIntents.length >= maxCueCount
                ? "Cue density budget reached for the current tier."
                : "Held for editorial restraint.";

      if (selectedIntent.decision === "flagged") {
        flaggedIntents.push(selectedIntent);
      } else {
        suppressedIntents.push(selectedIntent);
      }
      return;
    }

    suppressedIntents.push({
      ...selectedIntent,
      decision: "suppressed",
      unresolvedReason: "Confidence too low for the current motion tier."
    });
  });

  const minimumCoverageFloor = isSemanticSidecall
    ? 0
    : Math.max(2, Math.min(maxCueCount, Math.round(durationSeconds / 45)));
  if (!isSemanticSidecall && selectedIntents.length < minimumCoverageFloor) {
    const promotedIds = new Set<string>();
    const promotionPool = [...flaggedIntents, ...suppressedIntents]
      .filter((intent) => intent.matchedAsset && intent.matchedAssetScore >= 34)
      .sort((a, b) => {
        return (b.confidence + b.matchedAssetScore) - (a.confidence + a.matchedAssetScore) ||
          a.matchedStartMs - b.matchedStartMs;
      });

    for (const candidate of promotionPool) {
      if (selectedIntents.length >= minimumCoverageFloor) {
        break;
      }
      if (candidate.matchedAsset && usedAssetIds.has(candidate.matchedAsset.id)) {
        continue;
      }

      const nearSelected = selectedIntents.some((intent) => {
        return Math.abs(intent.matchedStartMs - candidate.matchedStartMs) < config.minGapMs;
      });
      const recentCategoryTime = recentCategoryUse.get(candidate.category) ?? Number.NEGATIVE_INFINITY;
      const nearSameCategory = candidate.matchedStartMs - recentCategoryTime < Math.max(4600, config.minGapMs * 0.7);
      if (nearSelected || nearSameCategory) {
        continue;
      }

      candidate.decision = "selected";
      candidate.unresolvedReason = undefined;
      selectedIntents.push(candidate);
      recentCategoryUse.set(candidate.category, candidate.matchedStartMs);
      if (candidate.matchedAsset) {
        usedAssetIds.add(candidate.matchedAsset.id);
      }
      promotedIds.add(candidate.id);
    }

    if (promotedIds.size > 0) {
      const keepIntent = (intent: MotionShowcaseIntent): boolean => !promotedIds.has(intent.id);
      flaggedIntents.splice(0, flaggedIntents.length, ...flaggedIntents.filter(keepIntent));
      suppressedIntents.splice(0, suppressedIntents.length, ...suppressedIntents.filter(keepIntent));
    }
  }

  const missingAssetCategories = aggregateMissingAssetCategories([
    ...selectedIntents.map((intent) => intent.missingAssetCategory),
    ...flaggedIntents.map((intent) => intent.missingAssetCategory),
    ...suppressedIntents.map((intent) => intent.missingAssetCategory)
  ]);
  const selectedAssetCueCount = selectedIntents.filter((intent) => {
    return intent.governorDecision?.cueSource
      ? intent.governorDecision.cueSource === "direct-asset"
      : Boolean(intent.matchedAsset);
  }).length;
  const selectedTemplateCueCount = selectedIntents.filter((intent) => {
    return intent.governorDecision?.cueSource === "template-graphic";
  }).length;
  const selectedTypographyCueCount = selectedIntents.filter((intent) => {
    return intent.governorDecision?.cueSource === "typography-only";
  }).length;

  const reasons = [
    `tier=${tier}`,
    `profile=${captionProfileId ?? "default"}`,
    `catalog=${catalog.length} showcase assets`,
    `selected=${selectedIntents.length}/${targetCueCount} target`,
    `flagged=${flaggedIntents.length}`,
    `suppressed=${suppressedIntents.length}`,
    `min-gap=${config.minGapMs}ms`,
    `ratio=${config.targetCueRatio.toFixed(2)} target / ${config.maxCueRatio.toFixed(2)} max`,
    `coverage-floor=${minimumCoverageFloor}`
  ];
  if (isSemanticSidecall) {
    reasons.push(
      `governor=${semanticSidecallCinematicGovernorPolicy.id}@${semanticSidecallCinematicGovernorPolicy.version}`,
      `cue-sources=asset:${selectedAssetCueCount} template:${selectedTemplateCueCount} typography:${selectedTypographyCueCount}`,
      `missing-categories=${missingAssetCategories.length}`
    );
  }

  return {
    tier,
    targetCueRatio: config.targetCueRatio,
    maxCueRatio: config.maxCueRatio,
    targetCueCount,
    maxCueCount,
    minGapMs: config.minGapMs,
    assetCatalogCount: catalog.length,
    selectedIntents,
    flaggedIntents,
    suppressedIntents,
    governorProfileId: isSemanticSidecall ? semanticSidecallCinematicGovernorPolicy.id : null,
    governorVersion: isSemanticSidecall ? semanticSidecallCinematicGovernorPolicy.version : null,
    selectedAssetCueCount,
    selectedTemplateCueCount,
    selectedTypographyCueCount,
    missingAssetCategories,
    reasons
  };
};
