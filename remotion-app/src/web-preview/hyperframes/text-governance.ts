import type {DisplayTimelineLayer} from "../display-god/display-timeline";

const TEXT_MODE_PRIORITY: Record<string, number> = {
  "title-card": 4,
  "keyword-only": 3,
  "full-caption": 2,
  "no-text": 0
};

const TEXT_VISUAL_ROLE_PRIORITY: Record<string, number> = {
  captain: 3,
  support: 2,
  restraint: 1
};

const getTrackType = (layer: DisplayTimelineLayer): string => {
  return typeof layer.styleMetadata?.["trackType"] === "string"
    ? String(layer.styleMetadata?.["trackType"])
    : "";
};

const getTextMode = (layer: DisplayTimelineLayer): string => {
  return typeof layer.styleMetadata?.["mode"] === "string"
    ? String(layer.styleMetadata?.["mode"])
    : "";
};

const getVisualRole = (layer: DisplayTimelineLayer): string => {
  return typeof layer.styleMetadata?.["visualRole"] === "string"
    ? String(layer.styleMetadata?.["visualRole"])
    : "";
};

const getTrackText = (layer: DisplayTimelineLayer): string => {
  const text = typeof layer.styleMetadata?.["text"] === "string"
    ? String(layer.styleMetadata?.["text"])
    : "";
  return text.trim();
};

export const isRenderableCreativeTextLayer = (layer: DisplayTimelineLayer): boolean => {
  return layer.kind === "creative-track" &&
    getTrackType(layer) === "text" &&
    getTextMode(layer) !== "no-text" &&
    getTrackText(layer).length > 0;
};

const compareTextLayerPriority = (left: DisplayTimelineLayer, right: DisplayTimelineLayer): number => {
  const leftRolePriority = TEXT_VISUAL_ROLE_PRIORITY[getVisualRole(left)] ?? 0;
  const rightRolePriority = TEXT_VISUAL_ROLE_PRIORITY[getVisualRole(right)] ?? 0;
  if (leftRolePriority !== rightRolePriority) {
    return rightRolePriority - leftRolePriority;
  }

  const leftModePriority = TEXT_MODE_PRIORITY[getTextMode(left)] ?? 1;
  const rightModePriority = TEXT_MODE_PRIORITY[getTextMode(right)] ?? 1;
  if (leftModePriority !== rightModePriority) {
    return rightModePriority - leftModePriority;
  }

  if (left.zIndex !== right.zIndex) {
    return right.zIndex - left.zIndex;
  }

  if (left.startMs !== right.startMs) {
    return left.startMs - right.startMs;
  }

  return left.id.localeCompare(right.id);
};

export const filterCompetingHyperframesTextLayers = (
  layers: DisplayTimelineLayer[]
): DisplayTimelineLayer[] => {
  const renderableTextLayers = layers.filter(isRenderableCreativeTextLayer);
  if (renderableTextLayers.length <= 1) {
    return layers;
  }

  const dominantTextLayer = [...renderableTextLayers].sort(compareTextLayerPriority)[0];
  return layers.filter((layer) => !isRenderableCreativeTextLayer(layer) || layer.id === dominantTextLayer.id);
};

export const shouldSuppressNativeCaptionsForHyperframes = (
  layers: DisplayTimelineLayer[]
): boolean => {
  return layers.some((layer) => {
    if (!isRenderableCreativeTextLayer(layer)) {
      return false;
    }

    const mode = getTextMode(layer);
    return mode === "title-card" || mode === "keyword-only" || mode === "full-caption";
  });
};
