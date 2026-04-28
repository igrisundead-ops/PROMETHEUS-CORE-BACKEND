import type {
  CinematicPiPCardBox,
  CinematicPiPFreeSpaceZone,
  CinematicPiPLayoutPreset,
  CinematicPiPPlan,
  CinematicPiPMotionAssetFlavor,
  CinematicPiPMotionAssetPlacement,
  CinematicPiPSubjectAnchor,
  MotionAssetFamily,
  MotionAssetManifest,
  MotionMoodTag,
  MotionTier,
  VideoMetadata
} from "../types";
import {motionAssetLibrary, resolveMotionAssets} from "./asset-manifests";

export type CinematicPiPPlannerInput = {
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "durationSeconds" | "durationInFrames">;
  motionTier: MotionTier;
  layoutPreset?: CinematicPiPLayoutPreset;
  subjectAnchor?: Partial<CinematicPiPSubjectAnchor> | null;
  motionAssets?: MotionAssetManifest[];
  headlineText?: string;
  supportText?: string;
};

export type CinematicPiPStageState = {
  fullFrameProgress: number;
  settleProgress: number;
  freeSpaceProgress: number;
  cardRect: CinematicPiPCardBox;
  shadowOpacity: number;
  shadowOffsetYPx: number;
  shadowBlurPx: number;
  backgroundScale: number;
  backgroundBlurPx: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};

const uniqueById = (assets: MotionAssetManifest[]): MotionAssetManifest[] => {
  const seen = new Set<string>();
  const output: MotionAssetManifest[] = [];

  for (const asset of assets) {
    if (seen.has(asset.id)) {
      continue;
    }
    seen.add(asset.id);
    output.push(asset);
  }

  return output;
};

const getAspectRatio = (videoMetadata: Pick<VideoMetadata, "width" | "height">): number => {
  if (videoMetadata.width > 0 && videoMetadata.height > 0) {
    return videoMetadata.width / videoMetadata.height;
  }
  return 16 / 9;
};

const resolveDefaultLayoutPreset = (aspectRatio: number): CinematicPiPLayoutPreset => {
  if (aspectRatio >= 1.5) {
    return "pip-left-content-right";
  }
  if (aspectRatio >= 1.08) {
    return "pip-floating-multi-ui";
  }
  return "pip-small-corner-large-text";
};

const resolveSubjectAnchor = ({
  layoutPreset,
  aspectRatio,
  subjectAnchor
}: {
  layoutPreset: CinematicPiPLayoutPreset;
  aspectRatio: number;
  subjectAnchor?: Partial<CinematicPiPSubjectAnchor> | null;
}): CinematicPiPSubjectAnchor => {
  if (subjectAnchor && typeof subjectAnchor.xPercent === "number" && typeof subjectAnchor.yPercent === "number") {
    return {
      xPercent: clamp(subjectAnchor.xPercent, 8, 92),
      yPercent: clamp(subjectAnchor.yPercent, 8, 92),
      confidence: clamp(typeof subjectAnchor.confidence === "number" ? subjectAnchor.confidence : 0.84, 0, 1),
      source: subjectAnchor.source ?? "provided",
      rationale: subjectAnchor.rationale ?? "Provided subject anchor was used to preserve the face and upper torso."
    };
  }

  const yPercent =
    layoutPreset === "pip-small-corner-large-text"
      ? aspectRatio >= 1.6
        ? 33
        : 31
      : layoutPreset === "pip-floating-multi-ui"
        ? aspectRatio >= 1.6
          ? 35
          : 33
        : 36;
  const xPercent =
    layoutPreset === "pip-right-content-left"
      ? 51
      : layoutPreset === "pip-small-corner-large-text"
        ? 49
        : 50;

  return {
    xPercent,
    yPercent,
    confidence: 0.78,
    source: "heuristic",
    rationale:
      "Upper-center subject anchoring keeps the face and shoulder line readable while leaving room for editorial framing."
  };
};

