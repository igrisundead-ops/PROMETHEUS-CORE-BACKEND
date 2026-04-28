import type {CSSProperties} from "react";

import {resolveControlledBackgroundScale} from "./caption-editorial-engine";
import type {
  CaptionVerticalBias,
  MotionBackgroundOverlayCue,
  MotionMoodTag
} from "../types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;
const BACKGROUND_OVERLAY_GLOW_GAIN = 1.5;

const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

type BackgroundOverlayToneKey = "neutral" | "warm" | "cool" | "calm" | "authority";

type BackgroundOverlayToneProfile = {
  veilTop: string;
  veilBottom: string;
  haloCore: string;
  haloMid: string;
  haloEdge: string;
  glowBlendMode: CSSProperties["mixBlendMode"];
  mediaFilter: string;
  scaleStart: number;
  scaleEnd: number;
  motionEnergy: number;
  xBias: number;
  yBias: number;
  grainOpacity: number;
};

const BACKGROUND_TONE_PROFILES: Record<BackgroundOverlayToneKey, BackgroundOverlayToneProfile> = {
  neutral: {
    veilTop: "rgba(7, 10, 16, 0.02)",
    veilBottom: "rgba(7, 10, 16, 0.06)",
    haloCore: "rgba(153, 179, 255, 0.16)",
    haloMid: "rgba(120, 149, 231, 0.08)",
    haloEdge: "rgba(255, 255, 255, 0)",
    glowBlendMode: "screen",
    mediaFilter: "saturate(1.04) contrast(1.03) brightness(1.01)",
    scaleStart: 1.018,
    scaleEnd: 1.002,
    motionEnergy: 0.52,
    xBias: 0.003,
    yBias: -0.004,
    grainOpacity: 0.1
  },
  warm: {
    veilTop: "rgba(16, 9, 7, 0.025)",
    veilBottom: "rgba(8, 7, 12, 0.07)",
    haloCore: "rgba(255, 193, 111, 0.20)",
    haloMid: "rgba(255, 146, 78, 0.10)",
    haloEdge: "rgba(255, 255, 255, 0)",
    glowBlendMode: "screen",
    mediaFilter: "saturate(1.06) contrast(1.04) brightness(1.02)",
    scaleStart: 1.02,
    scaleEnd: 1.003,
    motionEnergy: 0.60,
    xBias: 0.010,
    yBias: 0.002,
    grainOpacity: 0.11
  },
  cool: {
    veilTop: "rgba(6, 11, 18, 0.02)",
    veilBottom: "rgba(6, 8, 14, 0.065)",
    haloCore: "rgba(119, 176, 255, 0.20)",
    haloMid: "rgba(79, 130, 255, 0.11)",
    haloEdge: "rgba(255, 255, 255, 0)",
    glowBlendMode: "screen",
    mediaFilter: "saturate(1.05) contrast(1.05) brightness(1.01)",
    scaleStart: 1.019,
    scaleEnd: 1.002,
    motionEnergy: 0.56,
    xBias: -0.008,
    yBias: -0.003,
    grainOpacity: 0.1
  },
  calm: {
    veilTop: "rgba(6, 9, 15, 0.015)",
    veilBottom: "rgba(6, 8, 14, 0.05)",
    haloCore: "rgba(165, 194, 224, 0.16)",
    haloMid: "rgba(117, 146, 181, 0.08)",
    haloEdge: "rgba(255, 255, 255, 0)",
    glowBlendMode: "soft-light",
    mediaFilter: "saturate(1.02) contrast(1.02) brightness(1.015)",
    scaleStart: 1.014,
    scaleEnd: 1.0,
    motionEnergy: 0.38,
    xBias: 0,
    yBias: 0.008,
    grainOpacity: 0.08
  },
  authority: {
    veilTop: "rgba(7, 10, 18, 0.03)",
    veilBottom: "rgba(7, 9, 16, 0.08)",
    haloCore: "rgba(244, 210, 129, 0.22)",
    haloMid: "rgba(122, 157, 255, 0.10)",
    haloEdge: "rgba(255, 255, 255, 0)",
    glowBlendMode: "screen",
    mediaFilter: "saturate(1.06) contrast(1.06) brightness(1.015)",
    scaleStart: 1.02,
    scaleEnd: 1.004,
    motionEnergy: 0.68,
    xBias: 0.002,
    yBias: -0.006,
    grainOpacity: 0.11
  }
};

const resolveToneKey = (themeTags: MotionMoodTag[] = []): BackgroundOverlayToneKey => {
  const tags = new Set(themeTags);
  if (tags.has("authority") || tags.has("heroic")) {
    return "authority";
  }
  if (tags.has("warm")) {
    return "warm";
  }
  if (tags.has("cool")) {
    return "cool";
  }
  if (tags.has("calm")) {
    return "calm";
  }
  return "neutral";
};

