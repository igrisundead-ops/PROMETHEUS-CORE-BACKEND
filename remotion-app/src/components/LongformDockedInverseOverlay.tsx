import React, {useMemo} from "react";
import {AbsoluteFill, useVideoConfig} from "remotion";

import {
  resolveCaptionEditorialDecision,
  type CaptionEditorialContext
} from "../lib/motion-platform/caption-editorial-engine";
import {sanitizeRenderableOverlayText, shouldRenderOverlayText} from "../lib/motion-platform/render-text-safety";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import {
  getLongformWordMotionState,
  selectLongformActiveChunk
} from "../lib/longform-word-timing";
import type {CaptionChunk, TranscribedWord} from "../lib/types";

type LongformDockedInverseOverlayProps = {
  chunks: CaptionChunk[];
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">;
};

const getDominantWordIndex = (words: TranscribedWord[], currentTimeMs: number): number => {
  const activeIndex = words.findIndex((word) => currentTimeMs >= word.startMs && currentTimeMs < word.endMs);
  if (activeIndex >= 0) {
    return activeIndex;
  }

  let latestStartedIndex = 0;
  words.forEach((word, index) => {
    if (currentTimeMs >= word.startMs - 80) {
      latestStartedIndex = index;
    }
  });
  return latestStartedIndex;
};

export const LongformDockedInverseOverlay: React.FC<LongformDockedInverseOverlayProps> = ({
  chunks,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0,
  editorialContext
}) => {
  const {fps} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = ((stableFrame + 0.5) / fps) * 1000;
  const activeChunk = useMemo(() => selectLongformActiveChunk(chunks, currentTimeMs), [chunks, currentTimeMs]);
  const editorialDecision = useMemo(() => {
    const chunk = activeChunk ?? chunks[0] ?? {
      id: "idle",
      text: "",
      startMs: 0,
      endMs: 0,
      words: [],
      styleKey: "",
      motionKey: "",
      layoutVariant: "inline",
      emphasisWordIndices: []
    };

    return resolveCaptionEditorialDecision({
      chunk,
      ...editorialContext,
      currentTimeMs
    });
  }, [activeChunk, chunks, currentTimeMs, editorialContext]);

  const activeWords = activeChunk?.words ?? [];
  if (activeChunk && !shouldRenderOverlayText(activeChunk.text)) {
    return null;
  }
  const dominantWordIndex = activeWords.length > 0 ? getDominantWordIndex(activeWords, currentTimeMs) : 0;
  const isLightSurface = editorialDecision.surfaceTone === "light";
  const cardBackground = isLightSurface
    ? "linear-gradient(180deg, rgba(255,255,255,0.90), rgba(245,248,255,0.76))"
    : "linear-gradient(180deg, rgba(7,9,18,0.84), rgba(10,12,22,0.74))";
  const cardBorder = isLightSurface
    ? "1px solid rgba(18, 25, 42, 0.12)"
    : "1px solid rgba(138, 158, 255, 0.16)";
  const topBarBackground = isLightSurface
    ? "linear-gradient(90deg, rgba(24, 34, 58, 0.96), rgba(84, 102, 153, 0.34) 52%, rgba(84, 102, 153, 0.08))"
    : "linear-gradient(90deg, rgba(73,100,255,0.98), rgba(108,126,255,0.32) 52%, rgba(108,126,255,0.04))";
  const dominantWordBackground = isLightSurface
    ? "linear-gradient(135deg, rgba(24, 34, 58, 0.96), rgba(84, 102, 153, 0.88))"
    : "linear-gradient(135deg, rgba(70, 96, 255, 0.98), rgba(53, 79, 228, 0.9))";
  const dominantWordShadow = isLightSurface
    ? "0 8px 18px rgba(17, 24, 39, 0.24)"
    : "0 8px 18px rgba(43, 63, 188, 0.26)";

  return (
    <AbsoluteFill style={{zIndex: 8, pointerEvents: "none"}}>
      <div
        style={{
          position: "absolute",
          left: "4.2%",
          right: "4.2%",
          bottom: "6.4%",
          display: "flex",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            position: "relative",
            width: "min(92%, 1220px)",
            padding: "22px 26px 20px",
            borderRadius: 22,
            border: cardBorder,
            background: cardBackground,
            boxShadow: isLightSurface ? "0 18px 34px rgba(10, 14, 20, 0.14)" : "0 18px 40px rgba(0,0,0,0.30)",
            backdropFilter: "blur(14px)"
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              top: 10,
              height: 4,
              borderRadius: 999,
              background: topBarBackground
            }}
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.3em 0.34em",
              paddingTop: 10,
              fontFamily: editorialDecision.fontFamily,
              fontWeight: editorialDecision.fontWeight,
              fontSize: "clamp(26px, 2.8vw, 42px)",
              lineHeight: 1.12,
              letterSpacing: editorialDecision.letterSpacing,
              color: isLightSurface ? "rgba(18, 20, 24, 0.96)" : "rgba(245, 247, 255, 0.96)",
              textShadow: editorialDecision.textShadow,
              textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined
            }}
          >
            {activeWords.map((word, index) => {
              const safeText = sanitizeRenderableOverlayText(word.text);
              if (!safeText) {
                return null;
              }
              const previousWord = index > 0 ? activeWords[index - 1] : undefined;
              const nextWord = index < activeWords.length - 1 ? activeWords[index + 1] : undefined;
              const motionState = getLongformWordMotionState({
                word,
                previousWord,
                nextWord,
                wordIndex: index,
                chunkWordCount: activeWords.length,
                chunkEndMs: activeChunk?.endMs ?? currentTimeMs + 240,
                currentTimeMs
              });
              const isDominant = index === dominantWordIndex;

              return (
                <span
                  key={`${activeChunk?.id ?? "idle"}-${index}-${word.startMs}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: isDominant ? "0.05em 0.24em 0.08em" : undefined,
                    borderRadius: isDominant ? 10 : undefined,
                    background: isDominant ? dominantWordBackground : "transparent",
                    color: isDominant ? "#ffffff" : editorialDecision.textColor,
                    fontFamily: editorialDecision.fontFamily,
                    fontWeight: editorialDecision.fontWeight,
                    letterSpacing: editorialDecision.letterSpacing,
                    textShadow: editorialDecision.textShadow,
                    textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined,
                    opacity: motionState.hasStarted ? 1 : Math.max(0.7, motionState.opacity),
                    transform: `translate3d(0, ${(motionState.translateY * 0.34).toFixed(2)}px, 0) scale(${(isDominant ? motionState.scale * 1.02 : motionState.scale).toFixed(3)})`,
                    filter: `blur(${(motionState.blur * (isDominant ? 0.12 : 0.08)).toFixed(2)}px)`,
                    boxShadow: isDominant ? dominantWordShadow : "none",
                    willChange: "transform, opacity, filter"
                  }}
                >
                  {safeText}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
