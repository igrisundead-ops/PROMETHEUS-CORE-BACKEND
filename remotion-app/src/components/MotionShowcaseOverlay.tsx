import React, {CSSProperties, useMemo} from "react";
import {AbsoluteFill, Img, staticFile, useVideoConfig} from "remotion";

import {getCaptionContainerStyle, upperSafeZone} from "../lib/caption-layout";
import {
  findLongformWordAnchor,
  normalizeLongformWord,
  splitLongformWordsIntoLines
} from "../lib/longform-word-layout";
import {getLongformLineHandoffProgress} from "../lib/longform-word-timing";
import {
  isFrameRangeInsidePreviewWindow,
  shouldWindowPreviewCues,
  useStablePreviewFrame
} from "../lib/preview-runtime-stability";
import {selectActiveMotionShowcaseCueAtTime} from "../lib/motion-platform/showcase-motion-planner";
import type {CaptionChunk, MotionShowcaseCue, TranscribedWord} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import {SemanticSidecallCueVisual} from "./SemanticSidecallCueVisual";

type MotionShowcaseOverlayProps = {
  model: MotionCompositionModel;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
};

type PreparedLandscapeAnchor = {
  leftPercent: number;
  lineIndex: number;
  secondLineStartMs: number | null;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const resolveAssetSrc = (src: string): string => {
  if (/^(https?:)?\/\//.test(src)) {
    return src;
  }
  return staticFile(src);
};

const getCueSignature = (cue: MotionShowcaseCue): string => {
  return `${cue.assetId}|${cue.matchedText}|${cue.matchedStartMs}`;
};

const getCueAssetWidthEm = (cue: MotionShowcaseCue): number => {
  const label = cue.canonicalLabel.toLowerCase();
  if (label === "home") {
    return 3.2;
  }
  if (label === "thinking") {
    return 1.85;
  }
  if (label === "calendar") {
    return 1.95;
  }
  if (label === "camera") {
    return 2.15;
  }
  if (label === "mortarboard" || label === "expert") {
    return 2;
  }
  if (label === "money" || label === "bill" || label === "coin") {
    return 1.85;
  }
  return 2.05;
};

const getCueAnchorLiftEm = (cue: MotionShowcaseCue): number => {
  const label = cue.canonicalLabel.toLowerCase();
  if (label === "home") {
    return 0.45;
  }
  if (label === "thinking") {
    return 0.58;
  }
  if (label === "calendar") {
    return 0.64;
  }
  if (label === "camera") {
    return 0.72;
  }
  if (label === "mortarboard" || label === "expert") {
    return 0.68;
  }
  if (label === "money" || label === "bill" || label === "coin") {
    return 0.82;
  }
  return 0.66;
};

const getCueFilter = (cue: MotionShowcaseCue): string => {
  const label = cue.canonicalLabel.toLowerCase();
  if (label === "thinking") {
    return "brightness(1.05) contrast(1.08) saturate(1.06) drop-shadow(0 22px 36px rgba(0,0,0,0.42))";
  }
  if (label === "home") {
    return "brightness(1.06) contrast(1.1) saturate(1.03) drop-shadow(0 28px 42px rgba(0,0,0,0.46))";
  }
  return "brightness(1.07) contrast(1.14) saturate(1.05) drop-shadow(0 24px 38px rgba(0,0,0,0.48))";
};

const getCueGlowStyle = (cue: MotionShowcaseCue, visibility: number): CSSProperties => {
  const label = cue.canonicalLabel.toLowerCase();
  const tint =
    label === "money" || label === "bill" || label === "coin"
      ? "rgba(246, 234, 178, 0.48)"
      : label === "thinking"
        ? "rgba(255, 219, 115, 0.44)"
        : "rgba(184, 212, 255, 0.34)";

  return {
    position: "absolute",
    inset: "22% 22% 28% 22%",
    background: `radial-gradient(circle at 50% 46%, ${tint} 0%, rgba(255,255,255,0.12) 28%, rgba(255,255,255,0) 72%)`,
    borderRadius: "999px",
    filter: "blur(24px)",
    opacity: 0.74 * visibility,
    mixBlendMode: "screen"
  };
};

const getCueVignetteStyle = (visibility: number): CSSProperties => {
  return {
    position: "absolute",
    inset: "18% 18% 24% 18%",
    background:
      "radial-gradient(circle at 50% 56%, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0) 78%)",
    borderRadius: "999px",
    filter: "blur(18px)",
    opacity: 0.42 * visibility,
    mixBlendMode: "multiply"
  };
};

const findCueChunk = ({
  chunks,
  cue
}: {
  chunks: CaptionChunk[];
  cue: MotionShowcaseCue;
}): CaptionChunk | null => {
  return chunks.find((chunk) => {
    return cue.matchedStartMs >= chunk.startMs - 40 && cue.matchedEndMs <= chunk.endMs + 80;
  }) ?? null;
};

const cueWordMatches = (word: TranscribedWord, cue: MotionShowcaseCue): boolean => {
  return (
    word.startMs === cue.matchedStartMs &&
    normalizeLongformWord(word.text) === normalizeLongformWord(cue.matchedText)
  );
};

const findCueWord = ({
  chunk,
  cue
}: {
  chunk: CaptionChunk;
  cue: MotionShowcaseCue;
}): TranscribedWord | null => {
  const rangeWords = chunk.words.filter((word) => {
    return word.startMs >= cue.matchedStartMs && word.endMs <= cue.matchedEndMs + 20;
  });
  const bestRangeWord = rangeWords.find((word) => !/\d/.test(word.text)) ?? rangeWords[0];

  if (bestRangeWord) {
    return bestRangeWord;
  }

  return chunk.words.find((word) => cueWordMatches(word, cue))
    ?? chunk.words.find((word) => word.startMs === cue.matchedStartMs)
    ?? chunk.words.find((word) => normalizeLongformWord(cue.matchedText).includes(normalizeLongformWord(word.text)))
    ?? null;
};

const getFallbackPlacementStyle = (cue: MotionShowcaseCue): CSSProperties => {
  if (cue.placement === "landscape-left") {
    return {
      position: "absolute",
      left: "22%",
      top: "56%",
      transformOrigin: "center center"
    };
  }
  if (cue.placement === "landscape-right") {
    return {
      position: "absolute",
      left: "78%",
      top: "56%",
      transformOrigin: "center center"
    };
  }
  if (cue.placement === "portrait-top-left") {
    return {
      position: "absolute",
      left: "24%",
      top: "24%",
      transformOrigin: "center center"
    };
  }
  if (cue.placement === "portrait-top-right") {
    return {
      position: "absolute",
      left: "76%",
      top: "24%",
      transformOrigin: "center center"
    };
  }
  if (cue.placement === "portrait-bottom-left") {
    return {
      position: "absolute",
      left: "24%",
      top: "72%",
      transformOrigin: "center center"
    };
  }
  if (cue.placement === "portrait-bottom-right") {
    return {
      position: "absolute",
      left: "76%",
      top: "72%",
      transformOrigin: "center center"
    };
  }

  return {
    position: "absolute",
    left: "50%",
    top: "42%",
    transformOrigin: "center center"
  };
};

const getRotations = (cue: MotionShowcaseCue): {from: number; to: number; exit: number} => {
  const seed = hashString(getCueSignature(cue)) % 17;
  const direction = seed % 2 === 0 ? -1 : 1;
  const base = cue.canonicalLabel === "home" ? 4 : cue.canonicalLabel === "thinking" ? 6 : 10;
  const settle = cue.canonicalLabel === "money" || cue.canonicalLabel === "bill" ? 7 : base;
  const to = direction * settle;
  return {
    from: to + direction * 16,
    to,
    exit: to * 0.45
  };
};

const RawCueAsset: React.FC<{
  cue: MotionShowcaseCue;
  visibility: number;
  translateY: number;
  scale: number;
  rotation: number;
  style?: CSSProperties;
}> = ({cue, visibility, translateY, scale, rotation, style}) => {
  const widthEm = getCueAssetWidthEm(cue);
  return (
    <div
      data-animation-target-id={cue.id}
      data-animation-registry-ref={cue.assetId}
      data-animation-tags={`showcase ${cue.canonicalLabel.toLowerCase()} asset`}
      style={{
        width: `${widthEm}em`,
        maxWidth: cue.canonicalLabel === "home" ? "22vw" : "14vw",
        minWidth: cue.canonicalLabel === "thinking" ? "84px" : "110px",
        opacity: visibility,
        transform: `translate3d(-50%, -22%, 0) translateY(${translateY}px) scale(${scale}) rotate(${rotation}deg)`,
        willChange: "transform, opacity",
        pointerEvents: "none",
        ...style
      }}
    >
      <div style={{position: "relative", width: "100%"}}>
        <div style={getCueGlowStyle(cue, visibility)} />
        <div style={getCueVignetteStyle(visibility)} />
        <Img
          src={resolveAssetSrc(cue.asset.src)}
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            height: "auto",
            objectFit: "contain",
            filter: getCueFilter(cue)
          }}
        />
      </div>
    </div>
  );
};

