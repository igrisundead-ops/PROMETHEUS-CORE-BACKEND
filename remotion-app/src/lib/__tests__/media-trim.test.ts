import {describe, expect, it} from "vitest";

import {
  buildDeterministicMediaTrimWindow,
  hasValidMediaTrimWindow
} from "../motion-platform/media-trim";

describe("media trim helper", () => {
  it("creates a valid absolute trim window for Remotion media props", () => {
    const trimWindow = buildDeterministicMediaTrimWindow({
      totalFrames: 240,
      desiredFrames: 72,
      seed: "alpha"
    });

    expect(trimWindow.trimBeforeFrames).toBeGreaterThanOrEqual(0);
    expect(trimWindow.trimAfterFrames).toBeGreaterThan(trimWindow.trimBeforeFrames);
    expect(trimWindow.trimAfterFrames).toBeLessThanOrEqual(trimWindow.totalFrames);
    expect(trimWindow.playFrames).toBe(trimWindow.trimAfterFrames - trimWindow.trimBeforeFrames);
    expect(hasValidMediaTrimWindow(trimWindow)).toBe(true);
  });

  it("uses the full source when the requested duration is longer than the media", () => {
    const trimWindow = buildDeterministicMediaTrimWindow({
      totalFrames: 36,
      desiredFrames: 200,
      seed: "beta"
    });

    expect(trimWindow.trimBeforeFrames).toBe(0);
    expect(trimWindow.trimAfterFrames).toBe(36);
    expect(trimWindow.playFrames).toBe(36);
  });
});
