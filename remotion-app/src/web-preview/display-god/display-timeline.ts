import type {CreativeRenderMode} from "../../creative-orchestration/render/creative-timeline-to-remotion";
import type {CreativeTimeline, CreativeTrack} from "../../creative-orchestration/types";
import {
  isIframeMotionGraphic,
  isVideoLikeMotionGraphic,
  resolveMotionDecisionAssetPlacement,
  resolveMotionDecisionVisibility,
  resolveMotionDecisionZIndex
} from "../../lib/motion-graphics-agent/rendering";
import type {MotionGraphicsDecisionAsset, MotionGraphicsDecision} from "../../lib/motion-graphics-agent/types";
import type {MotionCompositionModel, ResolvedMotionScene} from "../../lib/motion-platform/scene-engine";
import type {CaptionChunk, CaptionStyleProfileId, VideoMetadata} from "../../lib/types";
import type {AudioCreativePreviewSession} from "../audio-creative-preview-session";

export type DisplayTimelineMediaKind = "none" | "image" | "video" | "iframe" | "sound";
export type DisplayTimelineLayerKind =
  | "caption"
  | "creative-track"
  | "motion-scene"
  | "motion-asset"
  | "background-overlay"
  | "transition-overlay"
  | "showcase-overlay"
  | "sound-cue";
export type DisplayTimelineSyncQuality = "not-applicable" | "pending" | "synced" | "unsynced";

export type DisplayTimelineLayerPlacement = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  anchor?: string;
};

export type DisplayTimelineLayerTransform = {
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotateDeg?: number;
};

export type DisplayTimelineLayer = {
  id: string;
  kind: DisplayTimelineLayerKind;
  mediaKind: DisplayTimelineMediaKind;
  label: string;
  startMs: number;
  endMs: number;
  zIndex: number;
  visual: boolean;
  assetId?: string;
  sceneId?: string;
  src?: string | null;
  opacity?: number;
  placement?: DisplayTimelineLayerPlacement;
  transform?: DisplayTimelineLayerTransform;
  easing?: {
    enter?: string;
    exit?: string;
  };
  styleMetadata?: Record<string, unknown>;
  exportMetadata?: Record<string, unknown>;
  syncQuality: DisplayTimelineSyncQuality;
};

export type DisplayTimeline = {
  id: string;
  jobId: string;
  renderMode: CreativeRenderMode;
  durationMs: number;
  captionProfileId: CaptionStyleProfileId;
  baseVideo: {
    src: string;
    width: number;
    height: number;
    fps: number;
    durationMs: number;
    sourceLabel?: string | null;
  };
  audio: {
    src?: string | null;
    source: "video-element" | "separate-audio" | "none";
  };
  captions: CaptionChunk[];
  layers: DisplayTimelineLayer[];
  creativeTimeline: CreativeTimeline;
  motionModel: MotionCompositionModel;
  exportMetadata: {
    creativeTimelineId: string;
    sourceJobId: string;
    renderMode: CreativeRenderMode;
    trackCount: number;
    momentCount: number;
    patternMemoryFingerprint?: string;
  };
};

const createEmptyCreativeTimeline = ({
  jobId,
  durationMs
}: {
  jobId: string;
  durationMs: number;
}): CreativeTimeline => {
  return {
    id: `${jobId}-display-god-fallback-timeline`,
    sourceJobId: jobId,
    durationMs,
    moments: [],
    decisions: [],
    tracks: [],
    diagnostics: {
      proposalCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      renderCost: "low",
      mattingWindows: [],
      warnings: []
    }
  };
};

const resolveMediaKindFromSrc = (src?: string | null): DisplayTimelineMediaKind => {
  const normalized = src?.trim() ?? "";
  if (!normalized) {
    return "none";
  }
  if (/\.html($|\?)/i.test(normalized)) {
    return "iframe";
  }
  if (isVideoLikeMotionGraphic(normalized)) {
    return "video";
  }
  return "image";
};

