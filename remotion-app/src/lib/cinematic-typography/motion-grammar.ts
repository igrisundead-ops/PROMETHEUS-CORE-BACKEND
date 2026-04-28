import type {CSSProperties} from "react";
import {Easing, interpolate} from "remotion";

import type {CinematicMotionPhase, CinematicTreatment} from "./treatments";

export type CinematicRuntimeScope = "block" | "line" | "word";

export type CinematicMotionRuntimeInput = {
  frame: number;
  fps: number;
  startFrame: number;
  endFrame: number;
  treatment: CinematicTreatment;
  scope: CinematicRuntimeScope;
  lineIndex?: number;
  wordSequenceIndex?: number;
  isEmphasis?: boolean;
  isActive?: boolean;
  wordProgress?: number;
  continuityWarmth?: number;
};

type MotionAccumulator = {
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotateZ: number;
  rotateX: number;
  blur: number;
  clipPath?: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const msToFrames = (ms: number, fps: number): number => Math.max(1, Math.round((ms / 1000) * fps));

const easingMap = {
  standard: Easing.bezier(0.22, 1, 0.36, 1),
  soft: Easing.bezier(0.16, 1, 0.3, 1),
  crisp: Easing.bezier(0.23, 1, 0.32, 1),
  slow: Easing.bezier(0.19, 1, 0.22, 1)
} as const;

const createAccumulator = (): MotionAccumulator => ({
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotateZ: 0,
  rotateX: 0,
  blur: 0
});

const applyMaskedInset = ({
  amount,
  axis,
  direction
}: {
  amount: number;
  axis: "x" | "y";
  direction: "forward" | "backward" | "center";
}): string => {
  const inset = `${Math.round(amount * 100)}%`;
  if (axis === "y") {
    if (direction === "backward") {
      return `inset(0 0 ${inset} 0)`;
    }
    if (direction === "center") {
      const splitInset = `${Math.round(amount * 50)}%`;
      return `inset(${splitInset} 0 ${splitInset} 0)`;
    }
    return `inset(${inset} 0 0 0)`;
  }

  if (direction === "backward") {
    return `inset(0 0 0 ${inset})`;
  }
  if (direction === "center") {
    const splitInset = `${Math.round(amount * 50)}%`;
    return `inset(0 ${splitInset} 0 ${splitInset})`;
  }
  return `inset(0 ${inset} 0 0)`;
};

const applyPrimitive = ({
  accumulator,
  primitive,
  phase,
  progress,
  continuityWarmth,
  isEmphasis
}: {
  accumulator: MotionAccumulator;
  primitive: CinematicMotionPhase["primitives"][number];
  phase: "entry" | "exit";
  progress: number;
  continuityWarmth: number;
  isEmphasis: boolean;
}): MotionAccumulator => {
  if (primitive.emphasisOnly && !isEmphasis) {
    return accumulator;
  }

  const direction = primitive.direction ?? "forward";
  const axis = primitive.axis ?? "y";
  const amount = (phase === "entry" ? 1 - progress : progress) * primitive.intensity * (1 - continuityWarmth * 0.34);
  const sign = direction === "backward" ? -1 : 1;

  switch (primitive.id) {
    case "split-reveal":
      if (axis === "x") {
        accumulator.x += amount * 28 * sign;
      } else {
        accumulator.y += amount * 26 * sign;
      }
      accumulator.opacity *= 1 - amount * 0.24;
      break;
    case "blur-resolve":
      accumulator.blur += amount * 16;
      accumulator.opacity *= 1 - amount * 0.16;
      break;
    case "focus-isolation":
      accumulator.scale *= 1 + (isEmphasis ? amount * 0.08 : amount * 0.02);
      if (!isEmphasis) {
        accumulator.opacity *= 1 - amount * 0.12;
      }
      break;
    case "rotating-transition":
      accumulator.rotateZ += amount * 4.5 * sign;
      accumulator.rotateX += amount * 8;
      accumulator.y += amount * 8;
      break;
    case "masked-reveal":
      accumulator.clipPath = applyMaskedInset({
        amount,
        axis,
        direction
      });
      break;
    case "directional-wipe":
      accumulator.clipPath = applyMaskedInset({
        amount: amount * 0.82,
        axis,
        direction
      });
      if (axis === "x") {
        accumulator.x += amount * 14 * sign;
      } else {
        accumulator.y += amount * 12 * sign;
      }
      break;
    case "emphasis-pulse":
      if (isEmphasis) {
        accumulator.scale *= 1 + amount * 0.06;
      }
      break;
    default:
      break;
  }

  return accumulator;
};

const getPhaseProgress = ({
  frame,
  startFrame,
  endFrame,
  fps,
  phase,
  scope,
  lineIndex = 0,
  wordSequenceIndex = 0,
  treatment
}: {
  frame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  phase: "entry" | "exit";
  scope: CinematicRuntimeScope;
  lineIndex?: number;
  wordSequenceIndex?: number;
  treatment: CinematicTreatment;
}): number => {
  const phaseConfig = phase === "entry" ? treatment.motionGrammar.entry : treatment.motionGrammar.exit;
  const durationFrames = msToFrames(phaseConfig.durationMs, fps);
  const lineStaggerFrames = msToFrames(phaseConfig.lineStaggerMs, fps);
  const wordStaggerFrames = msToFrames(phaseConfig.wordStaggerMs, fps);
  const easing = easingMap[phaseConfig.easing];

  let offsetFrames = 0;
  if (treatment.motionGrammar.unit === "line" && scope === "line") {
    offsetFrames = lineIndex * lineStaggerFrames;
  } else if (treatment.motionGrammar.unit === "word" && scope === "word") {
    offsetFrames = wordSequenceIndex * wordStaggerFrames;
  }

  if (phase === "entry") {
    return interpolate(frame, [startFrame - durationFrames + offsetFrames, startFrame + offsetFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing
    });
  }

  return interpolate(frame, [endFrame + offsetFrames, endFrame + durationFrames + offsetFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing
  });
};

const scopeParticipatesInPrimaryMotion = (
  treatment: CinematicTreatment,
  scope: CinematicRuntimeScope
): boolean => {
  return treatment.motionGrammar.unit === scope;
};

const resolveHoldStyle = ({
  treatment,
  scope,
  isEmphasis,
  isActive,
  wordProgress = 0
}: {
  treatment: CinematicTreatment;
  scope: CinematicRuntimeScope;
  isEmphasis: boolean;
  isActive: boolean;
  wordProgress?: number;
}): MotionAccumulator => {
  const accumulator = createAccumulator();
  const hold = treatment.motionGrammar.hold;

  if (scope === "word") {
    if (hold.focusIsolation !== "none" && !isEmphasis && !isActive) {
      accumulator.opacity *= hold.nonFocusOpacity;
    }

    if (isActive) {
      accumulator.scale *= hold.activeScale;
    } else {
      accumulator.scale *= hold.idleScale;
    }

    if (isEmphasis) {
      const pulse = Math.sin(clamp01(wordProgress) * Math.PI);
      accumulator.scale *= 1 + pulse * hold.emphasisPulse;
    }
  }

  if (scope === "line" && hold.focusIsolation === "keyword-spotlight") {
    accumulator.scale *= isEmphasis ? 1.012 : 1;
  }

  return accumulator;
};

export const getCinematicVisibilityWindowFrames = ({
  treatment,
  fps
}: {
  treatment: CinematicTreatment;
  fps: number;
}): {
  entryFrames: number;
  exitFrames: number;
} => {
  return {
    entryFrames: msToFrames(treatment.motionGrammar.entry.durationMs, fps),
    exitFrames: msToFrames(treatment.motionGrammar.exit.durationMs, fps)
  };
};

export const resolveCinematicMotionStyle = ({
  frame,
  fps,
  startFrame,
  endFrame,
  treatment,
  scope,
  lineIndex = 0,
  wordSequenceIndex = 0,
  isEmphasis = false,
  isActive = false,
  wordProgress = 0,
  continuityWarmth = 0
}: CinematicMotionRuntimeInput): CSSProperties => {
  const participatesInPrimaryMotion = scopeParticipatesInPrimaryMotion(treatment, scope);
  const entryProgress = participatesInPrimaryMotion
    ? getPhaseProgress({
    frame,
    startFrame,
    endFrame,
    fps,
    phase: "entry",
    scope,
    lineIndex,
    wordSequenceIndex,
      treatment
    })
    : 1;
  const exitProgress = participatesInPrimaryMotion
    ? getPhaseProgress({
    frame,
    startFrame,
    endFrame,
    fps,
    phase: "exit",
    scope,
    lineIndex,
    wordSequenceIndex,
      treatment
    })
    : 0;

  const entryState = createAccumulator();
  const exitState = createAccumulator();
  const holdState = resolveHoldStyle({
    treatment,
    scope,
    isEmphasis,
    isActive,
    wordProgress
  });

  if (participatesInPrimaryMotion) {
    treatment.motionGrammar.entry.primitives.forEach((primitive) => {
      applyPrimitive({
        accumulator: entryState,
        primitive,
        phase: "entry",
        progress: entryProgress,
        continuityWarmth,
        isEmphasis
      });
    });

    treatment.motionGrammar.exit.primitives.forEach((primitive) => {
      applyPrimitive({
        accumulator: exitState,
        primitive,
        phase: "exit",
        progress: exitProgress,
        continuityWarmth,
        isEmphasis
      });
    });
  }

  const opacity = participatesInPrimaryMotion
    ? clamp01(entryProgress * (1 - exitProgress) * entryState.opacity * exitState.opacity * holdState.opacity)
    : clamp01(holdState.opacity);
  const translateX = entryState.x + exitState.x;
  const translateY = entryState.y + exitState.y;
  const scale = entryState.scale * exitState.scale * holdState.scale;
  const rotateZ = entryState.rotateZ + exitState.rotateZ;
  const rotateX = entryState.rotateX + exitState.rotateX;
  const blur = Math.max(0, entryState.blur + exitState.blur);
  const clipPath =
    exitProgress > 0.001
      ? exitState.clipPath ?? entryState.clipPath
      : entryState.clipPath;

  const transformParts = [
    `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0)`,
    rotateX !== 0 ? `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg)` : "",
    rotateZ !== 0 ? `rotateZ(${rotateZ.toFixed(2)}deg)` : "",
    `scale(${scale.toFixed(4)})`
  ].filter(Boolean);

  return {
    opacity,
    transform: transformParts.join(" "),
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : undefined,
    clipPath,
    willChange: "transform, opacity, filter, clip-path"
  };
};
