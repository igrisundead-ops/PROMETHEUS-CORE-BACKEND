import React from "react";
import {Composition, staticFile} from "remotion";

import {FemaleCoachDeanGraziosi} from "./compositions/FemaleCoachDeanGraziosi";
import {CreativeAudioPreview} from "./compositions/CreativeAudioPreview";
import {CinematicPiPShowcase} from "./compositions/CinematicPiPShowcase";
import {TargetFocusZoomShowcase} from "./compositions/TargetFocusZoomShowcase";
import {choreographyProofChunks} from "./data/choreography-proof.chunks";
import {
  getLongformDraftVideoMetadata,
  LONGFORM_DRAFT_COMPOSITION_ID,
  LONGFORM_DRAFT_VIDEO_ASSET
} from "./lib/draft-preview";
import {HouseFontBootstrap} from "./lib/cinematic-typography/house-font-loader";
import {getPresentationPreset} from "./lib/presentation-presets";
import {normalizeCaptionStyleProfileId} from "./lib/stylebooks/caption-style-profiles";

const envCaptionProfileId = typeof process !== "undefined" ? process.env.CAPTION_STYLE_PROFILE : undefined;
const defaultCaptionProfileId = envCaptionProfileId?.trim()
  ? normalizeCaptionStyleProfileId(envCaptionProfileId)
  : undefined;
const reelPreset = getPresentationPreset("reel");
const longFormPreset = getPresentationPreset("long-form");
const longFormDraftVideoMetadata = getLongformDraftVideoMetadata(longFormPreset.videoMetadata);
const choreographyProofVideoMetadata = {
  width: reelPreset.videoMetadata.width,
  height: reelPreset.videoMetadata.height,
  fps: reelPreset.videoMetadata.fps,
  durationSeconds: 8,
  durationInFrames: reelPreset.videoMetadata.fps * 8
};
const targetFocusShowcaseVideoMetadata = {
  width: reelPreset.videoMetadata.width,
  height: reelPreset.videoMetadata.height,
  fps: reelPreset.videoMetadata.fps,
  durationSeconds: 8,
  durationInFrames: reelPreset.videoMetadata.fps * 8
};
const cinematicPiPShowcaseVideoMetadata = {
  width: longFormPreset.videoMetadata.width,
  height: longFormPreset.videoMetadata.height,
  fps: longFormPreset.videoMetadata.fps,
  durationSeconds: 12,
  durationInFrames: longFormPreset.videoMetadata.fps * 12
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <HouseFontBootstrap />
      <Composition
        id="FemaleCoachDeanGraziosi"
        component={FemaleCoachDeanGraziosi}
        width={reelPreset.videoMetadata.width}
        height={reelPreset.videoMetadata.height}
        fps={reelPreset.videoMetadata.fps}
        durationInFrames={reelPreset.videoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(reelPreset.videoAsset),
          videoMetadata: reelPreset.videoMetadata,
          presentationMode: reelPreset.presentationMode,
          motionTier: "auto",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          matteMode: "auto",
          captionBias: "auto",
          captionProfileId: defaultCaptionProfileId ?? reelPreset.captionProfileId
        }}
      />
      <Composition
        id="MaleHeadVideoLongForm"
        component={FemaleCoachDeanGraziosi}
        width={longFormPreset.videoMetadata.width}
        height={longFormPreset.videoMetadata.height}
        fps={longFormPreset.videoMetadata.fps}
        durationInFrames={longFormPreset.videoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(longFormPreset.videoAsset),
          videoMetadata: longFormPreset.videoMetadata,
          presentationMode: longFormPreset.presentationMode,
          motionTier: "auto",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          matteMode: "auto",
          captionBias: "auto",
          captionProfileId: defaultCaptionProfileId ?? longFormPreset.captionProfileId,
          motion3DMode: "editorial",
          stabilizePreviewTimeline: true,
          previewPerformanceMode: "balanced"
        }}
      />
      <Composition
        id={LONGFORM_DRAFT_COMPOSITION_ID}
        component={CreativeAudioPreview}
        width={longFormDraftVideoMetadata.width}
        height={longFormDraftVideoMetadata.height}
        fps={longFormDraftVideoMetadata.fps}
        durationInFrames={longFormDraftVideoMetadata.durationInFrames}
        defaultProps={{
          sourceAudioSrc: staticFile(LONGFORM_DRAFT_VIDEO_ASSET),
          videoMetadata: longFormDraftVideoMetadata,
          presentationMode: longFormPreset.presentationMode,
          motionTier: "auto",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          transitionOverlayMode: "standard",
          motion3DMode: "editorial",
          matteMode: "auto",
          captionProfileId: defaultCaptionProfileId ?? longFormPreset.captionProfileId,
          captionBias: "auto",
          hideCaptionOverlays: false,
          previewPerformanceMode: "balanced"
        }}
      />
      <Composition
        id="Cinematic3DDemo"
        component={FemaleCoachDeanGraziosi}
        width={reelPreset.videoMetadata.width}
        height={reelPreset.videoMetadata.height}
        fps={reelPreset.videoMetadata.fps}
        durationInFrames={reelPreset.videoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(reelPreset.videoAsset),
          videoMetadata: reelPreset.videoMetadata,
          presentationMode: reelPreset.presentationMode,
          motionTier: "premium",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          transitionOverlayMode: "off",
          motion3DMode: "showcase",
          matteMode: "auto",
          captionBias: "auto",
          captionProfileId: defaultCaptionProfileId ?? reelPreset.captionProfileId
        }}
      />
      <Composition
        id="CinematicChoreographyProof"
        component={FemaleCoachDeanGraziosi}
        width={choreographyProofVideoMetadata.width}
        height={choreographyProofVideoMetadata.height}
        fps={choreographyProofVideoMetadata.fps}
        durationInFrames={choreographyProofVideoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(reelPreset.videoAsset),
          videoMetadata: choreographyProofVideoMetadata,
          presentationMode: reelPreset.presentationMode,
          captionChunksOverride: choreographyProofChunks,
          motionTier: "premium",
          gradeProfileId: "premium-contrast",
          transitionPresetId: "auto",
          transitionOverlayMode: "off",
          motion3DMode: "showcase",
          matteMode: "off",
          captionBias: "middle",
          hideCaptionOverlays: true,
          captionProfileId: defaultCaptionProfileId ?? reelPreset.captionProfileId
        }}
      />
      <Composition
        id="TargetFocusZoomShowcase"
        component={TargetFocusZoomShowcase}
        width={targetFocusShowcaseVideoMetadata.width}
        height={targetFocusShowcaseVideoMetadata.height}
        fps={targetFocusShowcaseVideoMetadata.fps}
        durationInFrames={targetFocusShowcaseVideoMetadata.durationInFrames}
      />
      <Composition
        id="CinematicPiPShowcase"
        component={CinematicPiPShowcase}
        width={cinematicPiPShowcaseVideoMetadata.width}
        height={cinematicPiPShowcaseVideoMetadata.height}
        fps={cinematicPiPShowcaseVideoMetadata.fps}
        durationInFrames={cinematicPiPShowcaseVideoMetadata.durationInFrames}
      />
    </>
  );
};
