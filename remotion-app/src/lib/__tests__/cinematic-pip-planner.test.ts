import {describe, expect, it} from "vitest";

import {
  buildCinematicPiPCompositionPlan,
  resolveCinematicPiPStageState,
  selectCinematicPiPMotionAssets
} from "../motion-platform/pip-composition-planner";

const makeVideoMetadata = (overrides?: Partial<{
  width: number;
  height: number;
  durationSeconds: number;
  durationInFrames: number;
}>): {
  width: number;
  height: number;
  durationSeconds: number;
  durationInFrames: number;
} => ({
  width: overrides?.width ?? 1920,
  height: overrides?.height ?? 1080,
  durationSeconds: overrides?.durationSeconds ?? 12,
  durationInFrames: overrides?.durationInFrames ?? 360
});

describe("cinematic PiP planner", () => {
  it("builds a left-content/right-free-space layout for wide frames", () => {
    const videoMetadata = makeVideoMetadata();
    const selectedAssets = selectCinematicPiPMotionAssets({
      layoutPreset: "pip-left-content-right",
      motionTier: "premium"
    });
    const plan = buildCinematicPiPCompositionPlan({
      videoMetadata,
      motionTier: "premium",
      motionAssets: selectedAssets
    });

    expect(plan.layoutPreset).toBe("pip-left-content-right");
    expect(plan.subjectAnchor.source).toBe("heuristic");
    expect(plan.cardBox.leftPercent).toBeLessThan(10);
    expect(plan.cardBox.widthPercent).toBeGreaterThan(45);
    expect(plan.freeSpaceZones.find((zone) => zone.role === "headline")?.leftPercent ?? 0).toBeGreaterThan(50);
    expect(plan.motionAssetPlacements.length).toBeGreaterThanOrEqual(3);
  });

  it("honours provided subject anchors and mirrored layouts", () => {
    const videoMetadata = makeVideoMetadata();
    const plan = buildCinematicPiPCompositionPlan({
      videoMetadata,
      motionTier: "hero",
      layoutPreset: "pip-right-content-left",
      subjectAnchor: {
        xPercent: 54,
        yPercent: 31,
        confidence: 0.94,
        source: "provided",
        rationale: "Tracked face box"
      }
    });

    expect(plan.layoutPreset).toBe("pip-right-content-left");
    expect(plan.subjectAnchor).toMatchObject({
      xPercent: 54,
      yPercent: 31,
      source: "provided"
    });
    expect(plan.cardBox.leftPercent).toBeGreaterThan(40);
    expect(plan.freeSpaceZones.find((zone) => zone.role === "headline")?.leftPercent ?? 100).toBeLessThan(20);
  });

  it("settles from full frame into the PiP card and releases free-space modules later", () => {
    const plan = buildCinematicPiPCompositionPlan({
      videoMetadata: makeVideoMetadata(),
      motionTier: "premium"
    });

    const intro = resolveCinematicPiPStageState({
      plan,
      currentFrame: 0
    });
    const settled = resolveCinematicPiPStageState({
      plan,
      currentFrame: plan.entrance.fullFrameFrames + plan.entrance.settleFrames
    });

    expect(intro.cardRect.leftPercent).toBe(0);
    expect(intro.cardRect.widthPercent).toBe(100);
    expect(intro.shadowOpacity).toBe(0);
    expect(settled.cardRect.leftPercent).toBeCloseTo(plan.cardBox.leftPercent, 1);
    expect(settled.cardRect.widthPercent).toBeCloseTo(plan.cardBox.widthPercent, 1);
    expect(settled.freeSpaceProgress).toBeGreaterThan(0.4);
  });
});

