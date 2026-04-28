import type {MotionTier} from "../types";

import type {AssetSearchRequest, AssetSearchResult, NormalizedAssetDocument} from "./types";
import {buildSearchTerms, normalizeAssetText, tokenizeAssetText, uniqueStrings} from "./text-utils";

type RoleIntent = "headline" | "underlay" | "background" | "transition" | "motion" | "generic";

type PreparedRequest = {
  normalizedQuery: string;
  lexicalTerms: Set<string>;
  roleIntent: RoleIntent;
  desiredAssetTypeOrder: Map<string, number>;
  normalizedMood: string[];
  normalizedContexts: Set<string>;
  normalizedAntiContexts: Set<string>;
  normalizedConstraints: Set<string>;
  normalizedPositionRole: string;
  wantsCircularBoost: boolean;
  wantsReflectiveTone: boolean;
  wantsAggressiveMotion: boolean;
};

type PreparedDocument = {
  lexicalTerms: Set<string>;
  visualSignaturePool: string;
  normalizedTags: Set<string>;
  normalizedContexts: string[];
  normalizedAntiContexts: string[];
  normalizedConstraints: string[];
  normalizedMood: string[];
  normalizedDominantVisualRole: string;
};

const queryNeedsCircularBoost = (query: string): boolean => /(circle|circular|ring|halo|orbit|round)/.test(normalizeAssetText(query));
const queryNeedsReflectiveTone = (query: string): boolean => /(reflective|thoughtful|blur|soft|cinematic|calm|subtle)/.test(normalizeAssetText(query));
const queryNeedsAggressiveMotion = (query: string): boolean => /(burst|spike|impact|aggressive|fast|kinetic|explosive)/.test(normalizeAssetText(query));

const preparedRequestCache = new WeakMap<AssetSearchRequest, PreparedRequest>();
const preparedDocumentCache = new WeakMap<NormalizedAssetDocument, PreparedDocument>();

const resolveMotionTierPenalty = (requestTier: MotionTier | undefined, documentTier: MotionTier): number => {
  if (!requestTier) {
    return 0;
  }
  if (requestTier === documentTier) {
    return 18;
  }
  if ((requestTier === "hero" && documentTier === "premium") || (requestTier === "minimal" && documentTier === "editorial")) {
    return 8;
  }
  return -10;
};

const buildRequestPool = (request: AssetSearchRequest): string => {
  return normalizeAssetText([
    request.positionRole ?? "",
    request.queryText,
    request.sceneIntent ?? "",
    ...(request.contexts ?? []),
    ...(request.compositionHints ?? []),
    ...(request.constraints ?? [])
  ].join(" "));
};

const buildVisualSignaturePool = (document: NormalizedAssetDocument): string => {
  return normalizeAssetText([
    document.asset_type,
    document.filename,
    document.retrieval_caption,
    document.semantic_description,
    document.animation_family,
    document.subject,
    document.category,
    document.dominant_visual_role
  ].join(" "));
};

const resolvePrimaryRoleIntent = (request: AssetSearchRequest): RoleIntent => {
  const explicitRole = normalizeAssetText(request.positionRole ?? "");
  const requestPool = buildRequestPool(request);

  if (/(headline|quote|word|typography|text)/.test(explicitRole)) {
    return "headline";
  }
  if (/(underlay|accent|halo|ring|focus)/.test(explicitRole)) {
    return "underlay";
  }
  if (/(background|stage|depth)/.test(explicitRole)) {
    return "background";
  }
  if (/(transition|sweep|wipe)/.test(explicitRole)) {
    return "transition";
  }
  if (/(motion|emphasis|punctuation)/.test(explicitRole)) {
    return "motion";
  }
  if (/(underlay|behind centered headline|behind headline|halo behind|ring behind|background accent)/.test(requestPool)) {
    return "underlay";
  }
  if (/(background|support image|wallpaper|scene support|clean stage)/.test(requestPool)) {
    return "background";
  }
  if (/(transition|wipe|bridge|punctuation)/.test(requestPool)) {
    return "transition";
  }
  if (/(emphasis|spike|kinetic|impact)/.test(requestPool)) {
    return "motion";
  }
  if (/(headline|quote|word|typography|text|title)/.test(requestPool)) {
    return "headline";
  }
  return "generic";
};

