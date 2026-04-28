import {describe, expect, it} from "vitest";

import {
  getNextPreviewFrameGuardState,
  isFrameRangeInsidePreviewWindow,
  shouldWindowPreviewCues
} from "../preview-runtime-stability";

describe("preview runtime stability", () => {
  it("holds small backward frame regressions instead of rewinding the stable frame", () => {
    const initial = getNextPreviewFrameGuardState({
      rawFrame: 120,
      previousState: null
    });
    const held = getNextPreviewFrameGuardState({
      rawFrame: 113,
      previousState: initial.state
    });

    expect(held.heldRegression).toBe(true);
    expect(held.reset).toBe(false);
    expect(held.state.stableFrame).toBe(120);
  });

  it("treats large backward jumps as intentional seeks and resets stability", () => {
    const initial = getNextPreviewFrameGuardState({
      rawFrame: 240,
      previousState: null
    });
    const reset = getNextPreviewFrameGuardState({
      rawFrame: 0,
      previousState: initial.state
    });

    expect(reset.heldRegression).toBe(false);
    expect(reset.reset).toBe(true);
    expect(reset.state.stableFrame).toBe(0);
  });

  it("enables cue windowing for long videos or dense cue stacks", () => {
    expect(shouldWindowPreviewCues({
      durationInFrames: 9000,
      fps: 30,
      cueCount: 8
    })).toBe(true);
    expect(shouldWindowPreviewCues({
      durationInFrames: 1200,
      fps: 30,
      cueCount: 30
    })).toBe(true);
    expect(shouldWindowPreviewCues({
      durationInFrames: 1200,
      fps: 30,
      cueCount: 6
    })).toBe(false);
  });

  it("keeps only nearby cue ranges inside the preview mount window", () => {
    expect(isFrameRangeInsidePreviewWindow({
      currentFrame: 1800,
      startFrame: 1500,
      endFrame: 1860
    })).toBe(true);
    expect(isFrameRangeInsidePreviewWindow({
      currentFrame: 1800,
      startFrame: 3600,
      endFrame: 3660
    })).toBe(false);
  });
});