const resolveScenePlacement = (scene: ResolvedMotionScene): DisplayTimelineLayerPlacement => {
  if (scene.safeArea === "full-frame") {
    return {
      leftPercent: 50,
      topPercent: 50,
      widthPercent: 100,
      heightPercent: 100,
      anchor: "center"
    };
  }

  return {
    leftPercent: 50,
    topPercent: scene.safeArea === "avoid-caption-region" ? 38 : 50,
    widthPercent: scene.safeArea === "avoid-caption-region" ? 84 : 92,
    heightPercent: scene.safeArea === "avoid-caption-region" ? 42 : 48,
    anchor: "center"
  };
};

const resolveLegacyAssetPlacement = (placementZone: string): DisplayTimelineLayerPlacement => {
  if (placementZone === "edge-frame") {
    return {leftPercent: 50, topPercent: 50, widthPercent: 100, heightPercent: 100, anchor: "center"};
  }
  if (placementZone === "side-panels") {
    return {leftPercent: 84, topPercent: 50, widthPercent: 24, heightPercent: 34, anchor: "right"};
  }
  if (placementZone === "lower-third") {
    return {leftPercent: 50, topPercent: 78, widthPercent: 48, heightPercent: 24, anchor: "bottom"};
  }
  if (placementZone === "foreground-cross") {
    return {leftPercent: 50, topPercent: 50, widthPercent: 90, heightPercent: 90, anchor: "center"};
  }
  if (placementZone === "background-depth") {
    return {leftPercent: 50, topPercent: 50, widthPercent: 100, heightPercent: 100, anchor: "center"};
  }

  return {leftPercent: 50, topPercent: 50, widthPercent: 34, heightPercent: 34, anchor: "center"};
};

const resolveTrackMediaKind = (track: CreativeTrack): DisplayTimelineMediaKind => {
  const src = typeof track.payload["src"] === "string"
    ? track.payload["src"]
    : typeof track.payload["assetSrc"] === "string"
      ? track.payload["assetSrc"]
      : null;

  if (track.type === "sound") {
    return "sound";
  }

  return resolveMediaKindFromSrc(src);
};

const resolveCreativeTrackPlacement = (track: CreativeTrack): DisplayTimelineLayerPlacement | undefined => {
  const positionIntent = typeof track.payload["positionIntent"] === "string"
    ? track.payload["positionIntent"]
    : typeof track.payload["placementIntent"] === "string"
      ? track.payload["placementIntent"]
      : track.type === "text"
        ? "center"
        : "right-card";

  if (positionIntent === "hero-center") {
    return {leftPercent: 50, topPercent: 20, widthPercent: 68, heightPercent: 26, anchor: "center"};
  }
  if (positionIntent === "lower-third") {
    return {leftPercent: 50, topPercent: 80, widthPercent: 72, heightPercent: 18, anchor: "bottom"};
  }
  if (positionIntent === "left-rail") {
    return {leftPercent: 20, topPercent: 34, widthPercent: 28, heightPercent: 38, anchor: "left"};
  }
  if (positionIntent === "right-card") {
    return {leftPercent: 80, topPercent: 34, widthPercent: 28, heightPercent: 38, anchor: "right"};
  }
  if (positionIntent === "behind-subject") {
    return {leftPercent: 50, topPercent: 38, widthPercent: 62, heightPercent: 42, anchor: "center"};
  }

  return {leftPercent: 50, topPercent: 50, widthPercent: 54, heightPercent: 28, anchor: "center"};
};

