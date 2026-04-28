import React, {useEffect, useMemo} from "react";
import {Player} from "@remotion/player";

import {FemaleCoachDeanGraziosi} from "../compositions/FemaleCoachDeanGraziosi";
import type {CaptionStyleProfileId, PreviewPerformanceMode, VideoMetadata} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {PreviewPlaybackHealth} from "./preview-telemetry";

type RemotionPreviewPlayerProps = {
  readonly videoSrc: string;
  readonly videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  readonly motionModel: MotionCompositionModel;
  readonly captionProfileId: CaptionStyleProfileId;
  readonly previewPerformanceMode: PreviewPerformanceMode;
  readonly onHealthChange?: (health: PreviewPlaybackHealth) => void;
  readonly onErrorMessageChange?: (message: string | null) => void;
};

export const RemotionPreviewPlayer: React.FC<RemotionPreviewPlayerProps> = ({
  videoSrc,
  videoMetadata,
  motionModel,
  captionProfileId,
  previewPerformanceMode,
  onHealthChange,
  onErrorMessageChange
}) => {
  const inputProps = useMemo(() => {
    return {
      videoSrc,
      videoMetadata,
      presentationMode: "long-form" as const,
      motionTier: motionModel.tier,
      transitionOverlayMode: "standard" as const,
      motion3DMode: motionModel.motion3DPlan.enabled ? "editorial" as const : "off" as const,
      captionProfileId,
      captionBias: motionModel.captionBias,
      stabilizePreviewTimeline: true,
      previewPerformanceMode,
      motionModelOverride: motionModel,
      captionChunksOverride: motionModel.chunks
    };
  }, [captionProfileId, motionModel, previewPerformanceMode, videoMetadata, videoSrc]);

  useEffect(() => {
    onHealthChange?.("ready");
    onErrorMessageChange?.(null);
  }, [onErrorMessageChange, onHealthChange]);

  return (
    <div className="remotion-preview-player-shell" data-preview-mode="remotion-player">
      <Player
        key={`${videoSrc}-${motionModel.tier}-${captionProfileId}-${previewPerformanceMode}`}
        component={FemaleCoachDeanGraziosi}
        inputProps={inputProps}
        durationInFrames={videoMetadata.durationInFrames}
        compositionWidth={videoMetadata.width}
        compositionHeight={videoMetadata.height}
        fps={videoMetadata.fps}
        controls
        clickToPlay
        doubleClickToFullscreen
        showVolumeControls
        style={{
          width: "100%",
          height: "100%"
        }}
        errorFallback={({error}) => {
          onHealthChange?.("error");
          onErrorMessageChange?.(error.message);
          return (
            <div className="remotion-preview-error">
              <strong>Remotion preview failed</strong>
              <span>{error.message}</span>
            </div>
          );
        }}
        acknowledgeRemotionLicense
      />
    </div>
  );
};
