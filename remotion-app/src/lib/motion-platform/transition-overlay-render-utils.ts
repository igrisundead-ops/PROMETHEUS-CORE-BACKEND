import type {CSSProperties} from "react";
import {staticFile} from "remotion";

import type {TransitionOverlayBlendMode, TransitionOverlayCue} from "../types";

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};

export const resolveTransitionOverlaySrc = (src: string): string => {
  if (/^(https?:)?\/\//.test(src)) {
    return src;
  }
  return staticFile(src);
};

export const resolveTransitionOverlayBlendMode = (
  blendMode?: TransitionOverlayBlendMode
): CSSProperties["mixBlendMode"] => {
  if (!blendMode || blendMode === "normal") {
    return "normal";
  }

  return blendMode;
};

export const getTransitionOverlayVisibility = ({
  cue,
  currentTimeMs
}: {
  cue: TransitionOverlayCue;
  currentTimeMs: number;
}): number => {
  const enter = easeOutCubic((currentTimeMs - cue.startMs) / Math.max(1, cue.peakStartMs - cue.startMs));
  const exit = easeInOutCubic((currentTimeMs - cue.peakEndMs) / Math.max(1, cue.endMs - cue.peakEndMs));
  return clamp01(enter * (1 - exit));
};
