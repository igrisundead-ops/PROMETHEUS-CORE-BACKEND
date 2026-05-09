import React, {useMemo} from "react";
import {AbsoluteFill, useVideoConfig} from "remotion";

import {LongformDockedInverseOverlay} from "./LongformDockedInverseOverlay";
import {LongformNumericCounterOverlay} from "./LongformNumericCounterOverlay";
import {
  LongformWordEmphasisAdornment,
  buildLongformWordEmphasisBudgetMap,
  getLongformWordEmphasisWordKey
} from "./LongformWordEmphasisAdornment";
import type {LongformWordEmphasisPrimitiveId} from "./LongformWordEmphasisAdornment";
import {LongformSemanticSidecallOverlay} from "./LongformSemanticSidecallOverlay";
import {
  resolveCaptionEditorialDecision,
  type CaptionEditorialContext,
  type CaptionEditorialDecision
} from "../lib/motion-platform/caption-editorial-engine";
import {getCaptionContainerStyle, longformCaptionSafeZone} from "../lib/caption-layout";
import {getLongformCaptionSizing} from "../lib/longform-caption-scale";
import {resolveActiveLongformNumericTreatment} from "../lib/longform-numeric-treatment";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import {
  isLongformHelperWord,
  normalizeLongformWord,
  splitLongformWordsIntoLines,
  type LongformWordLine
} from "../lib/longform-word-layout";
import {
  getLongformLineHandoffProgress,
  getLongformWordMotionState,
  selectLongformActiveChunk
} from "../lib/longform-word-timing";
import {getLongformWordByWordFallbackModeForProfile} from "../lib/stylebooks/caption-style-profiles";
import {LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID} from "../lib/stylebooks/svg-typography-v1";
import type {CaptionChunk, CaptionStyleProfileId, CaptionVerticalBias, TranscribedWord} from "../lib/types";

type LongformWordByWordOverlayProps = {
  captionProfileId: CaptionStyleProfileId;
  chunks: CaptionChunk[];
  captionBias?: CaptionVerticalBias;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">;
};

type PreparedLongformChunk = {
  lines: LongformWordLine[];
  wordMetaByKey: Map<string, {
    chunkWordIndex: number;
    previousWord?: TranscribedWord;
    nextWord?: TranscribedWord;
    isHelper: boolean;
  }>;
};

