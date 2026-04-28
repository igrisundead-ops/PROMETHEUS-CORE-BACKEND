import type {CreativeAsset} from "../../creative-orchestration/types";
import type {MotionAssetManifest, MotionAssetPlacementZone, MotionAssetRenderMode, MotionAssetSafeArea, TemplateGraphicCategory} from "../types";
import {enrichMotionAssetManifest} from "../motion-platform/motion-asset-taxonomy";

import type {NormalizedAssetDocument} from "./types";
import {buildSearchTerms, inferMoodTags, motionLevelToTier, normalizeAssetText, uniqueStrings} from "./text-utils";

const resolveMotionFamily = (document: NormalizedAssetDocument): MotionAssetManifest["family"] => {
  const pool = normalizeAssetText([
    document.asset_type,
    document.animation_family,
    document.category,
    document.dominant_visual_role,
    ...document.tags
  ].join(" "));

  if (/(grid|mesh|guide)/.test(pool)) {
    return "grid";
  }
  if (/(sweep|light|beam|streak)/.test(pool)) {
    return "light-sweep";
  }
  if (/(texture|grain|noise|blur)/.test(pool)) {
    return "texture";
  }
  if (/(flare|glow|halo|ring|circle)/.test(pool)) {
    return "flare";
  }
  if (/(background|depth|haze)/.test(pool)) {
    return "depth-mask";
  }
  if (/(card|panel|frame|ui)/.test(pool)) {
    return "panel";
  }
  return "foreground-element";
};

const resolvePlacementZone = (document: NormalizedAssetDocument): MotionAssetPlacementZone => {
  const pool = normalizeAssetText([
    document.dominant_visual_role,
    document.category,
    ...document.tags,
    ...document.labels
  ].join(" "));

  if (/(background|support background|full frame)/.test(pool)) {
    return "background-depth";
  }
  if (/(lower third|caption support)/.test(pool)) {
    return "lower-third";
  }
  if (/(ring|halo|accent|headline support|focus)/.test(pool)) {
    return "foreground-cross";
  }
  if (/(panel|side|ui|card)/.test(pool)) {
    return "side-panels";
  }
  return "foreground-cross";
};

const resolveSafeArea = (document: NormalizedAssetDocument): MotionAssetSafeArea => {
  return document.asset_type === "background" ? "full-frame" : "edge-safe";
};

const resolveTemplateGraphicCategory = (document: NormalizedAssetDocument): TemplateGraphicCategory | null => {
  const pool = normalizeAssetText([
    document.category,
    document.animation_family,
    ...document.tags
  ].join(" "));

  if (/(graph|chart|metric|growth|kpi)/.test(pool)) {
    return "graph-chart";
  }
  if (/(number|counter|stat)/.test(pool)) {
    return "number-counter-kpi";
  }
  if (/(timeline|calendar|date)/.test(pool)) {
    return "timeline-calendar";
  }
  if (/(workflow|blueprint|steps|system|process)/.test(pool)) {
    return "blueprint-workflow";
  }
  return null;
};

const resolveRenderMode = (document: NormalizedAssetDocument): MotionAssetRenderMode => {
  return document.file_extension === ".html" ? "iframe" : "image";
};

export const toMotionAssetManifest = (document: NormalizedAssetDocument): MotionAssetManifest => {
  const tier = motionLevelToTier(document.motion_intensity);
  const themeTags = inferMoodTags([
    document.motion_intensity,
    ...document.mood,
    ...document.tags,
    ...document.labels
  ]);

  return enrichMotionAssetManifest({
    id: document.asset_id,
    assetRole: "showcase",
    canonicalLabel: document.labels[0] ?? document.asset_id,
    showcasePlacementHint: /background/.test(normalizeAssetText(document.dominant_visual_role)) ? "center" : "auto",
    templateGraphicCategory: resolveTemplateGraphicCategory(document),
    sourceKind: "local-public",
    sourceFile: document.relative_path,
    sourceBatch: document.source_library,
    family: resolveMotionFamily(document),
    tier,
    src: document.public_path.replace(/^\//, ""),
    alphaMode: "straight",
    placementZone: resolvePlacementZone(document),
    durationPolicy: document.extension_is_animated ? "scene-span" : "entry-only",
    themeTags,
    emotionalTags: themeTags,
    semanticTags: uniqueStrings([
      document.category,
      document.subject,
      ...document.tags,
      ...document.labels
    ]),
    subjectTags: uniqueStrings([
      document.subject,
      document.folder_name
    ]),
    functionalTags: uniqueStrings([
      document.dominant_visual_role,
      document.animation_family,
      document.asset_type,
      document.duration_class
    ]),
    semanticTriggers: buildSearchTerms(
      document.semantic_description,
      document.retrieval_caption,
      ...document.contexts,
      ...document.labels
    ),
    searchTerms: buildSearchTerms(
      document.filename,
      document.folder_name,
      document.semantic_description,
      document.retrieval_caption,
      document.animation_family,
      ...document.tags,
      ...document.labels,
      ...document.contexts
    ),
    graphTags: uniqueStrings([
      document.animation_family,
      document.category,
      document.dominant_visual_role
    ]),
    aliases: uniqueStrings([
      document.filename,
      ...document.labels
    ]),
    metadataConfidence: document.confidence,
    safeArea: resolveSafeArea(document),
    loopable: document.extension_is_animated,
    blendMode: /ring|halo|glow|light/.test(normalizeAssetText(document.dominant_visual_role)) ? "screen" : "normal",
    opacity: document.asset_type === "background" ? 0.92 : 1,
    renderMode: resolveRenderMode(document),
    source: "local",
    remoteUrl: undefined
  });
};

export const toCreativeAsset = (document: NormalizedAssetDocument): CreativeAsset => {
  const type: CreativeAsset["type"] = document.file_extension === ".html"
    ? "ui-card"
    : document.extension_is_animated
      ? "video"
      : document.asset_type === "icon"
        ? "icon"
        : document.asset_type === "accent"
          ? "shape"
          : "image";

  return {
    id: document.asset_id,
    name: document.labels[0] ?? document.filename,
    type,
    tags: uniqueStrings([
      ...document.tags,
      document.category,
      document.dominant_visual_role,
      document.animation_family
    ]),
    keywords: buildSearchTerms(
      document.filename,
      document.folder_name,
      document.semantic_description,
      ...document.labels,
      ...document.contexts
    ),
    semanticDescription: document.semantic_description,
    visualStyle: uniqueStrings([
      document.animation_family,
      document.motion_intensity,
      ...document.mood
    ]),
    colors: [],
    aspectRatio: document.aspect_ratio || undefined,
    hasTextSlot: /text|headline|quote|typography/.test(normalizeAssetText([
      document.animation_family,
      ...document.tags
    ].join(" "))),
    motionCompatible: document.extension_is_animated || document.asset_type !== "static_image",
    supportsTransparency: [".png", ".webp", ".svg"].includes(document.file_extension),
    renderCost: document.motion_intensity === "hero" ? "high" : document.motion_intensity === "premium" ? "medium" : "low",
    defaultDurationMs: document.extension_is_animated ? 1600 : 900,
    filePath: document.public_path,
    metadata: {
      public_path: document.public_path,
      absolute_path: document.absolute_path,
      asset_type: document.asset_type,
      source_library: document.source_library,
      confidence: document.confidence
    }
  };
};
