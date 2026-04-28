import type {CSSProperties} from "react";

import type {AnimationTriggerType, CaptionChunk, MotionChoreographyScenePlan, TranscribedWord} from "../types";
import type {ZoomEaseId} from "./zoom-timing";

export type TargetFocusSelection = {
  id?: string;
  tag?: string;
  selector?: string;
  registryRef?: string;
};

export type TargetFocusTargetBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TargetFocusTiming = {
  delayMs: number;
  focusMs: number;
  holdMs: number;
  returnMs: number;
  loop: boolean;
  loopDelayMs: number;
  easeIn: ZoomEaseId;
  easeOut: ZoomEaseId;
};

export type TargetFocusVignette = {
  opacity: number;
  radius: number;
  softness: number;
  tint: string;
};

export type TargetFocusCue = {
  id: string;
  label?: string;
  target: TargetFocusSelection;
  targetBox: TargetFocusTargetBox;
  startMs: number;
  zoomScale: number;
  timing: TargetFocusTiming;
  vignette: TargetFocusVignette;
  triggerType: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith: string[];
  notes?: string;
  priority?: number;
};

export type TargetFocusPhase = "idle" | "focus-in" | "hold" | "return";

export type TargetFocusCycleState = {
  active: boolean;
  phase: TargetFocusPhase;
  phaseProgress: number;
  progress: number;
  cycleIndex: number;
  elapsedMs: number;
  cycleMs: number;
};

