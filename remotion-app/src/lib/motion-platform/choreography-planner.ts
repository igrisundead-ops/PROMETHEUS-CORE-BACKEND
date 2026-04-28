import type {
  CaptionChunk,
  MotionAssetManifest,
  MotionCameraCue,
  MotionChoreographyContinuity,
  MotionChoreographyLayerBinding,
  MotionChoreographyPlan,
  MotionChoreographyPresetId,
  MotionChoreographyScenePlan,
  MotionInstructionEasing,
  MotionPreviewStageTransform,
  MotionPrimitiveId,
  MotionSceneKind,
  MotionTimelineInstruction,
  MotionTransformValue,
  VideoMetadata
} from "../types";
import {motionPrimitiveRegistry} from "./motion-primitive-registry";

type ChoreographySceneInput = {
  id: string;
  startMs: number;
  endMs: number;
  sourceChunkId?: string;
  assets: MotionAssetManifest[];
  cameraCue?: MotionCameraCue;
};

type PresetTargetTemplate = {
  primitiveId?: MotionPrimitiveId;
  depthTreatment: MotionChoreographyLayerBinding["depthTreatment"];
  from: MotionTransformValue;
  settle: MotionTransformValue;
  exit: MotionTransformValue;
};

type ChoreographyPresetDefinition = {
  id: MotionChoreographyPresetId;
  sceneKind: MotionSceneKind;
  staggerMs: number;
  carryCamera: boolean;
  carryFocusOffset: boolean;
  headline: PresetTargetTemplate;
  subtext: PresetTargetTemplate;
  primaryAsset: PresetTargetTemplate;
  secondaryAsset: PresetTargetTemplate;
  accentAsset: PresetTargetTemplate;
  stage: {
    from: MotionTransformValue;
    settle: MotionTransformValue;
    exit: MotionTransformValue;
  };
};

export type MotionChoreographySceneState = {
  scene: MotionChoreographyScenePlan;
  stageTransform: MotionPreviewStageTransform;
  targetTransforms: Record<string, MotionTransformValue>;
};

const DEFAULT_TRANSFORM: MotionTransformValue = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  opacity: 1,
  rotateDeg: 0,
  depth: 0,
  blurPx: 0,
  reveal: 1
};