const resolveCardBox = ({
  layoutPreset,
  aspectRatio
}: {
  layoutPreset: CinematicPiPLayoutPreset;
  aspectRatio: number;
}): CinematicPiPCardBox => {
  if (layoutPreset === "pip-right-content-left") {
    return {
      leftPercent: aspectRatio >= 1.5 ? 43.5 : 46,
      topPercent: 12.5,
      widthPercent: aspectRatio >= 1.5 ? 50 : 46,
      heightPercent: aspectRatio >= 1.5 ? 74 : 68,
      borderRadiusPx: 34
    };
  }

  if (layoutPreset === "pip-small-corner-large-text") {
    return {
      leftPercent: 60.5,
      topPercent: 14,
      widthPercent: aspectRatio >= 1.1 ? 31 : 35,
      heightPercent: aspectRatio >= 1.1 ? 36 : 32,
      borderRadiusPx: 28
    };
  }

  if (layoutPreset === "pip-floating-multi-ui") {
    return {
      leftPercent: 22.5,
      topPercent: 17,
      widthPercent: aspectRatio >= 1.5 ? 39 : 45,
      heightPercent: aspectRatio >= 1.5 ? 58 : 50,
      borderRadiusPx: 36
    };
  }

  return {
    leftPercent: 5.5,
    topPercent: 12.5,
    widthPercent: aspectRatio >= 1.6 ? 49 : 46,
    heightPercent: aspectRatio >= 1.6 ? 74 : 70,
    borderRadiusPx: 34
  };
};

const makeZone = (
  zone: CinematicPiPFreeSpaceZone
): CinematicPiPFreeSpaceZone => zone;

const resolveFreeSpaceZones = ({
  layoutPreset,
  aspectRatio
}: {
  layoutPreset: CinematicPiPLayoutPreset;
  aspectRatio: number;
}): CinematicPiPFreeSpaceZone[] => {
  if (layoutPreset === "pip-right-content-left") {
    return [
      makeZone({id: "headline", role: "headline", leftPercent: 5.5, topPercent: 12, widthPercent: 32, heightPercent: 24, align: "left"}),
      makeZone({id: "support", role: "support", leftPercent: 5.5, topPercent: 39, widthPercent: 30, heightPercent: 16, align: "left"}),
      makeZone({id: "asset-stack", role: "asset-stack", leftPercent: 5.5, topPercent: 58, widthPercent: 32, heightPercent: 24, align: "left"}),
      makeZone({id: "callout", role: "callout", leftPercent: 23.5, topPercent: 79, widthPercent: 14, heightPercent: 8, align: "left"})
    ];
  }

  if (layoutPreset === "pip-small-corner-large-text") {
    return [
      makeZone({id: "headline", role: "headline", leftPercent: 6.5, topPercent: 12, widthPercent: 52, heightPercent: 28, align: "left"}),
      makeZone({id: "support", role: "support", leftPercent: 6.5, topPercent: 43, widthPercent: 48, heightPercent: 16, align: "left"}),
      makeZone({id: "asset-stack", role: "asset-stack", leftPercent: 6.5, topPercent: 63, widthPercent: 52, heightPercent: 22, align: "left"}),
      makeZone({id: "callout", role: "callout", leftPercent: 60, topPercent: 12, widthPercent: 26, heightPercent: 10, align: "right"})
    ];
  }

  if (layoutPreset === "pip-floating-multi-ui") {
    return [
      makeZone({id: "headline", role: "headline", leftPercent: 9, topPercent: 11, widthPercent: 34, heightPercent: 24, align: "left"}),
      makeZone({id: "support", role: "support", leftPercent: 9, topPercent: 67, widthPercent: 34, heightPercent: 16, align: "left"}),
      makeZone({id: "asset-stack", role: "asset-stack", leftPercent: 66, topPercent: 18, widthPercent: 26, heightPercent: 34, align: "right"}),
      makeZone({id: "callout", role: "callout", leftPercent: 66, topPercent: 59, widthPercent: 23, heightPercent: 12, align: "right"})
    ];
  }

  return [
    makeZone({id: "headline", role: "headline", leftPercent: 57.5, topPercent: 12, widthPercent: 34, heightPercent: 24, align: "left"}),
    makeZone({id: "support", role: "support", leftPercent: 57.5, topPercent: 39, widthPercent: 30, heightPercent: 16, align: "left"}),
    makeZone({id: "asset-stack", role: "asset-stack", leftPercent: 57.5, topPercent: 58, widthPercent: 33, heightPercent: 24, align: "left"}),
    makeZone({id: "callout", role: "callout", leftPercent: 78, topPercent: 80, widthPercent: 12, heightPercent: 8, align: "right"})
  ];
};

const resolveMotionAssetFlavor = (asset: MotionAssetManifest): CinematicPiPMotionAssetFlavor => {
  if (asset.family === "flare") {
    return "glow";
  }
  if (asset.family === "depth-mask") {
    return "drift";
  }
  if (asset.family === "foreground-element") {
    return "float";
  }
  if (asset.family === "grid") {
    return "pulse";
  }
  if (asset.family === "panel") {
    return "slide";
  }
  return "drift";
};

