import {describe, expect, it} from "vitest";

import {
  getMotionPlanRecommendedMotionIntensity,
  resolveMotionPlan,
  type MotionPlanSignals
} from "../motion-platform/motion-determinator";
import type {CaptionChunk, VideoMetadata} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Build momentum",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 800,
  words: partial.words ?? [
    {text: "Build", startMs: partial.startMs ?? 0, endMs: (partial.startMs ?? 0) + 320},
    {text: "momentum", startMs: (partial.startMs ?? 0) + 340, endMs: (partial.startMs ?? 0) + 800}
  ],
  styleKey: partial.styleKey ?? "tall_generic_default",
  motionKey: partial.motionKey ?? "cinematic_text_preset",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  profileId: partial.profileId ?? "slcp",
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

const videoMetadata: VideoMetadata = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 8,
  durationInFrames: 240
};

const baseSignals: MotionPlanSignals = {
  durationSeconds: 8,
  aspectRatio: 0.56,
  totalChunks: 1,
  totalWords: 1,
  totalCharacters: 6,
  wordsPerSecond: 1,
  averageWordsPerChunk: 1,
  averageCharactersPerChunk: 6,
  semanticDensity: 0,
  emphasisDensity: 0,
  variationDensity: 0,
  punctuationDensity: 0,
  readabilityPressure: 0,
  energyScore: 0,
  clarityScore: 0,
  intensityScore: 0
};

describe("motion determinator", () => {
  it("maps score thresholds onto the expected motion tier", () => {
    expect(getMotionPlanRecommendedMotionIntensity({...baseSignals, intensityScore: 12})).toBe("minimal");
    expect(getMotionPlanRecommendedMotionIntensity({...baseSignals, intensityScore: 39})).toBe("editorial");
    expect(getMotionPlanRecommendedMotionIntensity({...baseSignals, intensityScore: 61})).toBe("premium");
    expect(getMotionPlanRecommendedMotionIntensity({...baseSignals, intensityScore: 88})).toBe("hero");
  });

  it("uses profile defaults when overrides stay on auto", () => {
    const plan = resolveMotionPlan({
      chunks: [
        makeChunk({id: "chunk-a", text: "Build", startMs: 0, endMs: 500}),
        makeChunk({id: "chunk-b", text: "Momentum", startMs: 1200, endMs: 1900})
      ],
      videoMetadata,
      captionProfileId: "slcp"
    });

    expect(plan.motionIntensity).toBe("minimal");
    expect(plan.captionBias).toBe("bottom");
    expect(plan.fieldSources.captionBias).toBe("profile-default");
    expect(plan.selectedAssets.length).toBeGreaterThan(0);
    expect(plan.reasons.some((reason) => reason.startsWith("catalog="))).toBe(true);
    expect(plan.reasons.some((reason) => reason.startsWith("selectedAssets="))).toBe(true);
  });

  it("keeps manual overrides ahead of auto planning", () => {
    const plan = resolveMotionPlan({
      chunks: [
        makeChunk({id: "chunk-a", text: "Build", startMs: 0, endMs: 500}),
        makeChunk({id: "chunk-b", text: "Momentum", startMs: 1200, endMs: 1900})
      ],
      videoMetadata,
      captionProfileId: "slcp",
      overrides: {
        motionIntensity: "hero",
        captionBias: "top",
        gradeProfileId: "premium-contrast",
        transitionPresetId: "hero-subject-wipe",
        matteMode: "prefer-matte",
        assetFamilies: ["frame", "foreground-element"]
      }
    });

    expect(plan.motionIntensity).toBe("hero");
    expect(plan.captionBias).toBe("top");
    expect(plan.gradeProfileId).toBe("premium-contrast");
    expect(plan.transitionPresetId).toBe("hero-subject-wipe");
    expect(plan.matteMode).toBe("prefer-matte");
    expect(plan.fieldSources.motionIntensity).toBe("manual");
    expect(plan.fieldSources.captionBias).toBe("manual");
    expect(plan.fieldSources.gradeProfileId).toBe("manual");
    expect(plan.fieldSources.transitionPresetId).toBe("manual");
    expect(plan.fieldSources.matteMode).toBe("manual");
    expect(plan.fieldSources.assetFamilies).toBe("manual");
  });

  it("keeps longform EVE captions bottom-biased even when motion gets energetic", () => {
    const plan = resolveMotionPlan({
      chunks: [
        makeChunk({id: "chunk-a", text: "Give", startMs: 0, endMs: 500}),
        makeChunk({id: "chunk-b", text: "it", startMs: 650, endMs: 900}),
        makeChunk({id: "chunk-c", text: "a name", startMs: 1000, endMs: 1500})
      ],
      videoMetadata,
      captionProfileId: "longform_eve_typography_v1",
      overrides: {
        motionIntensity: "hero"
      }
    });

    expect(plan.motionIntensity).toBe("hero");
    expect(plan.captionBias).toBe("bottom");
    expect(plan.fieldSources.captionBias).toBe("profile-default");
  });
});