const HIDDEN_TRANSFORM: MotionTransformValue = {
  ...DEFAULT_TRANSFORM,
  opacity: 0,
  scale: 0.96,
  reveal: 0
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const easeValue = (mode: MotionInstructionEasing, input: number): number => {
  const t = clamp01(input);
  if (mode === "linear") {
    return t;
  }
  if (mode === "ease-in-out") {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  }
  if (mode === "back-out") {
    const p = t - 1;
    return 1 + p * p * (2.3 * p + 1.3);
  }
  return 1 - (1 - t) ** 3;
};

const interpolateTransform = (
  from: MotionTransformValue,
  to: MotionTransformValue,
  progress: number
): MotionTransformValue => ({
  translateX: lerp(from.translateX, to.translateX, progress),
  translateY: lerp(from.translateY, to.translateY, progress),
  scale: lerp(from.scale, to.scale, progress),
  opacity: lerp(from.opacity, to.opacity, progress),
  rotateDeg: lerp(from.rotateDeg, to.rotateDeg, progress),
  depth: lerp(from.depth, to.depth, progress),
  blurPx: lerp(from.blurPx, to.blurPx, progress),
  reveal: lerp(from.reveal, to.reveal, progress)
});

const makeTransform = (partial: Partial<MotionTransformValue>): MotionTransformValue => ({
  ...DEFAULT_TRANSFORM,
  ...partial
});

const presetRegistry: Record<MotionSceneKind, ChoreographyPresetDefinition> = {
  comparison: {
    id: "comparison-lateral-sweep",
    sceneKind: "comparison",
    staggerMs: 110,
    carryCamera: true,
    carryFocusOffset: true,
    headline: {
      primitiveId: "blur-reveal",
      depthTreatment: "flat",
      from: makeTransform({translateX: -80, translateY: -72, opacity: 0, scale: 0.95, blurPx: 12, reveal: 0}),
      settle: makeTransform({translateX: -10, translateY: -30}),
      exit: makeTransform({translateX: 30, translateY: -46, opacity: 0, scale: 0.97})
    },
    subtext: {
      primitiveId: "highlight-word",
      depthTreatment: "flat",
      from: makeTransform({translateX: -30, translateY: 26, opacity: 0, scale: 0.98, blurPx: 8, reveal: 0}),
      settle: makeTransform({translateX: 14, translateY: 48}),
      exit: makeTransform({translateX: 42, translateY: 34, opacity: 0})
    },
    primaryAsset: {
      depthTreatment: "depth-worthy",
      from: makeTransform({translateX: -180, translateY: 0, opacity: 0, scale: 0.9, depth: -40}),
      settle: makeTransform({translateX: -48, translateY: 0, depth: 80}),
      exit: makeTransform({translateX: -12, translateY: 0, opacity: 0.18, scale: 0.98, depth: 36})
    },
    secondaryAsset: {
      depthTreatment: "depth-worthy",
      from: makeTransform({translateX: 180, translateY: 10, opacity: 0, scale: 0.9, depth: -30}),
      settle: makeTransform({translateX: 72, translateY: 10, depth: 62}),
      exit: makeTransform({translateX: 22, translateY: 10, opacity: 0.18, scale: 0.98, depth: 28})
    },
    accentAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: 0, translateY: -22, opacity: 0, scale: 0.92}),
      settle: makeTransform({translateX: 0, translateY: 0, opacity: 0.78}),
      exit: makeTransform({translateX: 18, translateY: -12, opacity: 0})
    },
    stage: {
      from: makeTransform({translateX: -34, scale: 1.008}),
      settle: makeTransform({translateX: 30, scale: 1.04}),
      exit: makeTransform({translateX: 12, scale: 1.012})
    }
  },
  quote: {
    id: "quote-side-drift",
    sceneKind: "quote",
    staggerMs: 120,
    carryCamera: true,
    carryFocusOffset: false,
    headline: {
      primitiveId: "blur-reveal",
      depthTreatment: "flat",
      from: makeTransform({translateX: 84, translateY: -52, opacity: 0, scale: 0.96, blurPx: 18, reveal: 0}),
      settle: makeTransform({translateX: 18, translateY: -12}),
      exit: makeTransform({translateX: 42, translateY: -24, opacity: 0, blurPx: 6})
    },
    subtext: {
      primitiveId: "typewriter",
      depthTreatment: "flat",
      from: makeTransform({translateX: 34, translateY: 36, opacity: 0, scale: 0.99, reveal: 0}),
      settle: makeTransform({translateX: 12, translateY: 54}),
      exit: makeTransform({translateX: 22, translateY: 36, opacity: 0})
    },
    primaryAsset: {
      depthTreatment: "depth-worthy",
      from: makeTransform({translateX: 108, translateY: -6, opacity: 0, scale: 0.92, depth: -24}),
      settle: makeTransform({translateX: 42, translateY: -6, depth: 44}),
      exit: makeTransform({translateX: 56, translateY: -6, opacity: 0.18, depth: 18})
    },
    secondaryAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: -38, translateY: 22, opacity: 0, scale: 0.94}),
      settle: makeTransform({translateX: -12, translateY: 22, opacity: 0.72}),
      exit: makeTransform({translateX: -4, translateY: 12, opacity: 0})
    },
    accentAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: 0, translateY: -14, opacity: 0, scale: 0.9}),
      settle: makeTransform({translateX: 0, translateY: 0, opacity: 0.72}),
      exit: makeTransform({translateX: 14, translateY: -8, opacity: 0})
    },
    stage: {
      from: makeTransform({translateX: 18, translateY: -6, scale: 1.004}),
      settle: makeTransform({translateX: -12, translateY: 8, scale: 1.028}),
      exit: makeTransform({translateX: -4, translateY: 0, scale: 1.008})
    }
  },
  stat: {
    id: "stat-shallow-push",
    sceneKind: "stat",
    staggerMs: 90,
    carryCamera: true,
    carryFocusOffset: true,
    headline: {
      primitiveId: "highlight-word",
      depthTreatment: "flat",
      from: makeTransform({translateY: -58, opacity: 0, scale: 0.94, blurPx: 10, reveal: 0}),
      settle: makeTransform({translateY: -18}),
      exit: makeTransform({translateY: -26, opacity: 0})
    },
    subtext: {
      primitiveId: "blur-reveal",
      depthTreatment: "flat",
      from: makeTransform({translateY: 18, opacity: 0, scale: 0.98, blurPx: 9, reveal: 0}),
      settle: makeTransform({translateY: 34}),
      exit: makeTransform({translateY: 26, opacity: 0})
    },
    primaryAsset: {
      depthTreatment: "depth-worthy",
      from: makeTransform({translateX: -24, translateY: 84, opacity: 0, scale: 0.88, depth: -28}),
      settle: makeTransform({translateX: -8, translateY: 34, depth: 72}),
      exit: makeTransform({translateX: 8, translateY: 24, opacity: 0.14, scale: 0.98, depth: 22})
    },
    secondaryAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: 44, translateY: 62, opacity: 0, scale: 0.94}),
      settle: makeTransform({translateX: 16, translateY: 38, opacity: 0.82}),
      exit: makeTransform({translateX: 26, translateY: 28, opacity: 0})
    },
    accentAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: -14, translateY: 18, opacity: 0, scale: 0.9}),
      settle: makeTransform({translateX: 0, translateY: 6, opacity: 0.66}),
      exit: makeTransform({translateX: 8, translateY: 0, opacity: 0})
    },
    stage: {
      from: makeTransform({translateY: 8, scale: 1}),
      settle: makeTransform({translateY: -12, scale: 1.05}),
      exit: makeTransform({translateY: -4, scale: 1.02})
    }
  },
  "feature-highlight": {
    id: "feature-depth-slide",
    sceneKind: "feature-highlight",
    staggerMs: 96,
    carryCamera: true,
    carryFocusOffset: true,
    headline: {
      primitiveId: "typewriter",
      depthTreatment: "flat",
      from: makeTransform({translateX: -70, translateY: -54, opacity: 0, scale: 0.96, reveal: 0}),
      settle: makeTransform({translateX: -18, translateY: -16}),
      exit: makeTransform({translateX: -8, translateY: -26, opacity: 0})
    },
    subtext: {
      primitiveId: "blur-reveal",
      depthTreatment: "flat",
      from: makeTransform({translateX: -20, translateY: 34, opacity: 0, scale: 0.98, blurPx: 8, reveal: 0}),
      settle: makeTransform({translateX: 6, translateY: 46}),
      exit: makeTransform({translateX: 20, translateY: 34, opacity: 0})
    },
    primaryAsset: {
      depthTreatment: "depth-worthy",
      from: makeTransform({translateX: 120, translateY: 20, opacity: 0, scale: 0.9, depth: -24}),
      settle: makeTransform({translateX: 36, translateY: 8, depth: 64}),
      exit: makeTransform({translateX: 20, translateY: 8, opacity: 0.16, depth: 24})
    },
    secondaryAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: -36, translateY: 14, opacity: 0, scale: 0.94}),
      settle: makeTransform({translateX: -8, translateY: 12, opacity: 0.76}),
      exit: makeTransform({translateX: 8, translateY: 0, opacity: 0})
    },
    accentAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: 0, translateY: -18, opacity: 0, scale: 0.9}),
      settle: makeTransform({translateX: 0, translateY: 0, opacity: 0.62}),
      exit: makeTransform({translateX: 8, translateY: -8, opacity: 0})
    },
    stage: {
      from: makeTransform({translateX: -14, translateY: 4, scale: 1.004}),
      settle: makeTransform({translateX: 8, translateY: -8, scale: 1.038}),
      exit: makeTransform({translateX: 4, translateY: -2, scale: 1.014})
    }
  },
  cta: {
    id: "cta-resolved-hold",
    sceneKind: "cta",
    staggerMs: 100,
    carryCamera: false,
    carryFocusOffset: true,
    headline: {
      primitiveId: "highlight-word",
      depthTreatment: "flat",
      from: makeTransform({translateY: -42, opacity: 0, scale: 0.96, blurPx: 8, reveal: 0}),
      settle: makeTransform({translateY: -8, scale: 1.01}),
      exit: makeTransform({translateY: -18, opacity: 0})
    },
    subtext: {
      primitiveId: "typewriter",
      depthTreatment: "flat",
      from: makeTransform({translateY: 24, opacity: 0, scale: 0.98, reveal: 0}),
      settle: makeTransform({translateY: 44}),
      exit: makeTransform({translateY: 28, opacity: 0})
    },
    primaryAsset: {
      depthTreatment: "depth-worthy",
      from: makeTransform({translateX: 0, translateY: 96, opacity: 0, scale: 0.9, depth: -22}),
      settle: makeTransform({translateX: 0, translateY: 32, depth: 58}),
      exit: makeTransform({translateX: 0, translateY: 22, opacity: 0.2, depth: 18})
    },
    secondaryAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: 28, translateY: 44, opacity: 0, scale: 0.94}),
      settle: makeTransform({translateX: 10, translateY: 26, opacity: 0.82}),
      exit: makeTransform({translateX: 18, translateY: 18, opacity: 0})
    },
    accentAsset: {
      depthTreatment: "flat",
      from: makeTransform({translateX: -10, translateY: 12, opacity: 0, scale: 0.9}),
      settle: makeTransform({translateX: 0, translateY: 0, opacity: 0.7}),
      exit: makeTransform({translateX: 8, translateY: -4, opacity: 0})
    },
    stage: {
      from: makeTransform({scale: 1.002}),
      settle: makeTransform({translateY: -6, scale: 1.03}),
      exit: makeTransform({translateY: -2, scale: 1.01})
    }
  }
};

