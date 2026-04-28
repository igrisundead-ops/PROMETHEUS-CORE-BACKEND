import {buildLongformSemanticSidecallPresentation} from "../longform-semantic-sidecall";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  GradeProfile,
  MotionAssetManifest,
  MotionBackgroundOverlayAsset,
  MotionCombatChunkPlan,
  MotionCombatElement,
  MotionCombatElementKind,
  MotionCombatMotionStyle,
  MotionCombatRange,
  MotionCombatRole,
  MotionCombatTierLabel,
  MotionCompositionCombatPlan,
  MotionBackgroundOverlayPlan,
  MotionShowcasePlan,
  MotionTier,
  TransitionOverlayAsset,
  TransitionOverlayPlan
} from "../types";
import {resolveCaptionEditorialDecision} from "./caption-editorial-engine";

type MotionCombatPlannerInput = {
  chunks: CaptionChunk[];
  tier: MotionTier;
  gradeProfile?: GradeProfile | null;
  captionProfileId?: CaptionStyleProfileId | null;
  backgroundOverlayPlan?: MotionBackgroundOverlayPlan | null;
  showcasePlan?: MotionShowcasePlan | null;
  transitionOverlayPlan?: TransitionOverlayPlan | null;
  motionAssets?: MotionAssetManifest[] | null;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const unique = <T,>(values: T[]): T[] => [...new Set(values)];
const uniqueById = <T extends {id: string}>(assets: T[]): T[] => {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const asset of assets) {
    if (seen.has(asset.id)) {
      continue;
    }
    seen.add(asset.id);
    output.push(asset);
  }

  return output;
};

const uniqueCombatElementsById = (elements: MotionCombatElement[]): MotionCombatElement[] => {
  const seen = new Set<string>();
  const output: MotionCombatElement[] = [];

  for (const element of elements) {
    if (seen.has(element.id)) {
      continue;
    }
    seen.add(element.id);
    output.push(element);
  }

  return output;
};

