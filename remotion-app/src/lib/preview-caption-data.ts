import devFixtureTestVideoWordsJson from "../data/dev-fixtures/test-video.words.json" with {type: "json"};
import longformTranscriptWords from "../data/transcript.longform.words.json" with {type: "json"};
import transcriptWords from "../data/transcript.words.json" with {type: "json"};
import {deterministicChunkWords, mapWordChunksToCaptionChunks, type WordChunk} from "./caption-chunker";
import {isCreativeOrchestrationEnabled} from "./env";
import {LONGFORM_VIDEO_ASSET, REEL_VIDEO_ASSET} from "./presentation-presets";
import {normalizeCaptionStyleProfileId} from "./stylebooks/caption-style-profiles";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  ChunkSemanticMeta,
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
export const DEV_FIXTURE_TEST_VIDEO_MEDIA_KEY = "dev-fixtures/test-video.mp4";

type PreviewFixtureMomentType = "hook" | "emphasis" | "neutral";

type PreviewFixtureWordRecord = TranscribedWord & {
  semanticRole?: string;
  emphasis?: boolean;
  momentType?: PreviewFixtureMomentType;
};

type PreviewTranscriptFixture = {
  mediaSource: string;
  expectedMediaKey: string;
  words: PreviewFixtureWordRecord[];
};

type PreparedPreviewFixtureChunk = {
  momentType: PreviewFixtureMomentType;
  chunk: WordChunk;
  emphasisIndices: number[];
};

export type PreviewCaptionMediaIdentity = {
  mediaSource?: string | null;
  durationSeconds?: number | null;
  durationInFrames?: number | null;
};

const normalizePreviewMediaSource = (value?: string | null): string => {
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
    } catch {
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
  devFixtureTestVideoWordsJson as PreviewTranscriptFixture
];

const previewTranscriptFixtureByMediaKey = new Map(
  devFixtureTranscriptFixtures.map((fixture) => [
    normalizePreviewMediaSource(fixture.expectedMediaKey || fixture.mediaSource),
    fixture
  ] as const)
);

const getPreviewFixtureWords = (fixture: PreviewTranscriptFixture): TranscribedWord[] => {
  return fixture.words.map(({text, startMs, endMs, confidence}) => ({
    text,
    startMs,
    endMs,
    confidence
  }));
};

const resolvePreviewFixtureChunkSemantic = (momentType: PreviewFixtureMomentType): ChunkSemanticMeta => {
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

const buildPreviewFixtureWordChunks = (fixture: PreviewTranscriptFixture): PreparedPreviewFixtureChunk[] => {
  if (fixture.words.length === 0) {
    return [];
  }

  const chunks: PreparedPreviewFixtureChunk[] = [];
  let currentWords: PreviewFixtureWordRecord[] = [];
  let currentMomentType: PreviewFixtureMomentType = fixture.words[0]?.momentType ?? "neutral";

  const flushChunk = () => {
    if (currentWords.length === 0) {
      return;
    }

    const semantic = resolvePreviewFixtureChunkSemantic(currentMomentType);
    const words = currentWords.map(({text, startMs, endMs, confidence}) => ({
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
      emphasisIndices: currentWords.reduce<number[]>((indices, word, index) => {
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

const buildPreviewFixtureCaptionChunks = (
  fixture: PreviewTranscriptFixture,
  profileId: CaptionStyleProfileId
): CaptionChunk[] => {
  const preparedChunks = buildPreviewFixtureWordChunks(fixture);
  const mappedChunks = mapWordChunksToCaptionChunks(
    preparedChunks.map((entry) => entry.chunk),
    preparedChunks.reduce<Record<number, number[]>>((output, entry, index) => {
      output[index] = entry.emphasisIndices;
      return output;
    }, {}),
    {profileId}
  );

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

const resolvePreviewTranscriptFixture = (
  mediaIdentity?: PreviewCaptionMediaIdentity | null
): PreviewTranscriptFixture | null => {
  const normalizedMediaSource = normalizePreviewMediaSource(mediaIdentity?.mediaSource);
  if (!normalizedMediaSource) {
    return null;
  }

  return previewTranscriptFixtureByMediaKey.get(normalizedMediaSource) ?? null;
};

const resolvePreviewMediaFamily = (
  presentationMode: PresentationMode,
  mediaIdentity?: PreviewCaptionMediaIdentity | null
): PresentationMode | null => {
  const normalizedMediaSource = normalizePreviewMediaSource(mediaIdentity?.mediaSource);
  if (!normalizedMediaSource) {
    return presentationMode;
  }

  const normalizedLongformAsset = normalizePreviewMediaSource(LONGFORM_VIDEO_ASSET);
  const normalizedReelAsset = normalizePreviewMediaSource(REEL_VIDEO_ASSET);
  const longformFamilyMatch =
    normalizedMediaSource === normalizedLongformAsset ||
    normalizedMediaSource.startsWith("input-video-landscape.");
  const reelFamilyMatch =
    normalizedMediaSource === normalizedReelAsset ||
    normalizedMediaSource.startsWith("input-video.");

  if (presentationMode === "long-form") {
    return longformFamilyMatch ? "long-form" : null;
  }

  return reelFamilyMatch ? "reel" : null;
};

export const buildPreviewCaptionMediaFingerprint = (
  presentationMode?: PresentationModeSetting | null,
  mediaIdentity?: PreviewCaptionMediaIdentity | null
): string => {
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

const normalizePreviewPresentationMode = (
  presentationMode?: PresentationModeSetting | null
): PresentationMode => {
  return presentationMode === "long-form" ? "long-form" : "reel";
};

export const getPreviewTranscriptWords = (
  presentationMode?: PresentationModeSetting | null,
  mediaIdentity?: PreviewCaptionMediaIdentity | null
): TranscribedWord[] => {
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

export const buildPreviewCaptionChunks = (
  profileId?: string | null,
  presentationMode?: PresentationModeSetting | null,
  mediaIdentity?: PreviewCaptionMediaIdentity | null
): CaptionChunk[] => {
  const normalizedProfileId = normalizeCaptionStyleProfileId(profileId);
  const normalizedPresentationMode = normalizePreviewPresentationMode(presentationMode);
  const creativeOrchestrationState = isCreativeOrchestrationEnabled() ? "creative-on" : "creative-off";
  const mediaFingerprint = buildPreviewCaptionMediaFingerprint(normalizedPresentationMode, mediaIdentity);
  const cacheKey = `${creativeOrchestrationState}:${normalizedPresentationMode}:${normalizedProfileId}:${mediaFingerprint}`;
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
  const creativeChunks = isCreativeOrchestrationEnabled()
    ? buildCreativePreviewCaptionChunks(mappedChunks, {
        profileId: normalizedProfileId,
        presentationMode: normalizedPresentationMode
      })
    : mappedChunks;

  previewCaptionCache.set(cacheKey, creativeChunks);
  return creativeChunks;
};