const buildCreativeTrackLayer = (track: CreativeTrack): DisplayTimelineLayer => {
  const mediaKind = resolveTrackMediaKind(track);
  const src = typeof track.payload["src"] === "string"
    ? track.payload["src"]
    : typeof track.payload["assetSrc"] === "string"
      ? track.payload["assetSrc"]
      : null;

  return {
    id: `track:${track.id}`,
    kind: "creative-track",
    mediaKind,
    label: `${track.type}:${track.id}`,
    startMs: track.startMs,
    endMs: track.endMs,
    zIndex: track.zIndex,
    visual: track.type !== "sound",
    assetId: typeof track.payload["assetId"] === "string" ? track.payload["assetId"] : undefined,
    src,
    opacity: typeof track.payload["opacity"] === "number" ? track.payload["opacity"] : undefined,
    placement: resolveCreativeTrackPlacement(track),
    styleMetadata: {
      ...track.payload,
      trackType: track.type,
      text: typeof track.payload["text"] === "string" ? track.payload["text"] : undefined,
      title: typeof track.payload["title"] === "string" ? track.payload["title"] : undefined,
      subtitle: typeof track.payload["subtitle"] === "string" ? track.payload["subtitle"] : undefined,
      positionIntent: typeof track.payload["positionIntent"] === "string" ? track.payload["positionIntent"] : undefined,
      placementIntent: typeof track.payload["placementIntent"] === "string" ? track.payload["placementIntent"] : undefined,
      animationPreset: typeof track.payload["animation"] === "string" ? track.payload["animation"] : undefined,
      backgroundStyle: typeof track.payload["backgroundStyle"] === "string" ? track.payload["backgroundStyle"] : undefined
    },
    exportMetadata: {
      dependencies: track.dependencies ?? []
    },
    syncQuality: mediaKind === "iframe" ? "pending" : "not-applicable"
  };
};

const buildCaptionLayers = (chunks: CaptionChunk[]): DisplayTimelineLayer[] => {
  return chunks.map((chunk) => ({
    id: `caption:${chunk.id}`,
    kind: "caption",
    mediaKind: "none",
    label: chunk.text,
    startMs: chunk.startMs,
    endMs: chunk.endMs,
    zIndex: 12,
    visual: true,
    opacity: 1,
    styleMetadata: {
      styleKey: chunk.styleKey,
      motionKey: chunk.motionKey,
      layoutVariant: chunk.layoutVariant,
      emphasisWordIndices: chunk.emphasisWordIndices
    },
    exportMetadata: {
      profileId: chunk.profileId
    },
    syncQuality: "not-applicable"
  }));
};

const buildMotionDecisionAssetLayer = ({
  scene,
  decision,
  selectedAsset,
  fps
}: {
  scene: ResolvedMotionScene;
  decision: MotionGraphicsDecision;
  selectedAsset: MotionGraphicsDecisionAsset;
  fps: number;
}): DisplayTimelineLayer => {
  const asset = selectedAsset.asset;
  const mediaKind = asset && isIframeMotionGraphic(asset)
    ? "iframe"
    : asset && isVideoLikeMotionGraphic(asset.src)
      ? "video"
      : "image";
  const placement = resolveMotionDecisionAssetPlacement({
    selectedAsset,
    decision
  });
  const visibility = resolveMotionDecisionVisibility({
    selectedAsset,
    currentTimeMs: (selectedAsset.startFrame / fps) * 1000,
    fps
  });

  return {
    id: `motion-asset:${scene.id}:${selectedAsset.assetId}:${selectedAsset.role}`,
    kind: "motion-asset",
    mediaKind,
    label: asset?.canonicalLabel ?? selectedAsset.assetId,
    startMs: (selectedAsset.startFrame / fps) * 1000,
    endMs: (selectedAsset.endFrame / fps) * 1000,
    zIndex: resolveMotionDecisionZIndex(selectedAsset.role),
    visual: true,
    assetId: selectedAsset.assetId,
    sceneId: scene.id,
    src: asset?.src ?? null,
    opacity: selectedAsset.opacity ?? visibility.opacity,
    placement,
    transform: {
      translateX: visibility.translateX,
      translateY: visibility.translateY,
      scale: visibility.scale,
      rotateDeg: selectedAsset.rotation ?? 0
    },
    easing: {
      enter: selectedAsset.enterAnimation ?? "cubic-out",
      exit: selectedAsset.exitAnimation ?? "quadratic-in"
    },
    styleMetadata: {
      role: selectedAsset.role,
      anchor: selectedAsset.position.anchor,
      blendMode: selectedAsset.blendMode ?? asset?.blendMode ?? "normal",
      rationale: selectedAsset.rationale
    },
    exportMetadata: {
      startFrame: selectedAsset.startFrame,
      endFrame: selectedAsset.endFrame,
      retrievalScore: selectedAsset.retrievalScore,
      whyItMatched: selectedAsset.whyItMatched
    },
    syncQuality: mediaKind === "iframe" ? "pending" : "not-applicable"
  };
};

