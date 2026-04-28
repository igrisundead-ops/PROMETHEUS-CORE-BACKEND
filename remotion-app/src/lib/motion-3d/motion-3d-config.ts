import type {Motion3DMode} from "../types";

export type Motion3DConfig = {
  enabled: boolean;
  mode: Motion3DMode;
  camera: {
    fov: number;
    baseZ: number;
    maxPushZ: number;
    maxPullZ: number;
    maxPanX: number;
    maxPanY: number;
    maxOrbitDeg: number;
  };
  depth: {
    backgroundZ: number;
    midZ: number;
    foregroundZ: number;
    maxLayerCount: number;
  };
  timing: {
    introSec: number;
    holdSec: number;
    exitSec: number;
  };
  parallax: {
    background: number;
    mid: number;
    foreground: number;
  };
  opacity: {
    background: number;
    mid: number;
    foreground: number;
  };
};

export const MOTION_3D_DEFAULTS: Motion3DConfig = {
  enabled: false,
  mode: "off",
  camera: {
    fov: 36,
    baseZ: 1500,
    maxPushZ: 260,
    maxPullZ: 320,
    maxPanX: 120,
    maxPanY: 90,
    maxOrbitDeg: 3.2
  },
  depth: {
    backgroundZ: -420,
    midZ: 0,
    foregroundZ: 280,
    maxLayerCount: 6
  },
  timing: {
    introSec: 0.8,
    holdSec: 1.4,
    exitSec: 0.7
  },
  parallax: {
    background: 0.22,
    mid: 0.36,
    foreground: 0.52
  },
  opacity: {
    background: 0.6,
    mid: 0.82,
    foreground: 1
  }
};

export const resolveMotion3DConfig = (
  overrides?: Partial<Motion3DConfig>
): Motion3DConfig => {
  return {
    ...MOTION_3D_DEFAULTS,
    ...overrides,
    camera: {
      ...MOTION_3D_DEFAULTS.camera,
      ...overrides?.camera
    },
    depth: {
      ...MOTION_3D_DEFAULTS.depth,
      ...overrides?.depth
    },
    timing: {
      ...MOTION_3D_DEFAULTS.timing,
      ...overrides?.timing
    },
    parallax: {
      ...MOTION_3D_DEFAULTS.parallax,
      ...overrides?.parallax
    },
    opacity: {
      ...MOTION_3D_DEFAULTS.opacity,
      ...overrides?.opacity
    }
  };
};
