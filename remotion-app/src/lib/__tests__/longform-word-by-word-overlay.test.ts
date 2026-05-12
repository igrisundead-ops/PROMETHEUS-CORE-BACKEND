import React from "react";
import {describe, expect, it, vi} from "vitest";

vi.mock("remotion", () => ({
  AbsoluteFill: ({children, ...props}: {children?: React.ReactNode}) => React.createElement("div", props, children),
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({
    fps: 30,
    width: 1920,
    height: 1080
  })
}));

import {getWordStyle} from "../../components/LongformWordByWordOverlay";
import {getEditorialFontPalette} from "../cinematic-typography/font-runtime-registry";
import type {CaptionEditorialDecision} from "../motion-platform/caption-editorial-engine";
import type {CaptionChunk} from "../types";

const makeEditorialDecision = (): CaptionEditorialDecision => ({
  mode: "normal",
  surfaceTone: "dark",
  textColor: "rgba(255,255,255,0.98)",
  textShadow: "0 4px 14px rgba(0,0,0,0.56)",
  textStroke: "0.6px rgba(255,255,255,0.42)",
  fontFamily: getEditorialFontPalette("fraunces-editorial").runtimeFontStack,
  fontWeight: 650,
  fontSizeScale: 1,
  opacityMultiplier: 1,
  uppercaseBias: false,
  letterSpacing: "-0.016em",
  keywordPhrases: [],
  keywordAnimation: "fade",
  assetBias: "semantic",
  backgroundScaleCap: 1.02,
  rationale: [],
  cssVariables: {},
  typography: {
    role: "headline",
    contentEnergy: "medium",
    speechPacing: "medium",
    preferredUnit: "word",
    targetMoods: ["editorial"],
    pattern: {
      id: "test-pattern",
      unit: "word",
      mood: "editorial",
      entry: {},
      duration: 0.6,
      easing: "ease-out",
      useCase: "test",
      styling: {
        preferredFontWeight: 650,
        preferredCase: "sentence",
        shadowStyle: "soft-bloom",
        glowStyle: "none",
        backgroundFit: "dark-video",
        pacingFit: "medium",
        emphasisFit: "headline"
      }
    },
    styling: {
      preferredFontWeight: 650,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "headline"
    },
    reasoning: [],
    readabilitySafeguards: []
  },
  lineStyles: {},
  hierarchyMetadata: {
    lines: [],
    aggressionLevel: 0,
    emotionalWeight: 0,
    tokens: []
  },
  motionProfile: {
    easing: "ease-out",
    snapDurationMs: 180,
    axis: "y"
  },
  visualOrchestration: {} as CaptionEditorialDecision["visualOrchestration"],
  stylePhysics: {
    motion: {
      blurRelease: 0
    }
  } as CaptionEditorialDecision["stylePhysics"],
  timelineRhythm: {} as CaptionEditorialDecision["timelineRhythm"],
  fontSelection: {
    requestedRoleId: "hero_serif_alternate",
    selectedRoleId: "hero_serif_alternate",
    fontCandidateId: "noto-serif-display",
    fontPaletteId: "noto-display",
    palette: getEditorialFontPalette("noto-display"),
    intensityBand: "high",
    motionDemand: "high",
    rationale: []
  }
});

const makeChunk = (emphasisWordIndices: number[] | undefined): CaptionChunk => ({
  id: "chunk-1",
  text: "Build stronger captions",
  startMs: 0,
  endMs: 1800,
  words: [
    {text: "Build", startMs: 0, endMs: 550},
    {text: "stronger", startMs: 550, endMs: 1100},
    {text: "captions", startMs: 1100, endMs: 1800}
  ],
  styleKey: "legacy-non-svg",
  motionKey: "legacy-non-svg",
  layoutVariant: "inline",
  emphasisWordIndices: emphasisWordIndices ?? [],
  semantic: {
    intent: "punch-emphasis",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  }
});

const getScale = (style: React.CSSProperties): number => {
  const match = String(style.transform).match(/scale\(([0-9.]+)\)/);
  return match ? Number.parseFloat(match[1]) : 1;
};

describe("LongformWordByWordOverlay word hierarchy", () => {
  it("gives emphasized words more visual weight than context words", () => {
    const editorialDecision = makeEditorialDecision();
    const chunk = makeChunk([1]);

    const contextStyle = getWordStyle({
      word: chunk.words[0]!,
      previousWord: undefined,
      nextWord: chunk.words[1],
      wordIndex: 0,
      chunkWordCount: chunk.words.length,
      chunk,
      currentTimeMs: 300,
      editorialDecision
    });
    const emphasizedStyle = getWordStyle({
      word: chunk.words[1]!,
      previousWord: chunk.words[0],
      nextWord: chunk.words[2],
      wordIndex: 1,
      chunkWordCount: chunk.words.length,
      chunk,
      currentTimeMs: 850,
      editorialDecision
    });

    expect(getScale(emphasizedStyle)).toBeGreaterThan(getScale(contextStyle));
    expect(Number(emphasizedStyle.opacity)).toBeGreaterThan(Number(contextStyle.opacity));
  });

  it("does not globally mute or shrink words when no emphasis indices exist", () => {
    const editorialDecision = makeEditorialDecision();
    const baselineChunk = makeChunk([]);
    const missingHierarchyChunk = makeChunk(undefined);

    const baselineStyle = getWordStyle({
      word: baselineChunk.words[0]!,
      previousWord: undefined,
      nextWord: baselineChunk.words[1],
      wordIndex: 0,
      chunkWordCount: baselineChunk.words.length,
      chunk: baselineChunk,
      currentTimeMs: 300,
      editorialDecision
    });
    const missingHierarchyStyle = getWordStyle({
      word: missingHierarchyChunk.words[0]!,
      previousWord: undefined,
      nextWord: missingHierarchyChunk.words[1],
      wordIndex: 0,
      chunkWordCount: missingHierarchyChunk.words.length,
      chunk: {
        ...missingHierarchyChunk,
        emphasisWordIndices: undefined as unknown as number[]
      },
      currentTimeMs: 300,
      editorialDecision
    });

    expect(missingHierarchyStyle.opacity).toBe(baselineStyle.opacity);
    expect(missingHierarchyStyle.transform).toBe(baselineStyle.transform);
  });
});
