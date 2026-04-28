import {describe, expect, it} from "vitest";

import {getLongformCaptionSizing} from "../longform-caption-scale";

describe("longform caption sizing", () => {
  it("keeps compact landscape frames on a smaller caption scale", () => {
    const sizing = getLongformCaptionSizing({width: 640, height: 360});

    expect(sizing.fontSizePx).toBe(32);
    expect(sizing.maxWidthPercent).toBe(72);
    expect(sizing.guardScale).toBe(1);
  });

  it("allows larger landscape frames to scale up without overshooting", () => {
    const compact = getLongformCaptionSizing({width: 640, height: 360});
    const hd = getLongformCaptionSizing({width: 1280, height: 720});

    expect(hd.fontSizePx).toBeGreaterThan(compact.fontSizePx);
    expect(hd.fontSizePx).toBeLessThanOrEqual(66);
    expect(hd.maxWidthPercent).toBe(78);
  });

  it("shrinks dense multi-line captions to stay inside the guarded region", () => {
    const sizing = getLongformCaptionSizing({
      width: 1280,
      height: 720,
      maxLineUnits: 34,
      lineCount: 2
    });

    expect(sizing.guardScale).toBeLessThan(1);
    expect(sizing.fontSizePx).toBeLessThan(getLongformCaptionSizing({width: 1280, height: 720}).fontSizePx);
    expect(sizing.maxWidthPercent).toBeGreaterThanOrEqual(78);
  });
});
