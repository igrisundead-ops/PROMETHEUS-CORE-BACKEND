import {getLongformCaptionSizing} from "../lib/longform-caption-scale";
import type {CaptionEditorialDecision} from "../lib/motion-platform/caption-editorial-engine";
import type {CaptionChunk, CaptionVerticalBias} from "../lib/types";

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
};

export const PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT = 72;
export const PREVIEW_SUBTITLE_FONT_SCALE = 0.94;
export const PREVIEW_SUBTITLE_LINE_GAP_EM = 0.16;
export const PREVIEW_SUBTITLE_WORD_GAP_EM = 0.18;
export const PREVIEW_SUBTITLE_GLOW_GAIN = 1.48;
export const PREVIEW_SUBTITLE_ANIMATION_GAIN = 1.22;
export const PREVIEW_SUBTITLE_BACKDROP_BLUR_PX = 18;

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
  editorialDecision
}: {
  width: number;
  height: number;
  maxLineUnits?: number;
  lineCount?: number;
  previewViewportScale: number;
  captionBias?: CaptionVerticalBias;
  editorialDecision?: CaptionEditorialDecision;
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
  const widthPercent = Number((100 - sideInsetPercent * 2).toFixed(2));
  const maxWidthPercent = Math.round(
    clamp(
      Math.min(PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT, sizing.maxWidthPercent - 6),
      64,
      PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT
    )
  );
  const bottomBiasOffset = captionBias === "top"
    ? 2.2
    : captionBias === "middle"
      ? 1.1
      : 0;
  const fontScale = PREVIEW_SUBTITLE_FONT_SCALE *
    (1 - densityPressure * 0.06 - linePressure * 0.08) *
    (editorialDecision?.fontSizeScale ?? 1);

  return {
    leftPercent: sideInsetPercent,
    widthPercent,
    bottomPercent: Number((PREVIEW_SUBTITLE_BOTTOM_SAFE_PERCENT + bottomBiasOffset).toFixed(2)),
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
    backdropBlurPx: Math.round(PREVIEW_SUBTITLE_BACKDROP_BLUR_PX + densityPressure * 4)
  };
};
