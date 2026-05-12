import React, {useEffect, useMemo} from "react";
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
import {ENABLE_LONGFORM_SEMANTIC_SIDECALL_OVERLAYS} from "../lib/longform-semantic-sidecall";
import {
  resolveCaptionEditorialDecision,
  type CaptionEditorialContext,
  type CaptionEditorialDecision
} from "../lib/motion-platform/caption-editorial-engine";
import {
  sanitizeRenderableOverlayText,
  shouldRenderOverlayText
} from "../lib/motion-platform/render-text-safety";
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
  premiumTypographyMode?: "default" | "dev-fixture-v1";
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

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const resolvePremiumTypographyDevFixtureMoment = (
  chunk: CaptionChunk | null | undefined
): "hook" | "emphasis" | "neutral" | null => {
  if (!chunk?.id.startsWith("dev-fixture-")) {
    return null;
  }

  if (chunk.id.includes("-hook-")) {
    return "hook";
  }
  if (chunk.id.includes("-emphasis-")) {
    return "emphasis";
  }

  return "neutral";
};

const resolvePremiumTypographyDevFixtureTuning = (
  moment: "hook" | "emphasis" | "neutral" | null
): {
  fontSizeMultiplier: number;
  lineHeight: number;
  maxWidthPercent: number;
  containerLiftPx: number;
} => {
  if (moment === "hook") {
    return {
      fontSizeMultiplier: 1.18,
      lineHeight: 0.98,
      maxWidthPercent: 54,
      containerLiftPx: -32
    };
  }

  if (moment === "emphasis") {
    return {
      fontSizeMultiplier: 1.08,
      lineHeight: 1,
      maxWidthPercent: 58,
      containerLiftPx: -16
    };
  }

  return {
    fontSizeMultiplier: 1,
    lineHeight: 1.04,
    maxWidthPercent: 64,
    containerLiftPx: -8
  };
};

