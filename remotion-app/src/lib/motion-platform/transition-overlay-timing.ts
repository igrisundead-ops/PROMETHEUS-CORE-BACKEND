import type {TransitionBoundaryAnalysis} from "./transition-brain";
import {buildDeterministicMediaTrimWindow} from "./media-trim";
import type {CaptionChunk} from "../types";
import type {
  TransitionOverlayAsset,
  TransitionOverlayBlendMode,
  TransitionOverlayFitStrategy,
  TransitionOverlayMode,
  TransitionOverlayTrimWindow,
} from "../types";
import type {TransitionOverlayRules} from "./transition-overlay-config";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const QUALITY_ROTATION_ADVANTAGE_THRESHOLD = 0.08;

export type TransitionOverlayTimingWindow = {
  startMs: number;
  peakStartMs: number;
  peakEndMs: number;
  endMs: number;
  trimBeforeFrames: number;
  trimAfterFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  cueDurationMs: number;
  peakOpacity: number;
  blendMode: TransitionOverlayBlendMode;
};

export type TransitionOverlayTimingBoundary = TransitionBoundaryAnalysis & {
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
};

const resolveSourceTrimWindow = (asset: TransitionOverlayAsset): TransitionOverlayTrimWindow => {
  if (asset.preferredTrimWindow) {
    return asset.preferredTrimWindow;
  }

  return {
    startSeconds: 0,
    endSeconds: Math.max(asset.durationSeconds, 0.25)
  };
};

const resolveFadeWindowMs = ({
  asset,
  rules
}: {
  asset: TransitionOverlayAsset;
  rules: TransitionOverlayRules;
}): {fadeInMs: number; fadeOutMs: number} => {
  const preference = asset.fadePreference ?? "balanced";

  if (preference === "soft") {
    return {
      fadeInMs: Math.round(rules.fadeInMs * 1.2),
      fadeOutMs: Math.round(rules.fadeOutMs * 1.15)
    };
  }
  if (preference === "snappy") {
    return {
      fadeInMs: Math.round(rules.fadeInMs * 0.8),
      fadeOutMs: Math.round(rules.fadeOutMs * 0.85)
    };
  }

  return {
    fadeInMs: rules.fadeInMs,
    fadeOutMs: rules.fadeOutMs
  };
};

const resolveOverlayOpacity = ({
  asset,
  mode,
  boundaryScore
}: {
  asset: TransitionOverlayAsset;
  mode: TransitionOverlayMode;
  boundaryScore: number;
}): number => {
  const baseOpacity = asset.opacity ?? (mode === "fast-intro" ? 0.96 : 0.92);
  const boost = boundaryScore >= 70 ? 0.04 : boundaryScore >= 55 ? 0.02 : 0;
  return clamp(baseOpacity + boost, 0.65, 1);
};

export const resolveTransitionOverlayFitStrategy = ({
  asset,
  targetWidth,
  targetHeight,
  overlayScale
}: {
  asset: TransitionOverlayAsset;
  targetWidth: number;
  targetHeight: number;
  overlayScale: number;
}): TransitionOverlayFitStrategy => {
  const sourceAspectRatio = asset.height > 0 ? asset.width / asset.height : 1;
  const targetAspectRatio = targetHeight > 0 ? targetWidth / targetHeight : 1;
  const unrotatedScale = asset.width > 0 && asset.height > 0 ? Math.max(targetWidth / asset.width, targetHeight / asset.height) : 1;
  const rotatedScale = asset.width > 0 && asset.height > 0 ? Math.max(targetWidth / asset.height, targetHeight / asset.width) : 1;
  const shouldRotate =
    targetWidth > targetHeight &&
    asset.height > asset.width &&
    rotatedScale + QUALITY_ROTATION_ADVANTAGE_THRESHOLD < unrotatedScale;

  return shouldRotate
    ? {
      rotateDeg: 90,
      coverScale: rotatedScale,
      overlayScale,
      orientedWidth: asset.height,
      orientedHeight: asset.width,
      sourceAspectRatio: Number(sourceAspectRatio.toFixed(3)),
      targetAspectRatio: Number(targetAspectRatio.toFixed(3)),
      rationale: "Rotated 90deg because the portrait source covers a landscape frame with less upscale pressure."
    }
    : {
      rotateDeg: 0,
      coverScale: unrotatedScale,
      overlayScale,
      orientedWidth: asset.width,
      orientedHeight: asset.height,
      sourceAspectRatio: Number(sourceAspectRatio.toFixed(3)),
      targetAspectRatio: Number(targetAspectRatio.toFixed(3)),
      rationale: "Kept upright because direct cover-fit is the cleanest route for this transition asset."
    };
};

