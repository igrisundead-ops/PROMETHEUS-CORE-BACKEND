import {describe, expect, it} from "vitest";

import {
  getDefaultCaptionProfileIdForPresentationMode,
  getDefaultVideoAssetForPresentationMode,
  getPresentationPreset
} from "../presentation-presets";

describe("presentation presets", () => {
  it("defaults long-form presets to the EVE typography engine", () => {
    const preset = getPresentationPreset("long-form");

    expect(getDefaultCaptionProfileIdForPresentationMode("long-form")).toBe("longform_eve_typography_v1");
    expect(preset.presentationMode).toBe("long-form");
    expect(preset.captionProfileId).toBe("longform_eve_typography_v1");
    expect(preset.videoAsset).toBe(getDefaultVideoAssetForPresentationMode("long-form"));
  });
});