const resolveMotionAssetOpacity = (asset: MotionAssetManifest): number => {
  if (asset.family === "flare") {
    return 0.88;
  }
  if (asset.family === "frame") {
    return 0.94;
  }
  if (asset.family === "foreground-element") {
    return 0.9;
  }
  if (asset.family === "grid") {
    return 0.82;
  }
  return 0.92;
};

const resolveMotionAssetScale = (asset: MotionAssetManifest): number => {
  if (asset.family === "flare") {
    return 0.9;
  }
  if (asset.family === "foreground-element") {
    return 1.02;
  }
  if (asset.family === "grid") {
    return 0.96;
  }
  return 1;
};

const resolveAssetFamilies = (layoutPreset: CinematicPiPLayoutPreset): MotionAssetFamily[] => {
  if (layoutPreset === "pip-small-corner-large-text") {
    return ["panel", "flare", "foreground-element", "frame"];
  }
  if (layoutPreset === "pip-floating-multi-ui") {
    return ["frame", "grid", "panel", "flare", "foreground-element"];
  }
  return ["frame", "panel", "flare", "foreground-element"];
};

const pickZoneForAsset = (
  asset: MotionAssetManifest,
  zones: CinematicPiPFreeSpaceZone[],
  index: number
): CinematicPiPFreeSpaceZone => {
  const byRole = new Map(zones.map((zone) => [zone.role, zone] as const));
  if (asset.family === "flare") {
    return byRole.get("headline") ?? zones[0];
  }
  if (asset.family === "grid" || asset.family === "depth-mask") {
    return byRole.get("support") ?? zones[1] ?? zones[0];
  }
  if (asset.family === "panel" || asset.family === "frame") {
    return byRole.get("asset-stack") ?? zones.at(-1) ?? zones[0];
  }
  if (asset.family === "foreground-element") {
    return byRole.get("callout") ?? zones.at(-1) ?? zones[0];
  }
  return zones[index % zones.length] ?? zones[0];
};

const buildPlacementBox = ({
  zone,
  asset
}: {
  zone: CinematicPiPFreeSpaceZone;
  asset: MotionAssetManifest;
}): CinematicPiPMotionAssetPlacement => {
  const horizontalInset = zone.widthPercent * (asset.family === "flare" ? 0.14 : 0.08);
  const verticalInset = zone.heightPercent * (asset.family === "flare" ? 0.18 : 0.1);
  const widthPercent = clamp(zone.widthPercent - horizontalInset * 2, 12, 100);
  const heightPercent = clamp(zone.heightPercent - verticalInset * 2, 8, 100);
  const leftPercent = zone.leftPercent + horizontalInset;
  const topPercent = zone.topPercent + verticalInset;

  return {
    asset,
    zoneId: zone.id,
    leftPercent,
    topPercent,
    widthPercent,
    heightPercent,
    revealDelayFrames: asset.family === "flare" ? 12 : asset.family === "foreground-element" ? 22 : 18,
    motionFlavor: resolveMotionAssetFlavor(asset),
    opacity: resolveMotionAssetOpacity(asset),
    scale: resolveMotionAssetScale(asset)
  };
};

export const selectCinematicPiPMotionAssets = ({
  layoutPreset,
  motionTier,
  motionAssets
}: {
  layoutPreset: CinematicPiPLayoutPreset;
  motionTier: MotionTier;
  motionAssets?: MotionAssetManifest[];
}): MotionAssetManifest[] => {
  const preferredAssets = uniqueById((motionAssets ?? []).filter(Boolean));
  const fallbackAssets = resolveMotionAssets({
    tier: motionTier,
    moodTags: ["neutral", "cool", "authority", "heroic"] as MotionMoodTag[],
    safeArea: "avoid-caption-region",
    families: resolveAssetFamilies(layoutPreset),
    library: motionAssetLibrary
  });

  return uniqueById([...preferredAssets, ...fallbackAssets]).slice(0, 4);
};

