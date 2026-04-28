import type {
  CaptionChunk,
  MotionBackgroundOverlayAsset,
  MotionBackgroundOverlayCue,
  MotionBackgroundOverlayFitStrategy,
  MotionBackgroundOverlayPlan,
  MotionMoodTag,
  MotionTier,
  VideoMetadata
} from "../types";
import {analyzeTransitionBoundary} from "./transition-brain";
import {buildDeterministicMediaTrimWindow} from "./media-trim";
import {
  getBackgroundOverlayCatalog,
  getBackgroundOverlayCatalogSummary
} from "./background-overlay-catalog";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const MIN_BACKGROUND_OVERLAY_DURATION_MS = 4000;
const MAX_BACKGROUND_OVERLAY_DURATION_MS = 8000;
const QUALITY_ROTATION_ADVANTAGE_THRESHOLD = 0.09;
const QUALITY_BASE_SCALE_PENALTY_THRESHOLD = 1.08;
const QUALITY_TIE_WINDOW = 5;
const RECENT_BACKGROUND_HISTORY_SIZE = 3;
const RECENT_COMPOSITION_HISTORY_SIZE = 4;
const OWNERSHIP_SIGNAL_WORDS = new Set([
  "mine",
  "my",
  "ours",
  "yours",
  "choice",
  "choose",
  "chose",
  "decide",
  "decision",
  "control",
  "owned",
  "ownership"
]);

