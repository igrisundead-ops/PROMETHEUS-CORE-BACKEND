import {getDefaultLongformSemanticKeywords} from "../longform-semantic-sidecall";
import type {
  CaptionChunk,
  CinematicGovernorPolicy,
  GovernorDecision,
  GovernorReasonCode,
  MissingAssetCategoryRecord,
  MotionAssetManifest,
  MotionAssetSource,
  MotionMoodTag,
  MotionShowcasePlacementHint,
  MotionShowcaseCueSource,
  TemplateGraphicCategory
} from "../types";
import {normalizeShowcaseText} from "./showcase-asset-catalog";

export type SemanticSidecallGovernorCandidate = {
  conceptId: string;
  conceptLabel: string;
  category: string;
  sourceChunkText: string;
  matchedText: string;
  matchedStartMs: number;
  matchedEndMs: number;
  placementHint: MotionShowcasePlacementHint;
  confidence: number;
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
};

export const SEMANTIC_SIDECALL_CINEMATIC_GOVERNOR_ID = "semantic-sidecall-cinematic-governor-v1";

export const semanticSidecallCinematicGovernorPolicy: CinematicGovernorPolicy = {
  id: SEMANTIC_SIDECALL_CINEMATIC_GOVERNOR_ID,
  version: "1.0.0",
  tone: "restrained-luxe",
  directAssetMinScore: 82,
  templateMinScore: 76,
  textOnlyMinScore: 72,
  overTargetSelectionScore: 94,
  strongAssetScore: 46,
  usableAssetScore: 30,
  weakAssetCoverageScore: 22,
  templatePreferredAssetCeiling: 54,
  cooldownMs: 6200,
  screenPressureWordCount: 7,
  screenPressurePenalty: 10
};

const TITLE_KEYWORDS = getDefaultLongformSemanticKeywords();
const TEMPLATE_PREFERRED_CONCEPT_IDS = new Set([
  "growth-graph",
  "process-blueprint",
  "time-calendar"
]);
const NUMBER_WORDS = new Set([
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "hundred",
  "thousand",
  "million",
  "billion",
  "figure",
  "figures"
]);

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const normalizeToken = (value: string): string => normalizeShowcaseText(value);

const tokenize = (value: string): string[] => {
  const normalized = normalizeShowcaseText(value);
  if (!normalized) {
    return [];
  }

  return normalized.split(" ").filter(Boolean);
};

const hasNumberSignal = (values: string[]): boolean => {
  return values.some((value) => {
    if (/\d/.test(value)) {
      return true;
    }

    return tokenize(value).some((token) => NUMBER_WORDS.has(token));
  });
};

const hasTitleContextMatch = (candidate: SemanticSidecallGovernorCandidate): boolean => {
  const searchPool = unique([
    candidate.conceptId,
    candidate.conceptLabel,
    candidate.matchedText,
    ...candidate.supportWords,
    ...candidate.recommendedLabels
  ]);

  return searchPool.some((entry) => {
    const normalized = normalizeToken(entry);
    return normalized.length > 1 && TITLE_KEYWORDS.has(normalized);
  });
};

const resolveTemplateGraphicCategory = ({
  candidate,
  sourceChunk
}: {
  candidate: SemanticSidecallGovernorCandidate;
  sourceChunk: CaptionChunk | null;
}): TemplateGraphicCategory | null => {
  const sourceText = `${candidate.sourceChunkText} ${sourceChunk?.text ?? ""}`;
  const numericSignal = hasNumberSignal([candidate.matchedText, sourceText]);

  if (candidate.conceptId === "growth-graph") {
    return "graph-chart";
  }
  if (candidate.conceptId === "process-blueprint") {
    return "blueprint-workflow";
  }
  if (candidate.conceptId === "time-calendar") {
    return "timeline-calendar";
  }
  if (candidate.conceptId === "planning-track-expenses") {
    if (numericSignal) {
      return "number-counter-kpi";
    }
    if (/(system|process|workflow|track|budget|expense|expenses)/i.test(sourceText)) {
      return "blueprint-workflow";
    }
  }
  if (numericSignal && (candidate.category === "finance" || candidate.category === "growth" || candidate.category === "time")) {
    return "number-counter-kpi";
  }

  return null;
};

