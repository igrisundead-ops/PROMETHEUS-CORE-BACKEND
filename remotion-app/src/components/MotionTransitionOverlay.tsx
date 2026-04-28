import React, {CSSProperties, useMemo} from "react";
import {AbsoluteFill, Html5Video, OffthreadVideo, useVideoConfig} from "remotion";

import {hasValidMediaTrimWindow} from "../lib/motion-platform/media-trim";
import {
  getTransitionOverlayVisibility,
  lerp,
  resolveTransitionOverlayBlendMode,
  resolveTransitionOverlaySrc,
  clamp01
} from "../lib/motion-platform/transition-overlay-render-utils";
import {selectActiveTransitionOverlayCueAtTime} from "../lib/motion-platform/transition-overlay-planner";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";

type MotionTransitionOverlayProps = {
  model: MotionCompositionModel;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
};

const PRELOAD_LEAD_MS = 650;
const PREVIEW_TRANSITION_ACCEPTABLE_TIMESHIFT_SECONDS = 2;

export const MotionTransitionOverlay: React.FC<MotionTransitionOverlayProps> = ({
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {fps, width, height} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = (stableFrame / fps) * 1000;
  const activeCue = useMemo(
    () => {
      const liveCue = selectActiveTransitionOverlayCueAtTime({
        cues: model.transitionOverlayPlan.cues,
        currentTimeMs
      });
      if (liveCue) {
        return liveCue;
      }

      return model.transitionOverlayPlan.cues.find((cue) => {
        return currentTimeMs >= cue.startMs - PRELOAD_LEAD_MS && currentTimeMs < cue.startMs;
      }) ?? null;
    },
    [currentTimeMs, model.transitionOverlayPlan.cues]
  );

  if (!activeCue || !model.transitionOverlayPlan.enabled) {
    return null;
  }

  if (!hasValidMediaTrimWindow({
    trimBeforeFrames: activeCue.trimBeforeFrames,
    trimAfterFrames: activeCue.trimAfterFrames
  })) {
    return null;
  }

  const visibility = getTransitionOverlayVisibility({
    cue: activeCue,
    currentTimeMs
  });
  const driftScale = lerp(1.01, 1, visibility) * lerp(
    1,
    1.006,
    clamp01((currentTimeMs - activeCue.peakEndMs) / Math.max(1, activeCue.endMs - activeCue.peakEndMs))
  );
  const renderWidth = activeCue.asset.width * activeCue.fitStrategy.coverScale * activeCue.fitStrategy.overlayScale * driftScale;
  const renderHeight = activeCue.asset.height * activeCue.fitStrategy.coverScale * activeCue.fitStrategy.overlayScale * driftScale;
  const opacity = visibility * activeCue.peakOpacity;
  const containerStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: renderWidth,
    height: renderHeight,
    transform: `translate3d(-50%, -50%, 0) rotate(${activeCue.fitStrategy.rotateDeg}deg)`,
    transformOrigin: "center center",
    opacity,
    mixBlendMode: resolveTransitionOverlayBlendMode(activeCue.blendMode),
    willChange: "transform, opacity",
    pointerEvents: "none"
  };

  return (
    <AbsoluteFill style={{zIndex: 8, pointerEvents: "none", overflow: "hidden"}}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(7, 11, 20, ${(0.02 + visibility * 0.024).toFixed(3)}), rgba(7, 11, 20, ${(0.01 + visibility * 0.016).toFixed(3)}))`
        }}
      />
      <div style={containerStyle}>
        {stabilizePreviewTimeline ? (
          <Html5Video
            src={resolveTransitionOverlaySrc(activeCue.asset.src)}
            muted
            acceptableTimeShiftInSeconds={PREVIEW_TRANSITION_ACCEPTABLE_TIMESHIFT_SECONDS}
            pauseWhenBuffering={false}
            trimBefore={activeCue.trimBeforeFrames}
            trimAfter={activeCue.trimAfterFrames}
            style={{
              width: width > 0 ? renderWidth : "100%",
              height: height > 0 ? renderHeight : "100%",
              objectFit: "cover",
              filter: "saturate(1.04) contrast(1.05)",
              opacity: 0.99
            }}
          />
        ) : (
          <OffthreadVideo
            src={resolveTransitionOverlaySrc(activeCue.asset.src)}
            muted
            pauseWhenBuffering
            trimBefore={activeCue.trimBeforeFrames}
            trimAfter={activeCue.trimAfterFrames}
            style={{
              width: width > 0 ? renderWidth : "100%",
              height: height > 0 ? renderHeight : "100%",
              objectFit: "cover",
              filter: "saturate(1.04) contrast(1.05)",
              opacity: 0.99
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};
