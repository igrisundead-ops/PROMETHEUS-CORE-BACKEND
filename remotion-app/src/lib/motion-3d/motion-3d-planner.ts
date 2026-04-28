import type {
  CaptionChunk,
  MotionChoreographyPlan,
  Motion3DLayerKind,
  Motion3DLayerSpec,
  Motion3DMode,
  Motion3DPlan,
  Motion3DSceneSpec,
  VideoMetadata
} from "../types";
import {resolveMotion3DConfig, type Motion3DConfig} from "./motion-3d-config";
import type {ResolvedMotionScene} from "../motion-platform/scene-engine";

const pickSceneText = (chunk?: CaptionChunk | null): string | null => {
  if (!chunk) {
    return null;
  }
  const trimmed = chunk.text.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= 36) {
    return trimmed;
  }
  const words = trimmed.split(/\s+/).slice(0, 6);
  return `${words.join(" ")}…`;
};

const getDepthForPlacement = (placement?: string, config?: Motion3DConfig): {z: number; kind: Motion3DLayerKind} => {
  const depth = config ?? resolveMotion3DConfig();
  if (placement === "background-depth") {
    return {z: depth.depth.backgroundZ, kind: "background"};
  }
  if (placement === "foreground-cross" || placement === "edge-frame") {
    return {z: depth.depth.foregroundZ, kind: "accent"};
  }
  return {z: depth.depth.midZ, kind: "card"};
};

const getPlacementPosition = ({
  placement,
  width,
  height
}: {
  placement?: string;
  width: number;
  height: number;
}): {x: number; y: number} => {
  if (placement === "lower-third") {
    return {x: 0, y: height * 0.22};
  }
  if (placement === "side-panels") {
    return {x: width * 0.22, y: 0};
  }
  if (placement === "background-depth") {
    return {x: 0, y: 0};
  }
  return {x: 0, y: 0};
};

const buildLayerFromAsset = ({
  asset,
  targetId,
  width,
  height,
  config
}: {
  asset: ResolvedMotionScene["assets"][number];
  targetId?: string;
  width: number;
  height: number;
  config: Motion3DConfig;
}): Motion3DLayerSpec => {
  const {z, kind} = getDepthForPlacement(asset.placementZone, config);
  const position = getPlacementPosition({
    placement: asset.placementZone,
    width,
    height
  });
  const parallax = kind === "background"
    ? config.parallax.background
    : kind === "accent"
      ? config.parallax.foreground
      : config.parallax.mid;
  const opacity = kind === "background"
    ? config.opacity.background
    : kind === "accent"
      ? config.opacity.foreground
      : config.opacity.mid;

  return {
    id: targetId ?? asset.id,
    kind,
    src: asset.src,
    width,
    height,
    x: position.x,
    y: position.y,
    z,
    scale: asset.placementZone === "background-depth" ? 1.08 : 1,
    rotateZ: 0,
    opacity: asset.opacity * opacity,
    parallax
  };
};

const buildTextLayer = ({
  id,
  text,
  width,
  height,
  config
}: {
  id: string;
  text: string;
  width: number;
  height: number;
  config: Motion3DConfig;
}): Motion3DLayerSpec => {
  return {
    id,
    kind: "text",
    text,
    width: Math.min(width * 0.72, 840),
    height: Math.min(height * 0.28, 320),
    x: 0,
    y: -height * 0.06,
    z: config.depth.foregroundZ + 80,
    scale: 1,
    rotateZ: 0,
    opacity: 1,
    parallax: config.parallax.foreground
  };
};

const pickCameraPreset = ({
  mode,
  scene
}: {
  mode: Motion3DMode;
  scene: ResolvedMotionScene;
}): Motion3DSceneSpec["cameraPreset"] => {
  if (scene.sceneKind === "comparison") {
    return "comparisonPan";
  }
  if (scene.sceneKind === "quote") {
    return "quoteRevealCameraEase";
  }
  if (scene.sceneKind === "stat") {
    return "heroLayerPush";
  }
  if (scene.sceneKind === "cta") {
    return "subtlePullBack";
  }
  if (scene.cameraCue?.mode === "punch-in-out") {
    return "heroLayerPush";
  }
  if (mode === "showcase") {
    return "gentleOrbit";
  }
  if ((scene.transitionInPreset.family === "panel" || scene.transitionOutPreset.family === "panel")) {
    return "comparisonPan";
  }
  return "subtlePushIn";
};