const quotePattern = /["“”]|(?:^|\s)(quote|quoted|said|told me|he said|she said|they said)(?:\s|$)/i;
const comparisonPattern = /\b(before(?:\s+and\s+|\s*\/\s*)after|versus|vs\.?|compare|comparison|against)\b/i;
const ctaPattern = /\b(subscribe|follow|join|book|click|download|get|try|start|comment|share|sign up)\b/i;
const statPattern = /\b(\d+[%x]?|\d{1,3}(?:,\d{3})+|percent|percentage|million|billion|thousand|dollars?|years?|months?|weeks?)\b/i;

const splitWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

const pickHeadlineAndSubtext = (text: string, sceneKind: MotionSceneKind): {headlineText: string; subtextText?: string} => {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      headlineText: ""
    };
  }

  if (sceneKind === "quote") {
    return {headlineText: trimmed};
  }

  const numberMatch = sceneKind === "stat" ? trimmed.match(/(\$?\d[\d,.]*%?|\d+\s?(?:percent|million|billion|thousand))/i) : null;
  if (numberMatch) {
    const number = numberMatch[1].trim();
    const remainder = trimmed.replace(numberMatch[1], "").replace(/\s+/g, " ").trim();
    return {
      headlineText: number,
      subtextText: remainder || trimmed
    };
  }

  const parts = trimmed.split(/[:,-]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return {
      headlineText: parts[0],
      subtextText: parts.slice(1).join(" ")
    };
  }

  const words = splitWords(trimmed);
  if (words.length <= 5) {
    return {headlineText: trimmed};
  }
  const breakpoint = sceneKind === "cta" ? Math.min(4, words.length - 2) : Math.min(5, words.length - 2);
  return {
    headlineText: words.slice(0, breakpoint).join(" "),
    subtextText: words.slice(breakpoint).join(" ")
  };
};

