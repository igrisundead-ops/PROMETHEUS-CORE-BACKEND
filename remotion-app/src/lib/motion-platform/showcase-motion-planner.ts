import type {
  CaptionChunk,
  CaptionStyleProfileId,
  MotionAssetManifest,
  MotionShowcaseCue,
  MotionShowcasePlan,
  MotionTier,
  VideoMetadata
} from "../types";
import {resolveShowcasePlacement} from "./showcase-asset-catalog";
import {buildMotionShowcaseIntelligencePlan, type MotionShowcaseIntelligencePlan} from "./showcase-intelligence";
import {isLongformSemanticSidecallCaptionStyleProfile} from "../stylebooks/caption-style-profiles";
import {
  buildSemanticSidecallGovernorCueAsset,
  type SemanticSidecallGovernorCandidate
} from "./semantic-sidecall-governor";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const findLastCueStartingBeforeOrAt = (cues: MotionShowcaseCue[], targetTimeMs: number): number => {
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

const compareCuePriority = (
  left: MotionShowcaseCue,
  right: MotionShowcaseCue,
  currentTimeMs: number
): number => {
  const leftIsPeaking = currentTimeMs >= left.peakStartMs && currentTimeMs <= left.peakEndMs ? 1 : 0;
  const rightIsPeaking = currentTimeMs >= right.peakStartMs && currentTimeMs <= right.peakEndMs ? 1 : 0;

  if (leftIsPeaking !== rightIsPeaking) {
    return leftIsPeaking - rightIsPeaking;
  }
  if (left.score !== right.score) {
    return left.score - right.score;
  }
  return right.startMs - left.startMs;
};

const buildGovernorCandidateFromIntent = (
  intent: MotionShowcaseIntelligencePlan["selectedIntents"][number]
): SemanticSidecallGovernorCandidate => ({
  conceptId: intent.conceptId,
  conceptLabel: intent.conceptLabel,
  category: intent.category,
  sourceChunkText: intent.sourceChunkText,
  matchedText: intent.matchedText,
  matchedStartMs: intent.matchedStartMs,
  matchedEndMs: intent.matchedEndMs,
  placementHint: intent.placementHint,
  confidence: intent.confidence,
  supportWords: intent.supportWords,
  recommendedLabels: intent.recommendedLabels,
  assetSearchTerms: intent.assetSearchTerms,
  matchedAsset: intent.matchedAsset,
  matchedAssetScore: intent.matchedAssetScore,
  assetOptions: intent.assetOptions
});

const buildCue = ({
  intent,
  aspectRatio,
  captionBias,
  showLabelPlate
}: {
  intent: MotionShowcaseIntelligencePlan["selectedIntents"][number];
  aspectRatio: number;
  captionBias: "top" | "middle" | "bottom";
  showLabelPlate: boolean;
}): MotionShowcaseCue => {
  const cueSource = intent.governorDecision?.cueSource ?? "direct-asset";
  const asset = cueSource === "direct-asset"
    ? intent.matchedAsset as MotionAssetManifest
    : buildSemanticSidecallGovernorCueAsset({
      candidate: buildGovernorCandidateFromIntent(intent),
      decision: intent.governorDecision ?? {
        action: "text-only-accent",
        cueSource: "typography-only",
        score: intent.confidence,
        reasonCodes: ["typography-fallback"],
        templateGraphicCategory: null
      }
    });
  const baseLead = cueSource === "template-graphic"
    ? 180
    : cueSource === "typography-only"
      ? 140
      : intent.matchedAssetScore >= 52
        ? 120
        : 150;
  const wordDuration = Math.max(220, intent.matchedEndMs - intent.matchedStartMs);
  const holdMs = cueSource === "template-graphic"
    ? Math.max(360, Math.min(1240, wordDuration + 280))
    : cueSource === "typography-only"
      ? Math.max(300, Math.min(960, wordDuration + 220))
      : Math.max(260, Math.min(980, wordDuration + 180));
  const exitMs = cueSource === "template-graphic"
    ? 300
    : intent.category === "marketplace"
      ? 260
      : 220;
  const placement = resolveShowcasePlacement({
    aspectRatio,
    captionBias,
    placementHint: intent.placementHint
  });
  const startMs = Math.max(0, intent.matchedStartMs - baseLead);
  const peakStartMs = intent.matchedStartMs;
  const peakEndMs = intent.matchedEndMs + Math.max(0, holdMs - wordDuration);
  const endMs = peakEndMs + exitMs;
  return {
    id: `showcase-${asset.id}-${intent.matchedWordIndex}`,
    assetId: asset.id,
    asset,
    canonicalLabel: asset.canonicalLabel ?? asset.id,
    cueSource,
    matchedText: intent.matchedText,
    matchedWordIndex: intent.matchedWordIndex,
    matchedStartMs: intent.matchedStartMs,
    matchedEndMs: intent.matchedEndMs,
    startMs,
    peakStartMs,
    peakEndMs,
    endMs,
    leadMs: baseLead,
    holdMs,
    exitMs,
    placement,
    showLabelPlate: showLabelPlate && cueSource === "direct-asset",
    score: intent.governorDecision?.score ?? (intent.confidence + intent.matchedAssetScore),
    matchKind: cueSource === "template-graphic"
      ? "template"
      : cueSource === "typography-only"
        ? "typography"
        : intent.matchedAssetScore >= 52
          ? "exact"
          : intent.matchedAssetScore >= 40
            ? "search-term"
            : "fallback",
    templateGraphicCategory: intent.governorDecision?.templateGraphicCategory ?? asset.templateGraphicCategory ?? null,
    governorAction: intent.governorDecision?.action,
    governorReasonCodes: intent.governorDecision?.reasonCodes,
    governorScore: intent.governorDecision?.score,
    reason: intent.reasoning
  };
};

const selectNonOverlappingCues = ({
  cues,
  minGapMs
}: {
  cues: MotionShowcaseCue[];
  minGapMs: number;
}): MotionShowcaseCue[] => {
  const selected: MotionShowcaseCue[] = [];

  for (const cue of cues) {
    const overlaps = selected.some((existing) => {
      return Math.abs(existing.matchedStartMs - cue.matchedStartMs) < minGapMs ||
        Math.abs(existing.startMs - cue.startMs) < minGapMs;
    });

    if (!overlaps) {
      selected.push(cue);
    }
  }

  return selected.sort((a, b) => a.startMs - b.startMs || a.assetId.localeCompare(b.assetId));
};

export const buildMotionShowcasePlan = ({
  chunks,
  tier,
  videoMetadata,
  captionBias = "middle",
  captionProfileId,
  catalog
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  captionBias?: "top" | "middle" | "bottom";
  captionProfileId?: CaptionStyleProfileId;
  catalog?: MotionAssetManifest[];
}): MotionShowcasePlan & {intelligencePlan: MotionShowcaseIntelligencePlan} => {
  const aspectRatio = videoMetadata && videoMetadata.width > 0 && videoMetadata.height > 0
    ? Number((videoMetadata.width / videoMetadata.height).toFixed(2))
    : 9 / 16;
  const intelligencePlan = buildMotionShowcaseIntelligencePlan({
    chunks,
    tier,
    videoMetadata,
    captionProfileId,
    catalog
  });
  const showLabelPlate = isLongformSemanticSidecallCaptionStyleProfile(captionProfileId);
  const selectedCues = intelligencePlan.selectedIntents
    .filter((intent) => {
      const cueSource = intent.governorDecision?.cueSource ?? "direct-asset";
      return cueSource !== "direct-asset" || Boolean(intent.matchedAsset);
    })
    .map((intent) => buildCue({
      intent,
      aspectRatio,
      captionBias,
      showLabelPlate
    }))
    .sort((a, b) => b.score - a.score || a.matchedStartMs - b.matchedStartMs);
  const cues = selectNonOverlappingCues({
    cues: selectedCues,
    minGapMs: Math.max(4200, Math.round(intelligencePlan.minGapMs * 0.85))
  });
  const selectedAssets = cues.map((cue) => cue.asset);

  const reasons = [
    `cues=${cues.length}/${intelligencePlan.targetCueCount}`,
    `layout=${aspectRatio >= 1.1 ? "landscape-callout" : "portrait-safe"}`,
    ...intelligencePlan.reasons
  ];

  return {
    aspectRatio,
    layoutMode: aspectRatio >= 1.1 ? "landscape-callout" : "portrait-safe",
    cues,
    selectedAssets,
    reasons,
    intelligencePlan
  };
};

export const selectActiveMotionShowcaseCueAtTime = ({
  cues,
  currentTimeMs
}: {
  cues: MotionShowcaseCue[];
  currentTimeMs: number;
}): MotionShowcaseCue | null => {
  const lastRelevantIndex = findLastCueStartingBeforeOrAt(cues, currentTimeMs);
  if (lastRelevantIndex < 0) {
    return null;
  }

  let selectedCue: MotionShowcaseCue | null = null;

  for (let index = lastRelevantIndex; index >= 0; index -= 1) {
    const cue = cues[index];
    if (cue.endMs < currentTimeMs) {
      break;
    }
    if (currentTimeMs < cue.startMs || currentTimeMs > cue.endMs) {
      continue;
    }
    if (!selectedCue || compareCuePriority(cue, selectedCue, currentTimeMs) > 0) {
      selectedCue = cue;
    }
  }

  return selectedCue;
};

export const getMotionShowcaseCueVisibility = ({
  cue,
  currentTimeMs
}: {
  cue: MotionShowcaseCue;
  currentTimeMs: number;
}): number => {
  const enterProgress = clamp01((currentTimeMs - cue.startMs) / Math.max(1, cue.peakStartMs - cue.startMs));
  const exitProgress = clamp01((currentTimeMs - cue.peakEndMs) / Math.max(1, cue.endMs - cue.peakEndMs));
  return enterProgress * (1 - exitProgress);
};
