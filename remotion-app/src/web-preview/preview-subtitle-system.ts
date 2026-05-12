import {getLongformCaptionSizing, type LongformCaptionSizing} from "../lib/longform-caption-scale";
import type {CaptionEditorialDecision} from "../lib/motion-platform/caption-editorial-engine";
import type {CaptionChunk, CaptionVerticalBias} from "../lib/types";
import type {PlacementPlan} from "../lib/visual-field-engine";

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export type PreviewSubtitleAnimationMode =
  | "phrase_block_reveal"
  | "phrase_stagger_reveal"
  | "word_emphasis_reveal";

export type PreviewSubtitleSafeZone = {
  leftPercent: number;
  widthPercent: number;
  bottomPercent: number;
  maxWidthPercent: number;
  fontSizePx: number;
  lineHeight: number;
  lineGapEm: number;
  wordGapEm: number;
  minHeightEm: number;
  padInlineEm: number;
  padBlockEm: number;
  backdropInsetXEm: number;
  backdropInsetTopEm: number;
  backdropInsetBottomEm: number;
  backdropRadiusEm: number;
  backdropBlurPx: number;
  justifyContent: "center" | "flex-start" | "flex-end";
  physics: {
    opacity: number;
    blurPx: number;
    scaleMultiplier: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
    isSilenced: boolean;
    impactDelayFrames: number;
    tensionCurve: number;
  };
};

export const PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT = 65;
export const PREVIEW_SUBTITLE_FONT_SCALE = 0.92;
export const PREVIEW_SUBTITLE_LINE_GAP_EM = 0.14;
export const PREVIEW_SUBTITLE_WORD_GAP_EM = 0.16;
export const PREVIEW_SUBTITLE_GLOW_GAIN = 0.72;
export const PREVIEW_SUBTITLE_ANIMATION_GAIN = 1.08;
export const PREVIEW_SUBTITLE_BACKDROP_BLUR_PX = 12;

const PREVIEW_SUBTITLE_SIDE_INSET_PERCENT = 9;
const PREVIEW_SUBTITLE_BOTTOM_SAFE_PERCENT = 8.6;
const PREVIEW_SUBTITLE_MIN_HEIGHT_EM = 2.72;

const getValidEmphasisIndices = (chunk: CaptionChunk): number[] => {
  return [...new Set(
    chunk.emphasisWordIndices.filter((index) => index >= 0 && index < chunk.words.length)
  )];
};

const getConnectedSpeechRatio = (chunk: CaptionChunk): number => {
  if (chunk.words.length <= 1) {
    return 0;
  }

  let connectedPairCount = 0;
  for (let index = 1; index < chunk.words.length; index += 1) {
    const previousWord = chunk.words[index - 1];
    const word = chunk.words[index];
    if (word.startMs - previousWord.endMs <= 110) {
      connectedPairCount += 1;
    }
  }

  return connectedPairCount / Math.max(1, chunk.words.length - 1);
};

export const resolvePreviewSubtitleAnimationMode = ({
  chunk,
  editorialDecision
}: {
  chunk: CaptionChunk;
  editorialDecision?: CaptionEditorialDecision;
}): PreviewSubtitleAnimationMode => {
  const durationSeconds = Math.max(0.35, (chunk.endMs - chunk.startMs) / 1000);
  const wordCount = chunk.words.length;
  const wordsPerSecond = wordCount / durationSeconds;
  const emphasisIndices = getValidEmphasisIndices(chunk);
  const connectedSpeechRatio = getConnectedSpeechRatio(chunk);
  const pattern = editorialDecision?.typography.pattern;
  const shouldFavorPhraseStagger = wordCount >= 6 ||
    wordsPerSecond >= 2.55 ||
    connectedSpeechRatio >= 0.58 ||
    pattern?.unit === "phrase" ||
    pattern?.unit === "line";

  if (shouldFavorPhraseStagger) {
    return "phrase_stagger_reveal";
  }

  const shouldUseWordEmphasis = emphasisIndices.length > 0 &&
    emphasisIndices.length <= 2 &&
    wordCount <= 5 &&
    wordsPerSecond <= 2.9 &&
    (editorialDecision?.mode === "keyword-only" ||
      pattern?.mood === "aggressive" ||
      pattern?.mood === "dramatic" ||
      emphasisIndices.length === 1);

  if (shouldUseWordEmphasis) {
    return "word_emphasis_reveal";
  }

  return "phrase_block_reveal";
};

