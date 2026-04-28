import type {CaptionChunk, TranscribedWord} from "./types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const LONGFORM_CHUNK_LEAD_MS = 180;
const LONGFORM_CHUNK_TAIL_MS = 260;
const LONGFORM_BASE_WORD_LEAD_MS = 14;

const remap = ({
  value,
  inputStart,
  inputEnd,
  outputStart,
  outputEnd
}: {
  value: number;
  inputStart: number;
  inputEnd: number;
  outputStart: number;
  outputEnd: number;
}): number => {
  if (inputEnd === inputStart) {
    return outputEnd;
  }

  const progress = clamp01((value - inputStart) / (inputEnd - inputStart));
  return outputStart + (outputEnd - outputStart) * progress;
};

const getChunkVisibility = (chunk: CaptionChunk, currentTimeMs: number): boolean => {
  return currentTimeMs >= chunk.startMs - LONGFORM_CHUNK_LEAD_MS &&
    currentTimeMs <= chunk.endMs + LONGFORM_CHUNK_TAIL_MS;
};

const findLastChunkStartingBeforeOrAt = (chunks: CaptionChunk[], targetTimeMs: number): number => {
  let low = 0;
  let high = chunks.length - 1;
  let bestIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (chunks[middle].startMs <= targetTimeMs) {
      bestIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return bestIndex;
};

const getLongformEntryDurationMs = (word: TranscribedWord): number => {
  const durationMs = Math.max(1, word.endMs - word.startMs);
  return Math.min(120, Math.max(52, durationMs * 0.24));
};

const getWordGapFromPreviousMs = ({
  previousWord,
  word
}: {
  previousWord?: TranscribedWord;
  word: TranscribedWord;
}): number => {
  if (!previousWord) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, word.startMs - previousWord.endMs);
};

const getWordGapToNextMs = ({
  word,
  nextWord
}: {
  word: TranscribedWord;
  nextWord?: TranscribedWord;
}): number => {
  if (!nextWord) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, nextWord.startMs - word.endMs);
};

export const getLongformWordAnticipationMs = ({
  word,
  previousWord,
  nextWord,
  wordIndex,
  chunkWordCount
}: {
  word: TranscribedWord;
  previousWord?: TranscribedWord;
  nextWord?: TranscribedWord;
  wordIndex: number;
  chunkWordCount: number;
}): number => {
  const durationMs = Math.max(1, word.endMs - word.startMs);
  const previousGapMs = getWordGapFromPreviousMs({previousWord, word});
  const nextGapMs = getWordGapToNextMs({word, nextWord});
  const shortWordBias =
    durationMs <= 260
      ? remap({
          value: durationMs,
          inputStart: 260,
          inputEnd: 90,
          outputStart: 0,
          outputEnd: 28
        })
      : 0;
  const compressedLeadBias =
    Number.isFinite(previousGapMs) && previousGapMs <= 72
      ? remap({
          value: previousGapMs,
          inputStart: 72,
          inputEnd: 0,
          outputStart: 0,
          outputEnd: 26
        })
      : 0;
  const compressedTailBias =
    Number.isFinite(nextGapMs) && nextGapMs <= 52
      ? remap({
          value: nextGapMs,
          inputStart: 52,
          inputEnd: 0,
          outputStart: 0,
          outputEnd: 10
        })
      : 0;
  const denseChunkBias = chunkWordCount >= 6 ? 10 : chunkWordCount >= 5 ? 6 : chunkWordCount === 4 ? 3 : 0;
  const rawAnticipationMs = shortWordBias + compressedLeadBias + compressedTailBias + denseChunkBias;
  const cappedAnticipationMs = Math.min(wordIndex === 0 ? 34 : 68, rawAnticipationMs);

  return Math.max(0, Math.round(cappedAnticipationMs));
};

export const getLongformWordRevealStartMs = ({
  word,
  previousWord,
  nextWord,
  wordIndex,
  chunkWordCount
}: {
  word: TranscribedWord;
  previousWord?: TranscribedWord;
  nextWord?: TranscribedWord;
  wordIndex: number;
  chunkWordCount: number;
}): number => {
  return (
    word.startMs -
    LONGFORM_BASE_WORD_LEAD_MS -
    getLongformWordAnticipationMs({
      word,
      previousWord,
      nextWord,
      wordIndex,
      chunkWordCount
    })
  );
};

const getChunkRevealStartMs = (chunk: CaptionChunk): number => {
  const firstWord = chunk.words[0];
  if (!firstWord) {
    return chunk.startMs;
  }

  return getLongformWordRevealStartMs({
    word: firstWord,
    previousWord: undefined,
    nextWord: chunk.words[1],
    wordIndex: 0,
    chunkWordCount: chunk.words.length
  });
};

