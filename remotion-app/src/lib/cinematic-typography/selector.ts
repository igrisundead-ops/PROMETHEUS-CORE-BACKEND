import type {CaptionChunk, CaptionVerticalBias, MotionTier, TranscribedWord} from "../types";
import type {CaptionEditorialDecision} from "../motion-platform/caption-editorial-engine";

import {getEditorialFontPalette, type EditorialFontPalette} from "./editorial-fonts";
import {selectRuntimeFontSelection, type RuntimeFontSelection} from "./runtime-font-selector";
import {CINEMATIC_TREATMENTS, type CinematicCasePolicy, type CinematicSceneEnergy, type CinematicTreatment} from "./treatments";

export type CinematicWordPlan = {
  word: TranscribedWord;
  wordIndex: number;
  displayText: string;
  emphasis: boolean;
  italic: boolean;
  isName: boolean;
};

export type CinematicLinePlan = {
  key: string;
  role: "display" | "support";
  accent: boolean;
  words: CinematicWordPlan[];
};

export type CinematicContinuityPlan = {
  mode: "reset" | "echo" | "carry";
  warmth: number;
};

export type CinematicChunkMetrics = {
  wordCount: number;
  charCount: number;
  emphasisCount: number;
  emphasisRatio: number;
  durationMs: number;
  msPerWord: number;
  speechPacing: string;
  sceneEnergy: CinematicSceneEnergy;
  role: string;
  semanticIntent: string;
  patternMood: string;
  targetMoods: string[];
  surfaceTone: "light" | "dark" | "neutral";
  punctuationWeight: number;
};

