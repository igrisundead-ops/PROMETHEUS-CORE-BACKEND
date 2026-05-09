import type {CSSProperties} from "react";

import {
  buildLongformSemanticSidecallPresentation,
  hasLongformSemanticGraphicAsset,
  type LongformSemanticSidecallPresentation
} from "../longform-semantic-sidecall";
import {normalizeLongformWord} from "../longform-word-layout";
import {
  classifyTypographyContentEnergy,
  classifyTypographySpeechPacing,
  selectTypographyTreatment,
  type TypographySelection,
  type TypographyTextRole
} from "../typography-intelligence";
import {getEditorialFontPalette, type EditorialFontPaletteId} from "../cinematic-typography/editorial-fonts";
import {
  selectRuntimeFontSelection,
  type RuntimeFontSelection
} from "../cinematic-typography/runtime-font-selector";
import {selectActiveMotionBackgroundOverlayCueAtTime} from "./background-overlay-planner";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  GradeProfile,
  MotionCompositionCombatPlan,
  MotionBackgroundOverlayCue,
  MotionBackgroundOverlayPlan,
  MotionMoodTag,
  MotionTier,
  PresentationMode
} from "../types";

export type CaptionSurfaceTone = "light" | "dark" | "neutral";
export type CaptionEditorialMode = "normal" | "escalated" | "keyword-only";
export type CaptionKeywordAnimation = "fade" | "burst" | "letter-by-letter";
export type CaptionAssetBias = "minimal" | "semantic" | "structured";

export type CaptionEditorialContext = {
  chunk: CaptionChunk;
  captionProfileId?: CaptionStyleProfileId | null;
  gradeProfile?: GradeProfile | null;
  backgroundOverlayPlan?: MotionBackgroundOverlayPlan | null;
  currentTimeMs?: number;
  surfaceToneHint?: CaptionSurfaceTone | null;
  captionBias?: CaptionVerticalBias | null;
  presentationMode?: PresentationMode | null;
  motionTier?: MotionTier | null;
  forceMode?: CaptionEditorialMode | null;
  readabilityPressure?: number | null;
  compositionCombatPlan?: MotionCompositionCombatPlan | null;
};

export type CaptionEditorialDecision = {
  mode: CaptionEditorialMode;
  surfaceTone: CaptionSurfaceTone;
  textColor: string;
  textShadow: string;
  textStroke: string;
  fontFamily: string;
  fontWeight: number | string;
  fontSizeScale: number;
  uppercaseBias: boolean;
  letterSpacing: string;
  keywordPhrases: string[];
  keywordAnimation: CaptionKeywordAnimation;
  assetBias: CaptionAssetBias;
  backgroundScaleCap: number;
  rationale: string[];
  cssVariables: Record<string, string>;
  typography: TypographySelection;
  fontSelection: RuntimeFontSelection;
};

const DEFAULT_KEYWORD_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "but",
  "by",
  "for",
  "from",
  "give",
  "go",
  "got",
  "have",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "let",
  "lets",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "out",
  "that",
  "the",
  "their",
  "them",
  "this",
  "to",
  "too",
  "up",
  "we",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
  "you",
  "your"
]);

const SAFE_EDITORIAL_FONT_STACK = "\"Fraunces\", \"Times New Roman\", serif";
const warnedInvalidFontFamilies = new Set<string>();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isUsableFontStack = (value: string | null | undefined): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
    !normalized.includes("undefined") &&
    !normalized.includes("null") &&
    !normalized.includes("nan")
  );
};

const warnInvalidFontFamilyOnce = (warningKey: string, invalidValue: string | null | undefined): void => {
  if (warnedInvalidFontFamilies.has(warningKey)) {
    return;
  }

  warnedInvalidFontFamilies.add(warningKey);
  console.warn("[caption-editorial-engine] Invalid font family fallback applied.", {
    warningKey,
    invalidValue
  });
};

const parseRgbaAlpha = (value: string | undefined | null): number => {
  if (!value) {
    return 0;
  }

  const match = value.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)/i);
  if (!match) {
    return 0;
  }

  const alpha = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(alpha) ? clamp01(alpha) : 0;
};

const resolveBackgroundToneFromCue = (cue: MotionBackgroundOverlayCue | null | undefined): CaptionSurfaceTone => {
  if (!cue) {
    return "neutral";
  }

  const tags = new Set(cue.asset.themeTags ?? []);
  if (tags.has("authority") || tags.has("heroic")) {
    return "dark";
  }
  if (tags.has("calm") || tags.has("neutral")) {
    return "light";
  }
  if (tags.has("warm") && cue.asset.width >= cue.asset.height) {
    return "light";
  }
  return "neutral";
};