export const buildMotion3DPlan = ({
  chunks,
  scenes,
  videoMetadata,
  mode = "off",
  configOverrides,
  resolvedConfig,
  choreographyPlan
}: {
  chunks: CaptionChunk[];
  scenes: ResolvedMotionScene[];
  videoMetadata: Pick<VideoMetadata, "width" | "height">;
  mode?: Motion3DMode;
  configOverrides?: Partial<Motion3DConfig>;
  resolvedConfig?: Motion3DConfig;
  choreographyPlan?: MotionChoreographyPlan;
}): Motion3DPlan => {
  const config = resolvedConfig ?? resolveMotion3DConfig({
    mode,
    enabled: mode !== "off",
    ...configOverrides
  });

  if (!config.enabled) {
    return {
      enabled: false,
      mode,
      scenes: [],
      sceneMap: {},
      reasons: ["3d motion disabled"]
    };
  }

  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const reasons: string[] = [];
  const sceneSpecs: Motion3DSceneSpec[] = scenes.map((scene) => {
    const chunk = scene.sourceChunkId ? chunkById.get(scene.sourceChunkId) : null;
    const sceneText = pickSceneText(chunk);
    const layers: Motion3DLayerSpec[] = [];
    const maxLayers = config.depth.maxLayerCount;
    const choreographyScene = choreographyPlan?.sceneMap[scene.id];
    const depthWorthyAssetIds = new Set(
      choreographyScene?.layerBindings
        .filter((binding) => binding.targetType === "asset" && binding.depthTreatment === "depth-worthy")
        .map((binding) => binding.sourceAssetId ?? binding.targetId) ?? []
    );
    const assetLayers = scene.assets
      .filter((asset) => depthWorthyAssetIds.size === 0 || depthWorthyAssetIds.has(asset.id))
      .slice(0, Math.max(1, maxLayers - (sceneText ? 1 : 0)))
      .map((asset) => buildLayerFromAsset({
        asset,
        targetId: asset.id,
        width: videoMetadata.width,
        height: videoMetadata.height,
        config
      }));
    layers.push(...assetLayers);
    const allowTextDepth = choreographyScene?.layerBindings.some((binding) => {
      return binding.targetType === "headline" && binding.depthTreatment === "depth-worthy";
    });
    if (sceneText && allowTextDepth) {
      layers.push(buildTextLayer({
        id: `${scene.id}-headline`,
        text: sceneText,
        width: videoMetadata.width,
        height: videoMetadata.height,
        config
      }));
    }
    if (layers.length === 0) {
      layers.push({
        id: `fallback-${scene.id}`,
        kind: "background",
        width: videoMetadata.width,
        height: videoMetadata.height,
        x: 0,
        y: 0,
        z: config.depth.backgroundZ,
        scale: 1.05,
        rotateZ: 0,
        opacity: 0.5,
        parallax: config.parallax.background
      });
    }
    const focusLayer = layers.find((layer) => layer.kind === "text") ?? layers.at(-1);

    return {
      id: scene.id,
      startMs: scene.startMs,
      endMs: scene.endMs,
      cameraPreset: pickCameraPreset({mode, scene}),
      focusLayerId: focusLayer?.id,
      layers,
      reasons: [
        "cinematic depth staging",
        sceneText ? "text focus layer" : "asset focus layer"
      ]
    };
  });

  reasons.push(`3d scenes planned: ${sceneSpecs.length}`);

  return {
    enabled: true,
    mode,
    scenes: sceneSpecs,
    sceneMap: Object.fromEntries(sceneSpecs.map((scene) => [scene.id, scene])),
    reasons
  };
};