const getPreparedRequest = (request: AssetSearchRequest): PreparedRequest => {
  const cached = preparedRequestCache.get(request);
  if (cached) {
    return cached;
  }

  const normalizedQuery = buildRequestPool(request);
  const prepared: PreparedRequest = {
    normalizedQuery,
    lexicalTerms: new Set(buildSearchTerms(
      request.queryText,
      request.sceneIntent,
      ...(request.contexts ?? []),
      ...(request.compositionHints ?? []),
      ...(request.constraints ?? [])
    )),
    roleIntent: resolvePrimaryRoleIntent(request),
    desiredAssetTypeOrder: new Map((request.desiredAssetTypes ?? []).map((assetType, index) => [assetType, index])),
    normalizedMood: (request.mood ?? []).map((mood) => normalizeAssetText(mood)).filter(Boolean),
    normalizedContexts: new Set((request.contexts ?? []).map((context) => normalizeAssetText(context)).filter(Boolean)),
    normalizedAntiContexts: new Set((request.antiContexts ?? []).map((context) => normalizeAssetText(context)).filter(Boolean)),
    normalizedConstraints: new Set((request.constraints ?? []).map((constraint) => normalizeAssetText(constraint)).filter(Boolean)),
    normalizedPositionRole: normalizeAssetText(request.positionRole ?? ""),
    wantsCircularBoost: queryNeedsCircularBoost(normalizedQuery),
    wantsReflectiveTone: queryNeedsReflectiveTone(normalizedQuery),
    wantsAggressiveMotion: queryNeedsAggressiveMotion(normalizedQuery)
  };

  preparedRequestCache.set(request, prepared);
  return prepared;
};

const getPreparedDocument = (document: NormalizedAssetDocument): PreparedDocument => {
  const cached = preparedDocumentCache.get(document);
  if (cached) {
    return cached;
  }

  const prepared: PreparedDocument = {
    lexicalTerms: new Set(buildSearchTerms(
      document.filename,
      document.folder_name,
      document.semantic_description,
      document.retrieval_caption,
      document.animation_family,
      ...(document.tags ?? []),
      ...(document.labels ?? []),
      ...(document.contexts ?? []),
      ...(document.constraints ?? [])
    )),
    visualSignaturePool: buildVisualSignaturePool(document),
    normalizedTags: new Set(uniqueStrings([
      ...(document.tags ?? []),
      ...(document.labels ?? []),
      document.subject,
      document.category,
      document.dominant_visual_role,
      document.animation_family
    ]).map((value) => normalizeAssetText(value)).filter(Boolean)),
    normalizedContexts: (document.contexts ?? []).map((context) => normalizeAssetText(context)).filter(Boolean),
    normalizedAntiContexts: (document.anti_contexts ?? []).map((context) => normalizeAssetText(context)).filter(Boolean),
    normalizedConstraints: (document.constraints ?? []).map((constraint) => normalizeAssetText(constraint)).filter(Boolean),
    normalizedMood: (document.mood ?? []).map((mood) => normalizeAssetText(mood)).filter(Boolean),
    normalizedDominantVisualRole: normalizeAssetText(document.dominant_visual_role)
  };

  preparedDocumentCache.set(document, prepared);
  return prepared;
};

const scoreLexicalSeed = (preparedRequest: PreparedRequest, preparedDocument: PreparedDocument): number => {
  let score = 0;
  preparedRequest.lexicalTerms.forEach((term) => {
    if (preparedDocument.lexicalTerms.has(term)) {
      score += term.includes(" ") ? 14 : 5;
    }
  });

  return score;
};

