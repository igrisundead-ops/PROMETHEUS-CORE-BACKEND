import type {MotionTier, TransitionPreset} from "../types";

const transition = (preset: TransitionPreset): TransitionPreset => preset;

export const transitionPresets: TransitionPreset[] = [
  transition({
    id: "minimal-soft-fade",
    family: "fade",
    tier: "minimal",
    durationFrames: 10,
    easing: "ease-out",
    entryRules: {
      videoScaleFrom: 1.015,
      videoScaleTo: 1,
      overlayOpacityFrom: 0,
      overlayOpacityTo: 0.42,
      translateXFrom: 0,
      translateXTo: 0,
      translateYFrom: 18,
      translateYTo: 0,
      clipMode: "none"
    },
    exitRules: {
      videoScaleFrom: 1,
      videoScaleTo: 1.01,
      overlayOpacityFrom: 0.42,
      overlayOpacityTo: 0,
      translateXFrom: 0,
      translateXTo: 0,
      translateYFrom: 0,
      translateYTo: -12,
      clipMode: "none"
    },
    captionCompatibility: {
      protectSafeZone: true,
      safeZoneOpacityCap: 0.16,
      allowForegroundCross: false
    }
  }),
  transition({
    id: "minimal-edge-wipe",
    family: "wipe",
    tier: "minimal",
    durationFrames: 12,
    easing: "ease-in-out",
    entryRules: {
      videoScaleFrom: 1.02,
      videoScaleTo: 1,
      overlayOpacityFrom: 0,
      overlayOpacityTo: 0.46,
      translateXFrom: -20,
      translateXTo: 0,
      translateYFrom: 0,
      translateYTo: 0,
      clipMode: "left-to-right"
    },
    exitRules: {
      videoScaleFrom: 1,
      videoScaleTo: 1.012,
      overlayOpacityFrom: 0.46,
      overlayOpacityTo: 0,
      translateXFrom: 0,
      translateXTo: 18,
      translateYFrom: 0,
      translateYTo: 0,
      clipMode: "left-to-right"
    },
    captionCompatibility: {
      protectSafeZone: true,
      safeZoneOpacityCap: 0.12,
      allowForegroundCross: false
    }
  }),
  transition({
    id: "editorial-panel-reveal",
    family: "panel",
    tier: "editorial",
    durationFrames: 14,
    easing: "ease-in-out",
    entryRules: {
      videoScaleFrom: 1.03,
      videoScaleTo: 1,
      overlayOpacityFrom: 0,
      overlayOpacityTo: 0.52,
      translateXFrom: -28,
      translateXTo: 0,
      translateYFrom: 0,
      translateYTo: 0,
      clipMode: "left-to-right"
    },
    exitRules: {
      videoScaleFrom: 1,
      videoScaleTo: 1.016,
      overlayOpacityFrom: 0.52,
      overlayOpacityTo: 0,
      translateXFrom: 0,
      translateXTo: 22,
      translateYFrom: 0,
      translateYTo: -8,
      clipMode: "left-to-right"
    },
    captionCompatibility: {
      protectSafeZone: true,
      safeZoneOpacityCap: 0.1,
      allowForegroundCross: false
    }
  }),
  transition({
    id: "editorial-grid-cut",
    family: "grid",
    tier: "editorial",
    durationFrames: 12,
    easing: "ease-out",
    entryRules: {
      videoScaleFrom: 1.028,
      videoScaleTo: 1,
      overlayOpacityFrom: 0,
      overlayOpacityTo: 0.48,
      translateXFrom: 0,
      translateXTo: 0,
      translateYFrom: 20,
      translateYTo: 0,
      clipMode: "center-out"
    },
    exitRules: {
      videoScaleFrom: 1,
      videoScaleTo: 1.014,
      overlayOpacityFrom: 0.48,
      overlayOpacityTo: 0,
      translateXFrom: 0,
      translateXTo: 0,
      translateYFrom: 0,
      translateYTo: -16,
      clipMode: "center-out"
    },
    captionCompatibility: {
      protectSafeZone: true,
      safeZoneOpacityCap: 0.08,
      allowForegroundCross: false
    }
  }),
  transition({
    id: "premium-layered-sweep",
    family: "layered-sweep",
    tier: "premium",
    durationFrames: 18,
    easing: "ease-out",
    entryRules: {
      videoScaleFrom: 1.04,
      videoScaleTo: 1,
      overlayOpacityFrom: 0,
      overlayOpacityTo: 0.62,
      translateXFrom: -34,
      translateXTo: 0,
      translateYFrom: 14,
      translateYTo: 0,
      clipMode: "left-to-right"
    },
    exitRules: {
      videoScaleFrom: 1,
      videoScaleTo: 1.02,
      overlayOpacityFrom: 0.62,
      overlayOpacityTo: 0,
      translateXFrom: 0,
      translateXTo: 28,
      translateYFrom: 0,
      translateYTo: -16,
      clipMode: "bottom-up"
    },
    captionCompatibility: {
      protectSafeZone: true,
      safeZoneOpacityCap: 0.06,
      allowForegroundCross: false
    }
  }),
  transition({
    id: "premium-parallax-mask",
    family: "wipe",
    tier: "premium",
    durationFrames: 16,
    easing: "back-out",
    entryRules: {
      videoScaleFrom: 1.05,
      videoScaleTo: 1,
      overlayOpacityFrom: 0,
      overlayOpacityTo: 0.58,
      translateXFrom: 24,
      translateXTo: 0,
      translateYFrom: 0,
      translateYTo: 0,
      clipMode: "top-down"
    },
    exitRules: {
      videoScaleFrom: 1,
      videoScaleTo: 1.025,
      overlayOpacityFrom: 0.58,
      overlayOpacityTo: 0,
      translateXFrom: 0,
      translateXTo: -24,
      translateYFrom: 0,
      translateYTo: -20,
      clipMode: "top-down"
    },
    captionCompatibility: {
      protectSafeZone: true,
      safeZoneOpacityCap: 0.05,
      allowForegroundCross: false
    }
  }),
  transition({
    id: "hero-subject-wipe",
    family: "foreground-cross",
    tier: "hero",
    durationFrames: 20,
    easing: "back-out",
    entryRules: {
      videoScaleFrom: 1.06,
      videoScaleTo: 1,
      overlayOpacityFrom: 0,
      overlayOpacityTo: 0.72,
      translateXFrom: -30,
      translateXTo: 0,
      translateYFrom: 18,
      translateYTo: 0,
      clipMode: "center-out"
    },
    exitRules: {
      videoScaleFrom: 1,
      videoScaleTo: 1.03,
      overlayOpacityFrom: 0.72,
      overlayOpacityTo: 0,
      translateXFrom: 0,
      translateXTo: 26,
      translateYFrom: 0,
      translateYTo: -24,
      clipMode: "bottom-up"
    },
    captionCompatibility: {
      protectSafeZone: true,
      safeZoneOpacityCap: 0.04,
      allowForegroundCross: true
    }
  })
];

