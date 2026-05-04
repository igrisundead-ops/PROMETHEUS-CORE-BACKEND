import {describe, expect, it} from "vitest";

import {selectRuntimeFontSelection} from "../cinematic-typography/runtime-font-selector";

describe("runtime font selector", () => {
  it("chooses the hero alternate runtime lane for short high-intensity statements", () => {
    const selection = selectRuntimeFontSelection({
      typographyRole: "hook",
      contentEnergy: "high",
      patternMood: "trailer",
      targetMoods: ["trailer", "luxury", "editorial"],
      patternUnit: "phrase",
      wordCount: 3,
      emphasisCount: 2,
      mode: "keyword-only",
      surfaceTone: "dark",
      motionTier: "hero",
      semanticIntent: "punch-emphasis",
      presentationMode: "reel"
    });

    expect(selection.requestedRoleId).toBe("hero_serif_alternate");
    expect(selection.selectedRoleId).toBe("hero_serif_alternate");
    expect(selection.fontCandidateId).toBe("noto-serif-display");
    expect(selection.fontPaletteId).toBe("noto-display");
  });

  it("chooses the documentary challenger for quieter support-serifs when the mood is documentary", () => {
    const selection = selectRuntimeFontSelection({
      typographyRole: "quote",
      contentEnergy: "low",
      patternMood: "documentary",
      targetMoods: ["documentary", "emotional", "luxury"],
      patternUnit: "line",
      wordCount: 7,
      emphasisCount: 1,
      mode: "escalated",
      surfaceTone: "light",
      motionTier: "editorial",
      semanticIntent: "default",
      presentationMode: "long-form"
    });

    expect(selection.selectedRoleId).toBe("editorial_serif_support");
    expect(selection.fontCandidateId).toBe("crimson-pro");
    expect(selection.fontPaletteId).toBe("crimson-voice");
  });

  it("falls back out of pressure-release role until a runtime face exists for that lane", () => {
    const selection = selectRuntimeFontSelection({
      typographyRole: "keyword",
      contentEnergy: "high",
      patternMood: "aggressive",
      targetMoods: ["aggressive", "trailer", "dramatic"],
      patternUnit: "letter",
      wordCount: 2,
      emphasisCount: 1,
      mode: "keyword-only",
      surfaceTone: "dark",
      motionTier: "hero",
      semanticIntent: "punch-emphasis",
      presentationMode: "reel"
    });

    expect(selection.requestedRoleId).toBe("display_sans_pressure_release");
    expect(selection.selectedRoleId).toBe("neutral_sans_core");
    expect(selection.fontCandidateId).toBe("dm-sans");
    expect(selection.rationale).toContain("pressure-release-runtime-face-missing");
  });
});
