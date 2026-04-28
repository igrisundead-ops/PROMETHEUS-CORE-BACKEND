import type {CaptionChunk, MotionTier, TransitionOverlayAsset, TransitionOverlayCue, TransitionOverlayMode, TransitionOverlayPlan, VideoMetadata} from "../types";
import {analyzeTransitionBoundary} from "./transition-brain";
import {getTransitionOverlayCatalog, getTransitionOverlayCatalogSummary} from "./transition-overlay-catalog";
import {isTransitionOverlayModeEnabled, resolveTransitionOverlayRules, type TransitionOverlayRules} from "./transition-overlay-config";
import {resolveTransitionOverlayFitStrategy, resolveTransitionOverlayTiming} from "./transition-overlay-timing";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

const resolveLayoutMode = (videoMetadata?: Pick<VideoMetadata, "width" | "height">): TransitionOverlayPlan["layoutMode"] => {
  return isLandscapeVideo(videoMetadata) ? "landscape-cover" : "vertical-cover";
};

const getPoolOrientation = (videoMetadata?: Pick<VideoMetadata, "width" | "height">): "landscape" | "vertical" => {
  return isLandscapeVideo(videoMetadata) ? "landscape" : "vertical";
};

const getTierDensityMultiplier = (tier: MotionTier): number => {
  if (tier === "hero") {
    return 1.14;
  }
  if (tier === "premium") {
    return 1.06;
  }
  if (tier === "editorial") {
    return 1;
  }
  return 0.9;
};

type TransitionOverlayBoundaryContext = ReturnType<typeof analyzeTransitionBoundary> & {
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
};

const scoreBoundary = ({
  boundary,
  mode
}: {
  boundary: TransitionOverlayBoundaryContext;
  mode: TransitionOverlayMode;
}): number => {
  let score = 18;

  if (boundary.safety === "clear") {
    score += 26;
  } else if (boundary.safety === "guarded") {
    score += 12;
  } else {
    return 0;
  }

  if (boundary.gapMs >= 1400) {
    score += 22;
  } else if (boundary.gapMs >= 900) {
    score += 16;
  } else if (boundary.gapMs >= 600) {
    score += 10;
  } else if (boundary.gapMs >= 350) {
    score += 4;
  }

  if (boundary.endsSentence) {
    score += 8;
  } else {
    score -= 4;
  }
  if (boundary.endsBridgeWord) {
    score -= 8;
  }
  if (boundary.startsContinuationWord) {
    score -= 10;
  }

  if (boundary.continuationRisk >= 60) {
    score -= 20;
  } else if (boundary.continuationRisk >= 40) {
    score -= 8;
  } else if (boundary.continuationRisk <= 18) {
    score += 4;
  }

  const previousIntent = boundary.previousChunk.semantic?.intent;
  const nextIntent = boundary.nextChunk.semantic?.intent;
  if (previousIntent === "punch-emphasis" || nextIntent === "punch-emphasis") {
    score += 6;
  }
  if (previousIntent === "name-callout" || nextIntent === "name-callout") {
    score += 4;
  }
  if (boundary.previousChunk.semantic?.isVariation || boundary.nextChunk.semantic?.isVariation) {
    score += 3;
  }

  if (mode === "fast-intro") {
    if (boundary.gapMs <= 500) {
      score += 8;
    } else if (boundary.gapMs <= 900) {
      score += 4;
    }
  } else if (boundary.gapMs < 500) {
    score -= 8;
  }

  return clamp(score, 0, 100);
};

type TransitionOverlayBoundaryCandidate = {
  boundaryId: string;
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
  gapMs: number;
  safety: TransitionOverlayCue["boundarySafety"];
  score: number;
  reasons: string[];
};

type RecentSelection = {
  assetId: string;
  category: string;
  startMs: number;
};

const buildCandidates = ({
  chunks,
  mode
}: {
  chunks: CaptionChunk[];
  mode: TransitionOverlayMode;
}): TransitionOverlayBoundaryCandidate[] => {
  const candidates: TransitionOverlayBoundaryCandidate[] = [];

  for (let index = 0; index < chunks.length - 1; index += 1) {
    const previousChunk = chunks[index];
    const nextChunk = chunks[index + 1];
    const boundary = {
      ...analyzeTransitionBoundary({
        previousChunk,
        nextChunk
      }),
      previousChunk,
      nextChunk
    } satisfies TransitionOverlayBoundaryContext;
    const score = scoreBoundary({
      boundary,
      mode
    });

    if (boundary.safety === "unsafe") {
      continue;
    }
    if (score < 42) {
      continue;
    }

    candidates.push({
      boundaryId: boundary.id,
      previousChunk,
      nextChunk,
      gapMs: boundary.gapMs,
      safety: boundary.safety,
      score,
      reasons: boundary.reasons
    });
  }

  return candidates.sort((a, b) => b.score - a.score || a.nextChunk.startMs - b.nextChunk.startMs);
};