export const resolveTransitionPreset = (presetId: string): TransitionPreset => {
  return transitionPresets.find((preset) => preset.id === presetId) ?? transitionPresets[0];
};

const tierOrder: MotionTier[] = ["minimal", "editorial", "premium", "hero"];

export const getTransitionPresetsForTier = (tier: MotionTier): TransitionPreset[] => {
  const allowedIndex = tierOrder.indexOf(tier);
  return transitionPresets.filter((preset) => tierOrder.indexOf(preset.tier) <= allowedIndex);
};

export const getDefaultTransitionPresetIdForTier = (tier: MotionTier): string => {
  if (tier === "minimal") {
    return "minimal-edge-wipe";
  }
  if (tier === "editorial") {
    return "editorial-panel-reveal";
  }
  if (tier === "premium") {
    return "premium-layered-sweep";
  }
  return "hero-subject-wipe";
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const pickTransitionPresetId = ({
  tier,
  seed,
  preferredPresetId
}: {
  tier: MotionTier;
  seed: string;
  preferredPresetId?: string;
}): string => {
  if (preferredPresetId && preferredPresetId !== "auto") {
    return resolveTransitionPreset(preferredPresetId).id;
  }

  const pool = getTransitionPresetsForTier(tier);
  if (pool.length === 0) {
    return getDefaultTransitionPresetIdForTier(tier);
  }
  const preferredPool = pool.filter((preset) => preset.family !== "fade");
  const selectionPool = preferredPool.length > 0 ? preferredPool : pool;
  return selectionPool[hashString(seed) % selectionPool.length]?.id ?? getDefaultTransitionPresetIdForTier(tier);
};