export const resolveTransitionOverlayTiming = ({
  asset,
  boundary,
  mode,
  rules,
  seed,
  boundaryScore
}: {
  asset: TransitionOverlayAsset;
  boundary: TransitionOverlayTimingBoundary;
  mode: TransitionOverlayMode;
  rules: TransitionOverlayRules;
  seed: string;
  boundaryScore: number;
}): TransitionOverlayTimingWindow => {
  const {fadeInMs, fadeOutMs} = resolveFadeWindowMs({asset, rules});
  const preferredDurationMs = clamp(
    Math.round((asset.recommendedDurationSeconds ?? ((rules.preferredDurationMinMs + rules.preferredDurationMaxMs) / 2 / 1000)) * 1000),
    rules.preferredDurationMinMs,
    rules.maxDurationMs
  );
  const cueDurationMs = Math.max(rules.preferredDurationMinMs, Math.min(rules.maxDurationMs, preferredDurationMs));
  const startMs = Math.max(0, boundary.previousChunk.endMs - rules.transitionLeadMs);
  const endMs = startMs + cueDurationMs;
  const peakStartMs = Math.max(startMs + fadeInMs, boundary.previousChunk.endMs);
  let peakEndMs = Math.min(endMs - fadeOutMs, boundary.nextChunk.startMs + rules.transitionTailMs);

  if (peakEndMs <= peakStartMs) {
    peakEndMs = Math.min(endMs - fadeOutMs, peakStartMs + Math.max(120, Math.round(cueDurationMs * 0.35)));
  }
  if (peakEndMs <= peakStartMs) {
    peakEndMs = Math.min(endMs - fadeOutMs, peakStartMs + 120);
  }

  const sourceTrimWindow = resolveSourceTrimWindow(asset);
  const totalFrames = Math.max(1, Math.floor(asset.durationSeconds * asset.fps));
  const sourceWindowStartFrames = clamp(Math.round(sourceTrimWindow.startSeconds * asset.fps), 0, totalFrames - 1);
  const sourceWindowEndFrames = clamp(Math.round(sourceTrimWindow.endSeconds * asset.fps), sourceWindowStartFrames + 1, totalFrames);
  const sourceWindowTotalFrames = Math.max(1, sourceWindowEndFrames - sourceWindowStartFrames);
  const desiredFrames = clamp(Math.round((endMs - startMs) / 1000 * asset.fps), 1, sourceWindowTotalFrames);
  const trimWindow = buildDeterministicMediaTrimWindow({
    totalFrames: sourceWindowTotalFrames,
    desiredFrames,
    seed
  });
  const trimBeforeFrames = sourceWindowStartFrames + trimWindow.trimBeforeFrames;
  const trimAfterFrames = sourceWindowStartFrames + trimWindow.trimAfterFrames;
  const fadeInFrames = Math.max(1, Math.round((fadeInMs / 1000) * asset.fps));
  const fadeOutFrames = Math.max(1, Math.round((fadeOutMs / 1000) * asset.fps));

  return {
    startMs,
    peakStartMs,
    peakEndMs,
    endMs,
    trimBeforeFrames,
    trimAfterFrames,
    fadeInFrames,
    fadeOutFrames,
    cueDurationMs,
    peakOpacity: resolveOverlayOpacity({asset, mode, boundaryScore}),
    blendMode: asset.blendMode ?? "screen"
  };
};
