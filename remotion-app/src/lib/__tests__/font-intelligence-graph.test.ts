import {describe, expect, it} from "vitest";

import {buildFontCompatibilityGraph} from "../font-intelligence/graph";
import type {FontManifestRecord} from "../font-intelligence/types";

const buildManifestRecord = (overrides: Partial<FontManifestRecord>): FontManifestRecord => ({
  fontId: "font_default",
  familyId: "family_default",
  fileHash: "hash",
  contentHash: "hash",
  descriptorHash: "descriptor",
  status: "ok",
  metadataConfidence: "high",
  needsManualLicenseReview: false,
  canonicalSourceZip: "font.zip",
  sourceZips: ["font.zip"],
  duplicateSourceZips: [],
  duplicateCount: 0,
  observed: {
    sourceFilename: "font.zip",
    sourceZipPath: "C:/repo/FONTS/font.zip",
    extractedRelativePath: "font.otf",
    extractedAbsolutePath: "C:/repo/font.otf",
    filename: "font.otf",
    extension: ".otf",
    postscriptName: "FontPS",
    familyName: "Font Family",
    subfamilyName: "Regular",
    fullName: "Font Family Regular",
    weightClass: 400,
    widthClass: 5,
    italic: false,
    glyphCount: 420,
    unicodeRanges: ["Basic Latin", "Latin-1 Supplement", "Greek and Coptic"],
    ascent: 900,
    descent: -200,
    capHeight: 700,
    xHeight: 420,
    licenseTexts: ["Open Font License"],
    variationAxes: []
  },
  inferred: {
    classifications: ["sans"],
    primaryRole: "support",
    roles: ["support", "body", "caption"],
    personality: ["clean", "readable"],
    likelyUseCases: ["captions"],
    avoidUseCases: [],
    pairingGuidance: ["Works with expressive display."],
    motionCompatibility: ["fade-up"],
    readabilityScore: 0.82,
    expressivenessScore: 0.28,
    confidence: 0.81
  },
  descriptor: "descriptor",
  specimenPath: "specimen.html",
  metadataWarnings: [],
  metadataErrors: [],
  createdAt: "2026-05-04T00:00:00.000Z",
  updatedAt: "2026-05-04T00:00:00.000Z",
  ...overrides
});

describe("font compatibility graph", () => {
  it("builds typed directed edges with explainable scoring", () => {
    const hero = buildManifestRecord({
      fontId: "font_hero",
      familyId: "family_hero",
      inferred: {
        classifications: ["serif", "display"],
        primaryRole: "hero",
        roles: ["hero", "subtitle", "quote"],
        personality: ["editorial", "dramatic"],
        likelyUseCases: ["hero titles"],
        avoidUseCases: ["captions"],
        pairingGuidance: ["Use with neutral sans support."],
        motionCompatibility: ["blur-in"],
        readabilityScore: 0.46,
        expressivenessScore: 0.82,
        confidence: 0.74
      }
    });
    const body = buildManifestRecord({
      fontId: "font_body",
      familyId: "family_body"
    });

    const graph = buildFontCompatibilityGraph({
      fonts: [hero, body],
      topMatchesPerFont: 4
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges.some((edge) => edge.from === "font_hero" && edge.to === "font_body" && edge.pairing_type === "hero_to_body")).toBe(true);
    const edge = graph.edges.find((candidate) => candidate.from === "font_hero" && candidate.to === "font_body" && candidate.pairing_type === "hero_to_body");
    expect(edge?.breakdown.readabilitySupportBonus).toBeGreaterThan(0);
    expect(edge?.recommended_usage.length).toBeGreaterThan(0);
  });
});
