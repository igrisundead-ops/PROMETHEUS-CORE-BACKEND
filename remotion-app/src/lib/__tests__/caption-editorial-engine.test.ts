import {describe, expect, it} from "vitest";

import {buildMotionCompositionCombatPlan} from "../motion-platform/composition-combat-planner";
import {
  resolveCaptionEditorialDecision,
  resolveControlledBackgroundScale
} from "../motion-platform/caption-editorial-engine";
import {gradeProfiles} from "../motion-platform/grade-profiles";
import type {CaptionChunk, MotionAssetManifest} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Take more risk.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1200,
  words: partial.words ?? [
    {text: "Take", startMs: 0, endMs: 280},
    {text: "more", startMs: 280, endMs: 640},
    {text: "risk.", startMs: 640, endMs: 1200}
  ],
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [1, 2],
  profileId: partial.profileId ?? "svg_typography_v1",
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

const buildWords = (text: string, startMs: number, endMs: number): CaptionChunk["words"] => {
  const tokens = text.split(/\s+/).filter(Boolean);
  const step = (endMs - startMs) / Math.max(1, tokens.length);
  return tokens.map((word, index) => ({
    text: word,
    startMs: Math.round(startMs + step * index),
    endMs: Math.round(startMs + step * (index + 1))
  }));
};

const combatPrimaryAsset: MotionAssetManifest = {
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

const combatSupportAsset: MotionAssetManifest = {
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

const combatUtilityAsset: MotionAssetManifest = {
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

describe("caption editorial engine", () => {
  it("forces dark text on light surfaces and clamps background scale", () => {
    const decision = resolveCaptionEditorialDecision({
      chunk: makeChunk({text: "Whatever that decision is."}),
      surfaceToneHint: "light"
    });

    expect(decision.surfaceTone).toBe("light");
    expect(decision.textColor).toBe("rgba(18, 20, 24, 0.96)");
    expect(decision.backgroundScaleCap).toBe(1.02);
    expect(resolveControlledBackgroundScale(1.18, decision.backgroundScaleCap)).toBe(1.02);
  });

  it("escalates high-impact moments into keyword-only visuals", () => {
    const decision = resolveCaptionEditorialDecision({
      chunk: makeChunk({
        text: "Take more risk.",
        semantic: {
          intent: "punch-emphasis",
          nameSpans: [],
          isVariation: false,
          suppressDefault: false
        }
      }),
      surfaceToneHint: "dark"
    });

    expect(decision.mode).toBe("keyword-only");
    expect(decision.fontSizeScale).toBeGreaterThan(1.7);
    expect(decision.keywordAnimation).toBe("letter-by-letter");
    expect(decision.uppercaseBias).toBe(true);
    expect(decision.assetBias).toBe("structured");
    expect(decision.keywordPhrases.length).toBeGreaterThan(0);
    expect(decision.typography.role).toBe("hook");
    expect(decision.fontFamily).toContain("Playfair Display");
    expect(decision.rationale.join(" ")).toContain("typography-pattern=");
  });

  it("uses the combat plan to bias keyword filtration and editorial rationale", () => {
    const chunk = makeChunk({
      text: "We keep the layout consistent and readable",
      words: buildWords("We keep the layout consistent and readable", 0, 1600)
    });
    const combatPlan = buildMotionCompositionCombatPlan({
      chunks: [chunk],
      tier: "premium",
      gradeProfile: gradeProfiles["premium-contrast"],
      captionProfileId: "svg_typography_v1",
      motionAssets: [combatPrimaryAsset, combatSupportAsset, combatUtilityAsset]
    });
    const decision = resolveCaptionEditorialDecision({
      chunk,
      surfaceToneHint: "dark",
      compositionCombatPlan: combatPlan
    });
    const combatPrimaryLabel = combatPlan.chunkPlans[0]?.primary?.label ?? "";

    expect(combatPrimaryLabel.length).toBeGreaterThan(0);
    expect(decision.keywordPhrases[0]?.toLowerCase()).toBe(combatPrimaryLabel.toLowerCase());
    expect(decision.rationale.join(" ")).toContain("combat-synergy=");
    expect(decision.rationale.join(" ")).toContain("combat-primary=");
    expect(decision.typography.pattern.id.length).toBeGreaterThan(0);
    expect(decision.typography.readabilitySafeguards.length).toBeGreaterThan(0);
  });
});
