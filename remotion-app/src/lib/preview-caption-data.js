import devFixtureTestVideoWordsJson from "../data/dev-fixtures/test-video.words.json";
import longformTranscriptWords from "../data/transcript.longform.words.json";
import transcriptWords from "../data/transcript.words.json";
import { deterministicChunkWords, mapWordChunksToCaptionChunks } from "./caption-chunker";
import { LONGFORM_VIDEO_ASSET, REEL_VIDEO_ASSET } from "./presentation-presets";
import { normalizeCaptionStyleProfileId } from "./stylebooks/caption-style-profiles";
const previewTranscriptWordsByMode = {
    reel: transcriptWords,
    "long-form": longformTranscriptWords
};
const previewCaptionCache = new Map();
export const DEV_FIXTURE_TEST_VIDEO_MEDIA_KEY = "dev-fixtures/test-video.mp4";
const normalizePreviewMediaSource = (value) => {
    if (!value) {
        return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return "";
    }
    const normalizedUrl = trimmed.replace(/\\/g, "/");
    const pathCandidate = (() => {
        try {
            return new URL(normalizedUrl, "https://preview.local").pathname;
        }
        catch {
            return normalizedUrl;
        }
    })();
    return pathCandidate
        .replace(/^\/static-[^/]+\//i, "")
        .replace(/^\/+/, "")
        .replace(/\.preview(?=\.[a-z0-9]+$)/i, "")
        .replace(/\?.*$/, "")
        .toLowerCase();
};
const devFixtureTranscriptFixtures = [
    devFixtureTestVideoWordsJson
];
const previewTranscriptFixtureByMediaKey = new Map(devFixtureTranscriptFixtures.map((fixture) => [
    normalizePreviewMediaSource(fixture.expectedMediaKey || fixture.mediaSource),
    fixture
]));
const getPreviewFixtureWords = (fixture) => {
    return fixture.words.map(({ text, startMs, endMs, confidence }) => ({
        text,
        startMs,
        endMs,
        confidence
    }));
};
const resolvePreviewFixtureChunkSemantic = (momentType) => {
    if (momentType === "emphasis") {
        return {
            intent: "punch-emphasis",
            nameSpans: [],
            isVariation: true,
            suppressDefault: false
        };
    }
    return {
        intent: "default",
        nameSpans: [],
        isVariation: momentType === "hook",
        suppressDefault: false
    };
};
const buildPreviewFixtureWordChunks = (fixture) => {
    if (fixture.words.length === 0) {
        return [];
    }
    const chunks = [];
    let currentWords = [];
    let currentMomentType = fixture.words[0]?.momentType ?? "neutral";
    const flushChunk = () => {
        if (currentWords.length === 0) {
            return;
        }
        const semantic = resolvePreviewFixtureChunkSemantic(currentMomentType);
        const words = currentWords.map(({ text, startMs, endMs, confidence }) => ({
            text,
            startMs,
            endMs,
            confidence
        }));
        chunks.push({
            momentType: currentMomentType,
            chunk: {
                words,
                startMs: words[0]?.startMs ?? 0,
                endMs: words[words.length - 1]?.endMs ?? 0,
                text: words.map((word) => word.text).join(" ").trim(),
                semantic
            },
            emphasisIndices: currentWords.reduce((indices, word, index) => {
                if (word.emphasis) {
                    indices.push(index);
                }
                return indices;
            }, [])
        });
    };
    fixture.words.forEach((word) => {
        const nextMomentType = word.momentType ?? "neutral";
        if (currentWords.length > 0 && nextMomentType !== currentMomentType) {
            flushChunk();
            currentWords = [];
        }
        currentMomentType = nextMomentType;
        currentWords.push(word);
    });
    flushChunk();
    return chunks;
};
const buildPreviewFixtureCaptionChunks = (fixture, profileId) => {
    const preparedChunks = buildPreviewFixtureWordChunks(fixture);
    const mappedChunks = mapWordChunksToCaptionChunks(preparedChunks.map((entry) => entry.chunk), preparedChunks.reduce((output, entry, index) => {
        output[index] = entry.emphasisIndices;
        return output;
    }, {}), { profileId });
    return mappedChunks.map((chunk, index) => {
        const prepared = preparedChunks[index];
        return {
            ...chunk,
            id: `dev-fixture-${prepared?.momentType ?? "neutral"}-${String(index + 1).padStart(4, "0")}`,
            semantic: prepared?.chunk.semantic ?? chunk.semantic,
            emphasisWordIndices: prepared?.emphasisIndices ?? chunk.emphasisWordIndices
        };
    });
};
const resolvePreviewTranscriptFixture = (mediaIdentity) => {
    const normalizedMediaSource = normalizePreviewMediaSource(mediaIdentity?.mediaSource);
    if (!normalizedMediaSource) {
        return null;
    }
    return previewTranscriptFixtureByMediaKey.get(normalizedMediaSource) ?? null;
};
const normalizePreviewPresentationMode = (presentationMode) => {
    return presentationMode === "long-form" ? "long-form" : "reel";
};
const resolvePreviewMediaFamily = (presentationMode, mediaIdentity) => {
    const normalizedMediaSource = normalizePreviewMediaSource(mediaIdentity?.mediaSource);
    if (!normalizedMediaSource) {
        return presentationMode;
    }
    const normalizedLongformAsset = normalizePreviewMediaSource(LONGFORM_VIDEO_ASSET);
    const normalizedReelAsset = normalizePreviewMediaSource(REEL_VIDEO_ASSET);
    const longformFamilyMatch = normalizedMediaSource === normalizedLongformAsset ||
        normalizedMediaSource.startsWith("input-video-landscape.");
    const reelFamilyMatch = normalizedMediaSource === normalizedReelAsset ||
        normalizedMediaSource.startsWith("input-video.");
    if (presentationMode === "long-form") {
        return longformFamilyMatch ? "long-form" : null;
    }
    return reelFamilyMatch ? "reel" : null;
};
export const buildPreviewCaptionMediaFingerprint = (presentationMode, mediaIdentity) => {
    const normalizedPresentationMode = normalizePreviewPresentationMode(presentationMode);
    const normalizedMediaSource = normalizePreviewMediaSource(mediaIdentity?.mediaSource);
    const durationSeconds = Number.isFinite(mediaIdentity?.durationSeconds)
        ? Number(mediaIdentity?.durationSeconds).toFixed(3)
        : "unknown-seconds";
    const durationInFrames = Number.isFinite(mediaIdentity?.durationInFrames)
        ? String(mediaIdentity?.durationInFrames)
        : "unknown-frames";
    const mediaFamily = resolvePreviewMediaFamily(normalizedPresentationMode, mediaIdentity) ?? "unmatched";
    return [
        normalizedPresentationMode,
        mediaFamily,
        normalizedMediaSource || "default-preview-media",
        durationSeconds,
        durationInFrames
    ].join(":");
};
export const getPreviewTranscriptWords = (presentationMode, mediaIdentity) => {
    const previewFixture = resolvePreviewTranscriptFixture(mediaIdentity);
    if (previewFixture) {
        return getPreviewFixtureWords(previewFixture);
    }
    const normalizedPresentationMode = normalizePreviewPresentationMode(presentationMode);
    const mediaFamily = resolvePreviewMediaFamily(normalizedPresentationMode, mediaIdentity);
    if (!mediaFamily) {
        return [];
    }
    return previewTranscriptWordsByMode[mediaFamily];
};
export const buildPreviewCaptionChunks = (profileId, presentationMode, mediaIdentity) => {
    const normalizedProfileId = normalizeCaptionStyleProfileId(profileId);
    const normalizedPresentationMode = normalizePreviewPresentationMode(presentationMode);
    const mediaFingerprint = buildPreviewCaptionMediaFingerprint(normalizedPresentationMode, mediaIdentity);
    const cacheKey = `${normalizedPresentationMode}:${normalizedProfileId}:${mediaFingerprint}`;
    const cached = previewCaptionCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const previewFixture = resolvePreviewTranscriptFixture(mediaIdentity);
    if (previewFixture) {
        const fixtureChunks = buildPreviewFixtureCaptionChunks(previewFixture, normalizedProfileId);
        previewCaptionCache.set(cacheKey, fixtureChunks);
        return fixtureChunks;
    }
    const transcriptWords = getPreviewTranscriptWords(normalizedPresentationMode, mediaIdentity);
    if (transcriptWords.length === 0) {
        previewCaptionCache.set(cacheKey, []);
        return [];
    }
    const deterministicChunks = deterministicChunkWords(transcriptWords, {
        profileId: normalizedProfileId
    });
    const mappedChunks = mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
        profileId: normalizedProfileId
    });
    previewCaptionCache.set(cacheKey, mappedChunks);
    return mappedChunks;
};
