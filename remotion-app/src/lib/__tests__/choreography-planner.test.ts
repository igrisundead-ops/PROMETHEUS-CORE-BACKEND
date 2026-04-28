import {describe, expect, it} from "vitest";

import {
  buildMotionChoreographyPlan,
  inferMotionSceneKind,
  resolveMotionChoreographySceneStateAtTime,
  selectActiveMotionChoreographySceneAtTime
} from "../motion-platform/choreography-planner";
import {buildMotionCompositionModel} from "../motion-platform/scene-engine";
import type {CaptionChunk, MotionAssetManifest} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Build the message.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1200,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  profileId: partial.profileId ?? "svg_typography_v1",
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

const makeAsset = (id: string, placementZone: MotionAssetManifest["placementZone"] = "foreground-cross"): MotionAssetManifest => ({
  id,
  family: "panel",
  tier: "premium",
  src: `motion-assets/${id}.png`,
  alphaMode: "straight",
  placementZone,
  durationPolicy: "scene-span",
  themeTags: ["neutral"],
  safeArea: "avoid-caption-region",
  loopable: true,
  blendMode: "screen",
  opacity: 0.7
});

describe("choreography planner", () => {
  it("infers the expected scene kinds from text signals", () => {
    expect(inferMotionSceneKind({text: "Before and after the redesign.", assets: []})).toBe("comparison");
    expect(inferMotionSceneKind({text: "\"This changed everything,\" she said.", assets: []})).toBe("quote");
    expect(inferMotionSceneKind({text: "Replies rose by 42 percent.", assets: []})).toBe("stat");
    expect(inferMotionSceneKind({text: "Click to start the next step.", assets: []})).toBe("cta");
    expect(inferMotionSceneKind({text: "Build the message before you buy the traffic.", assets: []})).toBe("feature-highlight");
  });

  it("builds deterministic preset plans with preview-safe stage transforms and primitive registry contracts", () => {
    const chunks = [
      makeChunk({id: "feature", text: "Build the message before you buy the traffic.", startMs: 0, endMs: 2200}),
      makeChunk({id: "stat", text: "That one shift lifted replies by 42 percent.", startMs: 2200, endMs: 4600}),
      makeChunk({id: "cta", text: "Click to start the cleaner workflow.", startMs: 4600, endMs: 6900})
    ];
    const scenes = [
      {id: "scene-feature", startMs: 0, endMs: 2200, sourceChunkId: "feature", assets: [makeAsset("asset-a"), makeAsset("asset-b")]},
      {id: "scene-stat", startMs: 2200, endMs: 4600, sourceChunkId: "stat", assets: [makeAsset("asset-c"), makeAsset("asset-d")]},
      {id: "scene-cta", startMs: 4600, endMs: 6900, sourceChunkId: "cta", assets: [makeAsset("asset-e")]}
    ];

    const plan = buildMotionChoreographyPlan({
      chunks,
      scenes,
      videoMetadata: {width: 1080, height: 1920}
    });

    expect(plan.enabled).toBe(true);
    expect(plan.scenes).toHaveLength(3);
    expect(plan.primitiveRegistry.map((entry) => entry.id)).toEqual([
      "typewriter",
      "blur-reveal",
      "highlight-word",
      "circle-reveal",
      "blur-underline"
    ]);
    expect(plan.sceneMap["scene-feature"].sceneKind).toBe("feature-highlight");
    expect(plan.sceneMap["scene-stat"].choreographyPresetId).toBe("stat-shallow-push");
    expect(plan.sceneMap["scene-cta"].previewStageInstructions.length).toBeGreaterThan(0);
    expect(plan.sceneMap["scene-feature"].timelineInstructions.every((instruction, index, array) => {
      return index === 0 || instruction.startMs >= array[index - 1].startMs;
    })).toBe(true);
  });

  it("carries continuity into the next scene for compatible presets", () => {
    const chunks = [
      makeChunk({id: "feature", text: "Build the message before you buy the traffic.", startMs: 0, endMs: 2100}),
      makeChunk({id: "stat", text: "That one shift lifted replies by 42 percent.", startMs: 2100, endMs: 4300})
    ];
    const scenes = [
      {id: "scene-feature", startMs: 0, endMs: 2100, sourceChunkId: "feature", assets: [makeAsset("asset-a")]},
      {id: "scene-stat", startMs: 2100, endMs: 4300, sourceChunkId: "stat", assets: [makeAsset("asset-b")]}
    ];

    const plan = buildMotionChoreographyPlan({
      chunks,
      scenes,
      videoMetadata: {width: 1080, height: 1920}
    });
    const secondScene = plan.sceneMap["scene-stat"];

    expect(secondScene.continuity.carryCamera).toBe(true);
    expect(secondScene.continuity.carryFocusOffset).toBe(true);
    expect(secondScene.previewStageInstructions[0].from.translateX).not.toBe(0);
  });

  it("selects active choreography scenes and resolves live stage transforms", () => {
    const chunks = [
      makeChunk({id: "feature", text: "Build the message before you buy the traffic.", startMs: 0, endMs: 2200})
    ];
    const scenes = [
      {id: "scene-feature", startMs: 0, endMs: 2200, sourceChunkId: "feature", assets: [makeAsset("asset-a")]}
    ];

    const plan = buildMotionChoreographyPlan({
      chunks,
      scenes,
      videoMetadata: {width: 1080, height: 1920}
    });
    const activeScene = selectActiveMotionChoreographySceneAtTime({
      plan,
      currentTimeMs: 900
    });
    const state = resolveMotionChoreographySceneStateAtTime({
      scene: activeScene!,
      currentTimeMs: 900
    });

    expect(activeScene?.sceneId).toBe("scene-feature");
    expect(state.stageTransform.scale).toBeGreaterThan(1);
    expect(state.targetTransforms["scene-feature-headline"].opacity).toBeGreaterThan(0);
  });

  it("adds choreography metadata to the motion model even when 3d mode is off", () => {
    const chunks = [
      makeChunk({id: "feature", text: "Build the message before you buy the traffic.", startMs: 0, endMs: 2200}),
      makeChunk({id: "stat", text: "That one shift lifted replies by 42 percent.", startMs: 2200, endMs: 4600})
    ];

    const model = buildMotionCompositionModel({
      chunks,
      tier: "premium",
      fps: 30,
      motion3DMode: "off"
    });

    expect(model.choreographyPlan.enabled).toBe(true);
    expect(model.motion3DPlan.enabled).toBe(false);
    expect(model.scenes[0].sceneKind).toBeDefined();
    expect(model.scenes[0].timelineInstructions?.length).toBeGreaterThan(0);
    expect(model.scenes[1].choreographyPresetId).toBe("stat-shallow-push");
  }, 15000);
});
