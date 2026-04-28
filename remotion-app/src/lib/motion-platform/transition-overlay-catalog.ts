import transitionOverlayCatalogJson from "../../data/transition-overlays.local.json" with {type: "json"};

import type {
  TransitionOverlayAsset,
  TransitionOverlayBlendMode,
  TransitionOverlayFadePreference,
  TransitionOverlayOrientation,
  TransitionOverlayTrimWindow
} from "../types";

const transitionOverlayAsset = (asset: TransitionOverlayAsset): TransitionOverlayAsset => asset;

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const inferOrientation = (asset: Partial<TransitionOverlayAsset>): TransitionOverlayOrientation => {
  const text = normalizeText([asset.originalFileName, asset.src ?? "", asset.label ?? ""].join(" "));
  if (text.includes("landscape")) {
    return "landscape";
  }
  if (text.includes("both")) {
    return "both";
  }
  return asset.orientation ?? "vertical";
};

const inferCategory = (asset: Partial<TransitionOverlayAsset>): string => {
  const text = normalizeText([asset.originalFileName, asset.label ?? "", asset.category ?? "", ...(asset.styleTags ?? [])].join(" "));
  if (text.includes("click pin") || text.includes("clickpin") || text.includes("pin")) {
    return "click-pin";
  }
  if (text.includes("light leak") || text.includes("leak")) {
    return "light-leak";
  }
  if (text.includes("rough burn") || text.includes("rough")) {
    return "rough-burn";
  }
  if (text.includes("light burn") || text.includes("burn")) {
    return "burn";
  }
  if (text.includes("flare") || text.includes("abstract")) {
    return "flare";
  }
  if (text.includes("fast paced") || text.includes("montage") || text.includes("fast paced video")) {
    return "montage";
  }
  if (text.includes("transition")) {
    return "normal";
  }
  return asset.category ?? "normal";
};

const inferBlendMode = (category: string): TransitionOverlayBlendMode => {
  const normalized = category.toLowerCase();
  if (normalized.includes("leak") || normalized.includes("burn") || normalized.includes("flare")) {
    return "screen";
  }
  if (normalized.includes("click")) {
    return "overlay";
  }
  return "screen";
};

const inferFadePreference = (category: string): TransitionOverlayFadePreference => {
  const normalized = category.toLowerCase();
  if (normalized.includes("click") || normalized.includes("montage")) {
    return "snappy";
  }
  if (normalized.includes("burn") || normalized.includes("leak") || normalized.includes("flare")) {
    return "soft";
  }
  return "balanced";
};

const inferStyleTags = (asset: Partial<TransitionOverlayAsset>, category: string): string[] => {
  const tags = new Set<string>([
    ...(asset.styleTags ?? []),
    category,
    inferOrientation(asset),
    "cinematic",
    "transition"
  ]);

  if (category === "click-pin") {
    tags.add("impact");
    tags.add("kinetic");
  }
  if (category === "montage") {
    tags.add("fast-intro");
    tags.add("rapid");
  }
  if (category.includes("burn")) {
    tags.add("organic");
    tags.add("heat");
  }
  if (category.includes("leak")) {
    tags.add("light");
    tags.add("glow");
  }
  if (category === "flare") {
    tags.add("glow");
    tags.add("abstract");
  }

  return [...tags];
};

const inferTrimWindow = (asset: Partial<TransitionOverlayAsset>, category: string): TransitionOverlayTrimWindow | undefined => {
  if (asset.preferredTrimWindow) {
    return asset.preferredTrimWindow;
  }

  const duration = asset.durationSeconds ?? 0;
  if (duration <= 0) {
    return undefined;
  }

  if (category === "montage") {
    return {startSeconds: Math.max(0, duration * 0.05), endSeconds: Math.max(0.75, duration * 0.56)};
  }
  if (category === "click-pin") {
    return {startSeconds: Math.max(0, duration * 0.04), endSeconds: Math.max(0.9, duration * 0.5)};
  }
  if (category.includes("burn")) {
    return {startSeconds: Math.max(0, duration * 0.08), endSeconds: Math.max(1.4, duration * 0.68)};
  }
  if (category.includes("leak")) {
    return {startSeconds: Math.max(0, duration * 0.06), endSeconds: Math.max(1.2, duration * 0.64)};
  }
  if (category === "flare") {
    return {startSeconds: Math.max(0, duration * 0.05), endSeconds: Math.max(1.0, duration * 0.6)};
  }

  return {startSeconds: Math.max(0, duration * 0.06), endSeconds: Math.max(1.0, duration * 0.62)};
};

const normalizeTransitionOverlayAsset = (asset: Partial<TransitionOverlayAsset>): TransitionOverlayAsset => {
  const category = inferCategory(asset);
  const orientation = inferOrientation(asset);
  const styleTags = inferStyleTags(asset, category);
  const blendMode = asset.blendMode ?? inferBlendMode(category);
  const fadePreference = asset.fadePreference ?? inferFadePreference(category);
  const recommendedDurationSeconds = asset.recommendedDurationSeconds ?? (
    category === "burn" || category === "rough-burn"
      ? 1.65
      : category === "light-leak"
        ? 1.55
        : category === "flare"
          ? 1.38
          : category === "montage"
            ? 1.32
            : 1.38
  );
  const fallbackId = asset.originalFileName
    ? asset.originalFileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    : asset.id ?? "transition-asset";

  return transitionOverlayAsset({
    id: asset.id ?? fallbackId,
    label: asset.label ?? asset.originalFileName ?? asset.id ?? "Transition Asset",
    src: asset.src ?? "",
    originalFileName: asset.originalFileName ?? asset.id ?? "transition.mp4",
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    fps: asset.fps ?? 30,
    durationSeconds: asset.durationSeconds ?? 0,
    orientation,
    orientationSource: asset.orientationSource ?? (asset.originalFileName?.toLowerCase().includes("landscape") ? "filename-tag" : "manual"),
    category,
    styleTags,
    recommendedDurationSeconds,
    preferredTrimWindow: inferTrimWindow(asset, category),
    blendMode,
    fadePreference,
    opacity: asset.opacity ?? (category === "click-pin" ? 0.96 : category.includes("burn") || category.includes("leak") ? 0.92 : 0.95)
  });
};

const transitionOverlayCatalog: TransitionOverlayAsset[] = (transitionOverlayCatalogJson as Partial<TransitionOverlayAsset>[])
  .map((asset) => normalizeTransitionOverlayAsset(asset));

export const getTransitionOverlayCatalog = (): TransitionOverlayAsset[] => transitionOverlayCatalog;

export const getTransitionOverlayAsset = (assetId: string): TransitionOverlayAsset | null => {
  return transitionOverlayCatalog.find((asset) => asset.id === assetId) ?? null;
};

export const getTransitionOverlayCatalogSummary = () => {
  return {
    totalCount: transitionOverlayCatalog.length,
    landscapeCount: transitionOverlayCatalog.filter((asset) => asset.orientation === "landscape").length,
    verticalCount: transitionOverlayCatalog.filter((asset) => asset.orientation === "vertical").length,
    bothCount: transitionOverlayCatalog.filter((asset) => asset.orientation === "both").length
  };
};