const scoreRoleCompatibility = ({
  roleIntent,
  document,
  rolePool
}: {
  roleIntent: RoleIntent;
  document: NormalizedAssetDocument;
  rolePool: string;
}): {
  delta: number;
  reasons: string[];
} => {
  const reasons: string[] = [];
  let delta = 0;
  const isHeadline = document.asset_type === "typography_effect" || /(headline|quote|word|typography|text|selection|underline)/.test(rolePool);
  const isUnderlay = /(underlay|halo|ring|glow|focus|accent|spotlight|frame)/.test(rolePool);
  const isBackground = document.asset_type === "background" || /(background|wallpaper|texture|stage|depth)/.test(rolePool) || (document.asset_type === "static_image" && !isHeadline);
  const isTransition = /(transition|sweep|wipe|burst|bridge)/.test(rolePool);
  const isMotion = document.extension_is_animated || document.asset_type === "motion_graphic" || document.asset_type === "animated_overlay";
  const isUi = document.asset_type === "ui_card" || /(card|panel|hud|glass|ui)/.test(rolePool);

  if (roleIntent === "headline") {
    if (isHeadline || isUi) {
      delta += 22;
      reasons.push("headline support fit");
    }
    if (isTransition && !isHeadline) {
      delta -= 10;
      reasons.push("transition-first asset for headline request");
    }
    if (isUnderlay && !isHeadline && !isUi) {
      delta -= 6;
      reasons.push("underlay-first asset for headline request");
    }
  }

  if (roleIntent === "underlay") {
    if (isUnderlay || isBackground || (isMotion && !isHeadline)) {
      delta += 24;
      reasons.push("underlay role fit");
    }
    if (isHeadline && !isUnderlay) {
      delta -= 24;
      reasons.push("headline-first asset for underlay request");
    }
    if (document.asset_type === "typography_effect") {
      delta -= 12;
    }
  }

  if (roleIntent === "background") {
    if (isBackground || (document.asset_type === "static_image" && !isHeadline)) {
      delta += 22;
      reasons.push("background fit");
    }
    if (isTransition) {
      delta -= 16;
      reasons.push("transition asset for background request");
    }
    if (isHeadline) {
      delta -= 12;
      reasons.push("headline asset for background request");
    }
  }

  if (roleIntent === "transition") {
    if (isTransition || (isMotion && document.motion_intensity !== "minimal")) {
      delta += 20;
      reasons.push("transition fit");
    }
    if (!isMotion) {
      delta -= 14;
      reasons.push("static asset for transition request");
    }
  }

  if (roleIntent === "motion") {
    if (isMotion) {
      delta += 16;
      reasons.push("motion fit");
    }
    if (isBackground && !isMotion) {
      delta -= 8;
      reasons.push("too static for motion emphasis");
    }
  }

  return {delta, reasons};
};

