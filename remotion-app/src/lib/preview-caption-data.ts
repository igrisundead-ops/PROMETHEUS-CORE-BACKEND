import longformTranscriptWords from "../data/transcript.longform.words.json" with {type: "json"};
import transcriptWords from "../data/transcript.words.json" with {type: "json"};
import {deterministicChunkWords, mapWordChunksToCaptionChunks} from "./caption-chunker";
import {isCreativeOrchestrationEnabled} from "./env";
import {normalizeCaptionStyleProfileId} from "./stylebooks/caption-style-profiles";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  PresentationMode,
  PresentationModeSetting,
  TranscribedWord
} from "./types";
import {buildCreativePreviewCaptionChunks} from "../creative-orchestration/preview";

const previewTranscriptWordsByMode: Record<PresentationMode, TranscribedWord[]> = {
  reel: transcriptWords as TranscribedWord[],
  "long-form": longformTranscriptWords as TranscribedWord[]
};
const previewCaptionCache = new Map<string, CaptionChunk[]>();

const normalizePreviewPresentationMode = (
  presentationMode?: PresentationModeSetting | null
): PresentationMode => {
  return presentationMode === "long-form" ? "long-form" : "reel";
};

export const getPreviewTranscriptWords = (
  presentationMode?: PresentationModeSetting | null
): TranscribedWord[] => {
  return previewTranscriptWordsByMode[normalizePreviewPresentationMode(presentationMode)];
};

export const buildPreviewCaptionChunks = (
  profileId?: string | null,
  presentationMode?: PresentationModeSetting | null
): CaptionChunk[] => {
  const normalizedProfileId = normalizeCaptionStyleProfileId(profileId);
  const normalizedPresentationMode = normalizePreviewPresentationMode(presentationMode);
  const creativeOrchestrationState = isCreativeOrchestrationEnabled() ? "creative-on" : "creative-off";
  const cacheKey = `${creativeOrchestrationState}:${normalizedPresentationMode}:${normalizedProfileId}`;
  const cached = previewCaptionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const transcriptWords = getPreviewTranscriptWords(normalizedPresentationMode);
  const deterministicChunks = deterministicChunkWords(transcriptWords, {
    profileId: normalizedProfileId
  });
  const mappedChunks = mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
    profileId: normalizedProfileId
  });
  const creativeChunks = isCreativeOrchestrationEnabled()
    ? buildCreativePreviewCaptionChunks(mappedChunks, {
        profileId: normalizedProfileId,
        presentationMode: normalizedPresentationMode
      })
    : mappedChunks;

  previewCaptionCache.set(cacheKey, creativeChunks);
  return creativeChunks;
};
