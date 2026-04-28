import {sha256Text} from "../utils/hash";
import {buildGodPromptPack, GOD_MASTER_PROMPT_VERSION} from "./prompts";
import type {
  GodGenerationBrief,
  GodNeedAssessment,
  GodReferenceAsset,
  GodSceneContext
} from "./types";
import {godGenerationBriefSchema} from "./types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const tuple2 = (first: number, second: number): [number, number] => [first, second];

const inferAssetPurpose = (context: GodSceneContext, assessment: GodNeedAssessment): string => {
  if (assessment.decision === "generate_asset_variation") {
    return `Generate a governed variation of the existing ${assessment.chosenAssetId ?? "asset"} for this exact moment.`;
  }
  if (context.assetRole === "background") {
    return "Generate a transparent background-supporting motion layer that deepens the scene without stealing focus.";
  }
  if (context.preferredForm === "text-glow") {
    return "Generate a premium text-led overlay module with cinematic blur-in and layered glow.";
  }
  return "Generate a modular transparent overlay asset that can support a premium motion moment.";
};

const inferPreferredSize = (context: GodSceneContext): {width: number; height: number; aspectRatio: string} => {
  const width = context.width ?? (context.presentationMode === "long-form" ? 1920 : 1080);
  const height = context.height ?? (context.presentationMode === "long-form" ? 1080 : 1080);
  return {
    width,
    height,
    aspectRatio: `${width}:${height}`
  };
};

const inferMotionMetadata = ({
  context,
  assessment
}: {
  context: GodSceneContext;
  assessment: GodNeedAssessment;
}) => {
  const form = context.preferredForm;
  if (form === "text-glow") {
    return {
      recommendedEntranceStyle: "blur-up reveal with soft lock",
      recommendedHoverStyle: "calm glow pulse",
      recommendedDurationRangeMs: tuple2(1100, 1700),
      recommendedZLayerUsage: context.assetRole === "background" ? "background-depth or low overlay" : "overlay-text lane",
      recommendedBlendModes: ["screen", "soft-light"],
      recommendedOpacityRange: tuple2(0.76, 0.96),
      recommendedLoopStyle: "single reveal then slow settle"
    };
  }

  if (form === "panel") {
    return {
      recommendedEntranceStyle: "soft scale-up with glass settle",
      recommendedHoverStyle: "slow drift and gentle luminance shift",
      recommendedDurationRangeMs: tuple2(1300, 2100),
      recommendedZLayerUsage: "foreground-cross overlay lane",
      recommendedBlendModes: ["screen", "overlay", "soft-light"],
      recommendedOpacityRange: tuple2(0.68, 0.92),
      recommendedLoopStyle: "slow drift loop"
    };
  }

  if (form === "frame") {
    return {
      recommendedEntranceStyle: "trace-in corners with micro rise",
      recommendedHoverStyle: "subtle edge shimmer",
      recommendedDurationRangeMs: tuple2(1200, 1900),
      recommendedZLayerUsage: "edge frame lane",
      recommendedBlendModes: ["screen", "normal"],
      recommendedOpacityRange: tuple2(0.72, 0.94),
      recommendedLoopStyle: "steady perimeter loop"
    };
  }

  if (form === "symbol") {
    return {
      recommendedEntranceStyle: "compact bloom then settle",
      recommendedHoverStyle: "slow concentric pulse",
      recommendedDurationRangeMs: tuple2(1200, 2000),
      recommendedZLayerUsage: "center overlay lane",
      recommendedBlendModes: ["screen", "lighten"],
      recommendedOpacityRange: tuple2(0.7, 0.94),
      recommendedLoopStyle: "pulse and settle"
    };
  }

  if (form === "texture") {
    return {
      recommendedEntranceStyle: "ambient fade and bloom",
      recommendedHoverStyle: "graceful grain drift",
      recommendedDurationRangeMs: tuple2(1600, 2600),
      recommendedZLayerUsage: context.assetRole === "background" ? "background-depth" : "supporting-overlay",
      recommendedBlendModes: ["soft-light", "screen", "overlay"],
      recommendedOpacityRange: tuple2(0.52, 0.82),
      recommendedLoopStyle: "ambient loop"
    };
  }

  if (form === "flare") {
    return {
      recommendedEntranceStyle: "light bloom with orbital rise",
      recommendedHoverStyle: "slow luminous drift",
      recommendedDurationRangeMs: tuple2(1400, 2300),
      recommendedZLayerUsage: "accent overlay lane",
      recommendedBlendModes: ["screen", "lighter"],
      recommendedOpacityRange: tuple2(0.64, 0.92),
      recommendedLoopStyle: "orbital drift loop"
    };
  }

  return {
    recommendedEntranceStyle: "multi-axis rise with soft settle",
    recommendedHoverStyle: "premium glass drift",
    recommendedDurationRangeMs: tuple2(1600, 2600),
    recommendedZLayerUsage: context.assetRole === "background" ? "background-depth" : "foreground-cross",
    recommendedBlendModes: ["screen", "soft-light", "overlay"],
    recommendedOpacityRange: tuple2(0.66, 0.94),
    recommendedLoopStyle: "drift and settle"
  };
};