const findLastCueStartingBeforeOrAt = (cues: MotionBackgroundOverlayCue[], targetTimeMs: number): number => {
  let low = 0;
  let high = cues.length - 1;
  let bestIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (cues[middle].startMs <= targetTimeMs) {
      bestIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return bestIndex;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const normalizeToken = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .trim();
};

const scoreThemeAffinity = ({
  preferredThemeTags,
  assetThemeTags
}: {
  preferredThemeTags: MotionMoodTag[];
  assetThemeTags: MotionMoodTag[];
}): number => {
  if (preferredThemeTags.length === 0 || assetThemeTags.length === 0) {
    return 0;
  }

  const preferred = new Set(preferredThemeTags);
  let score = 0;

  assetThemeTags.forEach((tag) => {
    if (preferred.has(tag)) {
      score -= 14;
      return;
    }
    if (tag !== "neutral") {
      score += 3;
    }
  });

  const matchCount = preferredThemeTags.filter((tag) => assetThemeTags.includes(tag)).length;
  if (matchCount === preferredThemeTags.length) {
    score -= 4;
  }

  return score;
};

const getEmphasisCount = (chunk: CaptionChunk): number => chunk.emphasisWordIndices?.length ?? 0;

const hasTailEmphasis = (chunk: CaptionChunk): boolean => {
  const lastWordIndex = chunk.words.length - 1;
  return lastWordIndex >= 0 && (chunk.emphasisWordIndices?.includes(lastWordIndex) ?? false);
};

const hasOwnershipSignal = (chunk: CaptionChunk): boolean => {
  const normalizedWords = chunk.words.map((word) => normalizeToken(word.text)).filter(Boolean);
  if (normalizedWords.some((word) => OWNERSHIP_SIGNAL_WORDS.has(word))) {
    return true;
  }

  return /\b(choice|chosen|control|ownership|decide|decision)\b/i.test(chunk.text);
};

const inferPreferredThemeTags = (chunk: CaptionChunk): MotionMoodTag[] => {
  const tags = new Set<MotionMoodTag>();
  const emphasisCount = getEmphasisCount(chunk);

  if (hasOwnershipSignal(chunk)) {
    tags.add("authority");
    tags.add("warm");
  }
  if (chunk.semantic?.intent === "punch-emphasis" || emphasisCount >= 2 || /[!?]/.test(chunk.text)) {
    tags.add("kinetic");
  }
  if (tags.size === 0) {
    tags.add(chunk.words.length <= 4 ? "authority" : "cool");
  }

  return [...tags];
};

const getTotalDurationMs = (chunks: CaptionChunk[]): number => {
  if (chunks.length === 0) {
    return 0;
  }
  return Math.max(0, chunks[chunks.length - 1].endMs - chunks[0].startMs);
};

const isLandscapeVideo = (videoMetadata?: Pick<VideoMetadata, "width" | "height">): boolean => {
  if (!videoMetadata || videoMetadata.width <= 0 || videoMetadata.height <= 0) {
    return false;
  }
  return videoMetadata.width / videoMetadata.height >= 1.1;
};

const getTargetCueCount = ({
  totalDurationMs,
  tier,
  candidateCount,
  strongCandidateCount,
  layoutMode
}: {
  totalDurationMs: number;
  tier: MotionTier;
  candidateCount: number;
  strongCandidateCount: number;
  layoutMode: MotionBackgroundOverlayPlan["layoutMode"];
}): number => {
  if (totalDurationMs <= 0 || candidateCount === 0) {
    return 0;
  }

  const durationMinutes = totalDurationMs / 60000;
  if (layoutMode === "vertical-cover") {
    const cuesPerMinute = tier === "hero" ? 4.4 : tier === "premium" ? 3.9 : tier === "editorial" ? 3.3 : 2.8;
    let target = clamp(Math.round(durationMinutes * cuesPerMinute), 2, 16);

    if (durationMinutes >= 0.75 && candidateCount >= 3) {
      target += 1;
    }
    if (durationMinutes >= 1.5 && strongCandidateCount >= 4) {
      target += 1;
    }
    if (durationMinutes >= 3) {
      target += 1;
    }

    return clamp(target, 2, 16);
  }

  const divisor = tier === "hero" ? 2.25 : tier === "premium" ? 2.85 : tier === "editorial" ? 3.2 : 3.8;
  let target = clamp(Math.round(durationMinutes / divisor), 1, 12);

  if ((tier === "hero" || tier === "premium") && durationMinutes >= 0.85 && candidateCount >= 3) {
    target += 1;
  }
  if (durationMinutes >= 1.4 && strongCandidateCount >= 4) {
    target += 1;
  }

  return clamp(target, 1, 12);
};

const getMinGapMs = (tier: MotionTier, layoutMode: MotionBackgroundOverlayPlan["layoutMode"]): number => {
  if (layoutMode === "vertical-cover") {
    if (tier === "hero") {
      return 7800;
    }
    if (tier === "premium") {
      return 8600;
    }
    if (tier === "editorial") {
      return 9600;
    }
    return 11000;
  }

  if (tier === "hero") {
    return 18000;
  }
  if (tier === "premium") {
    return 21000;
  }
  if (tier === "editorial") {
    return 24000;
  }
  return 28000;
};

const scoreBoundary = ({
  previousChunk,
  nextChunk,
  gapMs,
  continuationRisk,
  safety
}: {
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
  gapMs: number;
  continuationRisk: number;
  safety: MotionBackgroundOverlayCue["boundarySafety"];
}): number => {
  let score = 24;
  const emphasisCount = getEmphasisCount(nextChunk);
  const ownershipSignal = hasOwnershipSignal(nextChunk);

  if (safety === "clear") {
    score += 24;
  } else if (safety === "guarded") {
    score += 10;
  } else {
    score -= 22;
  }

  if (gapMs >= 800) {
    score += 16;
  } else if (gapMs >= 450) {
    score += 10;
  } else if (gapMs >= 220) {
    score += 4;
  }

  if (/[.!?]["')\]]?$/.test(previousChunk.text.trim())) {
    score += 10;
  }

  if (nextChunk.semantic?.intent === "punch-emphasis") {
    score += 14;
  }
  if (nextChunk.semantic?.intent === "name-callout") {
    score += 8;
  }
  if (previousChunk.semantic?.intent === "punch-emphasis") {
    score += 6;
  }

  if (nextChunk.words.length >= 4) {
    score += 6;
  }
  if (emphasisCount > 0) {
    score += Math.min(16, emphasisCount * 5);
  }
  if (ownershipSignal) {
    score += 12;
  }
  if (hasTailEmphasis(nextChunk)) {
    score += 8;
  }

  score -= Math.round(continuationRisk * 0.45);
  return clamp(score, 0, 100);
};

const scorePhraseAnchor = ({
  chunk,
  gapMs,
  continuationRisk,
  safety
}: {
  chunk: CaptionChunk;
  gapMs: number;
  continuationRisk: number;
  safety: MotionBackgroundOverlayCue["boundarySafety"];
}): number => {
  const emphasisCount = getEmphasisCount(chunk);
  const ownershipSignal = hasOwnershipSignal(chunk);
  let score = 34;

  if (chunk.semantic?.intent === "punch-emphasis") {
    score += 18;
  }
  if (emphasisCount > 0) {
    score += Math.min(20, emphasisCount * 8);
  }
  if (ownershipSignal) {
    score += 18;
  }
  if (chunk.words.length <= 4) {
    score += 10;
  }
  if (hasTailEmphasis(chunk)) {
    score += 10;
  }
  if (/[.!?]["')\]]?$/.test(chunk.text.trim())) {
    score += 6;
  }
  if (safety === "clear") {
    score += 10;
  } else if (safety === "guarded") {
    score += 4;
  }
  if (gapMs >= 300) {
    score += 8;
  } else if (gapMs >= 140) {
    score += 4;
  }

  score -= Math.round(continuationRisk * 0.22);
  return clamp(score, 0, 100);
};

const resolveFitStrategy = ({
  asset,
  targetWidth,
  targetHeight,
  variationSeed = asset.id
}: {
  asset: MotionBackgroundOverlayAsset;
  targetWidth: number;
  targetHeight: number;
  variationSeed?: string;
}): MotionBackgroundOverlayFitStrategy => {
  const unrotatedScale = Math.max(targetWidth / asset.width, targetHeight / asset.height);
  const rotatedScale = Math.max(targetWidth / asset.height, targetHeight / asset.width);
  const targetIsLandscape = targetWidth >= targetHeight;
  const assetIsLandscape = asset.width >= asset.height;
  const shouldRotate =
    targetIsLandscape !== assetIsLandscape &&
    rotatedScale + QUALITY_ROTATION_ADVANTAGE_THRESHOLD < unrotatedScale;
  const focusSeed = hashString(
    `${asset.id}|${variationSeed}|${targetWidth}x${targetHeight}|${Math.round(asset.durationSeconds * 10)}`
  );
  const focusOffsetXBase = ((focusSeed & 0xff) / 255) - 0.5;
  const focusOffsetYBase = (((focusSeed >> 8) & 0xff) / 255) - 0.5;
  const compositionBias = ((((focusSeed >> 16) & 0xff) / 255) - 0.5) * 0.028;
  const targetBias = targetIsLandscape ? 0.05 : 0.032;
  const complementaryBias = targetIsLandscape ? 0.028 : 0.046;
  const focusOffsetX = Number(
    clamp(focusOffsetXBase * targetBias + compositionBias + (assetIsLandscape ? 0.006 : -0.006), -0.086, 0.086).toFixed(3)
  );
  const focusOffsetY = Number(
    clamp(focusOffsetYBase * complementaryBias - compositionBias * 0.72 + (targetIsLandscape ? -0.008 : 0.008), -0.086, 0.086).toFixed(3)
  );

  return shouldRotate
    ? {
      rotateDeg: 90,
      baseScale: rotatedScale,
      orientedWidth: asset.height,
      orientedHeight: asset.width,
      sourceAspectRatio: Number((asset.width / asset.height).toFixed(3)),
      targetAspectRatio: Number((targetWidth / targetHeight).toFixed(3)),
      focusOffsetX,
      focusOffsetY,
      rationale: `Rotated 90deg because it keeps the ${assetIsLandscape ? "landscape" : "portrait"} overlay inside a lower upscale envelope for the ${targetIsLandscape ? "landscape" : "portrait"} frame and adds a subtle spatial bias so the background bed feels more alive.`
    }
    : {
      rotateDeg: 0,
      baseScale: unrotatedScale,
      orientedWidth: asset.width,
      orientedHeight: asset.height,
      sourceAspectRatio: Number((asset.width / asset.height).toFixed(3)),
      targetAspectRatio: Number((targetWidth / targetHeight).toFixed(3)),
      focusOffsetX,
      focusOffsetY,
      rationale: `Kept upright because direct cover-fit preserves more fidelity than a 90deg rotation for the ${targetIsLandscape ? "landscape" : "portrait"} frame and the small focus shift keeps the composition from feeling static.`
    };
};

const getCompositionVariationKey = ({
  assetId,
  fitStrategy
}: {
  assetId: string;
  fitStrategy: MotionBackgroundOverlayFitStrategy;
}): string => {
  const focusBucketX = Math.round(fitStrategy.focusOffsetX * 1000 / 18);
  const focusBucketY = Math.round(fitStrategy.focusOffsetY * 1000 / 18);
  return `${assetId}|${fitStrategy.rotateDeg}|${focusBucketX}|${focusBucketY}`;
};

const pickAsset = ({
  assets,
  boundaryId,
  desiredDurationMs,
  recentAssetIds,
  recentCompositionKeys,
  targetWidth,
  targetHeight,
  preferredThemeTags = []
}: {
  assets: MotionBackgroundOverlayAsset[];
  boundaryId: string;
  desiredDurationMs: number;
  recentAssetIds: string[];
  recentCompositionKeys: string[];
  targetWidth: number;
  targetHeight: number;
  preferredThemeTags?: MotionMoodTag[];
}): MotionBackgroundOverlayAsset => {
  const durationReady = assets.filter((asset) => asset.durationSeconds * 1000 >= desiredDurationMs + 250);
  const pool = durationReady.length > 0 ? durationReady : assets;

  const rankedPool = pool
    .map((asset) => {
      const fitStrategy = resolveFitStrategy({
        asset,
        targetWidth,
        targetHeight,
        variationSeed: `${boundaryId}|${asset.id}`
      });
      const assetThemeTags = asset.themeTags ?? [];
      const recencyPenalty = recentAssetIds.includes(asset.id) ? 18 : 0;
      const compositionPenalty = recentCompositionKeys.includes(
        getCompositionVariationKey({
          assetId: asset.id,
          fitStrategy
        })
      )
        ? 10
        : 0;
      const durationSlackPenalty = Math.max(0, desiredDurationMs - asset.durationSeconds * 1000) * 0.01;
      const durationOvershootPenalty = Math.max(0, asset.durationSeconds * 1000 - desiredDurationMs - 1500) * 0.00045;
      const upscalePenalty = Math.max(0, fitStrategy.baseScale - 1) * 120;
      const rotationPenalty =
        fitStrategy.rotateDeg === 90 && fitStrategy.baseScale > QUALITY_BASE_SCALE_PENALTY_THRESHOLD ? 8 : 0;
      const themeAffinityScore = scoreThemeAffinity({
        preferredThemeTags,
        assetThemeTags
      });
      const qualityScore = upscalePenalty +
        rotationPenalty +
        recencyPenalty +
        compositionPenalty +
        durationSlackPenalty +
        durationOvershootPenalty +
        themeAffinityScore;

      return {
        asset,
        qualityScore,
        tieBreak: hashString(`${boundaryId}|${asset.id}`)
      };
    })
    .sort((a, b) => a.qualityScore - b.qualityScore || a.tieBreak - b.tieBreak);

  const bestScore = rankedPool[0]?.qualityScore ?? 0;
  const topPool = rankedPool.filter((entry) => entry.qualityScore - bestScore <= QUALITY_TIE_WINDOW);
  return topPool[hashString(boundaryId) % topPool.length]?.asset ?? rankedPool[0]?.asset ?? assets[0];
};

const toTrimFrames = ({
  asset,
  cueDurationMs,
  seed
}: {
  asset: MotionBackgroundOverlayAsset;
  cueDurationMs: number;
  seed: string;
}): {trimBeforeFrames: number; trimAfterFrames: number} => {
  const totalFrames = Math.max(1, Math.floor(asset.durationSeconds * asset.fps));
  const cueFrames = clamp(Math.round((cueDurationMs / 1000) * asset.fps), 1, totalFrames);
  const trimWindow = buildDeterministicMediaTrimWindow({
    totalFrames,
    desiredFrames: cueFrames,
    seed
  });
  return {
    trimBeforeFrames: trimWindow.trimBeforeFrames,
    trimAfterFrames: trimWindow.trimAfterFrames
  };
};

type OverlayCandidate = {
  boundaryId: string;
  candidateKind: "boundary" | "phrase-anchor";
  sourceChunk: CaptionChunk;
  anchorStartMs: number;
  gapMs: number;
  continuationRisk: number;
  safety: MotionBackgroundOverlayCue["boundarySafety"];
  score: number;
  reasons: string[];
  preferredDurationMs: number;
  preferredThemeTags: MotionMoodTag[];
};

const buildCandidates = (chunks: CaptionChunk[]): OverlayCandidate[] => {
  const candidates: OverlayCandidate[] = [];

  for (let index = 0; index < chunks.length - 1; index += 1) {
    const previousChunk = chunks[index];
    const nextChunk = chunks[index + 1];
    const boundary = analyzeTransitionBoundary({
      previousChunk,
      nextChunk
    });
    const preferredThemeTags = inferPreferredThemeTags(nextChunk);
    const score = scoreBoundary({
      previousChunk,
      nextChunk,
      gapMs: boundary.gapMs,
      continuationRisk: boundary.continuationRisk,
      safety: boundary.safety
    });

    if (boundary.safety !== "unsafe" && !(boundary.safety === "guarded" && boundary.gapMs < 380) && score >= 42) {
      candidates.push({
        boundaryId: boundary.id,
        candidateKind: "boundary",
        sourceChunk: nextChunk,
        anchorStartMs: nextChunk.startMs,
        gapMs: boundary.gapMs,
        continuationRisk: boundary.continuationRisk,
        safety: boundary.safety,
        score,
        reasons: boundary.reasons,
        preferredDurationMs: nextChunk.semantic?.intent === "punch-emphasis"
          ? 6400
          : boundary.safety === "clear"
            ? 5600
            : 5000,
        preferredThemeTags
      });
    }

    if (getEmphasisCount(nextChunk) > 0 || nextChunk.semantic?.intent === "punch-emphasis" || hasOwnershipSignal(nextChunk)) {
      const phraseScore = scorePhraseAnchor({
        chunk: nextChunk,
        gapMs: boundary.gapMs,
        continuationRisk: boundary.continuationRisk,
        safety: boundary.safety
      });

      if (phraseScore >= (boundary.safety === "unsafe" ? 72 : 56)) {
        candidates.push({
          boundaryId: `${boundary.id}:phrase-anchor`,
          candidateKind: "phrase-anchor",
          sourceChunk: nextChunk,
          anchorStartMs: nextChunk.startMs,
          gapMs: boundary.gapMs,
          continuationRisk: boundary.continuationRisk,
          safety: boundary.safety === "unsafe" ? "guarded" : boundary.safety,
          score: phraseScore,
          reasons: [
            ...boundary.reasons,
            "The next phrase carries enough emphasis to justify a background overlay without waiting for a full silence pocket."
          ],
          preferredDurationMs: hasOwnershipSignal(nextChunk)
            ? 6200
            : nextChunk.semantic?.intent === "punch-emphasis"
              ? 5800
              : 5200,
          preferredThemeTags
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.anchorStartMs - b.anchorStartMs);
};

export const buildMotionBackgroundOverlayPlan = ({
  chunks,
  tier,
  videoMetadata,
  catalog = getBackgroundOverlayCatalog()
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  catalog?: MotionBackgroundOverlayAsset[];
}): MotionBackgroundOverlayPlan => {
  const width = videoMetadata?.width ?? 1080;
  const height = videoMetadata?.height ?? 1920;
  const aspectRatio = Number((width / height).toFixed(3));
  const layoutMode = isLandscapeVideo(videoMetadata) ? "landscape-cover" : "vertical-cover";
  const totalDurationMs = getTotalDurationMs(chunks);
  const minGapMs = getMinGapMs(tier, layoutMode);

  if (catalog.length === 0) {
    return {
      enabled: false,
      aspectRatio,
      layoutMode: "disabled",
      targetCueCount: 0,
      minGapMs,
      cues: [],
      selectedAssets: [],
      reasons: [
        "Background overlay brain is disabled because no local overlay assets are available."
      ]
    };
  }

  const candidates = buildCandidates(chunks);
  const targetCueCount = getTargetCueCount({
    totalDurationMs,
    tier,
    candidateCount: candidates.length,
    strongCandidateCount: candidates.filter((candidate) => candidate.score >= 74).length,
    layoutMode
  });
  const selected: MotionBackgroundOverlayCue[] = [];
  const recentAssetIds: string[] = [];
  const recentCompositionKeys: string[] = [];

  for (const candidate of candidates) {
    if (selected.length >= targetCueCount) {
      break;
    }
    const tooClose = selected.some((cue) => Math.abs(cue.startMs - candidate.anchorStartMs) < minGapMs);
    if (tooClose) {
      continue;
    }

    const asset = pickAsset({
      assets: catalog,
      boundaryId: candidate.boundaryId,
      desiredDurationMs: candidate.preferredDurationMs,
      recentAssetIds: recentAssetIds.slice(-RECENT_BACKGROUND_HISTORY_SIZE),
      recentCompositionKeys: recentCompositionKeys.slice(-RECENT_COMPOSITION_HISTORY_SIZE),
      targetWidth: width,
      targetHeight: height,
      preferredThemeTags: candidate.preferredThemeTags
    });
    const cueDurationMs = clamp(
      Math.min(candidate.preferredDurationMs, Math.round(asset.durationSeconds * 1000) - 220),
      MIN_BACKGROUND_OVERLAY_DURATION_MS,
      MAX_BACKGROUND_OVERLAY_DURATION_MS
    );
    const startMs = Math.max(0, candidate.anchorStartMs - (candidate.candidateKind === "phrase-anchor" ? 120 : 240));
    const peakStartMs = startMs + (candidate.candidateKind === "phrase-anchor" ? 180 : 260);
    const endMs = startMs + cueDurationMs;
    const peakEndMs = Math.max(peakStartMs + (candidate.candidateKind === "phrase-anchor" ? 2200 : 1800), endMs - 520);
    const fitStrategy = resolveFitStrategy({
      asset,
      targetWidth: width,
      targetHeight: height,
      variationSeed: `${candidate.boundaryId}|${asset.id}|${selected.length}`
    });
    const trim = toTrimFrames({
      asset,
      cueDurationMs: endMs - startMs,
      seed: `${candidate.boundaryId}|${asset.id}`
    });

    selected.push({
      id: `background-overlay-${candidate.sourceChunk.id}`,
      sourceBoundaryId: candidate.boundaryId,
      sourceChunkId: candidate.sourceChunk.id,
      sourceChunkText: candidate.sourceChunk.text,
      assetId: asset.id,
      asset,
      startMs,
      peakStartMs,
      peakEndMs,
      endMs,
      score: candidate.score,
      boundaryGapMs: candidate.gapMs,
      boundarySafety: candidate.safety,
      reasoning: [
        `Boundary score ${candidate.score}.`,
        candidate.candidateKind === "phrase-anchor"
          ? "Selected as an internal phrase-anchor overlay so the talking-head beat can bloom under the emphasized line itself."
          : "Selected at a spoken reset so the overlay can land on the boundary without stepping on the phrase.",
        candidate.preferredThemeTags.length > 0
          ? `Theme-aware selection favored ${candidate.preferredThemeTags.join(" / ")} assets from the stock overlay library.`
          : "No tone tags were available, so fidelity and duration fit carried the asset choice.",
        candidate.safety === "clear"
          ? "Selected on a clear spoken reset so the overlay can land without stepping on the phrase."
          : "Selected on a guarded reset with enough pause to keep continuity safe.",
        fitStrategy.rationale,
        ...candidate.reasons
      ].join(" "),
      trimBeforeFrames: trim.trimBeforeFrames,
      trimAfterFrames: trim.trimAfterFrames,
      fitStrategy
    });
    recentAssetIds.push(asset.id);
    recentCompositionKeys.push(
      getCompositionVariationKey({
        assetId: asset.id,
        fitStrategy
      })
    );
  }

  const summary = getBackgroundOverlayCatalogSummary();

  return {
    enabled: selected.length > 0,
    aspectRatio,
    layoutMode,
    targetCueCount,
    minGapMs,
    cues: selected.sort((a, b) => a.startMs - b.startMs),
    selectedAssets: selected.map((cue) => cue.asset),
    reasons: [
      `layout=${layoutMode}`,
      `catalog=${summary.totalCount} overlays`,
      `portrait=${summary.portraitCount}`,
      `selected=${selected.length}/${targetCueCount}`,
      `minGapMs=${minGapMs}`,
      layoutMode === "vertical-cover"
        ? "Portrait overlays run as a denser background bed, stay upright when that preserves fidelity, and still rotate when a better upscale envelope is available."
        : "High-fidelity overlays are chosen first, portrait overlays rotate only when that preserves a lower upscale envelope, and emphasized phrase anchors can trigger overlays even inside talking-head flow."
    ]
  };
};

export const selectActiveMotionBackgroundOverlayCueAtTime = ({
  cues,
  currentTimeMs
}: {
  cues: MotionBackgroundOverlayCue[];
  currentTimeMs: number;
}): MotionBackgroundOverlayCue | null => {
  const lastRelevantIndex = findLastCueStartingBeforeOrAt(cues, currentTimeMs);
  if (lastRelevantIndex < 0) {
    return null;
  }

  for (let index = lastRelevantIndex; index >= 0; index -= 1) {
    const cue = cues[index];
    if (cue.endMs < currentTimeMs) {
      break;
    }
    if (currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs) {
      return cue;
    }
  }

  return null;
};