const buildLegacySceneAssetLayer = ({
  scene,
  asset
}: {
  scene: ResolvedMotionScene;
  asset: ResolvedMotionScene["assets"][number];
}): DisplayTimelineLayer => {
  const mediaKind = isIframeMotionGraphic(asset)
    ? "iframe"
    : isVideoLikeMotionGraphic(asset.src)
      ? "video"
      : "image";

  return {
    id: `scene-asset:${scene.id}:${asset.id}`,
    kind: "motion-asset",
    mediaKind,
    label: asset.canonicalLabel ?? asset.id,
    startMs: scene.startMs,
    endMs: scene.endMs,
    zIndex: asset.placementZone === "background-depth" ? 4 : asset.placementZone === "foreground-cross" ? 7 : 6,
    visual: true,
    assetId: asset.id,
    sceneId: scene.id,
    src: asset.src,
    opacity: asset.opacity,
    placement: resolveLegacyAssetPlacement(asset.placementZone),
    transform: {
      scale: 1,
      rotateDeg: 0
    },
    easing: {
      enter: scene.transitionInPreset.easing,
      exit: scene.transitionOutPreset.easing
    },
    styleMetadata: {
      blendMode: asset.blendMode,
      placementZone: asset.placementZone,
      safeArea: asset.safeArea
    },
    exportMetadata: {
      sceneKind: scene.sceneKind,
      sceneStartMs: scene.startMs,
      sceneEndMs: scene.endMs
    },
    syncQuality: mediaKind === "iframe" ? "pending" : "not-applicable"
  };
};

const buildSceneLayers = ({
  model,
  fps
}: {
  model: MotionCompositionModel;
  fps: number;
}): DisplayTimelineLayer[] => {
  return model.scenes.flatMap((scene) => {
    const decision = model.motionGraphicsPlan.sceneMap[scene.id] ?? null;
    const sceneLayer: DisplayTimelineLayer = {
      id: `scene:${scene.id}`,
      kind: "motion-scene",
      mediaKind: "none",
      label: scene.headlineText ?? scene.id,
      startMs: scene.startMs,
      endMs: scene.endMs,
      zIndex: 3,
      visual: false,
      sceneId: scene.id,
      placement: resolveScenePlacement(scene),
      styleMetadata: {
        sceneKind: scene.sceneKind,
        moodTags: scene.moodTags,
        captionMode: scene.captionMode
      },
      exportMetadata: {
        transitionIn: scene.transitionInPreset.id,
        transitionOut: scene.transitionOutPreset.id
      },
      syncQuality: "not-applicable"
    };

    const assetLayers = decision?.selectedAssets.length
      ? decision.selectedAssets.map((selectedAsset) =>
          buildMotionDecisionAssetLayer({
            scene,
            decision,
            selectedAsset,
            fps
          }))
      : scene.assets.map((asset) =>
          buildLegacySceneAssetLayer({
            scene,
            asset
          }));

    return [sceneLayer, ...assetLayers];
  });
};

const buildBackgroundOverlayLayers = (model: MotionCompositionModel): DisplayTimelineLayer[] => {
  return model.backgroundOverlayPlan.cues.map((cue) => ({
    id: `background:${cue.id}`,
    kind: "background-overlay",
    mediaKind: resolveMediaKindFromSrc(cue.asset.src),
    label: cue.asset.label,
    startMs: cue.startMs,
    endMs: cue.endMs,
    zIndex: 2,
    visual: true,
    assetId: cue.assetId,
    src: cue.asset.src,
    opacity: 1,
    placement: {
      leftPercent: 50,
      topPercent: 50,
      widthPercent: 100,
      heightPercent: 100,
      anchor: "center"
    },
    easing: {
      enter: "ease-out",
      exit: "ease-in-out"
    },
    styleMetadata: {
      sourceChunkId: cue.sourceChunkId,
      fitStrategy: cue.fitStrategy,
      reasoning: cue.reasoning
    },
    exportMetadata: {
      peakStartMs: cue.peakStartMs,
      peakEndMs: cue.peakEndMs
    },
    syncQuality: resolveMediaKindFromSrc(cue.asset.src) === "iframe" ? "pending" : "not-applicable"
  }));
};