export const inferMotionSceneKind = ({
  text,
  assets
}: {
  text: string;
  assets: MotionAssetManifest[];
}): MotionSceneKind => {
  if (comparisonPattern.test(text) || assets.filter((asset) => asset.placementZone === "side-panels").length >= 2) {
    return "comparison";
  }
  if (quotePattern.test(text)) {
    return "quote";
  }
  if (ctaPattern.test(text)) {
    return "cta";
  }
  if (statPattern.test(text)) {
    return "stat";
  }
  return "feature-highlight";
};

const createInstruction = ({
  targetId,
  targetType,
  lane,
  phase,
  order,
  startMs,
  endMs,
  easing,
  from,
  to,
  primitiveId
}: Omit<MotionTimelineInstruction, "id">): MotionTimelineInstruction => ({
  id: `${targetId}-${phase}-${order}`,
  targetId,
  targetType,
  lane,
  phase,
  order,
  startMs,
  endMs: Math.max(endMs, startMs + 1),
  easing,
  from,
  to,
  primitiveId
});

const buildTargetInstructions = ({
  targetId,
  targetType,
  lane,
  primitiveId,
  order,
  enterStartMs,
  enterDurationMs,
  settleDurationMs,
  holdEndMs,
  exitDurationMs,
  from,
  settle,
  exit
}: {
  targetId: string;
  targetType: MotionTimelineInstruction["targetType"];
  lane: MotionTimelineInstruction["lane"];
  primitiveId?: MotionPrimitiveId;
  order: number;
  enterStartMs: number;
  enterDurationMs: number;
  settleDurationMs: number;
  holdEndMs: number;
  exitDurationMs: number;
  from: MotionTransformValue;
  settle: MotionTransformValue;
  exit: MotionTransformValue;
}): MotionTimelineInstruction[] => {
  const enterEndMs = enterStartMs + enterDurationMs;
  const settleEndMs = enterEndMs + settleDurationMs;
  const exitStartMs = Math.max(settleEndMs, holdEndMs);

  return [
    createInstruction({
      targetId,
      targetType,
      lane,
      phase: "enter",
      order,
      startMs: enterStartMs,
      endMs: enterEndMs,
      easing: primitiveId === "typewriter" ? "linear" : "ease-out",
      from,
      to: settle,
      primitiveId
    }),
    createInstruction({
      targetId,
      targetType,
      lane,
      phase: "settle",
      order,
      startMs: enterEndMs,
      endMs: settleEndMs,
      easing: "ease-in-out",
      from: settle,
      to: settle,
      primitiveId
    }),
    createInstruction({
      targetId,
      targetType,
      lane,
      phase: "hold",
      order,
      startMs: settleEndMs,
      endMs: exitStartMs,
      easing: "linear",
      from: settle,
      to: settle,
      primitiveId
    }),
    createInstruction({
      targetId,
      targetType,
      lane,
      phase: "exit",
      order,
      startMs: exitStartMs,
      endMs: exitStartMs + exitDurationMs,
      easing: "ease-in-out",
      from: settle,
      to: exit,
      primitiveId
    })
  ];
};

