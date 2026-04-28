import {describe, expect, it} from "vitest";

import type {CaptionChunk} from "../types";
import {
  PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT,
  resolvePreviewSubtitleAnimationMode,
  resolvePreviewSubtitleSafeZone
} from "../../web-preview/preview-subtitle-system";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1600,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "style",
  motionKey: partial.motionKey ?? "motion",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? []
});

describe("preview subtitle system", () => {
  it("prefers phrase stagger reveals for fast connected chunks", () => {
    const chunk = makeChunk({
      text: "Whatever scares you the most right now",
      endMs: 1800,
      words: [
        {text: "Whatever", startMs: 0, endMs: 220},
        {text: "scares", startMs: 240, endMs: 430},
        {text: "you", startMs: 450, endMs: 560},
        {text: "the", startMs: 580, endMs: 660},
        {text: "most", startMs: 680, endMs: 860},
        {text: "right", startMs: 880, endMs: 1060},
        {text: "now", startMs: 1080, endMs: 1320}
      ],
      emphasisWordIndices: [1, 4]
    });

    expect(resolvePreviewSubtitleAnimationMode({chunk})).toBe("phrase_stagger_reveal");
  });

  it("uses word emphasis reveal sparingly for short emphatic chunks", () => {
    const chunk = makeChunk({
      text: "I want you",
      endMs: 1700,
      words: [
        {text: "I", startMs: 0, endMs: 180},
        {text: "want", startMs: 260, endMs: 640},
        {text: "you", startMs: 760, endMs: 1200}
      ],
      emphasisWordIndices: [1]
    });

    expect(resolvePreviewSubtitleAnimationMode({chunk})).toBe("word_emphasis_reveal");
  });

  it("falls back to phrase block reveal for calmer short phrases", () => {
    const chunk = makeChunk({
      text: "A few things",
      endMs: 2100,
      words: [
        {text: "A", startMs: 0, endMs: 180},
        {text: "few", startMs: 340, endMs: 690},
        {text: "things", startMs: 860, endMs: 1400}
      ]
    });

    expect(resolvePreviewSubtitleAnimationMode({chunk})).toBe("phrase_block_reveal");
  });

  it("keeps the subtitle safe zone inside the landscape frame and scales dense phrases down", () => {
    const relaxed = resolvePreviewSubtitleSafeZone({
      width: 1920,
      height: 1080,
      maxLineUnits: 18,
      lineCount: 1,
      previewViewportScale: 1,
      captionBias: "bottom"
    });
    const dense = resolvePreviewSubtitleSafeZone({
      width: 1920,
      height: 1080,
      maxLineUnits: 34,
      lineCount: 2,
      previewViewportScale: 1,
      captionBias: "bottom"
    });

    expect(relaxed.leftPercent).toBeGreaterThanOrEqual(9);
    expect(relaxed.bottomPercent).toBeGreaterThan(0);
    expect(relaxed.maxWidthPercent).toBeLessThanOrEqual(PREVIEW_SUBTITLE_MAX_WIDTH_PERCENT);
    expect(dense.fontSizePx).toBeLessThan(relaxed.fontSizePx);
    expect(dense.lineGapEm).toBeGreaterThan(relaxed.lineGapEm);
  });
});
