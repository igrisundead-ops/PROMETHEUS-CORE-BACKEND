import type {CaptionVerticalBias} from "./types";

export type CaptionSafeZone = {
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
};

export const upperSafeZone: CaptionSafeZone = {
  topPercent: 24,
  leftPercent: 8,
  widthPercent: 84,
  heightPercent: 34
};

export const longformCaptionSafeZone: CaptionSafeZone = {
  topPercent: 46,
  leftPercent: 8,
  widthPercent: 84,
  heightPercent: 30
};

const captionBiasAdjustments: Record<CaptionVerticalBias, {topOffset: number; heightDelta: number}> = {
  top: {topOffset: -5, heightDelta: -3},
  middle: {topOffset: 0, heightDelta: 0},
  bottom: {topOffset: 6, heightDelta: -3}
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const getCaptionContainerStyle = (
  zone: CaptionSafeZone = upperSafeZone,
  bias: CaptionVerticalBias = "middle"
): Record<string, string> => {
  const adjustment = captionBiasAdjustments[bias];
  const heightPercent = clamp(zone.heightPercent + adjustment.heightDelta, 24, 40);
  const maxTopPercent = Math.max(0, 100 - heightPercent - 4);
  const topPercent = clamp(zone.topPercent + adjustment.topOffset, 4, maxTopPercent);

  return {
    top: `${topPercent}%`,
    left: `${zone.leftPercent}%`,
    width: `${zone.widthPercent}%`,
    height: `${heightPercent}%`
  };
};