const getCategoryWeight = (mode: TransitionOverlayMode, category?: string): number => {
  const normalized = (category ?? "normal").toLowerCase();
  if (mode === "fast-intro") {
    if (normalized.includes("montage")) {
      return 24;
    }
    if (normalized.includes("click")) {
      return 22;
    }
    if (normalized.includes("flare")) {
      return 18;
    }
    if (normalized.includes("burn")) {
      return 16;
    }
    if (normalized.includes("leak")) {
      return 14;
    }
    if (normalized.includes("rough")) {
      return 13;
    }
    return 11;
  }

  if (normalized.includes("leak")) {
    return 22;
  }
  if (normalized.includes("burn")) {
    return 20;
  }
  if (normalized.includes("rough")) {
    return 18;
  }
  if (normalized.includes("flare")) {
    return 14;
  }
  if (normalized.includes("click")) {
    return 13;
  }
  if (normalized.includes("montage")) {
    return 11;
  }
  return 12;
};

const countSelectionsInWindow = ({
  selections,
  currentStartMs,
  windowMs
}: {
  selections: RecentSelection[];
  currentStartMs: number;
  windowMs: number;
}): number => {
  return selections.filter((selection) => Math.abs(currentStartMs - selection.startMs) <= windowMs).length;
};

const selectTransitionOverlayAsset = ({
  assets,
  boundary,
  mode,
  rules,
  boundaryScore,
  recentSelections,
  targetDurationMs
}: {
  assets: TransitionOverlayAsset[];
  boundary: TransitionOverlayBoundaryCandidate;
  mode: TransitionOverlayMode;
  rules: TransitionOverlayRules;
  boundaryScore: number;
  recentSelections: RecentSelection[];
  targetDurationMs: number;
}): TransitionOverlayAsset | null => {
  const rankedPool = assets
    .map((asset) => {
      const categoryWeight = getCategoryWeight(mode, asset.category);
      const recencyPenalty = recentSelections.some((selection) => selection.assetId === asset.id && Math.abs(boundary.nextChunk.startMs - selection.startMs) < rules.repetitionPenaltyWindowMs)
        ? 26
        : 0;
      const categoryRecencyPenalty = recentSelections.some((selection) => selection.category === (asset.category ?? "normal") && Math.abs(boundary.nextChunk.startMs - selection.startMs) < rules.repetitionPenaltyWindowMs)
        ? 10
        : 0;
      const durationReadyPenalty = asset.durationSeconds * 1000 >= targetDurationMs + 180 ? 0 : 14;
      const durationFitBonus = asset.recommendedDurationSeconds
        ? clamp(18 - Math.abs(asset.recommendedDurationSeconds * 1000 - targetDurationMs) / 80, 0, 18)
        : 8;
      const blendBonus = mode === "fast-intro" && asset.fadePreference === "snappy"
        ? 2
        : mode === "standard" && asset.fadePreference === "soft"
          ? 2
          : 0;
      const boundaryIntensityBonus =
        boundaryScore >= 70 && /burn|leak|flare/i.test(asset.category ?? "")
          ? 4
          : boundaryScore < 55 && (asset.category ?? "").toLowerCase().includes("normal")
            ? 4
            : 0;
      const orientationBonus = asset.orientation === "both" ? 2 : 0;
      const tieBreak = hashString(`${boundary.boundaryId}|${asset.id}`);

      return {
        asset,
        score:
          categoryWeight +
          durationFitBonus +
          blendBonus +
          boundaryIntensityBonus +
          orientationBonus -
          recencyPenalty -
          categoryRecencyPenalty -
          durationReadyPenalty,
        tieBreak
      };
    })
    .sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak);

  return rankedPool[0]?.asset ?? null;
};

const isValidTrimWindow = (trimBeforeFrames: number, trimAfterFrames: number): boolean => {
  return Number.isFinite(trimBeforeFrames) && Number.isFinite(trimAfterFrames) && trimAfterFrames > trimBeforeFrames;
};

