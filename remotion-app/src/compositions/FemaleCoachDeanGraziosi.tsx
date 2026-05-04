import React, {useMemo} from "react";
import {AbsoluteFill, staticFile, useRemotionEnvironment} from "remotion";
import {loadFont as loadAllura} from "@remotion/google-fonts/Allura";
import {loadFont as loadAnton} from "@remotion/google-fonts/Anton";
import {loadFont as loadBebasNeue} from "@remotion/google-fonts/BebasNeue";
import {loadFont as loadBodoniModa} from "@remotion/google-fonts/BodoniModa";
import {loadFont as loadCinzel} from "@remotion/google-fonts/Cinzel";
import {loadFont as loadCormorantGaramond} from "@remotion/google-fonts/CormorantGaramond";
import {loadFont as loadGreatVibes} from "@remotion/google-fonts/GreatVibes";
import {loadFont as loadLeagueGothic} from "@remotion/google-fonts/LeagueGothic";
import {loadFont as loadOswald} from "@remotion/google-fonts/Oswald";
import {loadFont as loadPlayfairDisplay} from "@remotion/google-fonts/PlayfairDisplay";
import {loadFont as loadTeko} from "@remotion/google-fonts/Teko";
import {loadFont as loadDMSans} from "@remotion/google-fonts/DMSans";
import {loadFont as loadDMSerifDisplay} from "@remotion/google-fonts/DMSerifDisplay";

import {CinematicCaptionOverlay} from "../components/CinematicCaptionOverlay";
import {LongformDockedInverseOverlay} from "../components/LongformDockedInverseOverlay";
import {LongformSemanticSidecallOverlay} from "../components/LongformSemanticSidecallOverlay";
import {LongformWordByWordOverlay} from "../components/LongformWordByWordOverlay";
import {
  buildMotionCompositionModel,
  CaptionFocusVignette,
  LongformTypographyBiasOverlay,
  Motion3DOverlay,
  MotionChoreographyOverlay,
  MotionAssetOverlay,
  MotionMatteForeground,
  MotionVideoBackdrop
} from "../components/MotionGraphicsEngine";
import {MotionBackgroundOverlay} from "../components/MotionBackgroundOverlay";
import {CinematicPiPOverlay} from "../components/CinematicPiPOverlay";
import {MotionTransitionOverlay} from "../components/MotionTransitionOverlay";
import {MotionSoundDesign} from "../components/MotionSoundDesign";
import {MotionShowcaseOverlay} from "../components/MotionShowcaseOverlay";
import {SvgCaptionOverlay, isSvgCaptionChunk} from "../components/SvgCaptionOverlay";
import reelVideoMetadata from "../data/video.metadata.json" with {type: "json"};
import {loadEditorialCaptionFonts} from "../lib/cinematic-typography/editorial-fonts";
import {buildPreviewCaptionChunks} from "../lib/preview-caption-data";
import {LONGFORM_SAFE_MOTION_ASSET_FAMILIES} from "../lib/motion-platform/asset-manifests";
import {
  getDefaultCaptionProfileIdForPresentationMode,
  getDefaultVideoAssetForPresentationMode
} from "../lib/presentation-presets";
import {resolvePresentationMode} from "../lib/presentation-mode";
import {
  getLongformCaptionRenderMode,
  normalizeCaptionStyleProfileId
} from "../lib/stylebooks/caption-style-profiles";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  MotionGradeProfileId,
  MotionMatteMode,
  MotionTier,
  Motion3DMode,
  CinematicPiPLayoutPreset,
  PreviewPerformanceMode,
  PresentationModeSetting,
  VideoMetadata,
  TransitionOverlayMode
} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {TransitionOverlayRules} from "../lib/motion-platform/transition-overlay-config";
import "../styles/cinematic.css";

const fontLoadOptions = {
  subsets: ["latin"] as ("latin")[],
  ignoreTooManyRequestsWarning: true
};

loadAllura("normal", fontLoadOptions);
loadAnton("normal", fontLoadOptions);
loadBebasNeue("normal", fontLoadOptions);
loadBodoniModa("normal", fontLoadOptions);
loadCinzel("normal", fontLoadOptions);
loadCormorantGaramond("normal", fontLoadOptions);
loadGreatVibes("normal", fontLoadOptions);
loadLeagueGothic("normal", fontLoadOptions);
loadOswald("normal", fontLoadOptions);
loadPlayfairDisplay("normal", fontLoadOptions);
loadTeko("normal", fontLoadOptions);
loadDMSans("normal", fontLoadOptions);
loadDMSerifDisplay("normal", fontLoadOptions);
loadEditorialCaptionFonts();