export const getWordStyle = ({
  word,
  previousWord,
  nextWord,
  wordIndex,
  chunkWordCount,
  chunk,
  currentTimeMs,
  editorialDecision
}: {
  word: TranscribedWord;
  previousWord?: TranscribedWord;
  nextWord?: TranscribedWord;
  wordIndex: number;
  chunkWordCount: number;
  chunk: CaptionChunk;
  currentTimeMs: number;
  editorialDecision: CaptionEditorialDecision;
}): React.CSSProperties => {
  const {opacity, translateY, blur, scale} =
    getLongformWordMotionState({
      word,
      previousWord,
      nextWord,
      wordIndex,
      chunkWordCount,
      chunkEndMs: chunk.endMs,
      currentTimeMs
    });
  const emphasisWordIndices = Array.isArray(chunk.emphasisWordIndices)
    ? chunk.emphasisWordIndices
    : [];
  const hasEditorialHierarchy = emphasisWordIndices.length > 0;
  const isEmphasized = hasEditorialHierarchy && emphasisWordIndices.includes(wordIndex);
  const isHookMoment = chunk.semantic?.intent === "punch-emphasis";
  const hierarchyScale = hasEditorialHierarchy
    ? isEmphasized ? 1.12 : 0.93
    : 1;
  const hierarchyOpacity = hasEditorialHierarchy
    ? isEmphasized ? 1 : 0.78
    : 1;
  const hierarchyWeight = isEmphasized && isHookMoment
    ? typeof editorialDecision.fontWeight === "number"
      ? Math.max(editorialDecision.fontWeight, 700)
      : editorialDecision.fontWeight
    : editorialDecision.fontWeight;

  return {
    display: "inline-block",
    opacity: Math.min(1, opacity * hierarchyOpacity),
    transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${(scale * hierarchyScale).toFixed(3)})`,
    filter: `blur(${blur.toFixed(2)}px)`,
    textShadow: editorialDecision.textShadow,
    color: editorialDecision.textColor,
    textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined,
    fontFamily: editorialDecision.fontFamily,
    fontWeight: hierarchyWeight,
    letterSpacing: editorialDecision.letterSpacing,
    willChange: "transform, opacity, filter"
  };
};

const getLineHandoffProgress = (lines: LongformWordLine[], currentTimeMs: number): number => {
  if (lines.length !== 2) {
    return 0;
  }

  return getLongformLineHandoffProgress({
    secondLineStartMs: lines[1].startMs,
    currentTimeMs
  });
};

const getTwoLineStyle = ({
  lineIndex,
  handoffProgress
}: {
  lineIndex: number;
  handoffProgress: number;
}): React.CSSProperties => {
  if (lineIndex === 0) {
    const opacity = 1 - handoffProgress * 0.82;
    const translateY = -0.08 * handoffProgress;
    const scale = 1 + handoffProgress * 0.03;
    const blur = handoffProgress * 1.35;

    return {
      position: "absolute",
      left: "50%",
      top: "0em",
      opacity,
      filter: `blur(${blur.toFixed(2)}px)`,
      transform: `translate3d(-50%, ${translateY.toFixed(3)}em, 0) scale(${scale.toFixed(3)})`,
      transformOrigin: "center center",
      willChange: "transform, opacity, filter"
    };
  }

  const baseTopEm = 1.1;
  const translateY = -0.94 * handoffProgress;
  const opacity = 0.94 + handoffProgress * 0.06;

  return {
    position: "absolute",
    left: "50%",
    top: `${baseTopEm.toFixed(3)}em`,
    opacity,
    transform: `translate3d(-50%, ${translateY.toFixed(3)}em, 0)`,
    transformOrigin: "center center",
    willChange: "transform, opacity"
  };
};

const getSingleLineStyle = (): React.CSSProperties => {
  return {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "baseline",
    gap: "0.14em 0.26em",
    flexWrap: "nowrap"
  };
};

export const LongformWordByWordOverlay: React.FC<LongformWordByWordOverlayProps> = ({
  captionProfileId,
  chunks,
  captionBias = "bottom",
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0,
  editorialContext
}) => {
  const {fps, width, height} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = ((stableFrame + 0.5) / fps) * 1000;
  const activeChunk = useMemo(() => selectLongformActiveChunk(chunks, currentTimeMs), [chunks, currentTimeMs]);
  const editorialDecision = useMemo(() => {
    if (!activeChunk) {
      return resolveCaptionEditorialDecision({
        chunk: chunks[0] ?? {
          id: "idle",
          text: "",
          startMs: 0,
          endMs: 0,
          words: [],
          styleKey: "",
          motionKey: "",
          layoutVariant: "inline",
          emphasisWordIndices: []
        },
        ...editorialContext,
        currentTimeMs
      });
    }

    return resolveCaptionEditorialDecision({
      chunk: activeChunk,
      ...editorialContext,
      currentTimeMs
    });
  }, [activeChunk, chunks, currentTimeMs, editorialContext]);
  const fallbackMode = useMemo(() => {
    if (captionProfileId === LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID) {
      return null;
    }

    return getLongformWordByWordFallbackModeForProfile(captionProfileId, activeChunk, editorialContext);
  }, [activeChunk, captionProfileId, editorialContext]);
  const emphasisBudgetMap = useMemo(() => {
    if (fallbackMode) {
      return new Map<string, LongformWordEmphasisPrimitiveId>();
    }

    return buildLongformWordEmphasisBudgetMap({
      chunks,
      currentTimeMs
    });
  }, [chunks, currentTimeMs, fallbackMode]);
  const preparedChunks = useMemo(() => {
    if (fallbackMode) {
      return new Map<string, PreparedLongformChunk>();
    }

    return new Map<string, PreparedLongformChunk>(
      chunks.map((chunk) => {
        const lines = splitLongformWordsIntoLines(chunk.words);
        const wordMetaByKey = new Map<string, {
          chunkWordIndex: number;
          previousWord?: TranscribedWord;
          nextWord?: TranscribedWord;
          isHelper: boolean;
        }>();

        chunk.words.forEach((word, chunkWordIndex) => {
          wordMetaByKey.set(getLongformWordEmphasisWordKey(word), {
            chunkWordIndex,
            previousWord: chunkWordIndex > 0 ? chunk.words[chunkWordIndex - 1] : undefined,
            nextWord: chunkWordIndex < chunk.words.length - 1 ? chunk.words[chunkWordIndex + 1] : undefined,
            isHelper: isLongformHelperWord(normalizeLongformWord(word.text))
          });
        });

        return [chunk.id, {lines, wordMetaByKey}];
      })
    );
  }, [chunks, fallbackMode]);
  const activeChunkPresentation = activeChunk ? preparedChunks.get(activeChunk.id) ?? null : null;
  const lines = activeChunkPresentation?.lines ?? [];
  const captionSizing = useMemo(() => getLongformCaptionSizing({
    width,
    height,
    maxLineUnits: lines.reduce((max, line) => Math.max(max, line.estimatedUnits), 0),
    lineCount: lines.length
  }), [height, lines, width]);
  const activeNumericTreatment = useMemo(() => {
    if (fallbackMode) {
      return null;
    }

    return resolveActiveLongformNumericTreatment({
      chunks,
      activeChunk,
      currentTimeMs
    });
  }, [activeChunk, chunks, currentTimeMs, fallbackMode]);

  if (!activeChunk || activeChunk.words.length === 0) {
    return null;
  }

  if (editorialDecision.mode !== "normal") {
    return (
      <LongformSemanticSidecallOverlay
        chunks={chunks}
        stabilizePreviewTimeline={stabilizePreviewTimeline}
        previewTimelineResetVersion={previewTimelineResetVersion}
        editorialContext={editorialContext}
      />
    );
  }

  if (fallbackMode === "semantic-sidecall") {
    return (
      <LongformSemanticSidecallOverlay
        chunks={chunks}
        stabilizePreviewTimeline={stabilizePreviewTimeline}
        previewTimelineResetVersion={previewTimelineResetVersion}
        editorialContext={editorialContext}
      />
    );
  }

  if (fallbackMode === "docked-inverse") {
    return (
      <LongformDockedInverseOverlay
        chunks={chunks}
        stabilizePreviewTimeline={stabilizePreviewTimeline}
        previewTimelineResetVersion={previewTimelineResetVersion}
      />
    );
  }

  if (activeNumericTreatment) {
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
              position: "relative",
              boxSizing: "border-box",
              padding: "0.06em 0.12em",
              textAlign: "center"
            }}
          >
            <LongformNumericCounterOverlay
              treatment={activeNumericTreatment}
              currentTimeMs={currentTimeMs}
              baseFontSizePx={captionSizing.fontSizePx}
            />
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  const handoffProgress = getLineHandoffProgress(lines, currentTimeMs);
  const usesTwoLineHandoff = lines.length === 2;

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
            position: "relative",
            minHeight: usesTwoLineHandoff ? "2.45em" : "auto",
            boxSizing: "border-box",
            padding: "0.06em 0.12em",
            textAlign: "center",
            fontSize: `${Math.round(captionSizing.fontSizePx * editorialDecision.fontSizeScale)}px`,
            lineHeight: 1.04,
            letterSpacing: editorialDecision.letterSpacing,
            color: editorialDecision.textColor,
            textShadow: editorialDecision.textShadow,
            fontWeight: editorialDecision.fontWeight,
            textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined,
            fontFamily: editorialDecision.fontFamily
          }}
        >
          {lines.map((line, lineIndex) => {
            const lineStyle = usesTwoLineHandoff
              ? getTwoLineStyle({lineIndex, handoffProgress})
              : getSingleLineStyle();

            return (
              <div
                key={`${activeChunk.id}-${line.id}`}
                style={{
                  ...lineStyle,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "baseline",
                  gap: "0.14em 0.26em",
                  whiteSpace: "nowrap"
                }}
              >
                {line.words.map((word, wordIndex) => {
                  const wordKey = getLongformWordEmphasisWordKey(word);
                  const wordMeta = activeChunkPresentation?.wordMetaByKey.get(wordKey);
                  const chunkWordIndex = wordMeta?.chunkWordIndex ?? wordIndex;
                  const previousWord = wordMeta?.previousWord;
                  const nextWord = wordMeta?.nextWord;
                  const isHelper = wordMeta?.isHelper ?? isLongformHelperWord(normalizeLongformWord(word.text));
                  const resolvedPrimitiveId = emphasisBudgetMap.get(wordKey) ?? null;

                  return (
                    <span
                      key={`${activeChunk.id}-${line.id}-${wordIndex}-${word.startMs}`}
                      style={{
                        ...getWordStyle({
                          word,
                          previousWord,
                          nextWord,
                          wordIndex: Math.max(0, chunkWordIndex),
                          chunkWordCount: activeChunk.words.length,
                          chunk: activeChunk,
                          currentTimeMs,
                          editorialDecision
                        }),
                        position: "relative",
                        overflow: "visible",
                        fontFamily: isHelper
                          ? "\"Cormorant Garamond\", serif"
                          : editorialDecision.fontFamily,
                        fontStyle: isHelper ? "italic" : "normal",
                        fontSize: isHelper ? "0.82em" : "1em",
                        letterSpacing: isHelper ? "0.01em" : editorialDecision.letterSpacing
                      }}
                    >
                      <LongformWordEmphasisAdornment
                        chunk={activeChunk}
                        word={word}
                        chunkWordIndex={Math.max(0, chunkWordIndex)}
                        currentTimeMs={currentTimeMs}
                        resolvedPrimitiveId={resolvedPrimitiveId}
                      />
                      {word.text}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
