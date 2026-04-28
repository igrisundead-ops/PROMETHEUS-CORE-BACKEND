import {afterEach, describe, expect, it} from "vitest";

import {clearCachedEnv} from "../env";
import {buildPreviewCaptionChunks} from "../preview-caption-data";
import {buildCreativePreviewCaptionChunks} from "../../creative-orchestration/preview";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-001",
  text: partial.text ?? "The biggest mistake creators make is this.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1600,
  words:
    partial.words ??
    [
      {text: "The", startMs: 0, endMs: 120},
      {text: "biggest", startMs: 120, endMs: 340},
      {text: "mistake", startMs: 340, endMs: 620},
      {text: "creators", startMs: 620, endMs: 980},
      {text: "make", startMs: 980, endMs: 1200},
      {text: "is", startMs: 1200, endMs: 1320},
      {text: "this", startMs: 1320, endMs: 1600}
    ],
  styleKey: partial.styleKey ?? "tall_generic_default",
  motionKey: partial.motionKey ?? "generic_single_word",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [1, 2, 6],
  profileId: partial.profileId ?? "slcp",
  semantic:
    partial.semantic ?? {
      intent: "punch-emphasis",
      nameSpans: [],
      isVariation: false,
      suppressDefault: false
    },
  suppressDefault: partial.suppressDefault ?? false
});

afterEach(() => {
  delete process.env.CREATIVE_ORCHESTRATION_V1;
  clearCachedEnv();
});

describe("preview caption data", () => {
  it("builds profile-specific caption chunks for the supported profiles", () => {
    const slcpChunks = buildPreviewCaptionChunks("slcp");
    const hormoziChunks = buildPreviewCaptionChunks("hormozi_word_lock_v1");
    const svgChunks = buildPreviewCaptionChunks("svg_typography_v1");
    const longformChunks = buildPreviewCaptionChunks("longform_svg_typography_v1", "long-form");

    expect(slcpChunks.length).toBeGreaterThan(0);
    expect(hormoziChunks.length).toBeGreaterThan(0);
    expect(svgChunks.length).toBeGreaterThan(0);
    expect(longformChunks.length).toBeGreaterThan(0);

    expect(slcpChunks[0]?.profileId).toBe("slcp");
    expect(hormoziChunks[0]?.profileId).toBe("hormozi_word_lock_v1");
    expect(svgChunks[0]?.profileId).toBe("svg_typography_v1");
    expect(longformChunks[0]?.profileId).toBe("longform_svg_typography_v1");

    expect(hormoziChunks[0]?.styleKey).toBe("hormozi_word_lock_base");
    expect(svgChunks.some((chunk) => chunk.styleKey.startsWith("svg_typography_v1:"))).toBe(true);
    expect(longformChunks[0]?.text).not.toBe(slcpChunks[0]?.text);
    expect((longformChunks[0]?.words.length ?? 0)).toBeGreaterThan(slcpChunks[0]?.words.length ?? 0);
  });

  it("switches to creative orchestration when the feature flag is enabled", () => {
    process.env.CREATIVE_ORCHESTRATION_V1 = "true";
    clearCachedEnv();
    const creativeChunks = buildCreativePreviewCaptionChunks([
      makeChunk({id: "chunk-001"}),
      makeChunk({id: "chunk-002", text: "We need better systems.", startMs: 1700, endMs: 2500})
    ], {
      profileId: "svg_typography_v1",
      presentationMode: "reel"
    });

    expect(creativeChunks.length).toBeGreaterThan(0);
    const rerouted = creativeChunks.some((chunk, index) => {
      void index;
      return chunk.profileId !== "slcp" || chunk.styleKey !== "tall_generic_default";
    });
    expect(rerouted).toBe(true);
  });
});
