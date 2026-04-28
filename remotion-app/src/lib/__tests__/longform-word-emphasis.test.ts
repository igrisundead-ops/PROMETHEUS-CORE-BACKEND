import {describe, expect, it} from "vitest";

import {
  buildLongformWordEmphasisBudgetMap,
  resolveLongformWordEmphasisPrimitive
} from "../../components/LongformWordEmphasisAdornment";
import type {CaptionChunk, TranscribedWord} from "../types";

const makeWord = (partial: Partial<TranscribedWord>): TranscribedWord => ({
  text: partial.text ?? "word",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 400,
  confidence: partial.confidence
});

const makeChunk = (partial: Partial<CaptionChunk> = {}): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "choice was mine.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1200,
  words: partial.words ?? [
    makeWord({text: "choice", startMs: 0, endMs: 320}),
    makeWord({text: "was", startMs: 320, endMs: 620}),
    makeWord({text: "mine.", startMs: 620, endMs: 1200})
  ],
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [1, 2],
  profileId: partial.profileId ?? "longform_svg_typography_v1",
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

describe("longform word emphasis primitive routing", () => {
  it("routes ownership end-words to blur underline without changing the base word template", () => {
    const chunk = makeChunk();
    const word = chunk.words[2];

    expect(resolveLongformWordEmphasisPrimitive({
      chunk,
      chunkWordIndex: 2,
      word
    })).toBe("blur-underline");
  });

  it("routes punch-emphasis end-words to circle reveal when they are not ownership words", () => {
    const chunk = makeChunk({
      text: "This is proof.",
      words: [
        makeWord({text: "This", startMs: 0, endMs: 220}),
        makeWord({text: "is", startMs: 220, endMs: 420}),
        makeWord({text: "proof.", startMs: 420, endMs: 980})
      ],
      emphasisWordIndices: [2],
      semantic: {
        intent: "punch-emphasis",
        nameSpans: [],
        isVariation: false,
        suppressDefault: false
      }
    });
    const word = chunk.words[2];

    expect(resolveLongformWordEmphasisPrimitive({
      chunk,
      chunkWordIndex: 2,
      word
    })).toBe("circle-reveal");
  });

  it("keeps underlines available while throttling circle emphasis much harder across long windows", () => {
    const chunks: CaptionChunk[] = [
      makeChunk({
        id: "underline-1",
        text: "mine",
        startMs: 0,
        endMs: 300,
        words: [makeWord({text: "mine", startMs: 0, endMs: 300})],
        emphasisWordIndices: [0]
      }),
      makeChunk({
        id: "circle-1",
        text: "proof",
        startMs: 400,
        endMs: 700,
        words: [makeWord({text: "proof", startMs: 400, endMs: 700})],
        emphasisWordIndices: [0],
        semantic: {
          intent: "punch-emphasis",
          nameSpans: [],
          isVariation: false,
          suppressDefault: false
        }
      }),
      makeChunk({
        id: "underline-2",
        text: "my",
        startMs: 800,
        endMs: 1100,
        words: [makeWord({text: "my", startMs: 800, endMs: 1100})],
        emphasisWordIndices: [0]
      }),
      makeChunk({
        id: "circle-2",
        text: "truth",
        startMs: 1200,
        endMs: 1500,
        words: [makeWord({text: "truth", startMs: 1200, endMs: 1500})],
        emphasisWordIndices: [0],
        semantic: {
          intent: "punch-emphasis",
          nameSpans: [],
          isVariation: false,
          suppressDefault: false
        }
      }),
      makeChunk({
        id: "underline-3",
        text: "ours",
        startMs: 1600,
        endMs: 1900,
        words: [makeWord({text: "ours", startMs: 1600, endMs: 1900})],
        emphasisWordIndices: [0]
      }),
      makeChunk({
        id: "circle-3",
        text: "future",
        startMs: 2000,
        endMs: 2300,
        words: [makeWord({text: "future", startMs: 2000, endMs: 2300})],
        emphasisWordIndices: [0],
        semantic: {
          intent: "punch-emphasis",
          nameSpans: [],
          isVariation: false,
          suppressDefault: false
        }
      })
    ];

    const budgetMap = buildLongformWordEmphasisBudgetMap({
      chunks,
      currentTimeMs: 2500
    });
    const resolvedEmphasisIds = Array.from(budgetMap.values());

    expect(resolvedEmphasisIds.filter((primitiveId) => primitiveId === "blur-underline")).toHaveLength(2);
    expect(resolvedEmphasisIds.filter((primitiveId) => primitiveId === "circle-reveal")).toHaveLength(1);
    expect(resolvedEmphasisIds).not.toContain(undefined);
  });
});
