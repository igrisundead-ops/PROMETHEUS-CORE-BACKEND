import {describe, expect, it} from "vitest";

import {
  getLongformLineHandoffProgress,
  getLongformWordAnticipationMs,
  getLongformWordMotionState,
  selectLongformActiveChunk
} from "../longform-word-timing";
import type {CaptionChunk, TranscribedWord} from "../types";

const buildWord = (overrides: Partial<TranscribedWord> = {}): TranscribedWord => ({
  text: "profit",
  startMs: 1000,
  endMs: 1300,
  ...overrides
});

const buildChunk = (overrides: Partial<CaptionChunk> = {}): CaptionChunk => ({
  id: "chunk-1",
  text: "alpha beta",
  startMs: 0,
  endMs: 1000,
  words: [],
  styleKey: "test-style",
  motionKey: "test-motion",
  layoutVariant: "inline",
  emphasisWordIndices: [],
  ...overrides
});

describe("longform word timing", () => {
  it("keeps a roomy word hidden before its own start timestamp", () => {
    const motion = getLongformWordMotionState({
      word: buildWord(),
      wordIndex: 0,
      chunkWordCount: 2,
      chunkEndMs: 1800,
      currentTimeMs: 999
    });

    expect(motion.hasStarted).toBe(false);
    expect(motion.opacity).toBe(0);
  });

  it("makes a word visible immediately once its spoken onset begins", () => {
    const motion = getLongformWordMotionState({
      word: buildWord(),
      wordIndex: 0,
      chunkWordCount: 2,
      chunkEndMs: 1800,
      currentTimeMs: 1000
    });

    expect(motion.hasStarted).toBe(true);
    expect(motion.isActive).toBe(true);
    expect(motion.opacity).toBeGreaterThan(0.4);
  });

  it("allows a slight anticipation for tightly packed words", () => {
    const previousWord = buildWord({
      text: "than",
      startMs: 780,
      endMs: 995
    });
    const word = buildWord({
      text: "six",
      startMs: 1000,
      endMs: 1160
    });
    const nextWord = buildWord({
      text: "figures",
      startMs: 1170,
      endMs: 1380
    });

    expect(
      getLongformWordAnticipationMs({
        word,
        previousWord,
        nextWord,
        wordIndex: 1,
        chunkWordCount: 6
      })
    ).toBeGreaterThan(0);

    const motion = getLongformWordMotionState({
      word,
      previousWord,
      nextWord,
      wordIndex: 1,
      chunkWordCount: 6,
      chunkEndMs: 1800,
      currentTimeMs: 980
    });

    expect(motion.hasStarted).toBe(false);
    expect(motion.opacity).toBeGreaterThan(0);
  });

  it("keeps the current chunk active until the next chunk actually starts", () => {
    const currentChunk = buildChunk({
      id: "chunk-current",
      startMs: 0,
      endMs: 1000
    });
    const nextChunk = buildChunk({
      id: "chunk-next",
      startMs: 1100,
      endMs: 1800
    });

    expect(selectLongformActiveChunk([currentChunk, nextChunk], 1050)?.id).toBe("chunk-current");
    expect(selectLongformActiveChunk([currentChunk, nextChunk], 1100)?.id).toBe("chunk-next");
  });

  it("does not promote an upcoming chunk before its anticipation window opens", () => {
    const nextChunk = buildChunk({
      id: "chunk-next",
      startMs: 1100,
      endMs: 1800,
      words: [
        buildWord({
          text: "Over",
          startMs: 1100,
          endMs: 1260
        }),
        buildWord({
          text: "time",
          startMs: 1265,
          endMs: 1460
        })
      ]
    });

    expect(selectLongformActiveChunk([nextChunk], 1040)).toBeNull();
    expect(selectLongformActiveChunk([nextChunk], 1080)?.id).toBe("chunk-next");
  });

  it("starts the multiline handoff only when the second line begins", () => {
    expect(
      getLongformLineHandoffProgress({
        secondLineStartMs: 2200,
        currentTimeMs: 2199
      })
    ).toBe(0);
    expect(
      getLongformLineHandoffProgress({
        secondLineStartMs: 2200,
        currentTimeMs: 2255
      })
    ).toBeGreaterThan(0);
  });
});
