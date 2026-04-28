import React, {useMemo} from "react";
import {Audio, Sequence, interpolate, staticFile, useVideoConfig} from "remotion";

import type {MotionSoundCue} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import {hasValidMediaTrimWindow} from "../lib/motion-platform/media-trim";
import {
  isFrameRangeInsidePreviewWindow,
  shouldWindowPreviewCues,
  useStablePreviewFrame
} from "../lib/preview-runtime-stability";

type MotionSoundDesignProps = {
  model: MotionCompositionModel;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
};

const PREVIEW_AUDIO_ACCEPTABLE_TIMESHIFT_SECONDS = 3;

const resolveSoundSrc = (src: string): string => {
  if (/^(https?:)?\/\//.test(src)) {
    return src;
  }
  return staticFile(src);
};

const getCueVolumeEnvelope = ({
  cue,
  frame
}: {
  cue: MotionSoundCue;
  frame: number;
}): number => {
  const introEnd = Math.max(1, cue.fadeInFrames);
  const outroStart = Math.max(introEnd + 1, cue.playFrames - cue.fadeOutFrames);
  const sustainPeak = Math.max(introEnd + 1, Math.min(outroStart, Math.round(cue.playFrames * 0.45)));

  if (frame <= introEnd) {
    return interpolate(frame, [0, introEnd], [0, cue.baseVolume], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
  }

  if (frame <= sustainPeak) {
    return interpolate(frame, [introEnd, sustainPeak], [cue.baseVolume, cue.maxVolume], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
  }

  if (frame < outroStart) {
    return cue.maxVolume;
  }

  return interpolate(frame, [outroStart, cue.playFrames], [cue.maxVolume, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
};

export const MotionSoundDesign: React.FC<MotionSoundDesignProps> = ({
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const premountFrames = Math.max(8, Math.round(fps * 0.6));
  const validCues = useMemo(
    () => [...model.soundDesignPlan.musicCues, ...model.soundDesignPlan.cues]
      .filter((cue) => hasValidMediaTrimWindow({
        trimBeforeFrames: cue.trimBeforeFrames,
        trimAfterFrames: cue.trimAfterFrames
      })),
    [model.soundDesignPlan.cues, model.soundDesignPlan.musicCues]
  );
  const mountedCues = useMemo(() => {
    if (!shouldWindowPreviewCues({
      durationInFrames,
      fps,
      cueCount: validCues.length
    })) {
      return validCues;
    }

    return validCues.filter((cue) => {
      const startFrame = Math.max(0, Math.round((cue.startMs / 1000) * fps));
      const endFrame = startFrame + cue.playFrames;
      return isFrameRangeInsidePreviewWindow({
        currentFrame: stableFrame,
        startFrame,
        endFrame
      });
    });
  }, [durationInFrames, fps, stableFrame, validCues]);

  if (!model.soundDesignPlan.enabled) {
    return null;
  }

  return (
    <>
      {mountedCues.map((cue) => {
        const fromFrame = Math.max(0, Math.round((cue.startMs / 1000) * fps));
        return (
          <Sequence
            key={cue.id}
            from={fromFrame}
            durationInFrames={cue.playFrames}
            name={cue.id}
            premountFor={premountFrames}
          >
            <Audio
              src={resolveSoundSrc(cue.asset.src)}
              trimBefore={cue.trimBeforeFrames}
              trimAfter={cue.trimAfterFrames}
              acceptableTimeShiftInSeconds={
                stabilizePreviewTimeline ? PREVIEW_AUDIO_ACCEPTABLE_TIMESHIFT_SECONDS : undefined
              }
              pauseWhenBuffering={!stabilizePreviewTimeline}
              volume={(frame) => getCueVolumeEnvelope({cue, frame})}
            />
          </Sequence>
        );
      })}
    </>
  );
};