export const getWordStyle = ({
  word,
  previousWord,
  nextWord,
  wordIndex,
  chunkWordCount,
  chunk,
  currentTimeMs,
  editorialDecision,
  premiumTypographyMode
}: {
  word: TranscribedWord;
  previousWord?: TranscribedWord;
  nextWord?: TranscribedWord;
  wordIndex: number;
  chunkWordCount: number;
  chunk: CaptionChunk;
  currentTimeMs: number;
  editorialDecision: CaptionEditorialDecision;
  premiumTypographyMode?: "default" | "dev-fixture-v1";
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
  const durationMs = Math.max(1, word.endMs - word.startMs);
  const patternEntry = editorialDecision.typography.pattern.entry;
  const revealWindowMs = premiumTypographyMode === "dev-fixture-v1"
    ? Math.max(140, Math.min(durationMs * 0.9, editorialDecision.motionProfile.snapDurationMs * 1.15))
    : Math.max(120, Math.min(durationMs * 0.82, 280));
  const revealStartMs = word.startMs - Math.min(220, revealWindowMs * 0.48);
  const revealProgress = clamp01((currentTimeMs - revealStartMs) / Math.max(1, revealWindowMs));
  const premiumTranslateY = premiumTypographyMode === "dev-fixture-v1"
    ? (1 - revealProgress) * ((patternEntry.y?.[0] ?? 0) * 0.18)
    : 0;
  const premiumBlur = premiumTypographyMode === "dev-fixture-v1"
    ? (1 - revealProgress) * ((patternEntry.blur?.[0] ?? editorialDecision.stylePhysics.motion.blurRelease ?? 0) * 0.12)
    : 0;
  const entryScale = patternEntry.scale?.[0] ?? 1;
  const premiumScale = premiumTypographyMode === "dev-fixture-v1"
    ? 1 + ((entryScale - 1) * (1 - revealProgress) * 0.26)
    : 1;
  const premiumOpacityFloor = premiumTypographyMode === "dev-fixture-v1"
    ? 0.92 + clamp01(editorialDecision.opacityMultiplier - 0.92) * 0.12
    : 1;

  return {
    display: "inline-block",
    opacity: Math.min(1, opacity * hierarchyOpacity * premiumOpacityFloor),
    transform: `translate3d(0, ${(translateY - premiumTranslateY).toFixed(2)}px, 0) scale(${(scale * hierarchyScale * premiumScale).toFixed(3)})`,
    filter: `blur(${(blur + premiumBlur).toFixed(2)}px)`,
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
  editorialContext,
  premiumTypographyMode = "default"
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
  const effectiveFallbackMode = premiumTypographyMode === "dev-fixture-v1"
    ? null
    : fallbackMode === "semantic-sidecall" && !ENABLE_LONGFORM_SEMANTIC_SIDECALL_OVERLAYS
    ? null
    : fallbackMode;
  const emphasisBudgetMap = useMemo(() => {
    if (effectiveFallbackMode) {
      return new Map<string, LongformWordEmphasisPrimitiveId>();
    }

    return buildLongformWordEmphasisBudgetMap({
      chunks,
      currentTimeMs
    });
  }, [chunks, currentTimeMs, effectiveFallbackMode]);
  const preparedChunks = useMemo(() => {
    if (effectiveFallbackMode) {
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
  }, [chunks, effectiveFallbackMode]);
  const activeChunkPresentation = activeChunk ? preparedChunks.get(activeChunk.id) ?? null : null;
  const lines = activeChunkPresentation?.lines ?? [];
  const premiumDevFixtureMoment = useMemo(
    () => premiumTypographyMode === "dev-fixture-v1" ? resolvePremiumTypographyDevFixtureMoment(activeChunk) : null,
    [activeChunk, premiumTypographyMode]
  );
  const premiumTypographyTuning = useMemo(
    () => resolvePremiumTypographyDevFixtureTuning(premiumDevFixtureMoment),
    [premiumDevFixtureMoment]
  );
  const captionSizing = useMemo(() => getLongformCaptionSizing({
    width,
    height,
    maxLineUnits: lines.reduce((max, line) => Math.max(max, line.estimatedUnits), 0),
    lineCount: lines.length
  }), [height, lines, width]);
  const activeNumericTreatment = useMemo(() => {
    if (effectiveFallbackMode || premiumTypographyMode === "dev-fixture-v1") {
      return null;
    }

    return resolveActiveLongformNumericTreatment({
      chunks,
      activeChunk,
      currentTimeMs
    });
  }, [activeChunk, chunks, currentTimeMs, effectiveFallbackMode, premiumTypographyMode]);

  useEffect(() => {
    if (
      premiumTypographyMode !== "dev-fixture-v1" ||
      !activeChunk ||
      !editorialDecision
    ) {
      return;
    }

    if (
      !editorialDecision.fontSelection.fauxBoldRisk &&
      !editorialDecision.fontSelection.fauxItalicRisk &&
      (editorialDecision.fontSelection.runtimeDiagnostics?.length ?? 0) === 0
    ) {
      return;
    }

    console.warn("[premium-typography-dev-fixture]", {
      chunkId: activeChunk.id,
      fontCandidateId: editorialDecision.fontSelection.fontCandidateId,
      fontPaletteId: editorialDecision.fontSelection.fontPaletteId,
      runtimeCssFamily: editorialDecision.fontSelection.runtimeCssFamily ?? null,
      fauxBoldRisk: editorialDecision.fontSelection.fauxBoldRisk ?? false,
      fauxItalicRisk: editorialDecision.fontSelection.fauxItalicRisk ?? false,
      runtimeDiagnostics: editorialDecision.fontSelection.runtimeDiagnostics ?? []
    });
  }, [activeChunk, editorialDecision, premiumTypographyMode]);

  if (!activeChunk || activeChunk.words.length === 0) {
    return null;
  }

  if (!shouldRenderOverlayText(activeChunk.text)) {
    return null;
  }

  if (editorialDecision.mode !== "normal" && ENABLE_LONGFORM_SEMANTIC_SIDECALL_OVERLAYS) {
    return (
      <LongformSemanticSidecallOverlay
        chunks={chunks}
        stabilizePreviewTimeline={stabilizePreviewTimeline}
        previewTimelineResetVersion={previewTimelineResetVersion}
        editorialContext={editorialContext}
      />
    );
  }

  if (effectiveFallbackMode === "semantic-sidecall") {
    return (
      <LongformSemanticSidecallOverlay
        chunks={chunks}
        stabilizePreviewTimeline={stabilizePreviewTimeline}
        previewTimelineResetVersion={previewTimelineResetVersion}
        editorialContext={editorialContext}
      />
    );
  }

  if (effectiveFallbackMode === "docked-inverse") {
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
          justifyContent: "center",
          transform: premiumTypographyMode === "dev-fixture-v1"
            ? `translate3d(0, ${premiumTypographyTuning.containerLiftPx}px, 0)`
            : undefined
        }}
      >
        <div
          data-caption-owner="longform-word-by-word"
          data-premium-typography-mode={premiumTypographyMode}
          data-runtime-font-candidate={editorialDecision.fontSelection.fontCandidateId}
          data-runtime-font-palette={editorialDecision.fontSelection.fontPaletteId}
          data-runtime-font-alias={editorialDecision.fontSelection.runtimeCssFamily ?? ""}
          data-runtime-font-manifest-backed={String(Boolean(editorialDecision.fontSelection.manifestBacked))}
          data-runtime-font-faux-bold-risk={String(Boolean(editorialDecision.fontSelection.fauxBoldRisk))}
          data-runtime-font-faux-italic-risk={String(Boolean(editorialDecision.fontSelection.fauxItalicRisk))}
          style={{
            width: "100%",
            maxWidth: `${Math.min(captionSizing.maxWidthPercent, premiumTypographyTuning.maxWidthPercent)}%`,
            position: "relative",
            minHeight: usesTwoLineHandoff ? "2.45em" : "auto",
            boxSizing: "border-box",
            padding: "0.06em 0.12em",
            textAlign: "center",
            fontSize: `${Math.round(captionSizing.fontSizePx * editorialDecision.fontSizeScale * premiumTypographyTuning.fontSizeMultiplier)}px`,
            lineHeight: premiumTypographyTuning.lineHeight,
            letterSpacing: editorialDecision.letterSpacing,
            color: editorialDecision.textColor,
            textShadow: editorialDecision.textShadow,
            fontWeight: editorialDecision.fontWeight,
            textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined,
            fontFamily: editorialDecision.fontFamily
          }}
        >
          {lines.map((line, lineIndex) => {
            const safeLineWords = line.words
              .map((word) => ({
                word,
                safeText: sanitizeRenderableOverlayText(word.text)
              }))
              .filter((entry) => entry.safeText.length > 0);
            if (safeLineWords.length === 0) {
              return null;
            }
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
                {safeLineWords.map(({word, safeText}, wordIndex) => {
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
                          editorialDecision,
                          premiumTypographyMode
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
                      {safeText}
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
