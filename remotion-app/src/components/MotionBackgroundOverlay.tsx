import React, {CSSProperties, useMemo} from "react";
import {AbsoluteFill, Html5Video, OffthreadVideo, staticFile, useVideoConfig} from "remotion";

import {selectActiveMotionBackgroundOverlayCueAtTime} from "../lib/motion-platform/background-overlay-planner";
import {resolveBackgroundOverlayRenderState} from "../lib/motion-platform/background-overlay-visuals";
import {hasValidMediaTrimWindow} from "../lib/motion-platform/media-trim";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";

type MotionBackgroundOverlayProps = {
  model: MotionCompositionModel;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
};

const resolveOverlaySrc = (src: string): string => {
  if (/^(https?:)?\/\//.test(src)) {
    return src;
  }
  return staticFile(src);
};

const PRELOAD_LEAD_MS = 700;
const PREVIEW_OVERLAY_ACCEPTABLE_TIMESHIFT_SECONDS = 2;

export const MotionBackgroundOverlay: React.FC<MotionBackgroundOverlayProps> = ({
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {fps, width, height} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  if (!model.backgroundOverlayPlan.enabled || model.backgroundOverlayPlan.cues.length === 0) {
    return null;
  }
  const currentTimeMs = (stableFrame / fps) * 1000;
  const activeCue = useMemo(
    () => {
      const liveCue = selectActiveMotionBackgroundOverlayCueAtTime({
        cues: model.backgroundOverlayPlan.cues,
        currentTimeMs
      });
      if (liveCue) {
        return liveCue;
      }

      return model.backgroundOverlayPlan.cues.find((cue) => {
        return currentTimeMs >= cue.startMs - PRELOAD_LEAD_MS && currentTimeMs < cue.startMs;
      }) ?? null;
    },
    [currentTimeMs, model.backgroundOverlayPlan.cues]
  );

  if (!activeCue) {
    return null;
  }

  if (!hasValidMediaTrimWindow({
    trimBeforeFrames: activeCue.trimBeforeFrames,
    trimAfterFrames: activeCue.trimAfterFrames
  })) {
    return null;
  }

  const visual = resolveBackgroundOverlayRenderState({
    cue: activeCue,
    currentTimeMs,
    outputWidth: width,
    outputHeight: height,
    captionBias: model.captionBias
  });
  const containerStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: visual.mediaWidth,
    height: visual.mediaHeight,
    transform: `translate3d(calc(-50% + ${visual.mediaOffsetX.toFixed(2)}px), calc(-50% + ${visual.mediaOffsetY.toFixed(2)}px), 0) rotate(${activeCue.fitStrategy.rotateDeg}deg)`,
    transformOrigin: "center center",
    opacity: visual.visibility,
    willChange: "transform, opacity, filter",
    filter: visual.mediaFilter,
    pointerEvents: "none"
  };

  return (
    <AbsoluteFill style={{zIndex: 3, pointerEvents: "none", overflow: "hidden"}}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: visual.veilGradient,
          opacity: visual.veilOpacity
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: visual.haloWidth,
          height: visual.haloHeight,
          transform: `translate3d(calc(-50% + ${visual.haloOffsetX.toFixed(2)}px), calc(-50% + ${visual.haloOffsetY.toFixed(2)}px), 0) rotate(${activeCue.fitStrategy.rotateDeg}deg)`,
          transformOrigin: "center center",
          background: visual.haloGradient,
          filter: "blur(34px)",
          opacity: visual.haloOpacity,
          mixBlendMode: visual.glowBlendMode,
          pointerEvents: "none"
        }}
      />
      <div style={containerStyle}>
        {stabilizePreviewTimeline ? (
          <Html5Video
            src={resolveOverlaySrc(activeCue.asset.src)}
            muted
            acceptableTimeShiftInSeconds={PREVIEW_OVERLAY_ACCEPTABLE_TIMESHIFT_SECONDS}
            pauseWhenBuffering={false}
            trimBefore={activeCue.trimBeforeFrames}
            trimAfter={activeCue.trimAfterFrames}
            style={{
              width: width > 0 ? visual.mediaWidth : "100%",
              height: height > 0 ? visual.mediaHeight : "100%",
              objectFit: "cover",
              opacity: 0.98
            }}
          />
        ) : (
          <OffthreadVideo
            src={resolveOverlaySrc(activeCue.asset.src)}
            muted
            pauseWhenBuffering
            trimBefore={activeCue.trimBeforeFrames}
            trimAfter={activeCue.trimAfterFrames}
            style={{
              width: width > 0 ? visual.mediaWidth : "100%",
              height: height > 0 ? visual.mediaHeight : "100%",
              objectFit: "cover",
              opacity: 0.98
            }}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: visual.grainGradient,
          opacity: visual.grainOpacity,
          mixBlendMode: "soft-light",
          pointerEvents: "none"
        }}
      />
    </AbsoluteFill>
  );
};
