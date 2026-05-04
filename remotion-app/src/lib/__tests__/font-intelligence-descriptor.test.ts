import {describe, expect, it} from "vitest";

import {buildFontDescriptorText, buildFontHeuristicProfile} from "../font-intelligence/descriptor";
import type {FontObservedMetadata} from "../font-intelligence/types";

describe("font descriptor generation", () => {
  it("builds editorial descriptors from observed metadata", () => {
    const observed: FontObservedMetadata = {
      sourceFilename: "cinzel.zip",
      sourceZipPath: "C:/repo/FONTS/cinzel.zip",
      extractedRelativePath: "cinzel/Cinzel-Bold.otf",
      extractedAbsolutePath: "C:/repo/font-intelligence/extracted-fonts/cinzel/Cinzel-Bold.otf",
      filename: "Cinzel-Bold.otf",
      extension: ".otf",
      postscriptName: "Cinzel-Bold",
      familyName: "Cinzel",
      subfamilyName: "Bold",
      fullName: "Cinzel Bold",
      weightClass: 700,
      widthClass: 5,
      italic: false,
      glyphCount: 420,
      unicodeRanges: ["Basic Latin", "Latin-1 Supplement", "Greek and Coptic"],
      ascent: 900,
      descent: -220,
      capHeight: 700,
      xHeight: 420,
      licenseTexts: ["Open Font License"],
      variationAxes: []
    };

    const inferred = buildFontHeuristicProfile(observed);
    const descriptor = buildFontDescriptorText({observed, inferred});

    expect(inferred.roles.length).toBeGreaterThan(0);
    expect(inferred.personality.length).toBeGreaterThan(0);
    expect(descriptor).toContain("Font: Cinzel Bold.");
    expect(descriptor).toContain("Pairing guidance:");
  });
});