const resolveBackgroundToneFromGradeProfile = (gradeProfile: GradeProfile | null | undefined): CaptionSurfaceTone => {
  if (!gradeProfile) {
    return "neutral";
  }

  const shadowAlpha = parseRgbaAlpha(gradeProfile.shadowTint);
  const highlightAlpha = parseRgbaAlpha(gradeProfile.highlightTint);

  if (gradeProfile.brightness <= 0.985 || gradeProfile.contrast >= 1.12 || gradeProfile.vignette >= 0.24 || shadowAlpha >= 0.2) {
    return "dark";
  }

  if (gradeProfile.brightness >= 0.995 && (highlightAlpha >= 0.08 || gradeProfile.bloom >= 0.14)) {
    return "light";
  }

  return "neutral";
};

export const deriveCaptionSurfaceTone = ({
  gradeProfile,
  backgroundOverlayPlan,
  currentTimeMs,
  surfaceToneHint
}: {
  gradeProfile?: GradeProfile | null;
  backgroundOverlayPlan?: MotionBackgroundOverlayPlan | null;
  currentTimeMs?: number | null;
  surfaceToneHint?: CaptionSurfaceTone | null;
}): CaptionSurfaceTone => {
  if (surfaceToneHint) {
    return surfaceToneHint;
  }

  const activeCue = backgroundOverlayPlan && typeof currentTimeMs === "number"
    ? selectActiveMotionBackgroundOverlayCueAtTime({
      cues: backgroundOverlayPlan.cues,
      currentTimeMs
    })
    : null;

  const cueTone = resolveBackgroundToneFromCue(activeCue);
  if (cueTone !== "neutral") {
    return cueTone;
  }

  return resolveBackgroundToneFromGradeProfile(gradeProfile);
};

const normalizeKeyword = (value: string): string => {
  return normalizeLongformWord(value).trim();
};

const toDisplayKeyword = (value: string, uppercaseBias: boolean): string => {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  return uppercaseBias ? trimmed.toUpperCase() : trimmed;
};

const collectKeywordPhrases = (chunk: CaptionChunk): string[] => {
  const semanticPresentation: LongformSemanticSidecallPresentation = buildLongformSemanticSidecallPresentation({
    chunk
  });
  const candidatePhrases = [
    ...semanticPresentation.keywords,
    semanticPresentation.leadLabel,
    semanticPresentation.supportingLabel ?? ""
  ];

  const emphasisWords = chunk.emphasisWordIndices
    .map((index) => chunk.words[index]?.text ?? "")
    .filter(Boolean);

  const fallbackWords = chunk.words
    .map((word) => word.text)
    .filter((word) => {
      const normalized = normalizeKeyword(word);
      return normalized.length > 0 && !DEFAULT_KEYWORD_STOP_WORDS.has(normalized);
    });

  return dedupeDisplayValues([...candidatePhrases, ...emphasisWords, ...fallbackWords]);
};

const buildDecisionRationale = (entries: Array<string | null | undefined>): string[] => {
  return entries.filter((entry): entry is string => Boolean(entry));
};

const dedupeDisplayValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(trimmed);
  }

  return output;
};

const resolveTypographyRole = ({
  chunk,
  mode,
  emphasisCount,
  combinedKeywordPhrases,
  hasGraphicAsset
}: {
  chunk: CaptionChunk;
  mode: CaptionEditorialMode;
  emphasisCount: number;
  combinedKeywordPhrases: string[];
  hasGraphicAsset: boolean;
}): TypographyTextRole => {
  const text = chunk.text;

  if (/\b(ai|data|system|workflow|prompt|code|command|agent|model|render|dashboard)\b/i.test(text)) {
    return "tech-overlay";
  }

  if (chunk.semantic?.intent === "name-callout") {
    return "headline";
  }

  if (mode === "keyword-only") {
    if (chunk.words.length <= 2) {
      return "keyword";
    }
    if (/[!?]/.test(text) || emphasisCount >= 2) {
      return "hook";
    }
    return "headline";
  }

  if (mode === "escalated") {
    if (
      !hasGraphicAsset &&
      (
        combinedKeywordPhrases.length <= 2 ||
        chunk.words.length >= 6 ||
        chunk.endMs - chunk.startMs >= 2200
      )
    ) {
      return "quote";
    }
    return "headline";
  }

  return "subtitle";
};

