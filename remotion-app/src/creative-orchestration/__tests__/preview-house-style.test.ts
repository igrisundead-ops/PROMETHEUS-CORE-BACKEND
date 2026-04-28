import {describe, expect, it} from "vitest";

import {buildCreativePreviewCaptionChunks} from "../preview";
import type {CaptionChunk} from "../../lib/types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1000,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "style",
  motionKey: partial.motionKey ?? "motion",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  }
});

describe("creative preview house style", () => {
  it("routes early hook moments into the EVE house style instead of the old long-form SVG lane", () => {
    const chunks = buildCreativePreviewCaptionChunks([
      makeChunk({
        id: "hook-1",
        text: "Build systems that scale",
        words: [
          {text: "Build", startMs: 0, endMs: 180},
          {text: "systems", startMs: 180, endMs: 420},
          {text: "that", startMs: 420, endMs: 540},
          {text: "scale", startMs: 540, endMs: 760}
        ]
      })
    ], {
      profileId: "longform_eve_typography_v1",
      presentationMode: "long-form"
    });

    expect(chunks[0]?.profileId).toBe("longform_eve_typography_v1");
  });

  it("routes longer explanatory passages into the steadier docked inverse lane", () => {
    const chunks = buildCreativePreviewCaptionChunks([
      makeChunk({
        id: "explanation-1",
        text: "This is the longer explanation that should stay readable while the frame breathes and the point unfolds clearly",
        words: [
          {text: "This", startMs: 0, endMs: 100},
          {text: "is", startMs: 100, endMs: 200},
          {text: "the", startMs: 200, endMs: 300},
          {text: "longer", startMs: 300, endMs: 400},
          {text: "explanation", startMs: 400, endMs: 520},
          {text: "that", startMs: 520, endMs: 620},
          {text: "should", startMs: 620, endMs: 720},
          {text: "stay", startMs: 720, endMs: 820},
          {text: "readable", startMs: 820, endMs: 940},
          {text: "while", startMs: 940, endMs: 1040},
          {text: "the", startMs: 1040, endMs: 1140},
          {text: "frame", startMs: 1140, endMs: 1240},
          {text: "breathes", startMs: 1240, endMs: 1360},
          {text: "and", startMs: 1360, endMs: 1460},
          {text: "the", startMs: 1460, endMs: 1560},
          {text: "point", startMs: 1560, endMs: 1660},
          {text: "unfolds", startMs: 1660, endMs: 1780},
          {text: "clearly", startMs: 1780, endMs: 1900}
        ]
      })
    ], {
      profileId: "longform_eve_typography_v1",
      presentationMode: "long-form"
    });

    expect(chunks[0]?.profileId).toBe("longform_docked_inverse_v1");
  });
});
