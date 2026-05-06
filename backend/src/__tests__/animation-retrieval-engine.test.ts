import {describe, expect, it, vi} from "vitest";

import {resolveRenderConfigFromEnv} from "../config/render-flags";
import {selectTextAnimation} from "../animation/animation-retrieval-engine";
import type {BackendEnv} from "../config";

const renderConfig = resolveRenderConfigFromEnv({
  ENABLE_MILVUS_ANIMATION_RETRIEVAL: true
} as BackendEnv);

describe("AnimationRetrievalEngine", () => {
  it("calls retrieval adapter when enabled", async () => {
    const retriever = vi.fn(async () => ({id: "anim_01", family: "fade_up" as const}));
    const decision = await selectTextAnimation({
      rhetoricalIntent: "authority",
      motionIntensity: 0.8,
      typographyMode: "svg_longform_typography_v1",
      renderConfig
    }, retriever);

    expect(retriever).toHaveBeenCalledTimes(1);
    expect(decision.retrievedFromMilvus).toBe(true);
    expect(decision.retrievedAnimationId).toBe("anim_01");
    expect(decision.entryMs).toBeGreaterThan(0);
    expect(decision.holdMs).toBeGreaterThan(0);
    expect(decision.exitMs).toBeGreaterThan(0);
  });

  it("records fallback reason when retrieval is unavailable", async () => {
    const decision = await selectTextAnimation({
      rhetoricalIntent: "emphasis",
      motionIntensity: 2,
      typographyMode: "svg_longform_typography_v1",
      renderConfig
    });
    expect(decision.retrievedFromMilvus).toBe(false);
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.fallbackReasons.length).toBeGreaterThan(0);
    expect(decision.motionIntensity).toBeLessThanOrEqual(1);
    expect(decision.motionIntensity).toBeGreaterThanOrEqual(0);
  });
});
