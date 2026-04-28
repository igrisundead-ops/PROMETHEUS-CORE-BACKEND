import {describe, expect, it} from "vitest";

import {
  getThreeWordContrastRole,
  getThreeWordLayoutClassName,
  getThreeWordPartClassName
} from "../../components/CinematicCaptionOverlay";
import {routeStyleForWords} from "../style-routing";

describe("overlay layout classes", () => {
  it("builds three-word layout class using routed layout variant", () => {
    const routed = routeStyleForWords(["Build", "Legacy", "Now"]);
    const className = getThreeWordLayoutClassName(routed.layoutVariant);

    expect(className.startsWith("dg-three-layout layout-")).toBe(true);
    expect(className).toBe(`dg-three-layout layout-${routed.layoutVariant}`);
  });

  it("maps three-word part classes to part-a/part-b/part-c", () => {
    expect(getThreeWordPartClassName(0)).toBe("dg-three-part part-a");
    expect(getThreeWordPartClassName(1)).toBe("dg-three-part part-b");
    expect(getThreeWordPartClassName(2)).toBe("dg-three-part part-c");
    expect(getThreeWordPartClassName(4)).toBe("dg-three-part part-c");
  });

  it("keeps inline three-word layouts flat without contrast roles", () => {
    expect(getThreeWordContrastRole("inline", 0)).toBeNull();
    expect(getThreeWordContrastRole("inline", 1)).toBeNull();
    expect(getThreeWordContrastRole("dream-big-now", 0)).toBe("secondary");
    expect(getThreeWordContrastRole("dream-big-now", 1)).toBe("primary");
    expect(getThreeWordContrastRole("take-action-now", 2)).toBe("secondary");
  });
});
