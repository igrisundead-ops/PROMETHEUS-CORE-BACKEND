import {routeStyleForWords} from "../lib/style-routing";
import {normalizeCaptionStyleProfileId} from "../lib/stylebooks/caption-style-profiles";
import type {CaptionChunk, CaptionStyleProfileId, PresentationModeSetting} from "../lib/types";
import {MomentSegmentationAgent} from "./segmentation/moment-segmentation-agent";
import {normalizeText} from "./utils";

const treatmentProfileMap: Record<string, CaptionStyleProfileId> = {
  captionOnly: "slcp",
  keywordEmphasis: "svg_typography_v1",
  titleCard: "longform_svg_typography_v1",
  assetSupported: "longform_semantic_sidecall_v1",
  assetLed: "longform_semantic_sidecall_v1",
  backgroundOverlay: "svg_typography_v1",
  cinematicTransition: "svg_typography_v1",
  behindSpeakerDepth: "longform_semantic_sidecall_v1",
  noTreatment: "slcp"
};

const selectTreatment = (momentType: string, text: string, wordCount: number): keyof typeof treatmentProfileMap => {
  const normalized = normalizeText(text);
  if (momentType === "hook" || momentType === "title" || momentType === "payoff") {
    return wordCount <= 4 ? "titleCard" : "keywordEmphasis";
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
    captionProfileId: options.profileId ?? null,
    renderMode: "overlay-preview",
    chunks: captionChunks
  });
  const momentByChunkId = new Map<string, {momentType: string; treatment: keyof typeof treatmentProfileMap; index: number}>();

  moments.forEach((moment, index) => {
    moment.chunkIds?.forEach((chunkId) => {
      momentByChunkId.set(chunkId, {
        momentType: moment.momentType,
        treatment: selectTreatment(moment.momentType, moment.transcriptText, moment.words.length),
        index
      });
    });
  });

  return captionChunks.map((chunk, chunkIndex) => {
    const info = momentByChunkId.get(chunk.id);
    if (!info) {
      return chunk;
    }

    const profileId = normalizeCaptionStyleProfileId(treatmentProfileMap[info.treatment] ?? options.profileId ?? "slcp");
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