const COMBAT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "let",
  "lets",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "up",
  "we",
  "with",
  "you",
  "your"
]);

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const titleCase = (value: string): string => {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const collectFallbackKeywords = (chunk: CaptionChunk): string[] => {
  const source = `${chunk.text} ${chunk.words.map((word) => word.text).join(" ")}`;
  const tokens = normalizeText(source).split(" ").filter(Boolean);
  return unique(tokens.filter((token) => !COMBAT_STOP_WORDS.has(token) && token.length > 2))
    .slice(0, 4)
    .map(titleCase);
};

const scoreToTier = (score: number): MotionCombatTierLabel => {
  if (score >= 0.88) {
    return "S";
  }
  if (score >= 0.72) {
    return "A";
  }
  if (score >= 0.56) {
    return "B";
  }
  return "C";
};

const makeElement = ({
  id,
  label,
  kind,
  role,
  range,
  motionStyle,
  score,
  reason,
  chunkId,
  assetId,
  keywords,
  tags,
  emphasis = false
}: {
  id: string;
  label: string;
  kind: MotionCombatElementKind;
  role: MotionCombatRole;
  range: MotionCombatRange;
  motionStyle: MotionCombatMotionStyle;
  score: number;
  reason: string[];
  chunkId?: string;
  assetId?: string;
  keywords?: string[];
  tags?: string[];
  emphasis?: boolean;
}): MotionCombatElement => {
  return {
    id,
    label,
    kind,
    role,
    range,
    tier: scoreToTier(score),
    motionStyle,
    score: round(clamp01(score)),
    reason: unique(reason.filter(Boolean)),
    chunkId,
    assetId,
    keywords: keywords && keywords.length > 0 ? unique(keywords.filter(Boolean)) : undefined,
    tags: tags && tags.length > 0 ? unique(tags.filter(Boolean)) : undefined,
    emphasis
  };
};

const classifyAssetKind = (asset: MotionAssetManifest): MotionCombatElementKind => {
  if (asset.assetRole === "showcase" || asset.templateGraphicCategory) {
    return "asset";
  }
  if (asset.showMode === "background" || asset.placementZone === "background-depth") {
    return "background";
  }
  if (asset.showMode === "partial" || asset.showMode === "accent") {
    return "ui";
  }
  if (asset.family === "panel" || asset.family === "frame" || asset.family === "grid") {
    return "ui";
  }
  return "asset";
};

const classifyAssetRole = (asset: MotionAssetManifest): MotionCombatRole => {
  const tagPool = new Set(
    unique([
      ...(asset.semanticTags ?? []),
      ...(asset.functionalTags ?? []),
      ...(asset.graphTags ?? []),
      ...(asset.subjectTags ?? []),
      ...(asset.themeTags ?? [])
    ].map((value) => normalizeText(value)))
  );

  const hasPrimarySignal = [
    "headline",
    "title",
    "quote",
    "counter",
    "graph",
    "chart",
    "hero",
    "focus",
    "primary",
    "word-showcase",
    "text",
    "typography"
  ].some((signal) => tagPool.has(signal));
  const hasSupportSignal = [
    "underline",
    "circle",
    "highlight",
    "support",
    "connector",
    "accent",
    "badge",
    "chip",
    "callout",
    "frame",
    "panel"
  ].some((signal) => tagPool.has(signal));
  const hasUtilitySignal = [
    "background",
    "depth",
    "grid",
    "grain",
    "vignette",
    "mask",
    "wash",
    "blur"
  ].some((signal) => tagPool.has(signal));

  if (hasUtilitySignal || asset.showMode === "background" || asset.placementZone === "background-depth") {
    return "utility";
  }
  if (hasPrimarySignal && (asset.visualWeight ?? 0.5) >= 0.68) {
    return "primary-attacker";
  }
  if (hasSupportSignal || (asset.visualWeight ?? 0.5) < 0.56) {
    return "support";
  }
  return "secondary-attacker";
};

const classifyAssetRange = (asset: MotionAssetManifest, role: MotionCombatRole): MotionCombatRange => {
  if (role === "utility" || asset.showMode === "background" || asset.placementZone === "background-depth") {
    return "long-range";
  }
  if (asset.showMode === "partial" || asset.showMode === "accent" || asset.family === "grid") {
    return "long-range";
  }
  return "short-range";
};

const classifyAssetMotionStyle = (
  asset: MotionAssetManifest,
  role: MotionCombatRole,
  range: MotionCombatRange
): MotionCombatMotionStyle => {
  if (role === "utility") {
    return range === "long-range" ? "soft-drift" : "blur-reveal";
  }
  if (role === "support") {
    const supportTags = new Set([...(asset.semanticTags ?? []), ...(asset.functionalTags ?? [])].map((value) => normalizeText(value)));
    if (supportTags.has("underline") || supportTags.has("circle") || supportTags.has("highlight")) {
      return "underline-sweep";
    }
    return "support-glow";
  }
  if (role === "primary-attacker") {
    return asset.family === "foreground-element" ? "dolly-reveal" : "cinematic-scale-fade";
  }
  return asset.sourceHtml || asset.sourceFile ? "letter-by-letter" : "keyword-burst";
};

const buildAssetElement = (asset: MotionAssetManifest, sourceLabel: string): MotionCombatElement => {
  const role = classifyAssetRole(asset);
  const range = classifyAssetRange(asset, role);
  const motionStyle = classifyAssetMotionStyle(asset, role, range);
  const score = clamp01(
    (asset.visualWeight ?? 0.54) +
    (asset.assetRole === "showcase" ? 0.08 : 0) +
    (asset.templateGraphicCategory ? 0.12 : 0) +
    (asset.sourceHtml || asset.sourceFile ? 0.06 : 0) +
    (role === "primary-attacker" ? 0.1 : role === "secondary-attacker" ? 0.04 : role === "support" ? 0.02 : 0)
  );

  return makeElement({
    id: `asset:${asset.id}`,
    label: asset.canonicalLabel ?? asset.id.replace(/[-_]+/g, " "),
    kind: classifyAssetKind(asset),
    role,
    range,
    motionStyle,
    score,
    reason: [
      sourceLabel,
      asset.sourceHtml ? "structured-animation-reference" : null,
      asset.assetRole === "showcase" ? "showcase-asset" : null,
      asset.templateGraphicCategory ? `template:${asset.templateGraphicCategory}` : null,
      ...(asset.semanticTags ?? []),
      ...(asset.functionalTags ?? [])
    ].filter((entry): entry is string => Boolean(entry)),
    assetId: asset.id,
    tags: [
      ...(asset.semanticTags ?? []),
      ...(asset.functionalTags ?? []),
      ...(asset.graphTags ?? []),
      ...(asset.themeTags ?? []),
      ...(asset.subjectTags ?? [])
    ]
  });
};

const buildOverlayElement = (
  asset: MotionBackgroundOverlayAsset | TransitionOverlayAsset,
  sourceLabel: string
): MotionCombatElement => {
  const isTransitionOverlay = "styleTags" in asset;
  const tags = isTransitionOverlay
    ? asset.styleTags
    : asset.themeTags ?? [];
  const score = clamp01(
    0.42 +
    (isTransitionOverlay ? 0.12 : 0.1) +
    Math.min(0.16, (asset.durationSeconds ?? 0) / 12)
  );

  return makeElement({
    id: `overlay:${asset.id}`,
    label: asset.label,
    kind: isTransitionOverlay ? "overlay" : "background",
    role: "utility",
    range: "long-range",
    motionStyle: isTransitionOverlay ? "blur-reveal" : "soft-drift",
    score,
    reason: [
      sourceLabel,
      isTransitionOverlay ? "transition-overlay-asset" : "background-overlay-asset",
      ...tags
    ],
    assetId: asset.id,
    tags: tags.length > 0 ? tags : undefined
  });
};

const getPrimaryCaptionPhrase = (keywords: string[], fallback: string): string => {
  return keywords[0] ?? fallback;
};

const getSecondaryCaptionPhrase = (keywords: string[], fallbackWords: string[]): string | null => {
  return keywords[1] ?? fallbackWords[0] ?? null;
};

const getCaptionMotionStyle = (
  role: MotionCombatRole,
  decisionMode: "normal" | "escalated" | "keyword-only",
  emphasisCount: number
): MotionCombatMotionStyle => {
  if (role === "primary-attacker") {
    return decisionMode === "keyword-only" ? "keyword-burst" : "cinematic-scale-fade";
  }
  if (role === "secondary-attacker") {
    return decisionMode === "keyword-only" || emphasisCount > 0 ? "letter-by-letter" : "support-glow";
  }
  if (role === "support") {
    return emphasisCount > 0 ? "underline-sweep" : "support-glow";
  }
  return "soft-drift";
};

const buildChunkPlan = ({
  chunk,
  index,
  decisionMode,
  keywords,
  backgroundOverlayPlan
}: {
  chunk: CaptionChunk;
  index: number;
  decisionMode: "normal" | "escalated" | "keyword-only";
  keywords: string[];
  backgroundOverlayPlan?: MotionBackgroundOverlayPlan | null;
}): MotionCombatChunkPlan => {
  const presentation = buildLongformSemanticSidecallPresentation({chunk});
  const fallbackKeywords = keywords.length > 0 ? keywords : collectFallbackKeywords(chunk);
  const primaryPhrase = getPrimaryCaptionPhrase(fallbackKeywords, chunk.text || presentation.leadLabel);
  const secondaryPhrase = getSecondaryCaptionPhrase(fallbackKeywords, chunk.words.map((word) => titleCase(word.text)));
  const emphasisCount = chunk.emphasisWordIndices?.length ?? 0;
  const primaryScore = clamp01(
    0.7 +
    (decisionMode === "keyword-only" ? 0.18 : decisionMode === "escalated" ? 0.08 : 0) +
    (chunk.semantic?.intent === "punch-emphasis" ? 0.06 : 0) +
    (chunk.semantic?.intent === "name-callout" ? 0.04 : 0)
  );
  const secondaryScore = clamp01(0.52 + (decisionMode !== "normal" ? 0.16 : 0) + (emphasisCount > 0 ? 0.08 : 0));
  const supportScore = clamp01(0.46 + (emphasisCount > 0 ? 0.18 : 0) + (presentation.supportingLabel ? 0.08 : 0));
  const utilityScore = clamp01(0.42 + (backgroundOverlayPlan?.enabled ? 0.18 : 0.08));
  const longRangeScore = clamp01(0.5 + (backgroundOverlayPlan?.enabled ? 0.18 : 0.06));

  const primary = makeElement({
    id: `${chunk.id}:primary`,
    label: primaryPhrase,
    kind: "caption",
    role: "primary-attacker",
    range: "short-range",
    motionStyle: getCaptionMotionStyle("primary-attacker", decisionMode, emphasisCount),
    score: primaryScore,
    reason: [
      decisionMode === "keyword-only" ? "caption-filtration-keyword-only" : null,
      chunk.semantic?.intent === "punch-emphasis" ? "punch-emphasis" : null,
      chunk.semantic?.intent === "name-callout" ? "name-callout" : null,
      "primary-visual-anchor"
    ].filter((entry): entry is string => Boolean(entry)),
    chunkId: chunk.id,
    keywords: fallbackKeywords.slice(0, 2),
    emphasis: true
  });

  const secondary: MotionCombatElement[] = secondaryPhrase
    ? [
      makeElement({
        id: `${chunk.id}:secondary`,
        label: secondaryPhrase,
        kind: "caption",
        role: "secondary-attacker",
        range: "short-range",
        motionStyle: getCaptionMotionStyle("secondary-attacker", decisionMode, emphasisCount),
        score: secondaryScore,
        reason: [
          decisionMode === "keyword-only" ? "keyword-escaped-secondary" : null,
          presentation.supportingLabel ? "supporting-label" : null,
          "hierarchy-lift"
        ].filter((entry): entry is string => Boolean(entry)),
        chunkId: chunk.id,
        keywords: fallbackKeywords.slice(1, 3),
        emphasis: false
      })
    ]
    : [];

  const supporters: MotionCombatElement[] = [
    makeElement({
      id: `${chunk.id}:support`,
      label: presentation.supportingLabel ?? "Support cue",
      kind: "ui",
      role: "support",
      range: "short-range",
      motionStyle: getCaptionMotionStyle("support", decisionMode, emphasisCount),
      score: supportScore,
      reason: [
        emphasisCount > 0 ? "underline-support" : null,
        presentation.supportingLabel ? "supporting-label" : null,
        "hierarchy-support"
      ].filter((entry): entry is string => Boolean(entry)),
      chunkId: chunk.id,
      keywords: fallbackKeywords.slice(0, 1),
      emphasis: emphasisCount > 0
    })
  ];

  const utilities: MotionCombatElement[] = [
    makeElement({
      id: `${chunk.id}:utility`,
      label: backgroundOverlayPlan?.enabled ? "Background overlay bed" : "Contrast wash",
      kind: "utility",
      role: "utility",
      range: "long-range",
      motionStyle: "soft-drift",
      score: utilityScore,
      reason: [
        backgroundOverlayPlan?.enabled ? "background-overlay-support" : "contrast-stabilizer",
        "layout-utility"
      ],
      chunkId: chunk.id,
      emphasis: false
    })
  ];

  const longRange: MotionCombatElement[] = backgroundOverlayPlan?.cues.map((cue) =>
    makeElement({
      id: `background:${chunk.id}:${cue.id}`,
      label: cue.asset.label,
      kind: "background",
      role: "utility",
      range: "long-range",
      motionStyle: "soft-drift",
      score: clamp01(0.45 + cue.score * 0.004),
      reason: [
        "background-overlay-cue",
        cue.fitStrategy.rationale
      ],
      chunkId: chunk.id,
      assetId: cue.assetId,
      tags: cue.asset.themeTags ?? []
    })
  ) ?? [];

  const shortRange: MotionCombatElement[] = [primary, ...secondary, ...supporters];

  const chunkScore = round(
    primary.score * 0.4 +
    (secondary[0]?.score ?? 0) * 0.18 +
    supporters[0].score * 0.17 +
    utilities[0].score * 0.1 +
    (longRange.length > 0 ? 0.08 : 0.04)
  );

  return {
    chunkId: chunk.id,
    chunkText: chunk.text,
    primary,
    secondary,
    supporters,
    utilities,
    longRange,
    shortRange,
    keywordPhrases: fallbackKeywords,
    score: chunkScore,
    reasons: [
      `keywords=${fallbackKeywords.slice(0, 3).join(" | ") || "none"}`,
      `mode=${decisionMode}`,
      emphasisCount > 0 ? `emphasis=${emphasisCount}` : null,
      backgroundOverlayPlan?.enabled ? "background-overlay-enabled" : "background-overlay-muted"
    ].filter((entry): entry is string => Boolean(entry))
  };
};

const getSupportCoverageScore = (supporters: MotionCombatElement[], utilities: MotionCombatElement[]): number => {
  const supportSignal = supporters.length > 0 ? 0.52 : 0;
  const utilitySignal = utilities.length > 0 ? 0.3 : 0;
  const stackedSignal = Math.min(0.18, (supporters.length + utilities.length) * 0.06);
  return round(clamp01(supportSignal + utilitySignal + stackedSignal));
};

const getHierarchyScore = (primaryAttackers: MotionCombatElement[], secondaryAttackers: MotionCombatElement[]): number => {
  if (primaryAttackers.length === 0) {
    return 0;
  }
  const ordered = [...primaryAttackers].sort((left, right) => right.score - left.score);
  const primaryScore = ordered[0]?.score ?? 0;
  const secondaryScore = ordered[1]?.score ?? secondaryAttackers[0]?.score ?? 0;
  const gap = Math.max(0, primaryScore - secondaryScore);
  return round(clamp01(0.42 + primaryScore * 0.34 + gap * 0.34));
};

const getMotionVarietyScore = (elements: MotionCombatElement[]): number => {
  const uniqueStyles = new Set(elements.map((element) => element.motionStyle));
  const uniqueKinds = new Set(elements.map((element) => element.kind));
  return round(clamp01(0.28 + uniqueStyles.size * 0.12 + uniqueKinds.size * 0.07));
};

const getReadabilityScore = (chunkPlans: MotionCombatChunkPlan[], primaryAttackers: MotionCombatElement[], supporters: MotionCombatElement[]): number => {
  const keywordCount = chunkPlans.reduce((sum, plan) => sum + plan.keywordPhrases.length, 0);
  const hasKeywordFiltering = keywordCount > 0 ? 0.18 : 0;
  const hierarchySignal = primaryAttackers.length > 0 ? 0.36 : 0;
  const supportSignal = supporters.length > 0 ? 0.24 : 0;
  const brevitySignal = chunkPlans.length <= 4 ? 0.12 : 0.04;
  return round(clamp01(0.24 + hasKeywordFiltering + hierarchySignal + supportSignal + brevitySignal));
};

const getOverExecutionScore = (elements: MotionCombatElement[], chunkPlans: MotionCombatChunkPlan[]): number => {
  const roleDiversity = new Set(elements.map((element) => element.role)).size;
  const assetCount = elements.filter((element) => element.kind === "asset").length;
  const supportCount = elements.filter((element) => element.role === "support").length;
  const utilityCount = elements.filter((element) => element.role === "utility").length;
  const repetitionPenalty = Math.max(0, (elements.length - new Set(elements.map((element) => element.motionStyle)).size) * 0.035);
  const score = 0.24 +
    Math.min(0.24, elements.length * 0.04) +
    Math.min(0.14, assetCount * 0.035) +
    Math.min(0.18, supportCount * 0.05) +
    Math.min(0.1, utilityCount * 0.03) +
    Math.min(0.14, roleDiversity * 0.04) +
    Math.min(0.08, chunkPlans.length * 0.02) -
    repetitionPenalty;
  return round(clamp01(score));
};

export const buildMotionCompositionCombatPlan = ({
  chunks,
  tier,
  gradeProfile,
  captionProfileId,
  backgroundOverlayPlan,
  showcasePlan,
  transitionOverlayPlan,
  motionAssets
}: MotionCombatPlannerInput): MotionCompositionCombatPlan => {
  const combinedAssets = uniqueById([
    ...(motionAssets ?? []),
    ...(showcasePlan?.selectedAssets ?? []),
    ...(backgroundOverlayPlan?.selectedAssets ?? []),
    ...(transitionOverlayPlan?.selectedAssets ?? [])
  ].filter(Boolean));

  const chunkPlans = chunks.map((chunk, index) => {
    const decision = resolveCaptionEditorialDecision({
      chunk,
      captionProfileId,
      gradeProfile,
      backgroundOverlayPlan,
      currentTimeMs: Math.max(0, chunk.startMs),
      motionTier: tier
    });
    return buildChunkPlan({
      chunk,
      index,
      decisionMode: decision.mode,
      keywords: decision.keywordPhrases,
      backgroundOverlayPlan
    });
  });

  const chunkElements = chunkPlans.flatMap((plan) => [
    ...(plan.primary ? [plan.primary] : []),
    ...plan.secondary,
    ...plan.supporters,
    ...plan.utilities,
    ...plan.longRange,
    ...plan.shortRange
  ]);

  const assetElements = combinedAssets.map((asset) => {
    if ("family" in asset) {
      return buildAssetElement(
        asset,
        asset.sourceHtml ? "structured-animation-reference" : asset.sourceFile ? "structured-animation-file" : asset.virtualAsset ? "virtual-asset" : "motion-asset"
      );
    }

    return buildOverlayElement(
      asset,
      "overlay-asset"
    );
  });
  const utilityAnchor = makeElement({
    id: "utility:contrast-wash",
    label: "Contrast wash",
    kind: "utility",
    role: "utility",
    range: "long-range",
    motionStyle: "blur-reveal",
    score: 0.56,
    reason: ["default-utility-layer", "readability-stabilizer"],
    emphasis: false
  });
  const backgroundUtility = backgroundOverlayPlan?.enabled
    ? makeElement({
      id: "utility:background-overlay-bed",
      label: "Background overlay bed",
      kind: "background",
      role: "utility",
      range: "long-range",
      motionStyle: "soft-drift",
      score: 0.68,
      reason: ["background-overlay-layer", "ambient-depth"],
      emphasis: false
    })
    : null;

  const elements = uniqueCombatElementsById([
    ...chunkElements,
    ...assetElements,
    utilityAnchor,
    ...(backgroundUtility ? [backgroundUtility] : [])
  ]);

  const primaryAttackers = elements.filter((element) => element.role === "primary-attacker");
  const secondaryAttackers = elements.filter((element) => element.role === "secondary-attacker");
  const supporters = elements.filter((element) => element.role === "support");
  const utilities = elements.filter((element) => element.role === "utility");
  const longRangeElements = elements.filter((element) => element.range === "long-range");
  const shortRangeElements = elements.filter((element) => element.range === "short-range");

  const roleCounts: Record<MotionCombatRole, number> = {
    "primary-attacker": primaryAttackers.length,
    "secondary-attacker": secondaryAttackers.length,
    support: supporters.length,
    utility: utilities.length
  };

  const hasPrimary = primaryAttackers.length > 0;
  const hasSupport = supporters.length > 0;
  const hasUtility = utilities.length > 0;
  const hasLongRange = longRangeElements.length > 0;

  const primaryScore = primaryAttackers[0]?.score ?? 0;
  const secondaryScore = primaryAttackers[1]?.score ?? secondaryAttackers[0]?.score ?? 0;
  const primaryGap = Math.max(0, primaryScore - secondaryScore);
  const invalidReasons = [
    !hasPrimary ? "missing-primary-attacker" : null,
    !hasSupport ? "missing-supporter" : null,
    !hasUtility ? "missing-utility-layer" : null,
    primaryAttackers.length > 1 && primaryGap < 0.06 ? "primary-hierarchy-unclear" : null
  ].filter((entry): entry is string => Boolean(entry));

  const hierarchyScore = getHierarchyScore(primaryAttackers, secondaryAttackers);
  const supportCoverageScore = getSupportCoverageScore(supporters, utilities);
  const motionVarietyScore = getMotionVarietyScore(elements);
  const readabilityScore = getReadabilityScore(chunkPlans, primaryAttackers, supporters);
  const overExecutionScore = getOverExecutionScore(elements, chunkPlans);
  const synergyScore = round(clamp01(
    hierarchyScore * 0.28 +
    supportCoverageScore * 0.2 +
    motionVarietyScore * 0.18 +
    readabilityScore * 0.2 +
    overExecutionScore * 0.14
  ));

  const reasons = [
    `tier=${tier}`,
    `chunks=${chunks.length}`,
    `primary=${primaryAttackers.length}`,
    `secondary=${secondaryAttackers.length}`,
    `support=${supporters.length}`,
    `utility=${utilities.length}`,
    `synergy=${synergyScore.toFixed(2)}`,
    hasLongRange ? "long-range-battlefield-present" : null,
    backgroundOverlayPlan?.enabled ? "background-overlay-bias" : null,
    showcasePlan?.selectedAssets.length ? "structured-assets-selected" : null,
    transitionOverlayPlan?.cues.length ? "transition-overlay-support" : null
  ].filter((entry): entry is string => Boolean(entry));

  return {
    version: "1.0.0",
    tier,
    elements,
    chunkPlans,
    primaryAttackers,
    secondaryAttackers,
    supporters,
    utilities,
    longRangeElements,
    shortRangeElements,
    synergyScore,
    hierarchyScore,
    supportCoverageScore,
    motionVarietyScore,
    readabilityScore,
    overExecutionScore,
    roleCounts,
    validity: {
      hasPrimary,
      hasSupport,
      hasUtility,
      hasLongRange,
      invalidReasons
    },
    reasons: [
      ...reasons,
      ...chunkPlans.flatMap((plan) => plan.reasons)
    ]
  };
};
