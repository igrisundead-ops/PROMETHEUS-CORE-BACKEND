import reelVideoMetadata from "../data/video.metadata.json" with {type: "json"};
import longformIngestManifestJson from "../data/ingest.longform.json" with {type: "json"};
import longformVideoMetadata from "../data/video.longform.metadata.json" with {type: "json"};
import {getPublicAssetPathFromOutput, type IngestManifest} from "./ingest-manifest";
import {resolvePresentationMode} from "./presentation-mode";
import type {CaptionStyleProfileId, PresentationMode, PresentationModeSetting, VideoMetadata} from "./types";
import {LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID} from "./stylebooks/svg-typography-v1";

export const REEL_VIDEO_ASSET = "input-video.mp4";
export const LONGFORM_VIDEO_ASSET = "input-video-landscape.mp4";
const longformIngestManifest = longformIngestManifestJson as Partial<IngestManifest>;
const CURRENT_LONGFORM_VIDEO_ASSET =
  getPublicAssetPathFromOutput(longformIngestManifest.outputs?.videoPublicPath) ?? LONGFORM_VIDEO_ASSET;

export const REEL_VIDEO_METADATA = reelVideoMetadata as VideoMetadata;
export const LONGFORM_VIDEO_METADATA = longformVideoMetadata as VideoMetadata;

export type PresentationPreset = {
  presentationMode: PresentationMode;
  videoAsset: string;
  videoMetadata: VideoMetadata;
  captionProfileId: CaptionStyleProfileId;
};

export const getDefaultCaptionProfileIdForPresentationMode = (
  presentationMode: PresentationMode
): CaptionStyleProfileId => {
  return presentationMode === "long-form" ? LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID : "slcp";
};

export const getDefaultVideoAssetForPresentationMode = (presentationMode: PresentationMode): string => {
  return presentationMode === "long-form" ? CURRENT_LONGFORM_VIDEO_ASSET : REEL_VIDEO_ASSET;
};

export const getDefaultVideoMetadataForPresentationMode = (presentationMode: PresentationMode): VideoMetadata => {
  return presentationMode === "long-form" ? LONGFORM_VIDEO_METADATA : REEL_VIDEO_METADATA;
};

export const getPresentationPreset = (
  presentationMode: PresentationModeSetting | undefined,
  fallbackVideoMetadata: Pick<VideoMetadata, "width" | "height"> = REEL_VIDEO_METADATA
): PresentationPreset => {
  const resolvedMode =
    presentationMode && presentationMode !== "auto"
      ? presentationMode
      : resolvePresentationMode(fallbackVideoMetadata);

  return {
    presentationMode: resolvedMode,
    videoAsset: getDefaultVideoAssetForPresentationMode(resolvedMode),
    videoMetadata: getDefaultVideoMetadataForPresentationMode(resolvedMode),
    captionProfileId: getDefaultCaptionProfileIdForPresentationMode(resolvedMode)
  };
};