const buildTransitionOverlayLayers = (model: MotionCompositionModel): DisplayTimelineLayer[] => {
  return model.transitionOverlayPlan.cues.map((cue) => ({
    id: `transition:${cue.id}`,
    kind: "transition-overlay",
    mediaKind: resolveMediaKindFromSrc(cue.asset.src),
    label: cue.asset.label,
    startMs: cue.startMs,
    endMs: cue.endMs,
    zIndex: 11,
    visual: true,
    assetId: cue.assetId,
    src: cue.asset.src,
    opacity: cue.blendMode === "screen" ? 0.96 : 1,
    placement: {
      leftPercent: 50,
      topPercent: 50,
      widthPercent: 100,
      heightPercent: 100,
      anchor: "center"
    },
    easing: {
      enter: cue.mode === "fast-intro" ? "snappy" : "ease-out",
      exit: cue.mode === "fast-intro" ? "snappy" : "ease-in-out"
    },
    styleMetadata: {
      blendMode: cue.blendMode,
      reasoning: cue.reasoning
    },
    exportMetadata: {
      peakStartMs: cue.peakStartMs,
      peakEndMs: cue.peakEndMs
    },
    syncQuality: resolveMediaKindFromSrc(cue.asset.src) === "iframe" ? "pending" : "not-applicable"
  }));
};

const resolveShowcasePlacement = (placement: string): DisplayTimelineLayerPlacement => {
  if (placement === "landscape-left") {
    return {leftPercent: 25, topPercent: 50, widthPercent: 34, heightPercent: 34, anchor: "left"};
  }
  if (placement === "landscape-right") {
    return {leftPercent: 75, topPercent: 50, widthPercent: 34, heightPercent: 34, anchor: "right"};
  }
  if (placement === "portrait-top-left") {
    return {leftPercent: 26, topPercent: 24, widthPercent: 30, heightPercent: 30, anchor: "top-left"};
  }
  if (placement === "portrait-top-right") {
    return {leftPercent: 74, topPercent: 24, widthPercent: 30, heightPercent: 30, anchor: "top-right"};
  }
  if (placement === "portrait-bottom-left") {
    return {leftPercent: 26, topPercent: 76, widthPercent: 30, heightPercent: 30, anchor: "bottom-left"};
  }
  if (placement === "portrait-bottom-right") {
    return {leftPercent: 74, topPercent: 76, widthPercent: 30, heightPercent: 30, anchor: "bottom-right"};
  }

  return {leftPercent: 50, topPercent: 50, widthPercent: 34, heightPercent: 34, anchor: "center"};
};

const buildShowcaseLayers = (model: MotionCompositionModel): DisplayTimelineLayer[] => {
  return model.showcasePlan.cues.map((cue) => ({
    id: `showcase:${cue.id}`,
    kind: "showcase-overlay",
    mediaKind: resolveMediaKindFromSrc(cue.asset.src),
    label: cue.canonicalLabel,
    startMs: cue.startMs,
    endMs: cue.endMs,
    zIndex: 9,
    visual: true,
    assetId: cue.assetId,
    src: cue.asset.src,
    opacity: 1,
    placement: resolveShowcasePlacement(cue.placement),
    easing: {
      enter: "ease-out",
      exit: "ease-in-out"
    },
    styleMetadata: {
      cueSource: cue.cueSource,
      matchedText: cue.matchedText,
      placement: cue.placement,
      showLabelPlate: cue.showLabelPlate
    },
    exportMetadata: {
      peakStartMs: cue.peakStartMs,
      peakEndMs: cue.peakEndMs
    },
    syncQuality: resolveMediaKindFromSrc(cue.asset.src) === "iframe" ? "pending" : "not-applicable"
  }));
};