export const rerankAssetDocument = ({
  document,
  request,
  vectorScore = 0
}: {
  document: NormalizedAssetDocument;
  request: AssetSearchRequest;
  vectorScore?: number;
}): {
  score: number;
  reasons: string[];
  recommendedUsage: string;
} => {
  const reasons: string[] = [];
  const preparedRequest = getPreparedRequest(request);
  const preparedDocument = getPreparedDocument(document);
  let score = vectorScore * 100 + scoreLexicalSeed(preparedRequest, preparedDocument);
  const queryTerms = new Set(tokenizeAssetText(preparedRequest.normalizedQuery));

  let exactTagHits = 0;
  preparedDocument.normalizedTags.forEach((tag) => {
    if (queryTerms.has(tag)) {
      exactTagHits += 1;
    }
  });
  if (exactTagHits > 0) {
    score += exactTagHits * 12;
    reasons.push(`tag overlap x${exactTagHits}`);
  }

  const contextHits = preparedDocument.normalizedContexts.filter((context) => {
    return preparedRequest.normalizedQuery.includes(context) || preparedRequest.normalizedContexts.has(context);
  }).length;
  if (contextHits > 0) {
    score += contextHits * 10;
    reasons.push(`context fit x${contextHits}`);
  }

  const antiContextHits = preparedDocument.normalizedAntiContexts.filter((context) => {
    return preparedRequest.normalizedQuery.includes(context) || preparedRequest.normalizedAntiContexts.has(context);
  }).length;
  if (antiContextHits > 0) {
    score -= antiContextHits * 18;
    reasons.push(`anti-context penalty x${antiContextHits}`);
  }

  const constraintHits = preparedDocument.normalizedConstraints.filter((constraint) => {
    return preparedRequest.normalizedQuery.includes(constraint) || preparedRequest.normalizedConstraints.has(constraint);
  }).length;
  if (constraintHits > 0) {
    score += constraintHits * 9;
    reasons.push(`constraint fit x${constraintHits}`);
  }

  const desiredTypeIndex = preparedRequest.desiredAssetTypeOrder.get(document.asset_type) ?? -1;
  if (desiredTypeIndex >= 0) {
    score += 18 + Math.max(0, 8 - desiredTypeIndex * 4);
    reasons.push("asset-type match");
  } else if (request.desiredAssetTypes && request.desiredAssetTypes.length > 0) {
    score -= 10;
  }

  if (request.requireAnimated) {
    score += document.extension_is_animated ? 20 : -18;
  }
  if (request.requireStatic) {
    score += !document.extension_is_animated ? 20 : -18;
  }

  const moodHits = preparedRequest.normalizedMood.filter((mood) => preparedDocument.normalizedMood.includes(mood)).length;
  if (moodHits > 0) {
    score += moodHits * 6;
    reasons.push(`mood fit x${moodHits}`);
  }

  const roleScore = scoreRoleCompatibility({
    roleIntent: preparedRequest.roleIntent,
    document,
    rolePool: preparedDocument.visualSignaturePool
  });
  score += roleScore.delta;
  reasons.push(...roleScore.reasons);

  if (preparedRequest.wantsCircularBoost) {
    if (/(ring|halo|circle|orbit|circular)/.test(preparedDocument.visualSignaturePool)) {
      score += 24;
      reasons.push("circular intent match");
    } else {
      score -= 8;
    }
  }
  if (preparedRequest.wantsReflectiveTone && /(blur|soft|reflective|cinematic|thoughtful|calm|subtle)/.test(preparedDocument.visualSignaturePool)) {
    score += 16;
    reasons.push("reflective tone fit");
  }
  if (preparedRequest.wantsReflectiveTone && queryNeedsAggressiveMotion(preparedDocument.visualSignaturePool)) {
    score -= 48;
    reasons.push("too aggressive for reflective request");
  }
  if (preparedRequest.wantsAggressiveMotion && queryNeedsAggressiveMotion(preparedDocument.visualSignaturePool)) {
    score += 16;
    reasons.push("kinetic intensity fit");
  }

  if (preparedRequest.normalizedPositionRole && preparedDocument.normalizedDominantVisualRole.includes(preparedRequest.normalizedPositionRole)) {
    score += 14;
    reasons.push("role compatibility");
  }

  score += resolveMotionTierPenalty(request.motionLevel as MotionTier | undefined, document.motion_intensity);
  score += document.confidence * 6;

  const recommendedUsage = document.contexts[0]
    ? `Best for ${document.contexts[0]} with ${document.dominant_visual_role}.`
    : `Use as ${document.dominant_visual_role} support for ${document.category}.`;

  return {
    score,
    reasons: uniqueStrings(reasons),
    recommendedUsage
  };
};

export const toAssetSearchResult = ({
  document,
  request,
  vectorScore = 0
}: {
  document: NormalizedAssetDocument;
  request: AssetSearchRequest;
  vectorScore?: number;
}): AssetSearchResult => {
  const reranked = rerankAssetDocument({
    document,
    request,
    vectorScore
  });

  return {
    asset_id: document.asset_id,
    score: reranked.score,
    vector_score: vectorScore,
    rerank_score: reranked.score,
    asset_type: document.asset_type,
    path: document.absolute_path,
    public_path: document.public_path,
    tags: document.tags,
    labels: document.labels,
    retrieval_caption: document.retrieval_caption,
    semantic_description: document.semantic_description,
    why_it_matched: reranked.reasons.join("; ") || "semantic similarity",
    recommended_usage: reranked.recommendedUsage,
    confidence: document.confidence
  };
};