export const resolveMotionTransformAtTime = ({
  instructions,
  targetId,
  currentTimeMs,
  fallback = HIDDEN_TRANSFORM
}: {
  instructions: MotionTimelineInstruction[];
  targetId: string;
  currentTimeMs: number;
  fallback?: MotionTransformValue;
}): MotionTransformValue => {
  const targetInstructions = instructions
    .filter((instruction) => instruction.targetId === targetId)
    .sort((a, b) => a.startMs - b.startMs || a.order - b.order);

  if (targetInstructions.length === 0) {
    return fallback;
  }

  if (currentTimeMs <= targetInstructions[0].startMs) {
    return targetInstructions[0].from;
  }

  for (const instruction of targetInstructions) {
    if (currentTimeMs >= instruction.startMs && currentTimeMs <= instruction.endMs) {
      const progress = easeValue(
        instruction.easing,
        (currentTimeMs - instruction.startMs) / Math.max(1, instruction.endMs - instruction.startMs)
      );
      return interpolateTransform(instruction.from, instruction.to, progress);
    }
  }

  return targetInstructions[targetInstructions.length - 1].to;
};

const resolveContinuity = (
  preset: ChoreographyPresetDefinition,
  previousScene: MotionChoreographyScenePlan | null
): MotionChoreographyContinuity => ({
  carryCamera: preset.carryCamera,
  carryFocusOffset: preset.carryFocusOffset,
  anchorTargetId: previousScene?.focusTargetId
});