const buildSoundCueLayers = (model: MotionCompositionModel): DisplayTimelineLayer[] => {
  const allCues = [...model.soundDesignPlan.musicCues, ...model.soundDesignPlan.cues];
  return allCues.map((cue) => ({
    id: `sound:${cue.id}`,
    kind: "sound-cue",
    mediaKind: "sound",
    label: cue.asset.label,
    startMs: cue.startMs,
    endMs: cue.endMs,
    zIndex: 1,
    visual: false,
    assetId: cue.assetId,
    src: cue.asset.src,
    opacity: cue.maxVolume,
    styleMetadata: {
      category: cue.category,
      trigger: cue.trigger,
      priority: cue.priority,
      reasoning: cue.reasoning
    },
    exportMetadata: {
      trimBeforeFrames: cue.trimBeforeFrames,
      trimAfterFrames: cue.trimAfterFrames,
      playFrames: cue.playFrames
    },
    syncQuality: "not-applicable"
  }));
};

export const buildDisplayTimelineFromPreviewSession = (input: {
  jobId: string;
  videoSrc: string;
  audioSrc?: string | null;
  session?: AudioCreativePreviewSession | null;
  fallbackMotionModel: MotionCompositionModel;
  fallbackVideoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  captionProfileId: CaptionStyleProfileId;
  sourceLabel?: string | null;
}): DisplayTimeline => {
  const session = input.session ?? null;
  const motionModel = session?.motionModel ?? input.fallbackMotionModel;
  const videoMetadata = session?.videoMetadata ?? input.fallbackVideoMetadata;
  const durationMs = session?.durationMs ?? Math.max(1000, Math.round(videoMetadata.durationSeconds * 1000));
  const creativeTimeline = session?.creativeTimeline ?? createEmptyCreativeTimeline({
    jobId: input.jobId,
    durationMs
  });
  const renderMode = session?.renderMode ?? "overlay-preview";
  const captions = session?.captionChunks ?? [];
  const layers = [
    ...creativeTimeline.tracks.map((track) => buildCreativeTrackLayer(track)),
    ...buildCaptionLayers(captions),
    ...buildSceneLayers({
      model: motionModel,
      fps: videoMetadata.fps
    }),
    ...buildBackgroundOverlayLayers(motionModel),
    ...buildTransitionOverlayLayers(motionModel),
    ...buildShowcaseLayers(motionModel),
    ...buildSoundCueLayers(motionModel)
  ].sort((left, right) => {
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }
    if (left.startMs !== right.startMs) {
      return left.startMs - right.startMs;
    }
    return left.id.localeCompare(right.id);
  });

  return {
    id: `${input.jobId}:display-god`,
    jobId: input.jobId,
    renderMode,
    durationMs,
    captionProfileId: input.captionProfileId,
    baseVideo: {
      src: input.videoSrc,
      width: videoMetadata.width,
      height: videoMetadata.height,
      fps: videoMetadata.fps,
      durationMs,
      sourceLabel: input.sourceLabel ?? null
    },
    audio: {
      src: input.audioSrc ?? null,
      source: input.audioSrc ? "separate-audio" : "video-element"
    },
    captions,
    layers,
    creativeTimeline,
    motionModel,
    exportMetadata: {
      creativeTimelineId: creativeTimeline.id,
      sourceJobId: creativeTimeline.sourceJobId,
      renderMode,
      trackCount: creativeTimeline.tracks.length,
      momentCount: creativeTimeline.moments.length,
      patternMemoryFingerprint: motionModel.patternMemory?.fingerprint
    }
  };
};

export const getActiveDisplayTimelineLayers = (
  timeline: DisplayTimeline,
  currentTimeMs: number
): DisplayTimelineLayer[] => {
  return timeline.layers.filter((layer) => currentTimeMs >= layer.startMs && currentTimeMs <= layer.endMs);
};

export const getIframeDisplayTimelineLayers = (timeline: DisplayTimeline): DisplayTimelineLayer[] => {
  return timeline.layers.filter((layer) => layer.mediaKind === "iframe");
};
