import {describe, expect, it} from "vitest";

import {gradeProfiles} from "../motion-platform/grade-profiles";
import {buildMotionCompositionCombatPlan} from "../motion-platform/composition-combat-planner";
import type {CaptionChunk, MotionAssetManifest} from "../types";

const buildWords = (text: string, startMs: number, endMs: number): CaptionChunk["words"] => {
  const tokens = text.split(/\s+/).filter(Boolean);
  const step = (endMs - startMs) / Math.max(1, tokens.length);
  return tokens.map((word, index) => ({
    text: word,
    startMs: Math.round(startMs + step * index),
    endMs: Math.round(startMs + step * (index + 1))
  }));
};

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "If you look at your edits",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1400,
  words: partial.words ?? buildWords(partial.text ?? "If you look at your edits", partial.startMs ?? 0, partial.endMs ?? 1400),
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [5],
  profileId: partial.profileId ?? "svg_typography_v1",
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

const primaryAsset: MotionAssetManifest = {
  id: "hero-quote-panel",
  family: "foreground-element",
  tier: "premium",
  src: "motion-assets/hero-quote-panel.svg",
  alphaMode: "straight",
  placementZone: "foreground-cross",
  durationPolicy: "scene-span",
  themeTags: ["authority", "heroic"],
  searchTerms: ["hero", "quote", "primary"],
  semanticTags: ["hero", "headline", "primary"],
  subjectTags: ["quote"],
  functionalTags: ["focus", "accent"],
  visualWeight: 0.94,
  safeArea: "avoid-caption-region",
  loopable: true,
  blendMode: "screen",
  opacity: 0.92,
  assetRole: "showcase"
};

const supportAsset: MotionAssetManifest = {
  id: "underline-support",
  family: "panel",
  tier: "premium",
  src: "motion-assets/underline-support.svg",
  alphaMode: "straight",
  placementZone: "lower-third",
  durationPolicy: "scene-span",
  themeTags: ["cool"],
  searchTerms: ["underline", "support"],
  semanticTags: ["underline", "highlight"],
  subjectTags: ["text"],
  functionalTags: ["underline", "support", "highlight"],
  visualWeight: 0.58,
  safeArea: "avoid-caption-region",
  loopable: true,
  blendMode: "screen",
  opacity: 0.9
};

const utilityAsset: MotionAssetManifest = {
  id: "soft-grain-bed",
  family: "texture",
  tier: "premium",
  src: "motion-assets/soft-grain-bed.svg",
  alphaMode: "straight",
  placementZone: "background-depth",
  durationPolicy: "scene-span",
  themeTags: ["neutral", "calm"],
  searchTerms: ["texture", "grain", "background"],
  semanticTags: ["background", "depth"],
  subjectTags: ["ambient"],
  functionalTags: ["background", "blur", "wash"],
  visualWeight: 0.32,
  safeArea: "full-frame",
  loopable: true,
  blendMode: "overlay",
  opacity: 0.72
};

describe("composition combat planner", () => {
  it("classifies hierarchy and dedupes the assembled element battlefield", () => {
    const chunk = makeChunk({
      text: "If you look at your edits",
      words: buildWords("If you look at your edits", 0, 1400)
    });

    const plan = buildMotionCompositionCombatPlan({
      chunks: [chunk],
      tier: "premium",
      gradeProfile: gradeProfiles["premium-contrast"],
      captionProfileId: "svg_typography_v1",
      motionAssets: [primaryAsset, supportAsset, utilityAsset]
    });

    expect(plan.validity.hasPrimary).toBe(true);
    expect(plan.validity.hasSupport).toBe(true);
    expect(plan.validity.hasUtility).toBe(true);
    expect(plan.primaryAttackers.some((element) => element.assetId === primaryAsset.id)).toBe(true);
    expect(plan.supporters.some((element) => element.assetId === supportAsset.id)).toBe(true);
    expect(plan.utilities.some((element) => element.assetId === utilityAsset.id)).toBe(true);
    expect(plan.roleCounts["primary-attacker"]).toBeGreaterThanOrEqual(1);
    expect(plan.roleCounts.support).toBeGreaterThanOrEqual(1);
    expect(plan.synergyScore).toBeGreaterThan(0.5);
    expect(plan.chunkPlans[0]?.keywordPhrases.length ?? 0).toBeGreaterThan(0);
    expect(new Set(plan.elements.map((element) => element.id)).size).toBe(plan.elements.length);
  });
});