const resolveRequestedPack = ({
  category,
  templateGraphicCategory
}: {
  category: string;
  templateGraphicCategory: TemplateGraphicCategory | null;
}): string => {
  if (templateGraphicCategory !== null) {
    return "data-process-template-pack-v1";
  }
  if (["growth", "planning", "time"].includes(category)) {
    return "data-process-template-pack-v1";
  }
  if (["finance", "marketplace", "home", "creation", "expertise", "obstacle"].includes(category)) {
    return "semantic-showcase-cutouts-v2";
  }
  return "semantic-sidecall-coverage-v1";
};

const buildMissingAssetCategory = ({
  candidate,
  templateGraphicCategory
}: {
  candidate: SemanticSidecallGovernorCandidate;
  templateGraphicCategory: TemplateGraphicCategory | null;
}): MissingAssetCategoryRecord => {
  return {
    categoryId: candidate.conceptId,
    conceptId: candidate.conceptId,
    label: candidate.conceptLabel,
    aliases: unique([
      ...candidate.supportWords,
      ...candidate.recommendedLabels,
      ...candidate.assetSearchTerms,
      candidate.matchedText
    ]).slice(0, 12),
    examplePhrase: candidate.sourceChunkText || candidate.matchedText,
    requestedPack: resolveRequestedPack({
      category: candidate.category,
      templateGraphicCategory
    }),
    count: 1
  };
};

const buildMoodTagsForCueSource = (cueSource: MotionShowcaseCueSource): MotionMoodTag[] => {
  if (cueSource === "template-graphic") {
    return ["cool", "authority", "kinetic"];
  }
  if (cueSource === "typography-only") {
    return ["cool", "authority", "calm"];
  }
  return ["cool", "authority"];
};

export const buildSemanticSidecallGovernorCueAsset = ({
  candidate,
  decision
}: {
  candidate: SemanticSidecallGovernorCandidate;
  decision: GovernorDecision;
}): MotionAssetManifest => {
  const cueSource = decision.cueSource ?? "typography-only";
  const normalizedLabel = normalizeToken(candidate.conceptLabel) || normalizeToken(candidate.matchedText) || "keyword";
  const idPrefix = cueSource === "template-graphic" ? "governor-template" : "governor-text";

  return {
    id: `${idPrefix}-${candidate.conceptId}`,
    assetRole: "showcase",
    canonicalLabel: normalizedLabel.split(" ")[0] ?? normalizedLabel,
    showcasePlacementHint: candidate.placementHint,
    templateGraphicCategory: decision.templateGraphicCategory ?? null,
    virtualAsset: true,
    family: "foreground-element",
    tier: "premium",
    src: `governor://${cueSource}/${decision.templateGraphicCategory ?? candidate.conceptId}`,
    alphaMode: "straight",
    placementZone: "foreground-cross",
    durationPolicy: "scene-span",
    themeTags: buildMoodTagsForCueSource(cueSource),
    searchTerms: unique([
      candidate.conceptLabel,
      candidate.matchedText,
      ...candidate.supportWords,
      ...candidate.assetSearchTerms
    ]).map(normalizeToken).filter(Boolean),
    safeArea: "full-frame",
    loopable: false,
    blendMode: "screen",
    opacity: cueSource === "template-graphic" ? 0.96 : 0.94,
    source: "local",
    sourceId: `${SEMANTIC_SIDECALL_CINEMATIC_GOVERNOR_ID}:${candidate.conceptId}`
  };
};