const resolveTypographyEnergyScore = ({
  mode,
  emphasisCount,
  punctuationWeight,
  hasGraphicAsset,
  combatStrongHierarchy,
  combatNeedsEscalation,
  semanticKeywordCount
}: {
  mode: CaptionEditorialMode;
  emphasisCount: number;
  punctuationWeight: number;
  hasGraphicAsset: boolean;
  combatStrongHierarchy: boolean;
  combatNeedsEscalation: boolean;
  semanticKeywordCount: number;
}): number => {
  const score =
    0.22 +
    (mode === "keyword-only" ? 0.36 : mode === "escalated" ? 0.16 : 0) +
    Math.min(emphasisCount, 3) * 0.12 +
    punctuationWeight * 0.1 +
    (hasGraphicAsset ? 0.1 : 0) +
    (combatStrongHierarchy ? 0.14 : 0) +
    (combatNeedsEscalation ? 0.08 : 0) +
    Math.min(semanticKeywordCount, 3) * 0.06;

  return clamp01(score);
};

const resolveCaptionEditorialTypeface = ({
  mode,
  typography,
  uppercaseBias,
  fontSelection
}: {
  mode: CaptionEditorialMode;
  typography: TypographySelection;
  uppercaseBias: boolean;
  fontSelection: RuntimeFontSelection;
}): {
  fontFamily: string;
  fontWeight: number | string;
  letterSpacing: string;
} => {
  const paletteId: EditorialFontPaletteId = fontSelection.fontPaletteId;
  const palette = getEditorialFontPalette(paletteId);
  let fontWeight: number | string = 600;
  let letterSpacing = uppercaseBias ? "0.024em" : "-0.016em";

  switch (paletteId) {
    case "dm-sans-core":
      fontWeight = mode === "keyword-only" ? 700 : 600;
      letterSpacing = uppercaseBias ? "0.028em" : "-0.012em";
      break;
    case "noto-display":
      fontWeight = 700;
      letterSpacing = uppercaseBias ? "0.038em" : "-0.022em";
      break;
    case "playfair-contrast":
      fontWeight = 700;
      letterSpacing = uppercaseBias ? "0.03em" : "-0.018em";
      break;
    case "instrument-nocturne":
      fontWeight = 400;
      letterSpacing = uppercaseBias ? "0.02em" : "-0.014em";
      break;
    case "crimson-voice":
    case "lora-documentary":
      fontWeight = 600;
      letterSpacing = uppercaseBias ? "0.018em" : "-0.012em";
      break;
    case "cormorant-salon":
      fontWeight = 600;
      letterSpacing = uppercaseBias ? "0.022em" : "-0.016em";
      break;
    case "fraunces-editorial":
    default:
      fontWeight =
        typography.role === "headline" ||
        typography.role === "hook" ||
        typography.role === "transition-card" ||
        typography.role === "cta" ||
        mode === "keyword-only"
          ? 650
          : 600;
      letterSpacing = uppercaseBias ? "0.022em" : "-0.016em";
      break;
  }

  const runtimeFontStack = palette.runtimeFontStack;
  if (isUsableFontStack(runtimeFontStack)) {
    return {
      fontFamily: runtimeFontStack,
      fontWeight,
      letterSpacing
    };
  }

  if (isUsableFontStack(palette.displayFamily)) {
    if (runtimeFontStack && runtimeFontStack !== palette.displayFamily) {
      warnInvalidFontFamilyOnce(`runtime:${palette.id}`, runtimeFontStack);
    }

    return {
      fontFamily: palette.displayFamily,
      fontWeight,
      letterSpacing
    };
  }

  warnInvalidFontFamilyOnce(`display:${palette.id}`, palette.displayFamily);

  return {
    fontFamily: SAFE_EDITORIAL_FONT_STACK,
    fontWeight,
    letterSpacing
  };
};

