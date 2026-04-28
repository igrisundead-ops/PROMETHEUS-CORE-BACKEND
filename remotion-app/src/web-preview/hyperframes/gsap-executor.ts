import {useEffect} from "react";
import gsap from "gsap";

import type {DisplayTimelineLayer} from "../display-god/display-timeline";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const resolveEase = (value?: string): string => {
  if (!value) {
    return "power2.out";
  }

  if (value.includes("quadratic")) {
    return "power2.out";
  }
  if (value.includes("cubic")) {
    return "power3.out";
  }
  if (value.includes("sine")) {
    return "sine.out";
  }
  return "power2.out";
};

const resolveAnimationState = (layer: DisplayTimelineLayer, currentTimeMs: number): {
  opacity: number;
  scale: number;
  translateX: number;
  translateY: number;
  rotateDeg: number;
  blurPx: number;
} => {
  const durationMs = Math.max(1, layer.endMs - layer.startMs);
  const enterWindowMs = Math.min(500, Math.max(180, durationMs * 0.24));
  const exitWindowMs = Math.min(420, Math.max(140, durationMs * 0.18));
  const enterProgress = clamp01((currentTimeMs - layer.startMs) / enterWindowMs);
  const exitProgress = clamp01((layer.endMs - currentTimeMs) / exitWindowMs);
  const visibility = clamp01(Math.min(enterProgress, exitProgress));
  const baseScale = layer.transform?.scale ?? 1;

  return {
    opacity: (layer.opacity ?? 1) * visibility,
    scale: lerp(baseScale * 0.94, baseScale, visibility),
    translateX: layer.transform?.translateX ?? 0,
    translateY: (layer.transform?.translateY ?? 0) + lerp(22, 0, visibility),
    rotateDeg: layer.transform?.rotateDeg ?? 0,
    blurPx: lerp(8, 0, visibility)
  };
};

export const useHyperframesGsapExecutor = ({
  layers,
  currentTimeMs,
  layerElements
}: {
  layers: DisplayTimelineLayer[];
  currentTimeMs: number;
  layerElements: Record<string, HTMLDivElement | null>;
}): void => {
  useEffect(() => {
    layers.forEach((layer) => {
      const node = layerElements[layer.id];
      if (!node) {
        return;
      }

      const animationState = resolveAnimationState(layer, currentTimeMs);
      gsap.to(node, {
        opacity: animationState.opacity,
        x: animationState.translateX,
        y: animationState.translateY,
        scale: animationState.scale,
        rotate: animationState.rotateDeg,
        filter: `blur(${animationState.blurPx.toFixed(2)}px)`,
        duration: 0.12,
        overwrite: true,
        ease: resolveEase(layer.easing?.enter)
      });
    });
  }, [currentTimeMs, layerElements, layers]);
};