export type CinematicCaptionPlan = {
  chunk: CaptionChunk;
  chunkIndex: number;
  editorialDecision: CaptionEditorialDecision;
  treatment: CinematicTreatment;
  fontSelection: RuntimeFontSelection;
  fontPalette: EditorialFontPalette;
  lines: CinematicLinePlan[];
  continuity: CinematicContinuityPlan;
  metrics: CinematicChunkMetrics;
  placementOffsetEm: number;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const countChars = (words: Pick<TranscribedWord, "text">[]): number => {
  return words.map((word) => word.text).join(" ").length;
};

const countCharsForIndices = (words: TranscribedWord[], indices: number[]): number => {
  return indices.map((index) => words[index]?.text ?? "").filter(Boolean).join(" ").length;
};

const toSceneEnergy = (value: string, motionTier: MotionTier | null | undefined): CinematicSceneEnergy => {
  if (value === "high" || motionTier === "hero") {
    return "high";
  }
  if (value === "low" && motionTier !== "premium") {
    return "low";
  }
  return "medium";
};

const isNameWordIndex = (wordIndex: number, chunk: CaptionChunk): boolean => {
  return (chunk.semantic?.nameSpans ?? []).some((span) => wordIndex >= span.startWord && wordIndex <= span.endWord);
};

const isLikelyAcronym = (value: string): boolean => {
  return /^[A-Z0-9]{2,5}$/.test(value);
};

const lowercaseWord = (value: string): string => {
  return /^[A-Z'’.-]+$/.test(value) && !isLikelyAcronym(value) ? value.toLowerCase() : value;
};

const capitalizeFirstAlpha = (value: string): string => {
  return value.replace(/[A-Za-z]/, (match) => match.toUpperCase());
};

const toCaseDisplay = ({
  text,
  wordIndex,
  casePolicy,
  isName
}: {
  text: string;
  wordIndex: number;
  casePolicy: CinematicCasePolicy;
  isName: boolean;
}): string => {
  if (isName || isLikelyAcronym(text)) {
    return text;
  }

  if (casePolicy === "uppercase") {
    return text.toUpperCase();
  }

  if (casePolicy === "title") {
    return capitalizeFirstAlpha(lowercaseWord(text));
  }

  const normalized = lowercaseWord(text);
  return wordIndex === 0 ? capitalizeFirstAlpha(normalized) : normalized;
};

const buildBalancedLayout = (words: TranscribedWord[], maxWidthCh: number): number[][] => {
  if (words.length <= 3) {
    return [words.map((_, index) => index)];
  }

  let bestSplit = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    const leftIndices = words.slice(0, splitIndex).map((_, index) => index);
    const rightIndices = words.slice(splitIndex).map((_, index) => index + splitIndex);
    const leftChars = countCharsForIndices(words, leftIndices);
    const rightChars = countCharsForIndices(words, rightIndices);
    const overflowPenalty =
      Math.max(0, leftChars - maxWidthCh) * 2 +
      Math.max(0, rightChars - maxWidthCh) * 2;
    const sizePenalty = Math.abs(leftIndices.length - rightIndices.length) * 1.8;
    const score = Math.abs(leftChars - rightChars) + overflowPenalty + sizePenalty;
    if (score < bestScore) {
      bestScore = score;
      bestSplit = splitIndex;
    }
  }

  return [
    words.slice(0, bestSplit).map((_, index) => index),
    words.slice(bestSplit).map((_, index) => index + bestSplit)
  ];
};

const buildStaggeredPairLayout = (words: TranscribedWord[]): number[][] => {
  const count = words.length;
  if (count <= 3) {
    return [words.map((_, index) => index)];
  }
  if (count === 4) {
    return [[0, 1], [2, 3]];
  }
  if (count === 5) {
    return [[0, 1], [2, 3, 4]];
  }
  if (count === 6) {
    return [[0, 1], [2, 3], [4, 5]];
  }
  if (count === 7) {
    return [[0, 1], [2, 3], [4, 5, 6]];
  }
  return [[0, 1, 2], [3, 4], [5, 6, 7]];
};

const buildFocusTailLayout = (words: TranscribedWord[], emphasisIndices: number[], maxWidthCh: number): number[][] => {
  if (words.length < 4) {
    return buildBalancedLayout(words, maxWidthCh);
  }

  const focusIndex = emphasisIndices[emphasisIndices.length - 1] ?? (words.length - 1);
  const isolatedCount = focusIndex >= words.length - 2 ? Math.min(2, words.length - 1) : 1;
  const splitIndex = clamp(words.length - isolatedCount, 1, words.length - 1);
  return [
    words.slice(0, splitIndex).map((_, index) => index),
    words.slice(splitIndex).map((_, index) => index + splitIndex)
  ];
};

const buildAccentTailLayout = (words: TranscribedWord[], emphasisIndices: number[], maxWidthCh: number): number[][] => {
  if (words.length < 3) {
    return [words.map((_, index) => index)];
  }

  const accentIndex = emphasisIndices[emphasisIndices.length - 1] ?? (words.length - 1);
  if (accentIndex >= words.length - 2) {
    const splitIndex = clamp(accentIndex, 1, words.length - 1);
    return [
      words.slice(0, splitIndex).map((_, index) => index),
      words.slice(splitIndex).map((_, index) => index + splitIndex)
    ];
  }

  return buildBalancedLayout(words, maxWidthCh);
};

const buildLayoutIndices = (
  chunk: CaptionChunk,
  treatment: CinematicTreatment
): number[][] => {
  const words = chunk.words;
  if (words.length <= 1) {
    return [words.map((_, index) => index)];
  }

  switch (treatment.lineBreakBehavior) {
    case "single-anchor":
      return countChars(words) <= treatment.compositionRules.maxWidthCh
        ? [words.map((_, index) => index)]
        : buildBalancedLayout(words, treatment.compositionRules.maxWidthCh);
    case "focus-tail":
      return buildFocusTailLayout(words, chunk.emphasisWordIndices, treatment.compositionRules.maxWidthCh);
    case "accent-tail":
      return buildAccentTailLayout(words, chunk.emphasisWordIndices, treatment.compositionRules.maxWidthCh);
    case "staggered-pair":
      return buildStaggeredPairLayout(words);
    case "balanced":
    default:
      return buildBalancedLayout(words, treatment.compositionRules.maxWidthCh);
  }
};

const toPlacementOffsetEm = (
  treatment: CinematicTreatment,
  captionBias: CaptionVerticalBias
): number => {
  const treatmentPlacement = treatment.compositionRules.placement;
  if (captionBias === "top") {
    return treatmentPlacement === "lower-middle" ? -0.15 : -0.34;
  }
  if (captionBias === "bottom") {
    return treatmentPlacement === "upper-middle" ? 0.15 : 0.34;
  }

  if (treatmentPlacement === "upper-middle") {
    return -0.28;
  }
  if (treatmentPlacement === "lower-middle") {
    return 0.28;
  }
  return 0;
};

const buildLinePlans = (
  chunk: CaptionChunk,
  treatment: CinematicTreatment
): CinematicLinePlan[] => {
  const layoutIndices = buildLayoutIndices(chunk, treatment);

  return layoutIndices.map((indices, lineIndex) => {
    const lineChars = countCharsForIndices(chunk.words, indices);
    const role: "display" | "support" =
      treatment.compositionRules.supportLeadIn &&
      treatment.emphasisRules.allowSupportLine &&
      lineIndex === 0 &&
      layoutIndices.length > 1 &&
      lineChars <= 10
        ? "support"
        : "display";

    const accent =
      lineIndex === layoutIndices.length - 1 &&
      layoutIndices.length > 1 &&
      indices.some((index) => chunk.emphasisWordIndices.includes(index));

    return {
      key: `${chunk.id}-line-${lineIndex}`,
      role,
      accent,
      words: indices.map((wordIndex) => {
        const word = chunk.words[wordIndex]!;
        const emphasis = chunk.emphasisWordIndices.includes(wordIndex);
        const isName = isNameWordIndex(wordIndex, chunk);
        return {
          word,
          wordIndex,
          displayText: toCaseDisplay({
            text: word.text,
            wordIndex,
            casePolicy: treatment.casePolicy,
            isName
          }),
          emphasis,
          italic: emphasis && treatment.emphasisRules.italicizeEmphasis && word.text.length > 2,
          isName
        };
      })
    };
  });
};

const getRecentCount = (values: string[], target: string, windowSize: number): number => {
  return values.slice(-windowSize).filter((value) => value === target).length;
};

const buildMetrics = (
  chunk: CaptionChunk,
  editorialDecision: CaptionEditorialDecision,
  motionTier: MotionTier | null | undefined
): CinematicChunkMetrics => {
  const durationMs = Math.max(1, chunk.endMs - chunk.startMs);
  const wordCount = Math.max(1, chunk.words.length);
  const punctuationWeight = /[!?]/.test(chunk.text) ? 1 : 0;

  return {
    wordCount,
    charCount: countChars(chunk.words),
    emphasisCount: chunk.emphasisWordIndices.length,
    emphasisRatio: chunk.emphasisWordIndices.length / wordCount,
    durationMs,
    msPerWord: durationMs / wordCount,
    speechPacing: editorialDecision.typography.speechPacing,
    sceneEnergy: toSceneEnergy(editorialDecision.typography.contentEnergy, motionTier),
    role: editorialDecision.typography.role,
    semanticIntent: chunk.semantic?.intent ?? "default",
    patternMood: editorialDecision.typography.pattern.mood,
    targetMoods: editorialDecision.typography.targetMoods,
    surfaceTone: editorialDecision.surfaceTone,
    punctuationWeight
  };
};

const pacingCompatibilityScore = (treatment: CinematicTreatment, speechPacing: string): number => {
  if (treatment.pacingProfile.includes(speechPacing)) {
    return 1.4;
  }
  if (speechPacing === "medium" && treatment.pacingProfile.includes("fast")) {
    return 0.4;
  }
  if (speechPacing === "medium" && treatment.pacingProfile.includes("slow")) {
    return 0.4;
  }
  return -0.35;
};

const clampRangeScore = (value: number, preferred: [number, number], softCap: number): number => {
  if (value >= preferred[0] && value <= preferred[1]) {
    return 1.6;
  }
  const distance = value < preferred[0] ? preferred[0] - value : value - preferred[1];
  return Math.max(-1.25, 1.2 - distance / Math.max(1, softCap));
};

const matchesCompatibility = (
  treatment: CinematicTreatment,
  metrics: CinematicChunkMetrics,
  captionBias: CaptionVerticalBias,
  motionTier: MotionTier | null | undefined
): boolean => {
  const constraints = treatment.captionLengthConstraints;
  if (metrics.wordCount < constraints.minWords || metrics.wordCount > constraints.maxWords) {
    return false;
  }
  if (metrics.charCount > constraints.maxChars) {
    return false;
  }
  if (!treatment.sceneCompatibilityHints.surfaceTones.includes(metrics.surfaceTone)) {
    return false;
  }
  if (!treatment.sceneCompatibilityHints.energy.includes(metrics.sceneEnergy)) {
    return false;
  }
  if (!treatment.sceneCompatibilityHints.captionBiases.includes(captionBias)) {
    return false;
  }
  if (motionTier && !treatment.sceneCompatibilityHints.motionTiers.includes(motionTier)) {
    return false;
  }
  return true;
};

const scoreTreatment = ({
  chunk,
  treatment,
  metrics,
  editorialDecision,
  captionBias,
  motionTier,
  previousPlan,
  recentTreatmentIds,
  recentVisualFamilies
}: {
  chunk: CaptionChunk;
  treatment: CinematicTreatment;
  metrics: CinematicChunkMetrics;
  editorialDecision: CaptionEditorialDecision;
  captionBias: CaptionVerticalBias;
  motionTier: MotionTier | null | undefined;
  previousPlan: CinematicCaptionPlan | null;
  recentTreatmentIds: string[];
  recentVisualFamilies: string[];
}): number => {
  if (!matchesCompatibility(treatment, metrics, captionBias, motionTier)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  score += clampRangeScore(metrics.wordCount, treatment.captionLengthConstraints.preferredWordRange, 3);
  score += clampRangeScore(metrics.charCount, treatment.captionLengthConstraints.preferredCharRange, 8);
  score += pacingCompatibilityScore(treatment, metrics.speechPacing);
  score += treatment.semanticTags.includes(metrics.role) ? 1.25 : 0;
  score += treatment.semanticTags.includes(metrics.semanticIntent) ? 1.3 : 0;
  score += treatment.semanticTags.includes("quote") && metrics.role.includes("quote") ? 0.9 : 0;
  score += treatment.moodTags.includes(metrics.patternMood) ? 1.1 : 0;
  score += metrics.targetMoods.filter((mood) => treatment.moodTags.includes(mood)).length * 0.55;
  score += treatment.sceneCompatibilityHints.semanticIntents.includes(metrics.semanticIntent) ? 0.7 : 0;
  score += treatment.fontProfile === "dm-sans-core" && metrics.speechPacing === "fast" ? 0.45 : 0;
  score += editorialDecision.fontSelection?.fontPaletteId === treatment.fontProfile ? 0.95 : 0;
  score += editorialDecision.fontSelection?.fontPaletteId === treatment.fallbackFontProfile ? 0.35 : 0;
  score += treatment.emphasisRules.italicizeEmphasis && metrics.emphasisCount > 0 ? 0.5 : 0;
  score += !treatment.emphasisRules.italicizeEmphasis && metrics.emphasisCount === 0 ? 0.25 : 0;
  score += treatment.lineBreakBehavior === "single-anchor" && metrics.wordCount <= 3 ? 0.65 : 0;
  score += treatment.lineBreakBehavior === "balanced" && metrics.wordCount >= 4 ? 0.4 : 0;
  score += treatment.lineBreakBehavior === "staggered-pair" && metrics.speechPacing === "fast" ? 0.55 : 0;
  score += metrics.surfaceTone === "light" && treatment.fontProfile === "dm-sans-core" ? 0.3 : 0;
  score += editorialDecision.fontSelection?.selectedRoleId === "hero_serif_alternate" && treatment.id === "noto-monument" ? 0.9 : 0;
  score += editorialDecision.fontSelection?.selectedRoleId === "editorial_serif_support" && treatment.id === "fraunces-pullquote" ? 0.75 : 0;
  score += editorialDecision.fontSelection?.selectedRoleId === "neutral_sans_core" && treatment.id === "precision-directive" ? 0.75 : 0;
  score += editorialDecision.mode === "keyword-only" && treatment.lineBreakBehavior !== "balanced" ? 0.45 : 0;
  score += editorialDecision.mode === "normal" && treatment.motionGrammar.unit !== "block" ? 0.25 : 0;
  score += metrics.punctuationWeight > 0 && treatment.id === "noto-monument" ? 0.45 : 0;

  const recentUses = getRecentCount(recentTreatmentIds, treatment.id, treatment.antiRepeatBudget.windowSize);
  const recentFamilyUses = getRecentCount(
    recentVisualFamilies,
    treatment.visualFamily,
    treatment.antiRepeatBudget.windowSize
  );

  if (recentUses >= treatment.antiRepeatBudget.maxUsesInWindow) {
    score -= 5;
  } else {
    score -= recentUses * 1.25;
  }

  if (recentFamilyUses >= treatment.antiRepeatBudget.maxUsesInWindow) {
    score -= 4;
  } else {
    score -= recentFamilyUses * 0.65;
  }

  const lastTreatmentId = recentTreatmentIds[recentTreatmentIds.length - 1];
  const lastVisualFamily = recentVisualFamilies[recentVisualFamilies.length - 1];
  if (lastTreatmentId === treatment.id) {
    score -= 2.6;
  }
  if (lastVisualFamily === treatment.visualFamily) {
    score -= 1.2;
  }

  if (previousPlan) {
    const gapMs = chunk.startMs - previousPlan.chunk.endMs;
    if (gapMs <= 360 && treatment.motionGrammar.continuity.preferredBridgeIds.includes(previousPlan.treatment.id)) {
      score += 0.9;
    }
    if (gapMs <= 360 && previousPlan.treatment.visualFamily === treatment.visualFamily) {
      score += treatment.motionGrammar.continuity.shortGapBoost;
      score -= 0.55;
    }
    if (gapMs <= 200 && previousPlan.treatment.motionGrammar.unit === treatment.motionGrammar.unit) {
      score += 0.2;
    }
  }

  const deterministicNudge = (hashString(`${chunk.id}|${treatment.id}`) % 1000) / 100000;
  return score + deterministicNudge;
};

const resolveContinuity = (
  current: CinematicTreatment,
  previousPlan: CinematicCaptionPlan | null,
  chunk: CaptionChunk
): CinematicContinuityPlan => {
  if (!previousPlan) {
    return {
      mode: "reset",
      warmth: 0
    };
  }

  const gapMs = Math.max(0, chunk.startMs - previousPlan.chunk.endMs);
  const baseWarmth = gapMs <= 200 ? 1 : gapMs <= 420 ? 0.68 : gapMs <= 800 ? 0.32 : 0;

  if (previousPlan.treatment.visualFamily === current.visualFamily && gapMs <= 420) {
    return {
      mode: "carry",
      warmth: clamp(baseWarmth * current.motionGrammar.continuity.sameFamilyDamping, 0, 1)
    };
  }

  if (current.motionGrammar.continuity.preferredBridgeIds.includes(previousPlan.treatment.id) && gapMs <= 560) {
    return {
      mode: "echo",
      warmth: clamp(baseWarmth + current.motionGrammar.continuity.shortGapBoost, 0, 1)
    };
  }

  if (gapMs <= 280) {
    return {
      mode: "echo",
      warmth: clamp(baseWarmth * 0.92, 0, 1)
    };
  }

  return {
    mode: "reset",
    warmth: clamp(baseWarmth * 0.4, 0, 1)
  };
};

export const buildCinematicCaptionPlans = ({
  chunks,
  editorialDecisions,
  captionBias,
  motionTier
}: {
  chunks: CaptionChunk[];
  editorialDecisions: CaptionEditorialDecision[];
  captionBias: CaptionVerticalBias;
  motionTier?: MotionTier | null;
}): CinematicCaptionPlan[] => {
  const recentTreatmentIds: string[] = [];
  const recentVisualFamilies: string[] = [];
  const plans: CinematicCaptionPlan[] = [];

  chunks.forEach((chunk, chunkIndex) => {
    const editorialDecision = editorialDecisions[chunkIndex];
    if (!editorialDecision) {
      return;
    }

    const previousPlan = plans[plans.length - 1] ?? null;
    const metrics = buildMetrics(chunk, editorialDecision, motionTier);

    const selectedTreatment =
      CINEMATIC_TREATMENTS
        .map((treatment) => ({
          treatment,
          score: scoreTreatment({
            chunk,
            treatment,
            metrics,
            editorialDecision,
            captionBias,
            motionTier,
            previousPlan,
            recentTreatmentIds,
            recentVisualFamilies
          })
        }))
        .sort((a, b) => b.score - a.score)[0]?.treatment ?? CINEMATIC_TREATMENTS[0];

    const fontSelection = editorialDecision.fontSelection ?? selectRuntimeFontSelection({
      typographyRole: editorialDecision.typography.role,
      contentEnergy: editorialDecision.typography.contentEnergy,
      patternMood: editorialDecision.typography.pattern.mood,
      targetMoods: editorialDecision.typography.targetMoods,
      patternUnit: editorialDecision.typography.pattern.unit,
      wordCount: chunk.words.length,
      emphasisCount: chunk.emphasisWordIndices.length,
      mode: editorialDecision.mode,
      surfaceTone: editorialDecision.surfaceTone,
      motionTier: motionTier ?? null,
      semanticIntent: chunk.semantic?.intent ?? null,
      treatmentFontProfileHint: selectedTreatment.fontProfile,
      treatmentFallbackFontProfileHint: selectedTreatment.fallbackFontProfile
    });
    const continuity = resolveContinuity(selectedTreatment, previousPlan, chunk);
    const plan: CinematicCaptionPlan = {
      chunk,
      chunkIndex,
      editorialDecision,
      treatment: selectedTreatment,
      fontSelection,
      fontPalette: getEditorialFontPalette(fontSelection.fontPaletteId),
      lines: buildLinePlans(chunk, selectedTreatment),
      continuity,
      metrics,
      placementOffsetEm: toPlacementOffsetEm(selectedTreatment, captionBias)
    };

    recentTreatmentIds.push(selectedTreatment.id);
    recentVisualFamilies.push(selectedTreatment.visualFamily);
    plans.push(plan);
  });

  return plans;
};
