import React from "react";

import {normalizeLongformWord} from "../lib/longform-word-layout";
import {
  buildMotionUsageGovernorBudgetMap,
  type MotionUsageGovernorPrimitiveId
} from "../lib/motion-platform/motion-usage-governor";
import type {CaptionChunk, TranscribedWord} from "../lib/types";

export type LongformWordEmphasisPrimitiveId = MotionUsageGovernorPrimitiveId;
const LONGFORM_EMPHASIS_WINDOW_MS = 150000;
const LONGFORM_EMPHASIS_MAX_UNDERLINES = 2;
const LONGFORM_EMPHASIS_MAX_CIRCLES = 1;

const OWNERSHIP_WORDS = new Set(["mine", "my", "ours", "yours", "choice", "control", "decision"]);
const CIRCLE_REVEAL_WORDS = new Set(["dream", "truth", "proof", "power", "freedom"]);
const CIRCLE_PATH_LENGTH = 420;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};

const buildWordEffectProgress = ({
  word,
  currentTimeMs
}: {
  word: TranscribedWord;
  currentTimeMs: number;
}): number => {
  const durationMs = Math.max(180, word.endMs - word.startMs);
  const anticipationMs = clamp(durationMs * 0.18, 70, 120);
  const settleMs = clamp(durationMs * 0.55, 180, 360);
  return clamp01((currentTimeMs - (word.startMs - anticipationMs)) / (durationMs + anticipationMs + settleMs));
};

const resolveLongformWordEmphasisImportance = ({
  primitiveId,
  chunk,
  chunkWordIndex,
  word
}: {
  primitiveId: LongformWordEmphasisPrimitiveId;
  chunk: CaptionChunk;
  chunkWordIndex: number;
  word: TranscribedWord;
}): number => {
  const normalizedWord = normalizeLongformWord(word.text);
  const lastWordIndex = chunk.words.length - 1;
  const isTailWord = chunkWordIndex === lastWordIndex;
  const emphasisCount = chunk.emphasisWordIndices?.length ?? 0;
  const isStrongIntent = chunk.semantic?.intent === "punch-emphasis";
  const isOwnershipWord = OWNERSHIP_WORDS.has(normalizedWord);
  const isCircleWord = CIRCLE_REVEAL_WORDS.has(normalizedWord);
  const isSingleWordMoment = chunk.words.length === 1;

  if (primitiveId === "blur-underline") {
    if (isOwnershipWord) {
      return 0.95;
    }
    if (isTailWord) {
      return emphasisCount >= 2 ? 0.68 : 0.58;
    }
    return 0.48;
  }

  if (isStrongIntent && (isSingleWordMoment || (isTailWord && isCircleWord))) {
    return 0.96;
  }
  if (isCircleWord && isSingleWordMoment) {
    return 0.88;
  }
  if (isTailWord && isCircleWord) {
    return emphasisCount >= 2 ? 0.7 : 0.62;
  }
  return 0.52;
};

export const getLongformWordEmphasisWordKey = (word: TranscribedWord): string => {
  return `${word.startMs}|${word.endMs}|${word.text}`;
};

export const resolveLongformWordEmphasisPrimitive = ({
  chunk,
  chunkWordIndex,
  word
}: {
  chunk: CaptionChunk;
  chunkWordIndex: number;
  word: TranscribedWord;
}): LongformWordEmphasisPrimitiveId | null => {
  if (!(chunk.emphasisWordIndices?.includes(chunkWordIndex) ?? false)) {
    return null;
  }

  const normalizedWord = normalizeLongformWord(word.text);
  const lastWordIndex = chunk.words.length - 1;
  const isTailWord = chunkWordIndex === lastWordIndex;
  const emphasisCount = chunk.emphasisWordIndices?.length ?? 0;
  const isSingleWordMoment = chunk.words.length === 1;
  const isCircleWord = CIRCLE_REVEAL_WORDS.has(normalizedWord);

  if (OWNERSHIP_WORDS.has(normalizedWord)) {
    return "blur-underline";
  }
  if (chunk.semantic?.intent === "punch-emphasis" && isSingleWordMoment && isCircleWord) {
    return "circle-reveal";
  }
  if (
    chunk.semantic?.intent === "punch-emphasis" &&
    isTailWord &&
    isCircleWord &&
    emphasisCount <= 1 &&
    chunk.words.length <= 3
  ) {
    return "circle-reveal";
  }
  if (isTailWord && chunk.words.length <= 4) {
    return "blur-underline";
  }

  return null;
};