const resolveToneProfile = (themeTags: MotionMoodTag[] = []): BackgroundOverlayToneProfile => {
  const toneKey = resolveToneKey(themeTags);
  const base = BACKGROUND_TONE_PROFILES[toneKey];
  const tags = new Set(themeTags);
  const kineticBoost = tags.has("kinetic") ? 0.12 : 0;
  const heroicBoost = tags.has("heroic") ? 0.08 : 0;
  const calmDampening = tags.has("calm") ? -0.04 : 0;

  return {
    ...base,
    motionEnergy: Math.max(0.24, base.motionEnergy + kineticBoost + heroicBoost + calmDampening),
    scaleStart: base.scaleStart + (tags.has("kinetic") ? 0.006 : 0),
    scaleEnd: Math.max(1, base.scaleEnd - (tags.has("kinetic") ? 0.001 : 0)),
    xBias: base.xBias + (tags.has("warm") ? 0.004 : tags.has("cool") ? -0.004 : 0),
    yBias: base.yBias + (tags.has("authority") ? -0.003 : tags.has("calm") ? 0.004 : 0),
    grainOpacity: Math.min(0.16, base.grainOpacity + (tags.has("kinetic") ? 0.015 : 0))
  };
};

export type BackgroundOverlayRenderState = {
  visibility: number;
  mediaWidth: number;
  mediaHeight: number;
  mediaOffsetX: number;
  mediaOffsetY: number;
  haloWidth: number;
  haloHeight: number;
  haloOffsetX: number;
  haloOffsetY: number;
  veilOpacity: number;
  haloOpacity: number;
  grainOpacity: number;
  veilGradient: string;
  haloGradient: string;
  grainGradient: string;
  mediaFilter: string;
  glowBlendMode: CSSProperties["mixBlendMode"];
};

export const resolveBackgroundOverlayRenderState = ({
  cue,
  currentTimeMs,
  outputWidth,
  outputHeight,
  captionBias
}: {
  cue: MotionBackgroundOverlayCue;
  currentTimeMs: number;
  outputWidth: number;
  outputHeight: number;
  captionBias: CaptionVerticalBias;
}): BackgroundOverlayRenderState => {
  const tone = resolveToneProfile(cue.asset.themeTags);
  const enter = easeOutCubic((currentTimeMs - cue.startMs) / Math.max(1, cue.peakStartMs - cue.startMs));
  const exit = easeInOutCubic((currentTimeMs - cue.peakEndMs) / Math.max(1, cue.endMs - cue.peakEndMs));
  const visibility = clamp01(enter * (1 - exit));
  const cueProgress = clamp01((currentTimeMs - cue.startMs) / Math.max(1, cue.endMs - cue.startMs));
  const settleProgress = clamp01((currentTimeMs - cue.peakEndMs) / Math.max(1, cue.endMs - cue.peakEndMs));
  const cueSeed = hashString(`${cue.id}|${cue.assetId}`);
  const wavePhase = (cueSeed % 360) * (Math.PI / 180);
  const motionWave = Math.sin(cueProgress * Math.PI * (1.1 + tone.motionEnergy * 0.18) + wavePhase);
  const settleWave = Math.cos(cueProgress * Math.PI * 0.8 + wavePhase / 2);
  const captionBiasShiftX = captionBias === "top" ? outputWidth * 0.01 : captionBias === "bottom" ? outputWidth * -0.008 : 0;
  const captionBiasShiftY = captionBias === "top" ? outputHeight * 0.022 : captionBias === "bottom" ? outputHeight * -0.018 : 0;
  const mediaOffsetX = (cue.fitStrategy.focusOffsetX + tone.xBias) * outputWidth * 0.16 +
    motionWave * tone.motionEnergy * outputWidth * 0.022 +
    captionBiasShiftX;
  const mediaOffsetY = (cue.fitStrategy.focusOffsetY + tone.yBias) * outputHeight * 0.16 +
    settleWave * tone.motionEnergy * outputHeight * 0.018 +
    captionBiasShiftY;
  const driftScale = resolveControlledBackgroundScale(
    lerp(tone.scaleStart, tone.scaleEnd, visibility) *
      lerp(1, 1 + tone.motionEnergy * 0.004, settleProgress),
    1.02
  );
  const mediaWidth = cue.asset.width * cue.fitStrategy.baseScale * driftScale;
  const mediaHeight = cue.asset.height * cue.fitStrategy.baseScale * driftScale;
  const haloScale = 1.15 + tone.motionEnergy * 0.07;
  const haloWidth = mediaWidth * haloScale;
  const haloHeight = mediaHeight * haloScale;
  const haloOffsetX = mediaOffsetX * 0.78;
  const haloOffsetY = mediaOffsetY * 0.78;
  const veilOpacity = Math.min(0.102, (0.008 + visibility * (0.03 + tone.motionEnergy * 0.012)) * 1.18);
  const haloOpacity = Math.min(0.48, (0.10 + visibility * (0.14 + tone.motionEnergy * 0.03)) * BACKGROUND_OVERLAY_GLOW_GAIN);
  const grainOpacity = Math.min(0.08, tone.grainOpacity * 0.6 + visibility * 0.008);

  return {
    visibility,
    mediaWidth,
    mediaHeight,
    mediaOffsetX,
    mediaOffsetY,
    haloWidth,
    haloHeight,
    haloOffsetX,
    haloOffsetY,
    veilOpacity,
    haloOpacity,
    grainOpacity,
    veilGradient: `linear-gradient(180deg, ${tone.veilTop}, ${tone.veilBottom})`,
    haloGradient: `radial-gradient(circle at 50% 48%, ${tone.haloCore} 0%, ${tone.haloMid} 42%, ${tone.haloEdge} 76%)`,
    grainGradient: `repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, rgba(255,255,255,0) 1px 4px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, rgba(255,255,255,0) 1px 5px)`,
    mediaFilter: tone.mediaFilter,
    glowBlendMode: tone.glowBlendMode
  };
};