export type FemaleCoachDeanGraziosiProps = {
  readonly videoSrc?: string;
  readonly videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  readonly presentationMode?: PresentationModeSetting;
  readonly captionChunksOverride?: CaptionChunk[];
  readonly motionTier?: MotionTier | "auto";
  readonly gradeProfileId?: MotionGradeProfileId | "auto";
  readonly transitionPresetId?: string;
  readonly transitionOverlayMode?: TransitionOverlayMode;
  readonly transitionOverlayConfig?: Partial<TransitionOverlayRules>;
  readonly motion3DMode?: Motion3DMode;
  readonly matteMode?: MotionMatteMode | "auto";
  readonly captionProfileId?: CaptionStyleProfileId | "auto";
  readonly captionBias?: CaptionVerticalBias | "auto";
  readonly hideCaptionOverlays?: boolean;
  readonly pipMode?: "off" | "showcase";
  readonly pipLayoutPreset?: CinematicPiPLayoutPreset;
  readonly pipHeadlineText?: string;
  readonly pipSubtextText?: string;
  readonly stabilizePreviewTimeline?: boolean;
  readonly previewTimelineResetVersion?: number;
  readonly previewPerformanceMode?: PreviewPerformanceMode;
  readonly respectPreviewPerformanceModeDuringRender?: boolean;
  readonly motionModelOverride?: MotionCompositionModel | null;
};