const buildSuppressDecision = ({
  score,
  reasonCodes,
  templateGraphicCategory
}: {
  score: number;
  reasonCodes: GovernorReasonCode[];
  templateGraphicCategory: TemplateGraphicCategory | null;
}): GovernorDecision => {
  return {
    action: "suppress",
    cueSource: null,
    score,
    reasonCodes,
    templateGraphicCategory
  };
};

export const buildSemanticSidecallGovernorDecision = ({
  candidate,
  sourceChunk,
  canSelectAbstract,
  nearSelected,
  nearSameCategory,
  requestedAssetAlreadyUsed,
  selectedCount,
  maxCueCount,
  policy = semanticSidecallCinematicGovernorPolicy
}: {
  candidate: SemanticSidecallGovernorCandidate;
  sourceChunk: CaptionChunk | null;
  canSelectAbstract: boolean;
  nearSelected: boolean;
  nearSameCategory: boolean;
  requestedAssetAlreadyUsed: boolean;
  selectedCount: number;
  maxCueCount: number;
  policy?: CinematicGovernorPolicy;
}): {
  decision: GovernorDecision;
  missingAssetCategory: MissingAssetCategoryRecord | null;
} => {
  const reasonCodes: GovernorReasonCode[] = [];
  const templateGraphicCategory = resolveTemplateGraphicCategory({candidate, sourceChunk});
  const numericSignal = hasNumberSignal([candidate.matchedText, candidate.sourceChunkText, sourceChunk?.text ?? ""]);
  let score = candidate.confidence;

  if (hasTitleContextMatch(candidate)) {
    score += 14;
    reasonCodes.push("title-context-match");
  }
  if ((sourceChunk?.emphasisWordIndices.length ?? 0) > 0 || sourceChunk?.semantic?.intent === "punch-emphasis") {
    score += 10;
    reasonCodes.push("emphasis-boost");
  }
  if (candidate.matchedEndMs - candidate.matchedStartMs >= 260) {
    score += 8;
    reasonCodes.push("duration-strong");
  }
  if (numericSignal) {
    score += 10;
    reasonCodes.push("numeric-signal");
  }
  if (candidate.matchedAsset && candidate.matchedAssetScore >= policy.strongAssetScore) {
    score += 12;
    reasonCodes.push("asset-coverage-strong");
  } else if (candidate.matchedAssetScore < policy.weakAssetCoverageScore) {
    score -= 10;
    reasonCodes.push("asset-coverage-weak");
  }
  if (templateGraphicCategory !== null) {
    score += 10;
    reasonCodes.push("template-coverage-available");
  }
  if ((sourceChunk?.words.length ?? 0) >= policy.screenPressureWordCount) {
    score -= policy.screenPressurePenalty;
    reasonCodes.push("screen-pressure-high");
  }
  if (requestedAssetAlreadyUsed) {
    score -= 8;
    reasonCodes.push("repeated-asset");
  }

  if (nearSelected) {
    return {
      decision: buildSuppressDecision({
        score,
        reasonCodes: [...reasonCodes, "nearby-cue", "cooldown-active"],
        templateGraphicCategory
      }),
      missingAssetCategory: null
    };
  }
  if (nearSameCategory) {
    return {
      decision: buildSuppressDecision({
        score,
        reasonCodes: [...reasonCodes, "repeated-category", "cooldown-active"],
        templateGraphicCategory
      }),
      missingAssetCategory: null
    };
  }
  if (!canSelectAbstract) {
    return {
      decision: buildSuppressDecision({
        score,
        reasonCodes: [...reasonCodes, "abstract-held"],
        templateGraphicCategory
      }),
      missingAssetCategory: null
    };
  }
  if (selectedCount >= maxCueCount) {
    return {
      decision: buildSuppressDecision({
        score,
        reasonCodes: [...reasonCodes, "density-budget"],
        templateGraphicCategory
      }),
      missingAssetCategory: null
    };
  }

  const templatePreferred = templateGraphicCategory !== null && (
    TEMPLATE_PREFERRED_CONCEPT_IDS.has(candidate.conceptId) ||
    candidate.matchedAssetScore < policy.templatePreferredAssetCeiling
  );
  if (templatePreferred) {
    reasonCodes.push("template-preferred");
  }

  if (templateGraphicCategory !== null && templatePreferred && score >= policy.templateMinScore) {
    return {
      decision: {
        action: "template-graphic-cue",
        cueSource: "template-graphic",
        score,
        reasonCodes,
        templateGraphicCategory
      },
      missingAssetCategory: null
    };
  }

  if (candidate.matchedAsset && candidate.matchedAssetScore >= policy.strongAssetScore && score >= policy.directAssetMinScore) {
    if (!reasonCodes.includes("semantic-weight-strong")) {
      reasonCodes.push("semantic-weight-strong");
    }
    return {
      decision: {
        action: "asset-backed-cue",
        cueSource: "direct-asset",
        score,
        reasonCodes,
        templateGraphicCategory
      },
      missingAssetCategory: null
    };
  }

  if (templateGraphicCategory !== null && score >= policy.templateMinScore) {
    return {
      decision: {
        action: "template-graphic-cue",
        cueSource: "template-graphic",
        score,
        reasonCodes,
        templateGraphicCategory
      },
      missingAssetCategory: null
    };
  }

  if (
    candidate.matchedAsset &&
    candidate.matchedAssetScore >= policy.usableAssetScore &&
    score >= policy.directAssetMinScore + 4 &&
    !templatePreferred
  ) {
    return {
      decision: {
        action: "asset-backed-cue",
        cueSource: "direct-asset",
        score,
        reasonCodes,
        templateGraphicCategory
      },
      missingAssetCategory: null
    };
  }

  if (score >= policy.textOnlyMinScore) {
    const missingAssetCategory = candidate.matchedAssetScore < policy.weakAssetCoverageScore && templateGraphicCategory === null
      ? buildMissingAssetCategory({
        candidate,
        templateGraphicCategory
      })
      : null;
    return {
      decision: {
        action: "text-only-accent",
        cueSource: "typography-only",
        score,
        reasonCodes: [...reasonCodes, "typography-fallback"],
        templateGraphicCategory
      },
      missingAssetCategory
    };
  }

  return {
    decision: buildSuppressDecision({
      score,
      reasonCodes: [...reasonCodes, "semantic-weight-low"],
      templateGraphicCategory
    }),
    missingAssetCategory: candidate.matchedAssetScore < policy.weakAssetCoverageScore && templateGraphicCategory === null
      ? buildMissingAssetCategory({
        candidate,
        templateGraphicCategory
      })
      : null
  };
};

export const mergeMissingAssetRegistry = ({
  existingRecords,
  observedRecords,
  observedAt
}: {
  existingRecords: MissingAssetCategoryRecord[];
  observedRecords: MissingAssetCategoryRecord[];
  observedAt: string;
}): MissingAssetCategoryRecord[] => {
  const registry = new Map<string, MissingAssetCategoryRecord>();

  existingRecords.forEach((record) => {
    registry.set(record.categoryId, {...record});
  });

  observedRecords.forEach((record) => {
    const current = registry.get(record.categoryId);
    if (!current) {
      registry.set(record.categoryId, {
        ...record,
        lastSeenAt: observedAt
      });
      return;
    }

    registry.set(record.categoryId, {
      ...current,
      label: record.label,
      aliases: unique([...current.aliases, ...record.aliases]).slice(0, 16),
      examplePhrase: record.examplePhrase || current.examplePhrase,
      requestedPack: record.requestedPack,
      count: current.count + record.count,
      lastSeenAt: observedAt
    });
  });

  return [...registry.values()].sort((left, right) => {
    return right.count - left.count || left.categoryId.localeCompare(right.categoryId);
  });
};