export const MotionShowcaseOverlay: React.FC<MotionShowcaseOverlayProps> = ({
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = (stableFrame / fps) * 1000;
  const visibleCues = useMemo(() => {
    if (!stabilizePreviewTimeline || !shouldWindowPreviewCues({
      durationInFrames,
      fps,
      cueCount: model.showcasePlan.cues.length
    })) {
      return model.showcasePlan.cues;
    }

    return model.showcasePlan.cues.filter((cue) => {
      const startFrame = Math.max(0, Math.round((cue.startMs / 1000) * fps));
      const endFrame = Math.max(startFrame, Math.round((cue.endMs / 1000) * fps));
      return isFrameRangeInsidePreviewWindow({
        currentFrame: stableFrame,
        startFrame,
        endFrame
      });
    });
  }, [durationInFrames, fps, model.showcasePlan.cues, stabilizePreviewTimeline, stableFrame]);
  const preparedLandscapeAnchors = useMemo(() => {
    if (model.showcasePlan.layoutMode !== "landscape-callout") {
      return new Map<string, PreparedLandscapeAnchor>();
    }

    return new Map<string, PreparedLandscapeAnchor>(
      visibleCues.flatMap((cue) => {
        const chunk = findCueChunk({chunks: model.chunks, cue});
        if (!chunk || chunk.words.length === 0) {
          return [];
        }

        const cueWord = findCueWord({chunk, cue});
        if (!cueWord) {
          return [];
        }

        const lines = splitLongformWordsIntoLines(chunk.words);
        const anchor = findLongformWordAnchor({
          lines,
          word: cueWord
        });

        if (!anchor) {
          return [];
        }

        return [[
          cue.id,
          {
            leftPercent: 50 + (anchor.centerRatio - 0.5) * 46,
            lineIndex: anchor.lineIndex,
            secondLineStartMs: lines[1]?.startMs ?? null
          }
        ]];
      })
    );
  }, [model.chunks, model.showcasePlan.layoutMode, visibleCues]);
  const activeCue = useMemo(
    () => selectActiveMotionShowcaseCueAtTime({cues: visibleCues, currentTimeMs}),
    [currentTimeMs, visibleCues]
  );

  if (!activeCue) {
    return null;
  }

  const enterProgress = easeOutCubic((currentTimeMs - activeCue.startMs) / Math.max(1, activeCue.peakStartMs - activeCue.startMs));
  const exitProgress = easeInOutCubic((currentTimeMs - activeCue.peakEndMs) / Math.max(1, activeCue.endMs - activeCue.peakEndMs));
  const visibility = clamp01(enterProgress * (1 - exitProgress));
  const travel = lerp(20, 0, enterProgress) - exitProgress * 10;
  const scale = lerp(0.82, 1.02, enterProgress) * lerp(1, 0.97, exitProgress);
  const rotations = getRotations(activeCue);
  const rotation = lerp(rotations.from, rotations.to, enterProgress) * lerp(1, 0.5, exitProgress) + rotations.exit * exitProgress;
  const preparedLandscapeAnchor = preparedLandscapeAnchors.get(activeCue.id) ?? null;
  const handoffProgress = preparedLandscapeAnchor?.secondLineStartMs !== null &&
    preparedLandscapeAnchor?.secondLineStartMs !== undefined
    ? getLongformLineHandoffProgress({
      secondLineStartMs: preparedLandscapeAnchor.secondLineStartMs,
      currentTimeMs
    })
    : 0;
  const landscapeAnchor = preparedLandscapeAnchor
    ? {
      leftPercent: preparedLandscapeAnchor.leftPercent,
      topPercent: preparedLandscapeAnchor.lineIndex === 0
        ? 68 - handoffProgress * 8
        : 86 - handoffProgress * 20
    }
    : null;

  if (landscapeAnchor) {
    return (
      <AbsoluteFill
        style={{zIndex: 7, pointerEvents: "none"}}
        data-animation-tags="showcase motion asset"
        data-animation-registry-ref="host:motion-showcase-overlay"
      >
        <div
          style={{
            ...getCaptionContainerStyle(upperSafeZone, model.captionBias),
            position: "absolute",
            fontSize: "clamp(46px, 5.5vw, 84px)",
            lineHeight: 1.04,
            letterSpacing: "-0.02em"
          }}
        >
          {activeCue.cueSource === "direct-asset" ? (
            <RawCueAsset
              cue={activeCue}
              visibility={visibility}
              translateY={travel}
              scale={scale}
              rotation={rotation}
              style={{
                position: "absolute",
                left: `${landscapeAnchor.leftPercent}%`,
                top: `calc(${landscapeAnchor.topPercent}% - ${getCueAnchorLiftEm(activeCue)}em)`
              }}
            />
          ) : (
            <SemanticSidecallCueVisual
              cue={activeCue}
              visibility={visibility}
              translateY={travel}
              scale={scale}
              rotation={rotation}
              style={{
                position: "absolute",
                left: `${landscapeAnchor.leftPercent}%`,
                top: `calc(${landscapeAnchor.topPercent}% - 0.38em)`
              }}
            />
          )}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        zIndex: 7,
        pointerEvents: "none"
      }}
      data-animation-tags="showcase motion asset"
      data-animation-registry-ref="host:motion-showcase-overlay"
    >
      {activeCue.cueSource === "direct-asset" ? (
        <RawCueAsset
          cue={activeCue}
          visibility={visibility}
          translateY={travel}
          scale={scale}
          rotation={rotation}
          style={getFallbackPlacementStyle(activeCue)}
        />
      ) : (
        <SemanticSidecallCueVisual
          cue={activeCue}
          visibility={visibility}
          translateY={travel}
          scale={scale}
          rotation={rotation}
          style={getFallbackPlacementStyle(activeCue)}
        />
      )}
    </AbsoluteFill>
  );
};
