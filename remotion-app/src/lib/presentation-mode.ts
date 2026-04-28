import type {PresentationMode, PresentationModeSetting, VideoMetadata} from "./types";

export const DEFAULT_PRESENTATION_MODE: PresentationMode = "reel";

export const resolvePresentationMode = (
  videoMetadata: Pick<VideoMetadata, "width" | "height">,
  explicit?: PresentationModeSetting
): PresentationMode => {
  if (explicit && explicit !== "auto") {
    return explicit;
  }

  if (videoMetadata.width > 0 && videoMetadata.height > 0 && videoMetadata.width >= videoMetadata.height) {
    return "long-form";
  }

  return DEFAULT_PRESENTATION_MODE;
};
