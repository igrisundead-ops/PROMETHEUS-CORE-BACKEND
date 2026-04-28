import {describe, expect, it} from "vitest";

import {
  createTargetFocusCue,
  resolveTargetFocusState,
  selectActiveTargetFocusCueAtTime
} from "../motion-platform/target-focus-engine";

describe("target focus engine", () => {
  it("selects the latest started cue and loops it back to normal scale", () => {
    const cueA = createTargetFocusCue({
      id: "cue-a",
      target: {id: "headline"},
      targetBox: {left: 100, top: 120, width: 420, height: 150},
      startMs: 0,
      timing: {
        delayMs: 0,
        focusMs: 400,
        holdMs: 240,
        returnMs: 420,
        loop: true,
        loopDelayMs: 180,
        easeIn: "power3.out",
        easeOut: "sine.inOut"
      }
    });
    const cueB = createTargetFocusCue({
      id: "cue-b",
      target: {tag: "meta-row"},
      targetBox: {left: 180, top: 540, width: 280, height: 96},
      startMs: 1200,
      timing: {
        delayMs: 0,
        focusMs: 300,
        holdMs: 160,
        returnMs: 260,
        loop: true,
        loopDelayMs: 120,
        easeIn: "power2.out",
        easeOut: "sine.inOut"
      }
    });

    expect(selectActiveTargetFocusCueAtTime([cueA, cueB], 300)).toBe(cueA);
    expect(selectActiveTargetFocusCueAtTime([cueA, cueB], 1600)).toBe(cueB);

    const focused = resolveTargetFocusState({
      cue: cueA,
      currentTimeMs: 180,
      viewportWidth: 1080,
      viewportHeight: 1920
    });
    expect(focused.active).toBe(true);
    expect(focused.phase).toBe("focus-in");
    expect(focused.scale).toBeGreaterThan(1);
    expect(focused.translateX).not.toBe(0);
    expect(focused.translateY).not.toBe(0);
    expect(focused.vignetteOpacity).toBeGreaterThan(0);

    const reset = resolveTargetFocusState({
      cue: cueA,
      currentTimeMs: 1100,
      viewportWidth: 1080,
      viewportHeight: 1920
    });
    expect(reset.active).toBe(false);
    expect(reset.phase).toBe("idle");
    expect(reset.scale).toBe(1);
  });
});