export const buildLongformWordEmphasisBudgetMap = ({
  chunks,
  currentTimeMs,
  maxUnderlinesPerMinute = LONGFORM_EMPHASIS_MAX_UNDERLINES,
  maxCirclesPerMinute = LONGFORM_EMPHASIS_MAX_CIRCLES
}: {
  chunks: CaptionChunk[];
  currentTimeMs: number;
  maxUnderlinesPerMinute?: number;
  maxCirclesPerMinute?: number;
}): Map<string, LongformWordEmphasisPrimitiveId> => {
  const windowStartMs = currentTimeMs - LONGFORM_EMPHASIS_WINDOW_MS;
  const candidates = chunks
    .flatMap((chunk) => {
      return chunk.words.map((word, chunkWordIndex) => ({
        chunk,
        word,
        chunkWordIndex,
        primitiveId: resolveLongformWordEmphasisPrimitive({
          chunk,
          chunkWordIndex,
          word
        })
      }));
    })
    .filter((candidate) => candidate.word.startMs >= windowStartMs && candidate.word.startMs <= currentTimeMs)
    .sort((left, right) => {
      return left.word.startMs - right.word.startMs ||
        left.chunk.startMs - right.chunk.startMs ||
        left.chunkWordIndex - right.chunkWordIndex;
    });

  const governorCandidates = candidates.flatMap((candidate) => {
    if (!candidate.primitiveId) {
      return [];
    }

    const wordKey = getLongformWordEmphasisWordKey(candidate.word);
    return [{
      wordKey,
      primitiveId: candidate.primitiveId,
      startMs: candidate.word.startMs,
      importance: resolveLongformWordEmphasisImportance({
        primitiveId: candidate.primitiveId,
        chunk: candidate.chunk,
        chunkWordIndex: candidate.chunkWordIndex,
        word: candidate.word
      })
    }];
  });

  return buildMotionUsageGovernorBudgetMap({
    currentTimeMs,
    candidates: governorCandidates,
    windowMs: LONGFORM_EMPHASIS_WINDOW_MS,
    cooldownMs: 780,
    maxUsesPerPrimitive: {
      "blur-underline": maxUnderlinesPerMinute,
      "circle-reveal": maxCirclesPerMinute
    }
  });
};

export const LongformWordEmphasisAdornment: React.FC<{
  chunk: CaptionChunk;
  word: TranscribedWord;
  chunkWordIndex: number;
  currentTimeMs: number;
  resolvedPrimitiveId?: LongformWordEmphasisPrimitiveId | null;
}> = ({chunk, word, chunkWordIndex, currentTimeMs, resolvedPrimitiveId}) => {
  const primitiveId = resolvedPrimitiveId ?? resolveLongformWordEmphasisPrimitive({chunk, chunkWordIndex, word});
  const registryRef = "host:longform-word-emphasis-adornment";

  if (!primitiveId) {
    return null;
  }

  const progress = buildWordEffectProgress({
    word,
    currentTimeMs
  });
  const reveal = easeOutCubic(progress / 0.56);

  if (primitiveId === "blur-underline") {
    const underlineProgress = easeInOutCubic((progress - 0.26) / 0.72);

    return (
      <span
        aria-hidden
        data-animation-registry-ref={registryRef}
        data-animation-tags="longform-word-emphasis emphasis underline focus-target"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          pointerEvents: "none"
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "-0.04em",
            right: "-0.04em",
            bottom: "-0.11em",
            height: "0.12em",
            opacity: reveal,
            transform: `translate3d(0, ${((1 - reveal) * 4).toFixed(2)}px, 0)`,
            filter: `blur(${((1 - reveal) * 9).toFixed(2)}px)`
          }}
        >
          <span
            style={{
              display: "block",
              width: `${(underlineProgress * 100).toFixed(1)}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, rgba(91, 146, 255, 0.98), rgba(171, 205, 255, 0.82))",
              boxShadow: `0 0 ${(6 + underlineProgress * 12).toFixed(1)}px rgba(112, 168, 255, ${(0.24 + underlineProgress * 0.2).toFixed(3)})`
            }}
          />
        </span>
      </span>
    );
  }

  const strokeProgress = easeInOutCubic((progress - 0.18) / 0.82);
  const pathOpacity = 0.22 + reveal * 0.64;

  return (
    <svg
      aria-hidden
      data-animation-registry-ref={registryRef}
      data-animation-tags="longform-word-emphasis emphasis circle focus-target"
      viewBox="0 0 220 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: "118%",
        height: "158%",
        overflow: "visible",
        pointerEvents: "none",
        transform: `translate(-50%, -50%) scale(${(0.98 + reveal * 0.02).toFixed(3)})`,
        opacity: pathOpacity
      }}
    >
      <path
        fill="none"
        stroke="rgba(108, 162, 255, 0.22)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
        d="M 196,50 C 196,22 160,4 110,4 C 60,4 4,22 4,50 C 4,78 60,96 110,96 C 160,96 196,78 196,50"
      />
      <path
        fill="none"
        stroke="rgba(160, 200, 255, 0.92)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.4}
        strokeDasharray={`${CIRCLE_PATH_LENGTH} ${CIRCLE_PATH_LENGTH}`}
        strokeDashoffset={CIRCLE_PATH_LENGTH * (1 - strokeProgress)}
        d="M 196,50 C 196,22 160,4 110,4 C 60,4 4,22 4,50 C 4,78 60,96 110,96 C 160,96 196,78 196,50"
      />
    </svg>
  );
};
