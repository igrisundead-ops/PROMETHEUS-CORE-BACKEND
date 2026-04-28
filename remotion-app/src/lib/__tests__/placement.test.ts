import {describe, expect, it} from "vitest";

import {getCaptionContainerStyle, longformCaptionSafeZone, upperSafeZone} from "../caption-layout";

describe("caption placement", () => {
  it("matches locked legacy stage placement geometry", () => {
    const style = getCaptionContainerStyle(upperSafeZone);
    const top = Number(style.top.replace("%", ""));
    const left = Number(style.left.replace("%", ""));
    const width = Number(style.width.replace("%", ""));
    const height = Number(style.height.replace("%", ""));

    expect(top).toBe(24);
    expect(left).toBe(8);
    expect(width).toBe(84);
    expect(height).toBe(34);
  });

  it("nudges the caption block for top middle and bottom bias without leaving the safe zone", () => {
    const topStyle = getCaptionContainerStyle(upperSafeZone, "top");
    const middleStyle = getCaptionContainerStyle(upperSafeZone, "middle");
    const bottomStyle = getCaptionContainerStyle(upperSafeZone, "bottom");

    const topTop = Number(topStyle.top.replace("%", ""));
    const middleTop = Number(middleStyle.top.replace("%", ""));
    const bottomTop = Number(bottomStyle.top.replace("%", ""));
    const topHeight = Number(topStyle.height.replace("%", ""));
    const middleHeight = Number(middleStyle.height.replace("%", ""));
    const bottomHeight = Number(bottomStyle.height.replace("%", ""));

    expect(topTop).toBeLessThan(middleTop);
    expect(bottomTop).toBeGreaterThan(middleTop);
    expect(topHeight).toBeGreaterThan(0);
    expect(middleHeight).toBeGreaterThan(0);
    expect(bottomHeight).toBeGreaterThan(0);
    expect(topTop + topHeight).toBeLessThanOrEqual(100);
    expect(bottomTop + bottomHeight).toBeLessThanOrEqual(100);
  });

  it("keeps the longform safe zone lower than the legacy upper zone", () => {
    const legacyBottomTop = Number(getCaptionContainerStyle(upperSafeZone, "bottom").top.replace("%", ""));
    const longformBottomTop = Number(getCaptionContainerStyle(longformCaptionSafeZone, "bottom").top.replace("%", ""));

    expect(longformBottomTop).toBeGreaterThan(legacyBottomTop);
  });
});
