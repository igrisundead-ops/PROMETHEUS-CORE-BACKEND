import {routeStyleForWords} from "../lib/style-routing";
import {
  LONGFORM_DOCKED_INVERSE_PROFILE_ID,
  LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID,
  normalizeCaptionStyleProfileId
} from "../lib/stylebooks/caption-style-profiles";
import {LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID} from "../lib/stylebooks/svg-typography-v1";
import type {CaptionChunk, CaptionStyleProfileId, PresentationModeSetting} from "../lib/types";
import {MomentSegmentationAgent} from "./segmentation/moment-segmentation-agent";
import {normalizeText} from "./utils";

const treatmentProfileMap: Record<string, CaptionStyleProfileId> = {
  captionOnly: LONGFORM_DOCKED_INVERSE_PROFILE_ID,
  keywordEmphasis: LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID,
  titleCard: LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID,
  assetSupported: LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID,
  assetLed: LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID,
  backgroundOverlay: LONGFORM_DOCKED_INVERSE_PROFILE_ID,
  cinematicTransition: LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID,
  behindSpeakerDepth: LONGFORM_SEMANTIC_SIDECALL_PROFILE_ID,
  noTreatment: LONGFORM_DOCKED_INVERSE_PROFILE_ID
};

const selectTreatment = (
  momentType: string,
  text: string,
  wordCount: number,
  momentIndex: number
): keyof typeof treatmentProfileMap => {
  const normalized = normalizeText(text);
  if (momentType === "explanation" && wordCount >= 12) {
    return "captionOnly";
  }
  if (momentIndex === 0) {
    return "titleCard";
  }
  if (momentType === "hook" || momentType === "title" || momentType === "payoff") {
    return "titleCard";
  }
  if (momentType === "question") {
    return "keywordEmphasis";
  }
  if (momentType === "transition") {
    return "cinematicTransition";
  }
  if (momentType === "ambient" && wordCount <= 4) {
    return "noTreatment";
  }
  if (/(mistake|bottleneck|risk|problem|warning|fix|solution)/.test(normalized)) {
    return "assetLed";
  }
  if (wordCount <= 3) {
    return "keywordEmphasis";
  }
  if (wordCount >= 12) {
    return "captionOnly";
  }
  return "assetSupported";
};

export const buildCreativePreviewCaptionChunks = (
  captionChunks: CaptionChunk[],
  options: {
    profileId?: string | null;
    presentationMode?: PresentationModeSetting | null;
  } = {}
): CaptionChunk[] => {
  const segmenter = new MomentSegmentationAgent();
  const moments = segmenter.segment({
    jobId: `creative-preview-${options.profileId ?? "default"}-${options.presentationMode ?? "reel"}`,
    captionProfileId: options.profileId ? normalizeCaptionStyleProfileId(options.profileId) : null,
    renderMode: "overlay-preview",
    chunks: captionChunks
  });
  const momentByChunkId = new Map<string, {momentType: string; treatment: keyof typeof treatmentProfileMap; index: number}>();

  moments.forEach((moment, index) => {
    moment.chunkIds?.forEach((chunkId) => {
      momentByChunkId.set(chunkId, {
        momentType: moment.momentType,
        treatment: selectTreatment(moment.momentType, moment.transcriptText, moment.words.length, index),
        index
      });
    });
  });

  return captionChunks.map((chunk, chunkIndex) => {
    const info = momentByChunkId.get(chunk.id);
    if (!info) {
      return chunk;
    }

    const profileId: CaptionStyleProfileId = normalizeCaptionStyleProfileId(
      treatmentProfileMap[info.treatment] ?? options.profileId ?? "slcp"
    );
    const routed = routeStyleForWords(
      chunk.words.map((word) => word.text),
      chunk.semantic,
      {
        profileId,
        chunkIndex: info.index ?? chunkIndex
      }
    );
    const suppressDefault = info.treatment === "noTreatment" || chunk.suppressDefault === true;

    return {
      ...chunk,
      profileId,
      styleKey: routed.styleKey,
      motionKey: routed.motionKey,
      layoutVariant: routed.layoutVariant,
      suppressDefault,
      semantic: {
        ...(chunk.semantic ?? {
          intent: "default",
          nameSpans: [],
          isVariation: false,
          suppressDefault: false
        }),
        suppressDefault
      }
    };
  });
};