const applyContinuityToStage = ({
  preset,
  continuity,
  previousScene
}: {
  preset: ChoreographyPresetDefinition;
  continuity: MotionChoreographyContinuity;
  previousScene: MotionChoreographyScenePlan | null;
}): MotionTransformValue => {
  if (!continuity.carryCamera || !previousScene) {
    return preset.stage.from;
  }

  const carried = resolveMotionTransformAtTime({
    instructions: previousScene.previewStageInstructions,
    targetId: `${previousScene.sceneId}-camera-stage`,
    currentTimeMs: previousScene.previewStageInstructions.at(-1)?.endMs ?? 0,
    fallback: preset.stage.from
  });

  return makeTransform({
    translateX: preset.stage.from.translateX + carried.translateX * 0.32,
    translateY: preset.stage.from.translateY + carried.translateY * 0.32,
    scale: Math.max(preset.stage.from.scale, carried.scale * 0.985),
    rotateDeg: carried.rotateDeg * 0.26
  });
};

const applyContinuityToTarget = ({
  base,
  continuity,
  previousScene,
  isHeadline
}: {
  base: MotionTransformValue;
  continuity: MotionChoreographyContinuity;
  previousScene: MotionChoreographyScenePlan | null;
  isHeadline?: boolean;
}): MotionTransformValue => {
  if (!continuity.carryFocusOffset || !previousScene?.focusTargetId) {
    return base;
  }

  const carried = resolveMotionTransformAtTime({
    instructions: previousScene.timelineInstructions,
    targetId: previousScene.focusTargetId,
    currentTimeMs: previousScene.timelineInstructions.at(-1)?.endMs ?? 0,
    fallback: base
  });

  return makeTransform({
    translateX: base.translateX + carried.translateX * (isHeadline ? 0.12 : 0.24),
    translateY: base.translateY + carried.translateY * (isHeadline ? 0.08 : 0.16),
    scale: base.scale + (carried.scale - 1) * (isHeadline ? 0.04 : 0.08),
    opacity: base.opacity,
    rotateDeg: base.rotateDeg + carried.rotateDeg * 0.18,
    depth: base.depth + carried.depth * (isHeadline ? 0.05 : 0.12),
    blurPx: base.blurPx,
    reveal: base.reveal
  });
};

const buildBindings = ({
  scene,
  preset,
  headlineText,
  subtextText
}: {
  scene: ChoreographySceneInput;
  preset: ChoreographyPresetDefinition;
  headlineText: string;
  subtextText?: string;
}): MotionChoreographyLayerBinding[] => {
  const bindings: MotionChoreographyLayerBinding[] = [];

  if (headlineText) {
    bindings.push({
      targetId: `${scene.id}-headline`,
      targetType: "headline",
      role: "primary",
      primitiveId: preset.headline.primitiveId,
      depthTreatment: preset.headline.depthTreatment
    });
  }
  if (subtextText) {
    bindings.push({
      targetId: `${scene.id}-subtext`,
      targetType: "subtext",
      role: "secondary",
      primitiveId: preset.subtext.primitiveId,
      depthTreatment: preset.subtext.depthTreatment
    });
  }
  if (scene.assets[0]) {
    bindings.push({
      targetId: scene.assets[0].id,
      targetType: "asset",
      role: "primary",
      sourceAssetId: scene.assets[0].id,
      depthTreatment: preset.primaryAsset.depthTreatment
    });
  }
  if (scene.assets[1]) {
    bindings.push({
      targetId: scene.assets[1].id,
      targetType: "asset",
      role: "secondary",
      sourceAssetId: scene.assets[1].id,
      depthTreatment: preset.secondaryAsset.depthTreatment
    });
  }
  if (scene.assets[2]) {
    bindings.push({
      targetId: scene.assets[2].id,
      targetType: "asset",
      role: "accent",
      sourceAssetId: scene.assets[2].id,
      depthTreatment: preset.accentAsset.depthTreatment
    });
  }

  return bindings;
};

