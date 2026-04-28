export const LOCAL_PREVIEW_CAPTION_PROFILE_IDS = [
  "longform_eve_typography_v1",
  "longform_svg_typography_v1",
  "longform_docked_inverse_v1",
  "longform_semantic_sidecall_v1"
] as const;

export type LocalPreviewCaptionProfileId = (typeof LOCAL_PREVIEW_CAPTION_PROFILE_IDS)[number];

export const DEFAULT_LOCAL_PREVIEW_CAPTION_PROFILE_ID: LocalPreviewCaptionProfileId =
  "longform_eve_typography_v1";

const LOCAL_PREVIEW_CAPTION_PROFILE_ALIASES: Record<string, LocalPreviewCaptionProfileId> = {
  eve_typography_v1: "longform_eve_typography_v1",
  longform_typography_eve_v1: "longform_eve_typography_v1",
  longform_svg_typography_v1: "longform_svg_typography_v1",
  longform_typography_svg_v1: "longform_svg_typography_v1",
  svg_typography_v1: "longform_svg_typography_v1",
  hormozi_word_lock_v1: "longform_svg_typography_v1",
  longform_docked_inverse_v1: "longform_docked_inverse_v1",
  longform_semantic_sidecall_v1: "longform_semantic_sidecall_v1"
};

export const normalizeLocalPreviewCaptionProfileId = (
  value: unknown
): LocalPreviewCaptionProfileId => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const aliased = LOCAL_PREVIEW_CAPTION_PROFILE_ALIASES[normalized];
    if (aliased) {
      return aliased;
    }
  }

  return LOCAL_PREVIEW_CAPTION_PROFILE_IDS.includes(value as LocalPreviewCaptionProfileId)
    ? value as LocalPreviewCaptionProfileId
    : DEFAULT_LOCAL_PREVIEW_CAPTION_PROFILE_ID;
};