export const buildTransitionOverlayPlan = ({
  chunks,
  tier,
  videoMetadata,
  mode = "off",
  catalog = getTransitionOverlayCatalog(),
  rulesOverrides
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  mode?: TransitionOverlayMode;
  catalog?: TransitionOverlayAsset[];
  rulesOverrides?: Partial<TransitionOverlayRules>;
}): TransitionOverlayPlan => {
  const resolvedMode = mode;
  const rules = resolveTransitionOverlayRules(
    resolvedMode === "off" ? "standard" : resolvedMode,
    rulesOverrides
  );
  const width = videoMetadata?.width ?? 1080;
  const height = videoMetadata?.height ?? 1920;
  const aspectRatio = Number((width / height).toFixed(3));
  const layoutMode = resolvedMode === "off" ? "disabled" : resolveLayoutMode(videoMetadata);
  const poolOrientation = getPoolOrientation(videoMetadata);
  const summary = getTransitionOverlayCatalogSummary();
  const totalDurationMs = getTotalDurationMs(chunks);
  const durationMinutes = totalDurationMs / 60000;
  const tierDensityMultiplier = getTierDensityMultiplier(tier);
  const targetCueCount = resolvedMode === "off" || totalDurationMs <= 0
    ? 0
    : Math.min(
      Math.max(1, Math.round(durationMinutes * rules.densityPerMinute * tierDensityMultiplier)),
      Math.max(0, chunks.length - 1)
    );

  if (!isTransitionOverlayModeEnabled(resolvedMode)) {
    return {
      enabled: false,
      mode: "off",
      aspectRatio,
      layoutMode: "disabled",
      targetCueCount: 0,
      minSilenceMs: rules.minSilenceMs,
      cooldownMs: rules.cooldownMs,
      maxTransitionsPerWindow: rules.maxTransitionsPerWindow,
      windowMs: rules.windowMs,
      overlayScale: rules.overlayScale,
      preferredDurationMs: Math.round((rules.preferredDurationMinMs + rules.preferredDurationMaxMs) / 2),
      maxDurationMs: rules.maxDurationMs,
      cues: [],
      selectedAssets: [],
      reasons: [
        "Transition overlay engine is disabled by mode=off."
      ]
    };
  }

  const routedCatalog = catalog.filter((asset) => {
    return asset.orientation === "both" || asset.orientation === poolOrientation;
  });

  if (routedCatalog.length === 0) {
    return {
      enabled: false,
      mode: resolvedMode,
      aspectRatio,
      layoutMode,
      targetCueCount,
      minSilenceMs: rules.minSilenceMs,
      cooldownMs: rules.cooldownMs,
      maxTransitionsPerWindow: rules.maxTransitionsPerWindow,
      windowMs: rules.windowMs,
      overlayScale: rules.overlayScale,
      preferredDurationMs: Math.round((rules.preferredDurationMinMs + rules.preferredDurationMaxMs) / 2),
      maxDurationMs: rules.maxDurationMs,
      cues: [],
      selectedAssets: [],
      reasons: [
        `No transition overlay assets matched the ${poolOrientation} routing pool.`,
        `catalog=${summary.totalCount} landscape=${summary.landscapeCount} vertical=${summary.verticalCount} both=${summary.bothCount}`
      ]
    };
  }

  const candidates = buildCandidates({
    chunks,
    mode: resolvedMode
  });

  if (candidates.length === 0) {
    return {
      enabled: false,
      mode: resolvedMode,
      aspectRatio,
      layoutMode,
      targetCueCount,
      minSilenceMs: rules.minSilenceMs,
      cooldownMs: rules.cooldownMs,
      maxTransitionsPerWindow: rules.maxTransitionsPerWindow,
      windowMs: rules.windowMs,
      overlayScale: rules.overlayScale,
      preferredDurationMs: Math.round((rules.preferredDurationMinMs + rules.preferredDurationMaxMs) / 2),
      maxDurationMs: rules.maxDurationMs,
      cues: [],
      selectedAssets: [],
      reasons: [
        "No silence boundaries cleared the transition overlay safety gates."
      ]
    };
  }

  const selected: TransitionOverlayCue[] = [];
  const recentSelections: RecentSelection[] = [];

  for (const candidate of candidates) {
    if (selected.length >= targetCueCount) {
      break;
    }

    if (candidate.gapMs < rules.minSilenceMs) {
      continue;
    }

    if (selected.some((cue) => Math.abs(candidate.nextChunk.startMs - cue.startMs) < rules.cooldownMs)) {
      continue;
    }

    if (countSelectionsInWindow({
      selections: recentSelections,
      currentStartMs: candidate.nextChunk.startMs,
      windowMs: rules.windowMs
    }) >= rules.maxTransitionsPerWindow) {
      continue;
    }

    const asset = selectTransitionOverlayAsset({
      assets: routedCatalog,
      boundary: candidate,
      mode: resolvedMode,
      rules,
      boundaryScore: candidate.score,
      recentSelections,
      targetDurationMs: Math.round((rules.preferredDurationMinMs + rules.preferredDurationMaxMs) / 2)
    });

    if (!asset) {
      continue;
    }

    const boundaryAnalysis = analyzeTransitionBoundary({
      previousChunk: candidate.previousChunk,
      nextChunk: candidate.nextChunk
    });

    const timing = resolveTransitionOverlayTiming({
      asset,
      boundary: {
        ...boundaryAnalysis,
        previousChunk: candidate.previousChunk,
        nextChunk: candidate.nextChunk
      },
      mode: resolvedMode,
      rules,
      seed: `${candidate.boundaryId}|${asset.id}`,
      boundaryScore: candidate.score
    });

    if (!isValidTrimWindow(timing.trimBeforeFrames, timing.trimAfterFrames)) {
      continue;
    }

    const fitStrategy = resolveTransitionOverlayFitStrategy({
      asset,
      targetWidth: width,
      targetHeight: height,
      overlayScale: rules.overlayScale
    });

    selected.push({
      id: `transition-overlay-${candidate.nextChunk.id}`,
      assetId: asset.id,
      asset,
      sourceBoundaryId: candidate.boundaryId,
      sourceChunkId: candidate.nextChunk.id,
      sourceChunkText: candidate.nextChunk.text,
      mode: resolvedMode,
      startMs: timing.startMs,
      peakStartMs: timing.peakStartMs,
      peakEndMs: timing.peakEndMs,
      endMs: timing.endMs,
      score: candidate.score,
      silenceGapMs: candidate.gapMs,
      boundarySafety: candidate.safety,
      reasoning: [
        `Boundary score ${candidate.score}.`,
        candidate.safety === "clear"
          ? "Selected on a clean silence pocket so the overlay can land without fighting speech."
          : "Selected on a guarded pause that still leaves room for a premium overlay beat.",
        fitStrategy.rationale,
        ...candidate.reasons
      ].join(" "),
      trimBeforeFrames: timing.trimBeforeFrames,
      trimAfterFrames: timing.trimAfterFrames,
      fitStrategy,
      blendMode: timing.blendMode,
      peakOpacity: timing.peakOpacity,
      fadeInFrames: timing.fadeInFrames,
      fadeOutFrames: timing.fadeOutFrames
    });

    recentSelections.push({
      assetId: asset.id,
      category: asset.category ?? "normal",
      startMs: timing.startMs
    });
  }

  const preferredDurationMs = Math.round((rules.preferredDurationMinMs + rules.preferredDurationMaxMs) / 2);

  return {
    enabled: selected.length > 0,
    mode: resolvedMode,
    aspectRatio,
    layoutMode,
    targetCueCount,
    minSilenceMs: rules.minSilenceMs,
    cooldownMs: rules.cooldownMs,
    maxTransitionsPerWindow: rules.maxTransitionsPerWindow,
    windowMs: rules.windowMs,
    overlayScale: rules.overlayScale,
    preferredDurationMs,
    maxDurationMs: rules.maxDurationMs,
    cues: selected.sort((a, b) => a.startMs - b.startMs),
    selectedAssets: selected.map((cue) => cue.asset),
    reasons: [
      `mode=${resolvedMode}`,
      `routing=${layoutMode}`,
      `pool=${poolOrientation}`,
      `catalog=${summary.totalCount} landscape=${summary.landscapeCount} vertical=${summary.verticalCount} both=${summary.bothCount}`,
      `candidates=${candidates.length}`,
      `selected=${selected.length}/${targetCueCount}`,
      `silenceMinMs=${rules.minSilenceMs}`,
      `cooldownMs=${rules.cooldownMs}`,
      `windowMs=${rules.windowMs}`,
      `overlayScale=${rules.overlayScale}`,
      `preferredDurationMs=${preferredDurationMs}`,
      "Transition overlays are chosen from the silence boundaries first, then routed through a repetition-aware asset selector."
    ]
  };
};

export const selectActiveTransitionOverlayCueAtTime = ({
  cues,
  currentTimeMs
}: {
  cues: TransitionOverlayCue[];
  currentTimeMs: number;
}): TransitionOverlayCue | null => {
  let low = 0;
  let high = cues.length - 1;
  let bestIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (cues[middle].startMs <= currentTimeMs) {
      bestIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (bestIndex < 0) {
    return null;
  }

  for (let index = bestIndex; index >= 0; index -= 1) {
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