export const buildCinematicPiPCompositionPlan = ({
  videoMetadata,
  motionTier,
  layoutPreset,
  subjectAnchor,
  motionAssets
}: CinematicPiPPlannerInput): CinematicPiPPlan => {
  const aspectRatio = getAspectRatio(videoMetadata);
  const resolvedLayoutPreset = layoutPreset ?? resolveDefaultLayoutPreset(aspectRatio);
  const resolvedSubjectAnchor = resolveSubjectAnchor({
    layoutPreset: resolvedLayoutPreset,
    aspectRatio,
    subjectAnchor
  });
  const cardBox = resolveCardBox({
    layoutPreset: resolvedLayoutPreset,
    aspectRatio
  });
  const freeSpaceZones = resolveFreeSpaceZones({
    layoutPreset: resolvedLayoutPreset,
    aspectRatio
  });
  const selectedAssets = selectCinematicPiPMotionAssets({
    layoutPreset: resolvedLayoutPreset,
    motionTier,
    motionAssets
  });
  const motionAssetPlacements = selectedAssets.map((asset, index) => {
    const zone = pickZoneForAsset(asset, freeSpaceZones, index);
    return buildPlacementBox({zone, asset});
  });
  const tierHold =
    motionTier === "hero" ? 34 : motionTier === "premium" ? 30 : motionTier === "editorial" ? 26 : 22;
  const tierSettle =
    motionTier === "hero" ? 60 : motionTier === "premium" ? 56 : motionTier === "editorial" ? 50 : 44;
  const tierFreeSpace =
    motionTier === "hero" ? 44 : motionTier === "premium" ? 40 : motionTier === "editorial" ? 34 : 30;
  const tierStagger =
    motionTier === "hero" ? 10 : motionTier === "premium" ? 12 : motionTier === "editorial" ? 13 : 14;

  const reasons = [
    `layoutPreset=${resolvedLayoutPreset}`,
    `aspectRatio=${aspectRatio.toFixed(2)}`,
    `subjectAnchor=${resolvedSubjectAnchor.xPercent.toFixed(1)}x${resolvedSubjectAnchor.yPercent.toFixed(1)}`,
    `motionAssets=${motionAssetPlacements.length}`,
    `tier=${motionTier}`
  ];

  return {
    layoutPreset: resolvedLayoutPreset,
    subjectAnchor: resolvedSubjectAnchor,
    cardBox,
    freeSpaceZones,
    motionAssetPlacements,
    entrance: {
      fullFrameFrames: tierHold,
      settleFrames: tierSettle,
      freeSpaceRevealFrames: tierFreeSpace,
      assetStaggerFrames: tierStagger
    },
    shadow: {
      blurPx: motionTier === "hero" ? 72 : motionTier === "premium" ? 64 : motionTier === "editorial" ? 54 : 46,
      offsetYPx: motionTier === "hero" ? 32 : motionTier === "premium" ? 28 : motionTier === "editorial" ? 24 : 18,
      spreadPx: 0,
      opacity: motionTier === "hero" ? 0.38 : motionTier === "premium" ? 0.34 : motionTier === "editorial" ? 0.28 : 0.22
    },
    reasons
  };
};

export const resolveCinematicPiPStageState = ({
  plan,
  currentFrame
}: {
  plan: CinematicPiPPlan;
  currentFrame: number;
}): CinematicPiPStageState => {
  const settleProgress = easeInOutCubic((currentFrame - plan.entrance.fullFrameFrames) / Math.max(1, plan.entrance.settleFrames));
  const freeSpaceProgress = easeOutCubic((currentFrame - (plan.entrance.fullFrameFrames + Math.round(plan.entrance.settleFrames * 0.36))) /
    Math.max(1, plan.entrance.freeSpaceRevealFrames));
  const morphProgress = clamp01(settleProgress);

  const cardRect: CinematicPiPCardBox = {
    leftPercent: lerp(0, plan.cardBox.leftPercent, morphProgress),
    topPercent: lerp(0, plan.cardBox.topPercent, morphProgress),
    widthPercent: lerp(100, plan.cardBox.widthPercent, morphProgress),
    heightPercent: lerp(100, plan.cardBox.heightPercent, morphProgress),
    borderRadiusPx: lerp(0, plan.cardBox.borderRadiusPx, morphProgress)
  };

  return {
    fullFrameProgress: clamp01(currentFrame / Math.max(1, plan.entrance.fullFrameFrames)),
    settleProgress: morphProgress,
    freeSpaceProgress,
    cardRect,
    shadowOpacity: plan.shadow.opacity * morphProgress,
    shadowOffsetYPx: plan.shadow.offsetYPx * morphProgress,
    shadowBlurPx: plan.shadow.blurPx * (0.38 + morphProgress * 0.62),
    backgroundScale: lerp(1.055, 1.015, morphProgress),
    backgroundBlurPx: lerp(0, 14, morphProgress)
  };
};