const inferReferenceNotes = ({
  context,
  assessment,
  existingAssets,
  backgroundAssets
}: {
  context: GodSceneContext;
  assessment: GodNeedAssessment;
  existingAssets: GodReferenceAsset[];
  backgroundAssets: GodReferenceAsset[];
}): string[] => {
  const notes = [
    `Decision: ${assessment.decision}`,
    `Need score: ${assessment.needScore.toFixed(2)}`,
    `Preferred form: ${context.preferredForm}`,
    `Master prompt version: ${GOD_MASTER_PROMPT_VERSION}`
  ];

  if (assessment.chosenAssetId) {
    notes.push(`Closest existing asset: ${assessment.chosenAssetId}`);
  }

  if (existingAssets.length > 0) {
    notes.push(`Existing motion assets inspected: ${existingAssets.length}`);
  }
  if (backgroundAssets.length > 0) {
    notes.push(`Background reference assets inspected: ${backgroundAssets.length}`);
  }
  return notes;
};

export const buildGodGenerationBrief = ({
  context,
  assessment,
  existingAssets,
  backgroundAssets
}: {
  context: GodSceneContext;
  assessment: GodNeedAssessment;
  existingAssets: GodReferenceAsset[];
  backgroundAssets: GodReferenceAsset[];
}): GodGenerationBrief => {
  const size = inferPreferredSize(context);
  const motionMetadata = inferMotionMetadata({context, assessment});
  const promptPack = buildGodPromptPack({
    briefId: "",
    briefVersion: "placeholder",
    createdAt: new Date().toISOString(),
    sceneContext: context,
    needAssessment: assessment,
    assetPurpose: inferAssetPurpose(context, assessment),
    semanticRole: context.semanticRole,
    visualTone: context.visualTone,
    preferredForm: context.preferredForm,
    motionLanguage: context.motionLanguage,
    transparencyRequired: true,
    noBackgroundRequired: true,
    paletteGuidance: context.paletteGuidance,
    aspectRatio: size.aspectRatio,
    sizeGuidance: {
      width: size.width,
      height: size.height,
      safeMarginPx: 72
    },
    exportConstraints: [],
    reusabilityGoal: context.reusabilityGoal,
    brandRules: context.brandRules,
    forbiddenElements: context.forbiddenElements,
    requiredElements: context.requiredElements,
    compositionConstraints: context.compositionConstraints,
    motionMetadata,
    referenceNotes: [],
    existingAssetReferences: [],
    backgroundReferences: [],
    promptText: "",
    systemPrompt: "",
    userPrompt: "",
    providerHints: {}
  });

  const referenceNotes = inferReferenceNotes({context, assessment, existingAssets, backgroundAssets});
  const briefSeed = JSON.stringify({
    context,
    assessment: {
      decision: assessment.decision,
      chosenAssetId: assessment.chosenAssetId,
      needScore: assessment.needScore
    },
    size,
    referenceNotes
  });

  return godGenerationBriefSchema.parse({
    briefId: `god-brief-${sha256Text(briefSeed).slice(0, 12)}`,
    briefVersion: GOD_MASTER_PROMPT_VERSION,
    createdAt: new Date().toISOString(),
    sceneContext: context,
    needAssessment: assessment,
    assetPurpose: inferAssetPurpose(context, assessment),
    semanticRole: context.semanticRole,
    visualTone: context.visualTone,
    preferredForm: context.preferredForm,
    motionLanguage: context.motionLanguage,
    transparencyRequired: true,
    noBackgroundRequired: true,
    paletteGuidance: unique(context.paletteGuidance),
    aspectRatio: size.aspectRatio,
    sizeGuidance: {
      width: size.width,
      height: size.height,
      safeMarginPx: context.assetRole === "background" ? 32 : 72
    },
    exportConstraints: unique([
      "html-css-only",
      "transparent-background",
      "no-js",
      "compositor-friendly",
      "no-watermarks",
      "no-hardcoded-matte"
    ]),
    reusabilityGoal: context.reusabilityGoal,
    brandRules: unique([
      "premium-editorial-restraint",
      "glassmorphism-with-negative-space",
      ...context.brandRules
    ]),
    forbiddenElements: unique([
      "hardcoded background fills",
      "ugly stock-looking gradients",
      "random low-end clipart feel",
      "watermarks",
      "baked-in text unless explicitly requested",
      "visual clutter",
      "childish styling unless intentionally requested",
      "inconsistent perspective",
      "unusable edges for compositing",
      ...context.forbiddenElements
    ]),
    requiredElements: unique([
      "transparent background",
      "clean compositing edges",
      "premium motion restraint",
      "glassmorphism depth",
      ...context.requiredElements
    ]),
    compositionConstraints: unique([
      "overflow hidden",
      "isolation isolate",
      "transparent outside bounds",
      ...context.compositionConstraints
    ]),
    motionMetadata,
    referenceNotes,
    existingAssetReferences: existingAssets.slice(0, 5).map((asset, index) => ({
      id: asset.id,
      label: asset.label,
      score: clamp01(asset.score ?? Math.max(0, 0.8 - index * 0.08)),
      reason: `Inspected as part of existing-library-first governance.`
    })),
    backgroundReferences: backgroundAssets.slice(0, 5).map((asset) => ({
      id: asset.id,
      label: asset.label,
      themeTags: asset.themeTags ?? [],
      score: clamp01(asset.score ?? 0.5)
    })),
    promptText: promptPack.userPrompt,
    systemPrompt: promptPack.systemPrompt,
    userPrompt: promptPack.userPrompt,
    providerHints: {
      providerRouting: "provider-agnostic",
      transparentBackground: true,
      noBackground: true,
      outputFormat: "html-css",
      sceneSpecific: context.isSceneSpecific,
      variationRequested: context.variationRequested,
      manualReviewRequested: context.manualReviewRequested
    }
  });
};