export const resolveCaptionEditorialDecision = (context: CaptionEditorialContext): CaptionEditorialDecision => {
  const surfaceTone = deriveCaptionSurfaceTone({
    gradeProfile: context.gradeProfile,
    backgroundOverlayPlan: context.backgroundOverlayPlan,
    currentTimeMs: context.currentTimeMs,
    surfaceToneHint: context.surfaceToneHint
  });

  const semanticPresentation = buildLongformSemanticSidecallPresentation({
    chunk: context.chunk
  });
  const keywordPhrases = collectKeywordPhrases(context.chunk);
  const combatPlan = context.compositionCombatPlan ?? null;
  const combatChunkPlan = combatPlan?.chunkPlans.find((plan) => plan.chunkId === context.chunk.id) ?? null;
  const combatKeywordPhrases = dedupeDisplayValues([
    combatChunkPlan?.primary?.label ?? "",
    ...(combatChunkPlan?.secondary.map((element) => element.label) ?? []),
    ...(combatChunkPlan?.supporters.map((element) => element.label) ?? []),
    ...(combatChunkPlan?.keywordPhrases ?? [])
  ]);
  const combinedKeywordPhrases = dedupeDisplayValues([
    ...combatKeywordPhrases,
    ...keywordPhrases
  ]);
  const emphasisCount = context.chunk.emphasisWordIndices?.length ?? 0;
  const hasGraphicAsset = hasLongformSemanticGraphicAsset(context.chunk);
  const punctuationWeight = /[!?]/.test(context.chunk.text) ? 1 : 0;
  const shortSignal = context.chunk.words.length <= 4 ? 1 : 0;
  const combatStrongHierarchy = Boolean(
    combatPlan &&
      combatPlan.validity.hasPrimary &&
      combatPlan.validity.hasSupport &&
      combatPlan.validity.hasUtility &&
      combatPlan.synergyScore >= 0.7 &&
      combatPlan.hierarchyScore >= 0.62
  );
  const combatNeedsEscalation = Boolean(
    combatPlan &&
      (combatPlan.validity.invalidReasons.length > 0 ||
        combatPlan.supportCoverageScore < 0.54 ||
        combatPlan.motionVarietyScore < 0.45 ||
        combatPlan.overExecutionScore < 0.48)
  );
  const highImpactSignal =
    context.chunk.semantic?.intent === "punch-emphasis" ||
    context.chunk.semantic?.intent === "name-callout" ||
    hasGraphicAsset ||
    emphasisCount >= 2 ||
    semanticPresentation.keywords.length >= 2 ||
    combatStrongHierarchy;
  const mediumImpactSignal =
    emphasisCount >= 1 ||
    shortSignal === 1 ||
    punctuationWeight === 1 ||
    combinedKeywordPhrases.length <= 2 ||
    combatNeedsEscalation;

  let mode: CaptionEditorialMode = "normal";
  if (context.forceMode) {
    mode = context.forceMode;
  } else if (highImpactSignal) {
    mode = "keyword-only";
  } else if (surfaceTone === "light" || mediumImpactSignal) {
    mode = "escalated";
  }

  const isLightSurface = surfaceTone === "light";
  const isDarkSurface = surfaceTone === "dark";
  const textColor = isLightSurface
    ? "rgba(18, 20, 24, 0.96)"
    : isDarkSurface
      ? "rgba(255, 255, 255, 0.98)"
      : "rgba(243, 247, 255, 0.96)";
  const textShadow = isLightSurface
    ? "0 2px 8px rgba(0,0,0,0.16), 0 0 14px rgba(255,255,255,0.16)"
    : "0 4px 14px rgba(0,0,0,0.56), 0 0 18px rgba(193,212,255,0.26)";
  const textStroke = isLightSurface
    ? "0.45px rgba(255,255,255,0.28)"
    : "0.6px rgba(255,255,255,0.42)";
  const fontSizeScale = mode === "keyword-only"
    ? 1.88
    : mode === "escalated"
      ? 1.18
      : isLightSurface
        ? 1.08
        : 1;
  const typographyRole = resolveTypographyRole({
    chunk: context.chunk,
    mode,
    emphasisCount,
    combinedKeywordPhrases,
    hasGraphicAsset
  });
  const typographyEnergy = classifyTypographyContentEnergy(resolveTypographyEnergyScore({
    mode,
    emphasisCount,
    punctuationWeight,
    hasGraphicAsset,
    combatStrongHierarchy,
    combatNeedsEscalation,
    semanticKeywordCount: semanticPresentation.keywords.length
  }));
  const typographySpeechPacing = classifyTypographySpeechPacing({
    durationMs: Math.max(1, context.chunk.endMs - context.chunk.startMs),
    wordCount: Math.max(1, context.chunk.words.length)
  });
  const typography = selectTypographyTreatment({
    text: context.chunk.text,
    role: typographyRole,
    contentEnergy: typographyEnergy,
    speechPacing: typographySpeechPacing,
    wordCount: context.chunk.words.length,
    emphasisWordCount: emphasisCount,
    semanticIntent: context.chunk.semantic?.intent ?? null,
    surfaceTone,
    presentationMode: context.presentationMode ?? null
  });
  const fontSelection = selectRuntimeFontSelection({
    typographyRole,
    contentEnergy: typographyEnergy,
    patternMood: typography.pattern.mood,
    targetMoods: typography.targetMoods,
    patternUnit: typography.pattern.unit,
    wordCount: context.chunk.words.length,
    emphasisCount,
    mode,
    surfaceTone,
    motionTier: context.motionTier ?? null,
    semanticIntent: context.chunk.semantic?.intent ?? null,
    presentationMode: context.presentationMode ?? null
  });
  const uppercaseBias = mode !== "normal" || isLightSurface || typography.styling.preferredCase === "uppercase";
  const typeface = resolveCaptionEditorialTypeface({
    mode,
    typography,
    uppercaseBias,
    fontSelection
  });
  const letterSpacing = typeface.letterSpacing;
  const fontFamily = typeface.fontFamily;
  const fontWeight = typeface.fontWeight;
  const keywordAnimation: CaptionKeywordAnimation = mode === "keyword-only" || typography.pattern.unit === "letter"
    ? "letter-by-letter"
    : typography.pattern.mood === "aggressive" ||
        typography.pattern.mood === "trailer" ||
        typography.pattern.mood === "dramatic" ||
        Boolean(typography.pattern.entry.blur) ||
        Boolean(typography.pattern.entry.clipPath) ||
        Boolean(typography.pattern.entry.x) ||
        Boolean(typography.pattern.entry.y)
      ? "burst"
      : "fade";
  const assetBias: CaptionAssetBias = mode === "normal" && typography.role !== "tech-overlay" ? "semantic" : "structured";
  const backgroundScaleCap = 1.02;
  const rationale = buildDecisionRationale([
    surfaceTone === "light" ? "surface-tone-light" : surfaceTone === "dark" ? "surface-tone-dark" : "surface-tone-neutral",
    highImpactSignal ? "high-impact-cue" : null,
    mediumImpactSignal ? "medium-impact-cue" : null,
    hasGraphicAsset ? "semantic-graphic-asset" : null,
    combatPlan ? `combat-synergy=${combatPlan.synergyScore.toFixed(2)}` : null,
    combatPlan ? `combat-hierarchy=${combatPlan.hierarchyScore.toFixed(2)}` : null,
    combatPlan ? `combat-support=${combatPlan.supportCoverageScore.toFixed(2)}` : null,
    combatChunkPlan?.primary ? `combat-primary=${combatChunkPlan.primary.label}` : null,
    combatStrongHierarchy ? "combat-strong-hierarchy" : null,
    combatNeedsEscalation ? "combat-needs-escalation" : null,
    `typography-role=${typography.role}`,
    `typography-pattern=${typography.pattern.id}`,
    `typography-unit=${typography.pattern.unit}`,
    `typography-mood=${typography.pattern.mood}`,
    ...fontSelection.rationale,
    typography.combo ? `typography-combo=${typography.combo.id}` : null
  ]);

  return {
    mode,
    surfaceTone,
    textColor,
    textShadow,
    textStroke,
    fontFamily,
    fontWeight,
    fontSizeScale,
    uppercaseBias,
    letterSpacing,
    keywordPhrases: combinedKeywordPhrases.map((value) => toDisplayKeyword(value, uppercaseBias)),
    keywordAnimation,
    assetBias,
    backgroundScaleCap,
    rationale,
    cssVariables: {
      "--caption-text-color": textColor,
      "--caption-text-shadow": textShadow,
      "--caption-text-stroke": textStroke,
      "--caption-font-family": fontFamily,
      "--caption-font-weight": String(fontWeight),
      "--caption-letter-spacing": letterSpacing,
      "--caption-font-scale": String(fontSizeScale),
      "--caption-typography-pattern": typography.pattern.id,
      "--caption-typography-role": typography.role,
      "--caption-typography-mood": typography.pattern.mood,
      "--caption-typography-case": typography.styling.preferredCase
    },
    typography,
    fontSelection
  };
};

export const resolveControlledBackgroundScale = (
  scale: number,
  maxScale: number = 1.02
): number => {
  const upperBound = Math.max(1, maxScale);
  return Math.max(1, Math.min(scale, upperBound));
};
