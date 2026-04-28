import type {MotionAssetManifest} from "../types";

import type {
  MotionGraphicsAnchor,
  MotionGraphicsAssetRole,
  MotionGraphicsDecision,
  MotionGraphicsDecisionAsset
} from "./types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const isVideoLikeMotionGraphic = (src: string): boolean => /\.(mp4|webm|ogg|m4v|mov)$/i.test(src);
export const isIframeMotionGraphic = (asset?: MotionAssetManifest): boolean => asset?.renderMode === "iframe" || /\.html$/i.test(asset?.src ?? "");

const anchorToPoint = (anchor: MotionGraphicsAnchor): {left: number; top: number} => {
  if (anchor === "top-left") {
    return {left: 18, top: 22};
  }
  if (anchor === "top-right") {
    return {left: 82, top: 22};
  }
  if (anchor === "bottom-left") {
    return {left: 20, top: 78};
  }
  if (anchor === "bottom-right") {
    return {left: 80, top: 78};
  }
  if (anchor === "left") {
    return {left: 18, top: 50};
  }
  if (anchor === "right") {
    return {left: 82, top: 50};
  }
  if (anchor === "top") {
    return {left: 50, top: 18};
  }
  if (anchor === "bottom") {
    return {left: 50, top: 82};
  }
  return {left: 50, top: 50};
};

const resolveRoleBox = ({
  role,
  asset
}: {
  role: MotionGraphicsAssetRole;
  asset?: MotionAssetManifest;
}): {widthPercent: number; heightPercent: number} => {
  const pool = [
    asset?.id,
    asset?.family,
    ...(asset?.functionalTags ?? []),
    ...(asset?.semanticTags ?? [])
  ].join(" ").toLowerCase();

  if (role === "background-companion") {
    return /ring|halo|circle|focus/.test(pool)
      ? {widthPercent: 52, heightPercent: 34}
      : {widthPercent: 100, heightPercent: 100};
  }
  if (role === "typography-support") {
    return {widthPercent: 74, heightPercent: 36};
  }
  if (role === "transition") {
    return {widthPercent: 38, heightPercent: 78};
  }
  if (role === "foreground") {
    return {widthPercent: 30, heightPercent: 34};
  }
  return {widthPercent: 26, heightPercent: 26};
};

export const resolveMotionDecisionAssetPlacement = ({
  selectedAsset,
  decision
}: {
  selectedAsset: MotionGraphicsDecisionAsset;
  decision: MotionGraphicsDecision;
}): {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
} => {
  const textSafeZone = decision.safeZones.find((zone) => zone.kind === "text");
  const asset = selectedAsset.asset;
  const roleBox = resolveRoleBox({
    role: selectedAsset.role,
    asset
  });
  const anchor = selectedAsset.position.anchor;
  const centerReserved = decision.query.textOccupiesCenterFrame || decision.query.subjectOccupiesCenterFrame;
  const hasCircularIntent = /ring|halo|circle|focus/.test([
    asset?.id,
    asset?.canonicalLabel,
    ...(asset?.semanticTags ?? []),
    ...(asset?.functionalTags ?? [])
  ].join(" ").toLowerCase());
  const resolvedAnchor = centerReserved &&
    anchor === "center" &&
    selectedAsset.role !== "background-companion" &&
    !hasCircularIntent
    ? "right"
    : anchor;
  const point = anchorToPoint(resolvedAnchor);

  if (selectedAsset.role === "background-companion" && roleBox.widthPercent >= 90) {
    return {
      leftPercent: 50,
      topPercent: 50,
      widthPercent: roleBox.widthPercent,
      heightPercent: roleBox.heightPercent
    };
  }

  if (selectedAsset.role === "typography-support" && textSafeZone) {
    return {
      leftPercent: textSafeZone.leftPercent + textSafeZone.widthPercent / 2 + (selectedAsset.position.x ?? 0),
      topPercent: textSafeZone.topPercent + textSafeZone.heightPercent / 2 + (selectedAsset.position.y ?? 0),
      widthPercent: Math.max(roleBox.widthPercent, textSafeZone.widthPercent + 8),
      heightPercent: Math.max(roleBox.heightPercent, textSafeZone.heightPercent + 6)
    };
  }

  return {
    leftPercent: point.left + (selectedAsset.position.x ?? 0),
    topPercent: point.top + (selectedAsset.position.y ?? 0),
    widthPercent: roleBox.widthPercent * (selectedAsset.scale ?? 1),
    heightPercent: roleBox.heightPercent * (selectedAsset.scale ?? 1)
  };
};

export const resolveMotionDecisionVisibility = ({
  selectedAsset,
  currentTimeMs,
  fps
}: {
  selectedAsset: MotionGraphicsDecisionAsset;
  currentTimeMs: number;
  fps: number;
}): {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
} => {
  const startMs = (selectedAsset.startFrame / fps) * 1000;
  const endMs = (selectedAsset.endFrame / fps) * 1000;
  const durationMs = Math.max(300, endMs - startMs);
  const enterMs = Math.min(420, durationMs * 0.22);
  const exitMs = Math.min(300, durationMs * 0.16);
  const enterProgress = clamp01((currentTimeMs - startMs) / Math.max(1, enterMs));
  const exitProgress = clamp01((currentTimeMs - (endMs - exitMs)) / Math.max(1, exitMs));
  const easedEnter = 1 - (1 - enterProgress) ** 3;
  const easedExit = exitProgress ** 2;
  const baseOpacity = (selectedAsset.opacity ?? 0.5) * easedEnter * (1 - easedExit);

  if (selectedAsset.role === "transition") {
    return {
      opacity: baseOpacity,
      translateX: (1 - easedEnter) * (selectedAsset.position.anchor.includes("left") ? -44 : 44),
      translateY: 0,
      scale: 0.98 + easedEnter * 0.05
    };
  }

  return {
    opacity: baseOpacity,
    translateX: 0,
    translateY: (1 - easedEnter) * 18 - easedExit * 10,
    scale: 0.965 + easedEnter * 0.045
  };
};

export const resolveMotionDecisionObjectFit = (selectedAsset: MotionGraphicsDecisionAsset): "cover" | "contain" => {
  const asset = selectedAsset.asset;
  const pool = [
    asset?.id,
    asset?.canonicalLabel,
    asset?.family,
    ...(asset?.functionalTags ?? []),
    ...(asset?.semanticTags ?? [])
  ].join(" ").toLowerCase();

  if (selectedAsset.role === "background-companion" && !/ring|halo|circle|ui|card|panel|frame/.test(pool)) {
    return "cover";
  }

  return "contain";
};

export const resolveMotionDecisionZIndex = (role: MotionGraphicsAssetRole): number => {
  if (role === "background-companion") {
    return 4;
  }
  if (role === "typography-support") {
    return 5;
  }
  if (role === "accent") {
    return 6;
  }
  if (role === "foreground") {
    return 7;
  }
  return 8;
};