export type TargetFocusResolvedState = {
  cue: TargetFocusCue | null;
  active: boolean;
  phase: TargetFocusPhase;
  phaseProgress: number;
  progress: number;
  scale: number;
  translateX: number;
  translateY: number;
  screenCenterX: number;
  screenCenterY: number;
  vignetteOpacity: number;
  vignetteStyle: CSSProperties | null;
  targetBox: TargetFocusTargetBox | null;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const resolveTargetFocusEaseValue = (mode: ZoomEaseId, input: number): number => {
  const t = clamp01(input);
  if (mode === "sine.out") {
    return Math.sin((t * Math.PI) / 2);
  }
  if (mode === "sine.inOut") {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }
  if (mode === "power3.out") {
    return 1 - (1 - t) ** 3;
  }
  if (mode === "power2.out") {
    return 1 - (1 - t) ** 2;
  }
  if (mode === "power2.inOut") {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
};

export const createTargetFocusTiming = (partial?: Partial<TargetFocusTiming>): TargetFocusTiming => {
  return {
    delayMs: 120,
    focusMs: 720,
    holdMs: 420,
    returnMs: 520,
    loop: true,
    loopDelayMs: 360,
    easeIn: "power3.out",
    easeOut: "sine.inOut",
    ...partial
  };
};

export const createTargetFocusVignette = (partial?: Partial<TargetFocusVignette>): TargetFocusVignette => {
  return {
    opacity: 0.9,
    radius: 0.28,
    softness: 0.18,
    tint: "rgba(4, 7, 16, 1)",
    ...partial
  };
};

export const createTargetFocusCue = (partial: {
  id: string;
  target: TargetFocusSelection;
  targetBox: TargetFocusTargetBox;
  startMs: number;
  zoomScale?: number;
  timing?: Partial<TargetFocusTiming>;
  vignette?: Partial<TargetFocusVignette>;
  triggerType?: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith?: string[];
  label?: string;
  notes?: string;
  priority?: number;
}): TargetFocusCue => {
  return {
    id: partial.id,
    label: partial.label,
    target: partial.target,
    targetBox: partial.targetBox,
    startMs: partial.startMs,
    zoomScale: partial.zoomScale ?? 1.14,
    timing: createTargetFocusTiming(partial.timing),
    vignette: createTargetFocusVignette(partial.vignette),
    triggerType: partial.triggerType ?? "timeline",
    compatibleWith: partial.compatibleWith ?? ["focus-effect:target-focus-zoom", "host:target-focus-runtime"],
    notes: partial.notes,
    priority: partial.priority
  };
};

export const selectActiveTargetFocusCueAtTime = (cues: TargetFocusCue[], currentTimeMs: number): TargetFocusCue | null => {
  const active = cues
    .filter((cue) => cue.startMs <= currentTimeMs)
    .sort((left, right) => left.startMs - right.startMs || (left.priority ?? 0) - (right.priority ?? 0));

  return active.at(-1) ?? null;
};

export const resolveTargetFocusCycleState = ({
  cue,
  currentTimeMs
}: {
  cue: TargetFocusCue;
  currentTimeMs: number;
}): TargetFocusCycleState => {
  const elapsedMs = currentTimeMs - cue.startMs;
  const cycleMs = Math.max(
    1,
    cue.timing.delayMs + cue.timing.focusMs + cue.timing.holdMs + cue.timing.returnMs + (cue.timing.loop ? cue.timing.loopDelayMs : 0)
  );

  if (elapsedMs < 0) {
    return {
      active: false,
      phase: "idle",
      phaseProgress: 0,
      progress: 0,
      cycleIndex: 0,
      elapsedMs,
      cycleMs
    };
  }

  if (!cue.timing.loop && elapsedMs >= cycleMs) {
    return {
      active: false,
      phase: "idle",
      phaseProgress: 0,
      progress: 0,
      cycleIndex: 0,
      elapsedMs,
      cycleMs
    };
  }

  const cycleIndex = cue.timing.loop ? Math.floor(elapsedMs / cycleMs) : 0;
  const cycleElapsedMs = cue.timing.loop ? elapsedMs % cycleMs : Math.min(elapsedMs, cycleMs - 1);
  const delayEnd = cue.timing.delayMs;
  const focusEnd = delayEnd + cue.timing.focusMs;
  const holdEnd = focusEnd + cue.timing.holdMs;
  const returnEnd = holdEnd + cue.timing.returnMs;

  if (cycleElapsedMs < delayEnd) {
    return {
      active: false,
      phase: "idle",
      phaseProgress: 0,
      progress: 0,
      cycleIndex,
      elapsedMs,
      cycleMs
    };
  }

  if (cycleElapsedMs < focusEnd) {
    const phaseProgress = resolveTargetFocusEaseValue(
      cue.timing.easeIn,
      (cycleElapsedMs - delayEnd) / Math.max(1, cue.timing.focusMs)
    );
    return {
      active: true,
      phase: "focus-in",
      phaseProgress,
      progress: phaseProgress,
      cycleIndex,
      elapsedMs,
      cycleMs
    };
  }

  if (cycleElapsedMs < holdEnd) {
    return {
      active: true,
      phase: "hold",
      phaseProgress: 1,
      progress: 1,
      cycleIndex,
      elapsedMs,
      cycleMs
    };
  }

  if (cycleElapsedMs < returnEnd) {
    const phaseProgress = resolveTargetFocusEaseValue(
      cue.timing.easeOut,
      (cycleElapsedMs - holdEnd) / Math.max(1, cue.timing.returnMs)
    );
    return {
      active: true,
      phase: "return",
      phaseProgress,
      progress: 1 - phaseProgress,
      cycleIndex,
      elapsedMs,
      cycleMs
    };
  }

  return {
    active: false,
    phase: "idle",
    phaseProgress: 0,
    progress: 0,
    cycleIndex,
    elapsedMs,
    cycleMs
  };
};

const computePeakScale = (cue: TargetFocusCue, viewportWidth: number, viewportHeight: number): number => {
  const targetAspect = cue.targetBox.height > 0 ? cue.targetBox.width / cue.targetBox.height : 1;
  const viewportAspect = viewportHeight > 0 ? viewportWidth / viewportHeight : 1;
  const targetSpan = Math.max(cue.targetBox.width / Math.max(1, viewportWidth), cue.targetBox.height / Math.max(1, viewportHeight));
  const sizeBoost = clamp(1 + Math.max(0, 0.34 - targetSpan) * 0.18, 1, 1.16);
  const aspectBoost = clamp(1 + Math.abs(targetAspect - viewportAspect) * 0.015, 1, 1.08);
  return clamp(cue.zoomScale * sizeBoost * aspectBoost, 1, 1.42);
};

const buildVignetteStyle = ({
  cue,
  progress,
  screenCenterX,
  screenCenterY,
  viewportWidth,
  viewportHeight
}: {
  cue: TargetFocusCue;
  progress: number;
  screenCenterX: number;
  screenCenterY: number;
  viewportWidth: number;
  viewportHeight: number;
}): CSSProperties => {
  const minDimension = Math.min(viewportWidth, viewportHeight);
  const clearRadius = minDimension * cue.vignette.radius;
  const softness = minDimension * cue.vignette.softness;
  const outerRadius = clearRadius + softness;
  const opacity = cue.vignette.opacity * clamp01(progress);
  const tint = cue.vignette.tint;

  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity,
    background: [
      `radial-gradient(circle ${outerRadius.toFixed(1)}px at ${screenCenterX.toFixed(1)}px ${screenCenterY.toFixed(1)}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0) ${(clearRadius * 0.72).toFixed(1)}px, rgba(255,255,255,0.05) ${(clearRadius * 0.9).toFixed(1)}px, ${tint} ${outerRadius.toFixed(1)}px, ${tint} 100%)`,
      `radial-gradient(circle ${(clearRadius * 0.95).toFixed(1)}px at ${screenCenterX.toFixed(1)}px ${screenCenterY.toFixed(1)}px, rgba(255,255,255,${(0.12 * opacity).toFixed(3)}) 0%, rgba(255,255,255,0) 68%)`
    ].join(", "),
    mixBlendMode: "multiply",
    filter: `blur(${Math.max(0, softness * 0.06).toFixed(1)}px)`
  };
};

export const resolveTargetFocusState = ({
  cue,
  currentTimeMs,
  viewportWidth,
  viewportHeight
}: {
  cue: TargetFocusCue | null;
  currentTimeMs: number;
  viewportWidth: number;
  viewportHeight: number;
}): TargetFocusResolvedState => {
  if (!cue) {
    return {
      cue: null,
      active: false,
      phase: "idle",
      phaseProgress: 0,
      progress: 0,
      scale: 1,
      translateX: 0,
      translateY: 0,
      screenCenterX: viewportWidth / 2,
      screenCenterY: viewportHeight / 2,
      vignetteOpacity: 0,
      vignetteStyle: null,
      targetBox: null
    };
  }

  const cycle = resolveTargetFocusCycleState({cue, currentTimeMs});
  const peakScale = computePeakScale(cue, viewportWidth, viewportHeight);
  const scale = cycle.progress > 0 ? lerp(1, peakScale, cycle.progress) : 1;
  const targetCenterX = cue.targetBox.left + cue.targetBox.width / 2;
  const targetCenterY = cue.targetBox.top + cue.targetBox.height / 2;
  const translateX = viewportWidth / 2 - targetCenterX * scale;
  const translateY = viewportHeight / 2 - targetCenterY * scale;
  const screenCenterX = targetCenterX * scale + translateX;
  const screenCenterY = targetCenterY * scale + translateY;
  const vignetteStyle = buildVignetteStyle({
    cue,
    progress: cycle.progress,
    screenCenterX,
    screenCenterY,
    viewportWidth,
    viewportHeight
  });

  return {
    cue,
    active: cycle.active,
    phase: cycle.phase,
    phaseProgress: cycle.phaseProgress,
    progress: cycle.progress,
    scale,
    translateX,
    translateY,
    screenCenterX,
    screenCenterY,
    vignetteOpacity: cue.vignette.opacity * cycle.progress,
    vignetteStyle,
    targetBox: cue.targetBox
  };
};

export const buildTargetFocusSelectionLabel = (selection: TargetFocusSelection): string => {
  return selection.registryRef ?? selection.id ?? selection.tag ?? selection.selector ?? "target-focus";
};

export const buildTargetFocusTargetBoxFromWord = (
  word: TranscribedWord,
  left: number,
  top: number,
  height: number
): TargetFocusTargetBox => {
  const width = Math.max(90, Math.round((word.text.length + 1) * 18));
  return {
    left,
    top,
    width,
    height
  };
};

export const buildTargetFocusCueFromScene = ({
  scene,
  targetBox,
  startMs,
  zoomScale = 1.12,
  label,
  notes,
  priority
}: {
  scene: MotionChoreographyScenePlan;
  targetBox: TargetFocusTargetBox;
  startMs?: number;
  zoomScale?: number;
  label?: string;
  notes?: string;
  priority?: number;
}): TargetFocusCue => {
  return createTargetFocusCue({
    id: `focus-${scene.sceneId}`,
    label: label ?? scene.headlineText,
    target: {
      registryRef: scene.focusTargetId,
      id: scene.focusTargetId
    },
    targetBox,
    startMs: startMs ?? scene.timelineInstructions[0]?.startMs ?? 0,
    zoomScale,
    timing: {
      delayMs: 120,
      focusMs: 680,
      holdMs: 460,
      returnMs: 520,
      loop: true,
      loopDelayMs: 380,
      easeIn: "power3.out",
      easeOut: "sine.inOut"
    },
    vignette: {
      opacity: 0.9,
      radius: 0.28,
      softness: 0.2,
      tint: "rgba(5, 8, 18, 1)"
    },
    triggerType: "timeline",
    compatibleWith: ["focus-effect:target-focus-zoom", "host:target-focus-runtime"],
    notes: notes ?? "Choreography-driven target focus cue.",
    priority
  });
};

export const buildTargetFocusCueFromWord = ({
  chunk,
  word,
  targetBox,
  startMs,
  label,
  priority
}: {
  chunk: CaptionChunk;
  word: TranscribedWord;
  targetBox: TargetFocusTargetBox;
  startMs?: number;
  label?: string;
  priority?: number;
}): TargetFocusCue => {
  return createTargetFocusCue({
    id: `focus-${chunk.id}-${word.startMs}`,
    label: label ?? word.text,
    target: {
      id: `${chunk.id}-word-${word.startMs}`
    },
    targetBox,
    startMs: startMs ?? Math.max(0, word.startMs - 120),
    zoomScale: 1.1,
    timing: {
      delayMs: 90,
      focusMs: 360,
      holdMs: 260,
      returnMs: 380,
      loop: true,
      loopDelayMs: 260,
      easeIn: "power3.out",
      easeOut: "sine.inOut"
    },
    vignette: {
      opacity: 0.86,
      radius: 0.23,
      softness: 0.16,
      tint: "rgba(6, 10, 20, 1)"
    },
    triggerType: ["word-level", "syllable-level"],
    compatibleWith: ["focus-effect:target-focus-zoom", "host:target-focus-runtime"],
    notes: `Word focus cue for ${chunk.id}.`,
    priority
  });
};
