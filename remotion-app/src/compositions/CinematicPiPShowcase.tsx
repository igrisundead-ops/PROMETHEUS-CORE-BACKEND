import React from "react";
import {staticFile} from "remotion";

import {FemaleCoachDeanGraziosi} from "./FemaleCoachDeanGraziosi";
import {getPresentationPreset} from "../lib/presentation-presets";
import {normalizeCaptionStyleProfileId} from "../lib/stylebooks/caption-style-profiles";

const longformPreset = getPresentationPreset("long-form");
const defaultCaptionProfileId = normalizeCaptionStyleProfileId(longformPreset.captionProfileId);

export const CinematicPiPShowcase: React.FC = () => {
  return (
    <FemaleCoachDeanGraziosi
      videoSrc={staticFile(longformPreset.videoAsset)}
      videoMetadata={longformPreset.videoMetadata}
      presentationMode={longformPreset.presentationMode}
      motionTier="premium"
      gradeProfileId="cool-editorial"
      transitionPresetId="auto"
      transitionOverlayMode="off"
      motion3DMode="off"
      matteMode="off"
      captionBias="middle"
      captionProfileId={defaultCaptionProfileId}
      hideCaptionOverlays
      pipMode="showcase"
      pipLayoutPreset="pip-left-content-right"
      pipHeadlineText="PiP is not a box."
      pipSubtextText="The free frame is a storytelling surface."
      stabilizePreviewTimeline
      previewPerformanceMode="balanced"
    />
  );
};