const pickFocusTargetId = (bindings: MotionChoreographyLayerBinding[]): string => {
  return bindings.find((binding) => binding.role === "primary" && binding.targetType === "asset")?.targetId
    ?? bindings.find((binding) => binding.targetType === "headline")?.targetId
    ?? bindings[0]?.targetId
    ?? "camera-stage";
};

const createScenePlan = ({
  scene,
  chunk,
  previousScene
}: {
  scene: ChoreographySceneInput;
  chunk: CaptionChunk | null;
  previousScene: MotionChoreographyScenePlan | null;
}): MotionChoreographyScenePlan => {
  const sceneKind = inferMotionSceneKind({
    text: chunk?.text ?? "",
    assets: scene.assets
  });
  const preset = presetRegistry[sceneKind];
  const {headlineText, subtextText} = pickHeadlineAndSubtext(chunk?.text ?? "", sceneKind);
  const bindings = buildBindings({
    scene,
    preset,
    headlineText,
    subtextText
  });
  const focusTargetId = pickFocusTargetId(bindings);
  const continuity = resolveContinuity(preset, previousScene);
  const durationMs = Math.max(800, scene.endMs - scene.startMs);
  const entryDurationMs = clamp(Math.round(durationMs * 0.24), 260, 620);
  const settleDurationMs = clamp(Math.round(durationMs * 0.14), 140, 360);
  const exitDurationMs = clamp(Math.round(durationMs * 0.18), 220, 520);
  const holdEndMs = scene.endMs - exitDurationMs;
  const stageTargetId = `${scene.id}-camera-stage`;
  const instructions: MotionTimelineInstruction[] = [];

  const stageFrom = applyContinuityToStage({
    preset,
    continuity,
    previousScene
  });
  instructions.push(
    ...buildTargetInstructions({
      targetId: stageTargetId,
      targetType: "camera-stage",
      lane: "camera",
      order: 0,
      enterStartMs: scene.startMs,
      enterDurationMs: entryDurationMs,
      settleDurationMs,
      holdEndMs,
      exitDurationMs,
      from: stageFrom,
      settle: preset.stage.settle,
      exit: preset.stage.exit
    })
  );

  bindings.forEach((binding, index) => {
    const offsetMs = index * preset.staggerMs;
    const enterStartMs = scene.startMs + offsetMs;
    const template = binding.targetType === "headline"
      ? preset.headline
      : binding.targetType === "subtext"
        ? preset.subtext
        : binding.role === "primary"
          ? preset.primaryAsset
          : binding.role === "secondary"
            ? preset.secondaryAsset
            : preset.accentAsset;
    const from = applyContinuityToTarget({
      base: template.from,
      continuity,
      previousScene,
      isHeadline: binding.targetType === "headline"
    });

    instructions.push(
      ...buildTargetInstructions({
        targetId: binding.targetId,
        targetType: binding.targetType,
        lane: binding.targetType === "asset" ? "overlay" : "text",
        primitiveId: binding.primitiveId,
        order: index + 1,
        enterStartMs,
        enterDurationMs: entryDurationMs,
        settleDurationMs,
        holdEndMs,
        exitDurationMs,
        from,
        settle: template.settle,
        exit: template.exit
      })
    );
  });

  const primitiveIds = [...new Set(bindings.flatMap((binding) => binding.primitiveId ? [binding.primitiveId] : []))];

  return {
    sceneId: scene.id,
    sceneKind,
    choreographyPresetId: preset.id,
    focusTargetId,
    headlineText,
    subtextText,
    primitiveIds,
    layerBindings: bindings,
    timelineInstructions: instructions
      .sort((a, b) => a.startMs - b.startMs || a.order - b.order),
    previewStageInstructions: instructions
      .filter((instruction) => instruction.targetType === "camera-stage")
      .sort((a, b) => a.startMs - b.startMs || a.order - b.order),
    continuity
  };
};