export const FemaleCoachDeanGraziosi: React.FC<FemaleCoachDeanGraziosiProps> = ({
  videoSrc,
  videoMetadata = reelVideoMetadata,
  presentationMode = "auto",
  captionChunksOverride,
  motionTier = "auto",
  gradeProfileId,
  transitionPresetId = "auto",
  transitionOverlayMode = "standard",
  transitionOverlayConfig,
  motion3DMode = "off",
  matteMode = "auto",
  captionProfileId,
  captionBias = "auto",
  hideCaptionOverlays = false,
  pipMode = "off",
  pipLayoutPreset,
  pipHeadlineText,
  pipSubtextText,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0,
  previewPerformanceMode = "full",
  respectPreviewPerformanceModeDuringRender = false,
  motionModelOverride = null
}) => {
  const remotionEnvironment = useRemotionEnvironment();
  const useRealtimePreviewPath = stabilizePreviewTimeline && !remotionEnvironment.isRendering;
  const resolvedPreviewPerformanceMode = remotionEnvironment.isRendering && !respectPreviewPerformanceModeDuringRender
    ? "full"
    : previewPerformanceMode;
  const resolvedPresentationMode = resolvePresentationMode(videoMetadata, presentationMode);
  const resolvedVideoSrc = videoSrc ?? staticFile(getDefaultVideoAssetForPresentationMode(resolvedPresentationMode));
  const interactivePreviewVideoSrc = useMemo(() => {
    if (remotionEnvironment.isRendering) {
      return resolvedVideoSrc;
    }

    if (
      resolvedVideoSrc.includes("?") ||
      /\.preview\.mp4$/i.test(resolvedVideoSrc) ||
      !/\.mp4$/i.test(resolvedVideoSrc)
    ) {
      return resolvedVideoSrc;
    }

    return resolvedVideoSrc.replace(/\.mp4$/i, ".preview.mp4");
  }, [remotionEnvironment.isRendering, resolvedPreviewPerformanceMode, resolvedVideoSrc]);
  const resolvedCaptionProfileId = normalizeCaptionStyleProfileId(
    captionProfileId && captionProfileId !== "auto"
      ? captionProfileId
      : getDefaultCaptionProfileIdForPresentationMode(resolvedPresentationMode)
  );
  const captionChunks = useMemo(
    () => captionChunksOverride ?? buildPreviewCaptionChunks(resolvedCaptionProfileId, resolvedPresentationMode),
    [captionChunksOverride, resolvedCaptionProfileId, resolvedPresentationMode]
  );
  const longformCaptionRenderMode = useMemo(
    () => getLongformCaptionRenderMode(resolvedCaptionProfileId),
    [resolvedCaptionProfileId]
  );
  const showPiPShowcase = pipMode === "showcase";
  const svgCaptionChunks = useMemo(
    () => captionChunks.filter((chunk) => isSvgCaptionChunk(chunk)),
    [captionChunks]
  );
  const cinematicCaptionChunks = useMemo(
    () => captionChunks.filter((chunk) => !isSvgCaptionChunk(chunk)),
    [captionChunks]
  );
  const motionModel = useMemo(
    () => motionModelOverride ?? buildMotionCompositionModel({
      chunks: captionChunks,
      tier: motionTier,
      fps: videoMetadata.fps,
      videoMetadata,
      captionProfileId: resolvedCaptionProfileId,
      gradeProfileId,
      transitionPresetId,
      transitionOverlayMode,
      transitionOverlayConfig,
      motion3DMode,
      matteMode,
      captionBias,
      suppressAmbientAssets: false,
      ambientAssetFamilies: resolvedPresentationMode === "long-form"
        ? LONGFORM_SAFE_MOTION_ASSET_FAMILIES
        : undefined
    }),
    [captionBias, captionChunks, gradeProfileId, matteMode, motion3DMode, motionModelOverride, motionTier, resolvedCaptionProfileId, resolvedPresentationMode, transitionOverlayConfig, transitionOverlayMode, transitionPresetId, videoMetadata]
  );
  const captionEditorialContext = useMemo(() => ({
    gradeProfile: motionModel.gradeProfile,
    backgroundOverlayPlan: motionModel.backgroundOverlayPlan,
    captionBias: motionModel.captionBias,
    motionTier: motionModel.tier,
    compositionCombatPlan: motionModel.compositionCombatPlan
  }), [
    motionModel.backgroundOverlayPlan,
    motionModel.captionBias,
    motionModel.compositionCombatPlan,
    motionModel.gradeProfile,
    motionModel.tier
  ]);
  const showBackgroundOverlay = resolvedPreviewPerformanceMode !== "turbo" && !showPiPShowcase;
  const showMotionAssetOverlay = resolvedPreviewPerformanceMode !== "turbo" && !showPiPShowcase;
  const showMatteForeground = resolvedPreviewPerformanceMode === "full" && !showPiPShowcase;
  const showShowcaseOverlay = resolvedPreviewPerformanceMode !== "turbo" && !showPiPShowcase;
  const showSoundDesign = resolvedPreviewPerformanceMode === "full";

  return (
    <AbsoluteFill className="dg-stage">
      <MotionVideoBackdrop
        model={motionModel}
        videoSrc={interactivePreviewVideoSrc}
        presentationMode={resolvedPresentationMode}
        stabilizePreviewTimeline={useRealtimePreviewPath}
        previewTimelineResetVersion={previewTimelineResetVersion}
        previewPerformanceMode={resolvedPreviewPerformanceMode}
      />
      {showSoundDesign ? (
        <MotionSoundDesign
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showPiPShowcase ? (
        <CinematicPiPOverlay
          model={motionModel}
          videoSrc={interactivePreviewVideoSrc}
          videoMetadata={videoMetadata}
          headlineText={pipHeadlineText}
          supportText={pipSubtextText}
          layoutPreset={pipLayoutPreset}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showBackgroundOverlay ? (
        <MotionBackgroundOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showMotionAssetOverlay ? (
        <Motion3DOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showMotionAssetOverlay ? (
        <MotionChoreographyOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showMotionAssetOverlay ? (
        <MotionAssetOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {resolvedPresentationMode !== "long-form" ? (
        <CaptionFocusVignette
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showPiPShowcase ? null : resolvedPresentationMode === "long-form" && longformCaptionRenderMode !== "word-by-word" ? null : (
        <LongformTypographyBiasOverlay
          presentationMode={resolvedPresentationMode}
          captionBias={motionModel.captionBias}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      )}
      {showMatteForeground ? (
        <MotionMatteForeground
          model={motionModel}
          videoSrc={interactivePreviewVideoSrc}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showShowcaseOverlay ? (
        <MotionShowcaseOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showPiPShowcase ? null : (
        <MotionTransitionOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      )}
      {hideCaptionOverlays ? null : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "word-by-word" ? (
        <LongformWordByWordOverlay
          captionProfileId={resolvedCaptionProfileId}
          chunks={captionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "docked-inverse" ? (
        <LongformDockedInverseOverlay
          chunks={captionChunks}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "semantic-sidecall" ? (
        <LongformSemanticSidecallOverlay
          chunks={captionChunks}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" ? null : cinematicCaptionChunks.length > 0 ? (
        <CinematicCaptionOverlay
          chunks={cinematicCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
        />
      ) : null}
      {hideCaptionOverlays ? null : resolvedPresentationMode !== "long-form" && svgCaptionChunks.length > 0 ? (
        <SvgCaptionOverlay
          chunks={svgCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
        />
      ) : null}
    </AbsoluteFill>
  );
};