export const resolvePreviewSubtitleSafeZone = ({
  width,
  height,
  maxLineUnits,
  lineCount,
  previewViewportScale,
  captionBias,
  editorialDecision,
  placementPlan
}: {
  width: number;
  height: number;
  maxLineUnits?: number;
  lineCount?: number;
  previewViewportScale: number;
  captionBias?: CaptionVerticalBias;
  editorialDecision?: CaptionEditorialDecision;
  placementPlan?: PlacementPlan;
}): PreviewSubtitleSafeZone => {
  const resolvedLineCount = Math.max(1, lineCount ?? 1);
  const sizing = getLongformCaptionSizing({
    width,
    height,
    maxLineUnits,
    lineCount: resolvedLineCount
  });
  const densityPressure = maxLineUnits && maxLineUnits > 0
    ? clamp((maxLineUnits - 22) / 16, 0, 1)
    : 0;
  const linePressure = clamp((resolvedLineCount - 1) * 0.12, 0, 0.24);
  const sideInsetPercent = width >= 1600
    ? PREVIEW_SUBTITLE_SIDE_INSET_PERCENT + 1
    : PREVIEW_SUBTITLE_SIDE_INSET_PERCENT;
  const maxWidthPercent = Math.round(
    clamp(
      Math.min(PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT, sizing.maxWidthPercent - 6),
      64,
      PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT
    )
  );
  let bottomBiasOffset = captionBias === "top"
    ? 2.2
    : captionBias === "middle"
      ? 1.1
      : 0;
      
  const baseFontScale = PREVIEW_SUBTITLE_FONT_SCALE *
    (1 - densityPressure * 0.06 - linePressure * 0.08) *
    (editorialDecision?.fontSizeScale ?? 1);
    
  const fontScale = baseFontScale * (placementPlan?.breathingSpaceFactor ?? 1.0);

  let leftPercent = sideInsetPercent;
  let bottomPercent = PREVIEW_SUBTITLE_BOTTOM_SAFE_PERCENT + bottomBiasOffset;
  let justifyContent: "center" | "flex-start" | "flex-end" = "center";
  let widthPercent = Number((100 - sideInsetPercent * 2).toFixed(2));

  if (placementPlan) {
    if (placementPlan.strategy === "asymmetric-left") {
      leftPercent = placementPlan.coordinates.x * 100; // e.g., 20%
      widthPercent = Math.min(maxWidthPercent, 100 - leftPercent - sideInsetPercent);
      justifyContent = "flex-start";
    } else if (placementPlan.strategy === "asymmetric-right") {
      const rightPercent = (1 - placementPlan.coordinates.x) * 100;
      leftPercent = 100 - rightPercent - maxWidthPercent;
      widthPercent = maxWidthPercent;
      justifyContent = "flex-end";
    } else if (placementPlan.strategy === "center") {
      leftPercent = sideInsetPercent;
      justifyContent = "center";
    } else if (placementPlan.strategy === "lower-third") {
      bottomPercent = (1 - placementPlan.coordinates.y) * 100;
      justifyContent = "center";
    } else if (placementPlan.strategy === "rule-of-thirds") {
       leftPercent = 33;
       widthPercent = maxWidthPercent;
       justifyContent = "flex-start";
    }
  } else {
    // Fallback if orchestration is missing
    const isShortPunchyHook = resolvedLineCount === 1 && (maxLineUnits ?? 0) <= 14;
    const placementStrategy = isShortPunchyHook ? "center" : (maxLineUnits ?? 0) > 18 ? "asymmetric-left" : "rule-of-thirds";

    leftPercent = placementStrategy === "asymmetric-left" ? 12 : placementStrategy === "rule-of-thirds" ? 18 : sideInsetPercent;
    widthPercent = placementStrategy === "center" ? Number((100 - sideInsetPercent * 2).toFixed(2)) : Number((100 - leftPercent - sideInsetPercent).toFixed(2));
    justifyContent = placementStrategy === "center" ? "center" : "flex-start";
  }

  // Apply optical alignment offsets directly to the bottom percent if centered
  if (placementPlan?.opticalAlignmentOffset.y) {
    bottomPercent += placementPlan.opticalAlignmentOffset.y * 100;
  }

  return {
    leftPercent: Number(leftPercent.toFixed(2)),
    widthPercent: Number(widthPercent.toFixed(2)),
    bottomPercent: Number(bottomPercent.toFixed(2)),
    maxWidthPercent,
    fontSizePx: Math.round(
      clamp(
        sizing.fontSizePx * fontScale * previewViewportScale,
        18,
        96
      )
    ),
    lineHeight: Number(clamp(1.04 + (resolvedLineCount > 1 ? 0.04 : 0) + densityPressure * 0.04, 1.04, 1.14).toFixed(3)),
    lineGapEm: Number((PREVIEW_SUBTITLE_LINE_GAP_EM + (resolvedLineCount > 1 ? 0.03 : 0)).toFixed(3)),
    wordGapEm: PREVIEW_SUBTITLE_WORD_GAP_EM,
    minHeightEm: Number((PREVIEW_SUBTITLE_MIN_HEIGHT_EM + Math.max(0, resolvedLineCount - 1) * 0.86).toFixed(3)),
    padInlineEm: Number((0.28 + densityPressure * 0.06).toFixed(3)),
    padBlockEm: Number((0.16 + Math.max(0, resolvedLineCount - 1) * 0.04).toFixed(3)),
    backdropInsetXEm: Number((0.92 + densityPressure * 0.12).toFixed(3)),
    backdropInsetTopEm: Number((0.42 + linePressure * 0.6).toFixed(3)),
    backdropInsetBottomEm: Number((0.62 + linePressure * 0.9).toFixed(3)),
    backdropRadiusEm: Number((0.92 + densityPressure * 0.12).toFixed(3)),
    backdropBlurPx: Math.round(PREVIEW_SUBTITLE_BACKDROP_BLUR_PX + densityPressure * 4),
    justifyContent,
    physics: {
      opacity: editorialDecision?.stylePhysics.attention.typographyDominance ?? 1.0,
      blurPx: editorialDecision?.stylePhysics.motion.blurRelease ?? 0,
      scaleMultiplier: (editorialDecision?.stylePhysics.motion.scaleInertia ?? 0.05) * 10.0,
      offsetX: editorialDecision?.stylePhysics.optical.offsetX ?? 0,
      offsetY: editorialDecision?.stylePhysics.optical.offsetY ?? 0,
      rotation: editorialDecision?.stylePhysics.optical.rotation ?? 0,
      isSilenced: editorialDecision?.stylePhysics.silence.isSilenced ?? false,
      impactDelayFrames: editorialDecision?.timelineRhythm.impactDelayFrames ?? 0,
      tensionCurve: editorialDecision?.timelineRhythm.tensionCurve ?? 0.5
    }
  };
};
