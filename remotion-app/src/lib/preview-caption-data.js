import longformTranscriptWords from "../data/transcript.longform.words.json";
import transcriptWords from "../data/transcript.words.json";
import { deterministicChunkWords, mapWordChunksToCaptionChunks } from "./caption-chunker";
import { normalizeCaptionStyleProfileId } from "./stylebooks/caption-style-profiles";
const previewTranscriptWordsByMode = {
    reel: transcriptWords,
    "long-form": longformTranscriptWords
};
const previewCaptionCache = new Map();
const normalizePreviewPresentationMode = (presentationMode) => {
    return presentationMode === "long-form" ? "long-form" : "reel";
};
export const getPreviewTranscriptWords = (presentationMode) => {
    return previewTranscriptWordsByMode[normalizePreviewPresentationMode(presentationMode)];
};
export const buildPreviewCaptionChunks = (profileId, presentationMode) => {
    const normalizedProfileId = normalizeCaptionStyleProfileId(profileId);
    const normalizedPresentationMode = normalizePreviewPresentationMode(presentationMode);
    const cacheKey = `${normalizedPresentationMode}:${normalizedProfileId}`;
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
    previewCaptionCache.set(cacheKey, mappedChunks);
    return mappedChunks;
};
