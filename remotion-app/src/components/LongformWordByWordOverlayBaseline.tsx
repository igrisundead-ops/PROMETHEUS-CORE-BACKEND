import React, {useMemo} from "react";
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";

import {getCaptionContainerStyle, longformCaptionSafeZone} from "../lib/caption-layout";
import {getLongformCaptionSizing} from "../lib/longform-caption-scale";
import {sanitizeRenderableOverlayText, shouldRenderOverlayText} from "../lib/motion-platform/render-text-safety";
import type {CaptionChunk, CaptionVerticalBias, TranscribedWord} from "../lib/types";

type LongformWordByWordOverlayBaselineProps = {
  chunks: CaptionChunk[];
  captionBias?: CaptionVerticalBias;
};

const helperWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "with"
]);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getWordLeadInMs = (word: TranscribedWord): number => {
  const durationMs = Math.max(60, word.endMs - word.startMs);
  return Math.min(180, Math.max(70, durationMs * 0.52));
};

const getChunkVisibility = (chunk: CaptionChunk, currentTimeMs: number): boolean => {
  return currentTimeMs >= chunk.startMs - 180 && currentTimeMs <= chunk.endMs + 220;
};

const getActiveChunk = (chunks: CaptionChunk[], currentTimeMs: number): CaptionChunk | null => {
  const visible = chunks.filter((chunk) => getChunkVisibility(chunk, currentTimeMs));
  if (visible.length === 0) {
    return null;
  }

  return visible.sort((a, b) => {
    const aActive = currentTimeMs >= a.startMs && currentTimeMs <= a.endMs ? 1 : 0;
    const bActive = currentTimeMs >= b.startMs && currentTimeMs <= b.endMs ? 1 : 0;
    if (aActive !== bActive) {
      return bActive - aActive;
    }
    return b.startMs - a.startMs;
  })[0] ?? null;
};

const getWordStyle = ({
  word,
  chunk,
  currentTimeMs
}: {
  word: TranscribedWord;
  chunk: CaptionChunk;
  currentTimeMs: number;
}): React.CSSProperties => {
  const leadInMs = getWordLeadInMs(word);
  const appearStartMs = word.startMs - leadInMs;
  const appearProgress = clamp01((currentTimeMs - appearStartMs) / Math.max(1, word.startMs - appearStartMs));
  const activeProgress = clamp01((currentTimeMs - word.startMs) / Math.max(1, word.endMs - word.startMs));
  const activeFade = clamp01((word.endMs - currentTimeMs) / Math.max(1, word.endMs - word.startMs));
  const chunkExitProgress = clamp01((currentTimeMs - chunk.endMs) / 180);
  const isActive = currentTimeMs >= word.startMs && currentTimeMs <= word.endMs;
  const hasStarted = currentTimeMs >= word.startMs;
  const baseOpacity = hasStarted ? 0.72 : interpolate(appearProgress, [0, 1], [0, 0.62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const activeLift = isActive ? 0.28 + activeFade * 0.12 : 0;
  const opacity = Math.max(0, (baseOpacity + activeLift) * (1 - chunkExitProgress));
  const translateY = interpolate(appearProgress, [0, 1], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  }) + interpolate(chunkExitProgress, [0, 1], [0, -8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const blur = interpolate(appearProgress, [0, 1], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const scale = interpolate(appearProgress, [0, 1], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  }) * (isActive ? 1.02 : 1);
  const highlight = isActive ? activeProgress : hasStarted ? 0.22 : 0;
  const textShadow = isActive
    ? "0 0 16px rgba(255,255,255,0.9), 0 0 32px rgba(201,223,255,0.58), 0 6px 16px rgba(0,0,0,0.62)"
    : highlight > 0
      ? "0 0 10px rgba(242,247,255,0.38), 0 5px 14px rgba(0,0,0,0.54)"
      : "0 4px 14px rgba(0,0,0,0.46)";

  return {
    display: "inline-block",
    opacity,
    transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
    filter: `blur(${blur.toFixed(2)}px)`,
    textShadow,
    color: isActive ? "#ffffff" : hasStarted ? "rgba(243,246,255,0.94)" : "rgba(243,246,255,0.86)",
    willChange: "transform, opacity, filter"
  };
};

const normalizeWord = (value: string): string => {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[^a-zA-Z0-9']/g, "").toLowerCase();
};

export const LongformWordByWordOverlayBaseline: React.FC<LongformWordByWordOverlayBaselineProps> = ({
  chunks,
  captionBias = "bottom"
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const activeChunk = useMemo(() => getActiveChunk(chunks, currentTimeMs), [chunks, currentTimeMs]);
  const captionSizing = useMemo(() => getLongformCaptionSizing({width, height}), [height, width]);

  if (!activeChunk) {
    return null;
  }

  if (!shouldRenderOverlayText(activeChunk.text)) {
    return null;
  }

  return (
    <AbsoluteFill style={{zIndex: 8, pointerEvents: "none"}}>
        <div
          className="dg-caption-region"
          style={{
          ...getCaptionContainerStyle(longformCaptionSafeZone, captionBias),
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: `${captionSizing.maxWidthPercent}%`,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            gap: "0.14em 0.26em",
            textAlign: "center",
            fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
            fontSize: `${captionSizing.fontSizePx}px`,
            lineHeight: 1.04,
            letterSpacing: "-0.02em"
          }}
        >
          {activeChunk.words.map((word, index) => {
            const safeText = sanitizeRenderableOverlayText(word.text);
            if (!safeText) {
              return null;
            }
            const normalized = normalizeWord(word.text);
            const isHelper = helperWords.has(normalized);
            return (
              <span
                key={`${activeChunk.id}-${index}-${word.startMs}`}
                style={{
                  ...getWordStyle({word, chunk: activeChunk, currentTimeMs}),
                  fontFamily: isHelper ? "\"Cormorant Garamond\", serif" : "\"DM Serif Display\", \"Playfair Display\", serif",
                  fontStyle: isHelper ? "italic" : "normal",
                  fontSize: isHelper ? "0.82em" : "1em",
                  letterSpacing: isHelper ? "0.01em" : "-0.02em"
                }}
              >
                {safeText}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
