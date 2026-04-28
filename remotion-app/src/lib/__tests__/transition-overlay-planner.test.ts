import {describe, expect, it} from "vitest";

import {
  buildTransitionOverlayPlan,
  selectActiveTransitionOverlayCueAtTime
} from "../motion-platform/transition-overlay-planner";
import type {CaptionChunk, TransitionOverlayAsset} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Reset the room.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 900,
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

const makeAsset = (partial: Partial<TransitionOverlayAsset>): TransitionOverlayAsset => ({
  id: partial.id ?? "transition-asset",
  label: partial.label ?? "Transition Asset",
  src: partial.src ?? "transitions/transition-asset.mp4",
  originalFileName: partial.originalFileName ?? "transition-asset.mp4",
  width: partial.width ?? 720,
  height: partial.height ?? 1280,
  fps: partial.fps ?? 30,
  durationSeconds: partial.durationSeconds ?? 12,
  orientation: partial.orientation ?? "vertical",
  orientationSource: partial.orientationSource ?? "manual",
  category: partial.category ?? "normal",
  styleTags: partial.styleTags ?? ["transition"],
  recommendedDurationSeconds: partial.recommendedDurationSeconds ?? 1.38,
  preferredTrimWindow: partial.preferredTrimWindow ?? {startSeconds: 0.2, endSeconds: 8.2},
  blendMode: partial.blendMode ?? "screen",
  fadePreference: partial.fadePreference ?? "balanced",
  opacity: partial.opacity ?? 0.95
});

describe("transition overlay planner", () => {
  it("builds a standard silence-triggered overlay and keeps trimming inside the hard cap", () => {
    const plan = buildTransitionOverlayPlan({
      chunks: [
        makeChunk({id: "a", text: "Say it clearly.", startMs: 0, endMs: 950}),
        makeChunk({id: "b", text: "Then keep moving.", startMs: 1580, endMs: 2600})
      ],
      tier: "premium",
      mode: "standard",
      videoMetadata: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 12,
        durationInFrames: 360
      },
      catalog: [makeAsset({id: "vertical-soft", category: "light-leak", fadePreference: "soft"})]
    });

    expect(plan.enabled).toBe(true);
    expect(plan.layoutMode).toBe("vertical-cover");
    expect(plan.minSilenceMs).toBeGreaterThanOrEqual(350);
    expect(plan.cues).toHaveLength(1);
    expect(plan.selectedAssets[0]?.id).toBe("vertical-soft");
    expect(plan.cues[0].silenceGapMs).toBeGreaterThanOrEqual(plan.minSilenceMs);
    expect(plan.cues[0].endMs - plan.cues[0].startMs).toBeGreaterThanOrEqual(1350);
    expect(plan.cues[0].endMs - plan.cues[0].startMs).toBeLessThanOrEqual(2500);
    expect(selectActiveTransitionOverlayCueAtTime({
      cues: plan.cues,
      currentTimeMs: plan.cues[0].peakStartMs
    })).toEqual(plan.cues[0]);
  });

  it("routes landscape assets to landscape output and prefers the landscape pool", () => {
    const plan = buildTransitionOverlayPlan({
      chunks: [
        makeChunk({id: "a", text: "Open the scene.", startMs: 0, endMs: 1200}),
        makeChunk({id: "b", text: "Keep the room moving.", startMs: 1750, endMs: 2900})
      ],
      tier: "editorial",
      mode: "standard",
      videoMetadata: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationSeconds: 10,
        durationInFrames: 300
      },
      catalog: [
        makeAsset({id: "landscape-soft", orientation: "landscape", category: "burn", width: 1280, height: 720}),
        makeAsset({id: "vertical-soft", category: "light-leak"})
      ]
    });

    expect(plan.layoutMode).toBe("landscape-cover");
    expect(plan.cues[0]?.assetId).toBe("landscape-soft");
    expect(plan.selectedAssets.every((asset) => asset.orientation === "landscape")).toBe(true);
  });

  it("allows denser fast-intro chaining than standard mode", () => {
    const chunks = [
      makeChunk({id: "a", text: "Start now.", startMs: 0, endMs: 5600}),
      makeChunk({id: "b", text: "Stay moving.", startMs: 5880, endMs: 11480}),
      makeChunk({id: "c", text: "Cut faster.", startMs: 11860, endMs: 17460}),
      makeChunk({id: "d", text: "Keep it sharp.", startMs: 17880, endMs: 23280}),
      makeChunk({id: "e", text: "Push forward.", startMs: 23620, endMs: 29220}),
      makeChunk({id: "f", text: "Land the point.", startMs: 29560, endMs: 35460})
    ];
    const catalog = [
      makeAsset({id: "fast-intro", category: "montage", fadePreference: "snappy", recommendedDurationSeconds: 1.32}),
      makeAsset({id: "soft-leak", category: "light-leak", fadePreference: "soft", recommendedDurationSeconds: 1.58})
    ];

    const standard = buildTransitionOverlayPlan({
      chunks,
      tier: "hero",
      mode: "standard",
      videoMetadata: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 12,
        durationInFrames: 360
      },
      catalog
    });
    const fastIntro = buildTransitionOverlayPlan({
      chunks,
      tier: "hero",
      mode: "fast-intro",
      videoMetadata: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 12,
        durationInFrames: 360
      },
      catalog
    });

    expect(fastIntro.cues.length).toBeGreaterThan(standard.cues.length);
    expect(fastIntro.cooldownMs).toBeLessThan(standard.cooldownMs);
    expect(fastIntro.maxTransitionsPerWindow).toBeGreaterThanOrEqual(standard.maxTransitionsPerWindow);
  });
});