export const buildMotionChoreographyPlan = ({
  chunks,
  scenes,
  videoMetadata
}: {
  chunks: CaptionChunk[];
  scenes: ChoreographySceneInput[];
  videoMetadata: Pick<VideoMetadata, "width" | "height">;
}): MotionChoreographyPlan => {
  if (scenes.length === 0) {
    return {
      enabled: false,
      scenes: [],
      sceneMap: {},
      primitiveRegistry: motionPrimitiveRegistry,
      reasons: ["no scenes available for choreography planning"]
    };
  }

  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const plannedScenes: MotionChoreographyScenePlan[] = [];

  scenes.forEach((scene, index) => {
    const chunk = scene.sourceChunkId ? chunkById.get(scene.sourceChunkId) ?? null : null;
    const previousScene = index > 0 ? plannedScenes[index - 1] : null;
    plannedScenes.push(createScenePlan({
      scene,
      chunk,
      previousScene
    }));
  });

  return {
    enabled: true,
    scenes: plannedScenes,
    sceneMap: Object.fromEntries(plannedScenes.map((scene) => [scene.sceneId, scene])),
    primitiveRegistry: motionPrimitiveRegistry,
    reasons: [
      `planned ${plannedScenes.length} choreography scenes`,
      `configured for ${videoMetadata.width}x${videoMetadata.height} preview-safe stage transforms`
    ]
  };
};

export const selectActiveMotionChoreographySceneAtTime = ({
  plan,
  currentTimeMs
}: {
  plan: MotionChoreographyPlan;
  currentTimeMs: number;
}): MotionChoreographyScenePlan | null => {
  for (let index = plan.scenes.length - 1; index >= 0; index -= 1) {
    const scene = plan.scenes[index];
    const sceneStart = scene.timelineInstructions[0]?.startMs ?? 0;
    const sceneEnd = scene.timelineInstructions.at(-1)?.endMs ?? 0;
    if (currentTimeMs >= sceneStart && currentTimeMs <= sceneEnd) {
      return scene;
    }
  }
  return null;
};

export const resolveMotionChoreographySceneStateAtTime = ({
  scene,
  currentTimeMs
}: {
  scene: MotionChoreographyScenePlan;
  currentTimeMs: number;
}): MotionChoreographySceneState => {
  const targetTransforms: Record<string, MotionTransformValue> = {};
  scene.layerBindings.forEach((binding) => {
    targetTransforms[binding.targetId] = resolveMotionTransformAtTime({
      instructions: scene.timelineInstructions,
      targetId: binding.targetId,
      currentTimeMs,
      fallback: HIDDEN_TRANSFORM
    });
  });

  const stageTargetId = `${scene.sceneId}-camera-stage`;
  const stage = resolveMotionTransformAtTime({
    instructions: scene.previewStageInstructions,
    targetId: stageTargetId,
    currentTimeMs,
    fallback: DEFAULT_TRANSFORM
  });

  return {
    scene,
    stageTransform: {
      translateX: stage.translateX,
      translateY: stage.translateY,
      scale: stage.scale,
      rotateDeg: stage.rotateDeg,
      opacity: stage.opacity
    },
    targetTransforms
  };
};
