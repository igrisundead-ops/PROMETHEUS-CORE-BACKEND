import {describe, expect, it} from "vitest";

import {
  resolveFocusedStudioCaptionCompositor,
  resolvePreviewVisualFeatureFlags
} from "../FemaleCoachDeanGraziosi";

describe("preview state hygiene", () => {
  it("disables decorative overlay systems in focused studio mode", () => {
    const flags = resolvePreviewVisualFeatureFlags({
      focusedStudioMode: true,
      previewPerformanceMode: "balanced",
      showPiPShowcase: false
    });

    expect(flags.showBackgroundOverlay).toBe(false);
    expect(flags.showMotionAssetOverlay).toBe(false);
    expect(flags.showMatteForeground).toBe(false);
    expect(flags.showShowcaseOverlay).toBe(false);
    expect(flags.showSoundDesign).toBe(false);
    expect(flags.showTypographyBiasOverlay).toBe(false);
    expect(flags.showTransitionOverlay).toBe(false);
  });

  it("keeps the normal overlay stack available outside focused studio mode", () => {
    const flags = resolvePreviewVisualFeatureFlags({
      focusedStudioMode: false,
      previewPerformanceMode: "full",
      showPiPShowcase: false
    });

    expect(flags.showBackgroundOverlay).toBe(true);
    expect(flags.showMotionAssetOverlay).toBe(true);
    expect(flags.showMatteForeground).toBe(true);
    expect(flags.showShowcaseOverlay).toBe(true);
    expect(flags.showSoundDesign).toBe(true);
    expect(flags.showTypographyBiasOverlay).toBe(true);
    expect(flags.showTransitionOverlay).toBe(true);
  });

  it("keeps the dev fixture on a single longform word-by-word caption owner", () => {
    expect(resolveFocusedStudioCaptionCompositor({
      focusedStudioMode: true,
      presentationMode: "long-form",
      hideCaptionOverlays: false
    })).toBe("longform-word-by-word");

    expect(resolveFocusedStudioCaptionCompositor({
      focusedStudioMode: false,
      presentationMode: "long-form",
      hideCaptionOverlays: false
    })).toBeNull();
  });
});