export const selectLongformActiveChunk = (
  chunks: CaptionChunk[],
  currentTimeMs: number
): CaptionChunk | null => {
  const lastRelevantIndex = findLastChunkStartingBeforeOrAt(chunks, currentTimeMs + LONGFORM_CHUNK_LEAD_MS);
  if (lastRelevantIndex < 0) {
    return null;
  }

  let latestStarted: CaptionChunk | null = null;
  let earliestUpcoming: CaptionChunk | null = null;

  for (let index = lastRelevantIndex; index >= 0; index -= 1) {
    const chunk = chunks[index];

    if (chunk.endMs + LONGFORM_CHUNK_TAIL_MS < currentTimeMs) {
      break;
    }
    if (!getChunkVisibility(chunk, currentTimeMs)) {
      continue;
    }
    if (currentTimeMs >= chunk.startMs && currentTimeMs < chunk.endMs) {
      return chunk;
    }
    if (!latestStarted && currentTimeMs >= chunk.startMs) {
      latestStarted = chunk;
    }
    if (currentTimeMs >= getChunkRevealStartMs(chunk)) {
      earliestUpcoming = chunk;
    }
  }

  return latestStarted ?? earliestUpcoming;
};

export const getLongformWordMotionState = ({
  word,
  previousWord,
  nextWord,
  wordIndex,
  chunkWordCount,
  chunkEndMs,
  currentTimeMs
}: {
  word: TranscribedWord;
  previousWord?: TranscribedWord;
  nextWord?: TranscribedWord;
  wordIndex: number;
  chunkWordCount: number;
  chunkEndMs: number;
  currentTimeMs: number;
}): {
  opacity: number;
  translateY: number;
  blur: number;
  scale: number;
  isActive: boolean;
  hasStarted: boolean;
  highlightProgress: number;
} => {
  const durationMs = Math.max(1, word.endMs - word.startMs);
  const entryDurationMs = getLongformEntryDurationMs(word);
  const anticipationMs = getLongformWordAnticipationMs({
    word,
    previousWord,
    nextWord,
    wordIndex,
    chunkWordCount
  });
  const revealStartMs = word.startMs - anticipationMs;
  const hasAppeared = currentTimeMs >= revealStartMs;
  const hasStarted = currentTimeMs >= word.startMs;
  const isActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
  const preStartProgress =
    anticipationMs > 0 ? clamp01((currentTimeMs - revealStartMs) / Math.max(1, anticipationMs)) : 0;
  const entryProgressRaw = clamp01((currentTimeMs - word.startMs) / entryDurationMs);
  const entryProgress = hasStarted ? Math.max(anticipationMs > 0 ? 0.42 : 0.26, entryProgressRaw) : 0;
  const activeProgress = clamp01((currentTimeMs - word.startMs) / durationMs);
  const activeFade = clamp01((word.endMs - currentTimeMs) / durationMs);
  const chunkExitProgress = clamp01((currentTimeMs - chunkEndMs) / 220);

  const settledOpacity = isActive ? 0.96 : 0.9;
  const baseOpacity = !hasAppeared
    ? 0
    : hasStarted
      ? remap({
          value: entryProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: anticipationMs > 0 ? 0.58 : 0.42,
          outputEnd: settledOpacity
        })
      : remap({
          value: preStartProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: 0,
          outputEnd: 0.2
        });
  const activeLift = isActive ? 0.04 + activeFade * 0.04 : 0;
  const opacity = Math.max(0, (baseOpacity + activeLift) * (1 - chunkExitProgress));
  const translateYBase = !hasAppeared
    ? 22
    : hasStarted
      ? remap({
          value: entryProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: anticipationMs > 0 ? 8 : 16,
          outputEnd: 0
        })
      : remap({
          value: preStartProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: 22,
          outputEnd: 9
        });
  const translateY =
    translateYBase +
    remap({
      value: chunkExitProgress,
      inputStart: 0,
      inputEnd: 1,
      outputStart: 0,
      outputEnd: -8
    });
  const blur = !hasAppeared
    ? 15
    : hasStarted
      ? remap({
          value: entryProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: anticipationMs > 0 ? 5.4 : 9.8,
          outputEnd: 0
        })
      : remap({
          value: preStartProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: 15,
          outputEnd: 6.4
        });
  const scaleBase = !hasAppeared
    ? 0.972
    : hasStarted
      ? remap({
          value: entryProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: anticipationMs > 0 ? 0.986 : 0.972,
          outputEnd: 1.004
        })
      : remap({
          value: preStartProgress,
          inputStart: 0,
          inputEnd: 1,
          outputStart: 0.972,
          outputEnd: 0.988
        });
  const scale = scaleBase * (isActive ? 1.012 : 1);
  const highlightProgress = isActive ? activeProgress : hasStarted ? 0.18 : hasAppeared ? 0.05 : 0;

  return {
    opacity,
    translateY,
    blur,
    scale,
    isActive,
    hasStarted,
    highlightProgress
  };
};

export const getLongformLineHandoffProgress = ({
  secondLineStartMs,
  currentTimeMs
}: {
  secondLineStartMs: number;
  currentTimeMs: number;
}): number => {
  return clamp01((currentTimeMs - secondLineStartMs) / 280);
};
