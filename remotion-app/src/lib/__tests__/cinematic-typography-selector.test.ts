import {describe, expect, it} from "vitest";

import {buildCinematicCaptionPlans} from "../cinematic-typography/selector";
import {getEditorialFontPalette} from "../cinematic-typography/font-runtime-registry";
import type {CaptionEditorialDecision} from "../motion-platform/caption-editorial-engine";
import type {CaptionChunk} from "../types";

const makeChunk = ({
  id,
  text,
  startMs,
  endMs,
  emphasisWordIndices = [],
  semanticIntent = "default"
}: {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  emphasisWordIndices?: number[];
  semanticIntent?: "default" | "name-callout" | "punch-emphasis";
}): CaptionChunk => {
  const words = text.split(/\s+/).map((word, index, all) => {
    const duration = Math.max(120, Math.floor((endMs - startMs) / Math.max(1, all.length)));
    const wordStartMs = startMs + index * duration;
    return {
      text: word,
      startMs: wordStartMs,
      endMs: wordStartMs + duration - 1
    };
  });

  return {
    id,
    text,
    startMs,
    endMs,
    words,
    styleKey: "legacy-non-svg",
    motionKey: "legacy-non-svg",
    layoutVariant: "inline",
    emphasisWordIndices,
    semantic: {
      intent: semanticIntent,
      nameSpans: [],
      isVariation: false,
      suppressDefault: false
    }
  };
};

const makeEditorialDecision = ({
  role = "subtitle",
  mood = "cinematic",
  contentEnergy = "medium",
  speechPacing = "medium",
  targetMoods = [mood],
  mode = "normal"
}: {
  role?: string;
  mood?: string;
  contentEnergy?: "low" | "medium" | "high";
  speechPacing?: "slow" | "medium" | "fast";
  targetMoods?: string[];
  mode?: "normal" | "escalated" | "keyword-only";
} = {}): CaptionEditorialDecision => {
  return {
    mode,
    surfaceTone: "dark",
    textColor: "rgba(255,255,255,0.98)",
    textShadow: "0 4px 14px rgba(0,0,0,0.56)",
    textStroke: "0.6px rgba(255,255,255,0.42)",
    fontFamily: "\"Fraunces\", serif",
    fontWeight: 600,
    fontSizeScale: 1,
    uppercaseBias: false,
    letterSpacing: "-0.01em",
    keywordPhrases: [],
    keywordAnimation: "fade",
    assetBias: "semantic",
    backgroundScaleCap: 1.02,
    rationale: [],
    cssVariables: {},
    typography: {
      role: role as never,
      contentEnergy,
      speechPacing,
      preferredUnit: "word",
      targetMoods: targetMoods as never,
      pattern: {
        id: "test-pattern",
        unit: "word",
        mood: mood as never,
        entry: {},
        duration: 0.6,
        easing: "ease-out",
        useCase: "test",
        styling: {
          preferredFontWeight: 600,
          preferredCase: "sentence",
          shadowStyle: "soft-bloom",
          glowStyle: "none",
          backgroundFit: "dark-video",
          pacingFit: "medium",
          emphasisFit: "subtitle"
        }
      },
      styling: {
        preferredFontWeight: 600,
        preferredCase: "sentence",
        shadowStyle: "soft-bloom",
        glowStyle: "none",
        backgroundFit: "dark-video",
        pacingFit: "medium",
        emphasisFit: "subtitle"
      },
      reasoning: [],
      readabilitySafeguards: []
    },
    fontSelection: {
      requestedRoleId: "editorial_serif_support",
      selectedRoleId: "editorial_serif_support",
      fontCandidateId: "fraunces",
      fontPaletteId: "fraunces-editorial",
      palette: getEditorialFontPalette("fraunces-editorial"),
      intensityBand: "medium",
      motionDemand: "medium",
      rationale: []
    }
  } as unknown as CaptionEditorialDecision;
};

describe("cinematic typography selector", () => {
  it("suppresses direct treatment repetition across similar chunks", () => {
    const chunks = [
      makeChunk({id: "c1", text: "Build a calmer system", startMs: 0, endMs: 1200}),
      makeChunk({id: "c2", text: "Build a calmer system", startMs: 1280, endMs: 2480}),
      makeChunk({id: "c3", text: "Build a calmer system", startMs: 2560, endMs: 3760})
    ];
    const decisions = chunks.map(() => makeEditorialDecision({
      role: "subtitle",
      mood: "cinematic",
      contentEnergy: "medium",
      speechPacing: "medium"
    }));

    const plans = buildCinematicCaptionPlans({
      chunks,
      editorialDecisions: decisions,
      captionBias: "middle",
      motionTier: "premium"
    });

    expect(plans).toHaveLength(3);
    expect(plans[0]?.treatment.id).not.toBe(plans[1]?.treatment.id);
    expect(new Set(plans.map((plan) => plan.treatment.id)).size).toBeGreaterThan(1);
  });

  it("carries continuity across tightly spaced caption beats", () => {
    const chunks = [
      makeChunk({id: "c1", text: "This changes everything", startMs: 0, endMs: 1100, emphasisWordIndices: [2]}),
      makeChunk({id: "c2", text: "For the next chapter", startMs: 1160, endMs: 2300, emphasisWordIndices: [3]})
    ];
    const decisions = [
      makeEditorialDecision({
        role: "headline",
        mood: "editorial",
        contentEnergy: "medium",
        speechPacing: "medium",
        mode: "escalated"
      }),
      makeEditorialDecision({
        role: "headline",
        mood: "editorial",
        contentEnergy: "medium",
        speechPacing: "medium",
        mode: "escalated"
      })
    ];

    const plans = buildCinematicCaptionPlans({
      chunks,
      editorialDecisions: decisions,
      captionBias: "middle",
      motionTier: "premium"
    });

    expect(plans[1]?.continuity.mode).not.toBe("reset");
  });
});
