import {getUnifiedMotionAssetCatalog} from "../assets/catalog";
import {searchUnifiedAssetSnapshot} from "../assets/retrieval";
import {buildSearchTerms, normalizeAssetText, uniqueStrings} from "../assets/text-utils";
import type {AssetSearchRequest, AssetSearchResult} from "../assets/types";
import {getMotionAssetCatalog} from "../motion-platform/asset-catalog";
import type {CaptionChunk, MotionAssetManifest, MotionSceneKind, MotionTier, VideoMetadata} from "../types";

import {buildMotionGraphicsAgentQuery} from "./query";
import type {
  MotionGraphicsAssetRole,
  MotionGraphicsDecision,
  MotionGraphicsDecisionAsset,
  MotionGraphicsPlan,
  MotionGraphicsSafeZone
} from "./types";

type MotionGraphicsSceneInput = {
  id: string;
  startMs: number;
  endMs: number;
  sourceChunkId?: string;
  sceneKind?: MotionSceneKind;
  headlineText?: string;
  subtextText?: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const FORBIDDEN_CENTER_ARTIFACT_PATTERN = /\b(beam|pillar|column|slab|strip|center beam|glass pillar|blur column|light leak)\b/i;

const fallbackAssetIdsByRole: Record<MotionGraphicsAssetRole, string[]> = {
  "background-companion": ["editorial-side-panels", "editorial-grid-cut", "minimal-frame-lines"],
  "typography-support": ["minimal-frame-lines", "editorial-side-panels", "minimal-light-sweep"],
  accent: ["minimal-light-sweep", "editorial-side-panels", "hero-foreground-arc"],
  transition: ["minimal-light-sweep", "hero-foreground-arc", "editorial-side-panels"],
  foreground: ["hero-foreground-arc", "editorial-side-panels", "minimal-frame-lines"]
};

const resolveSceneChunk = (scene: MotionGraphicsSceneInput, chunks: CaptionChunk[]): CaptionChunk => {
  const fromSourceId = scene.sourceChunkId
    ? chunks.find((chunk) => chunk.id === scene.sourceChunkId)
    : null;

  return fromSourceId ?? chunks.find((chunk) => chunk.startMs === scene.startMs && chunk.endMs === scene.endMs) ?? chunks[0];
};

const buildSceneSafeZones = ({
  aspectRatio,
  scene
}: {
  aspectRatio: number;
  scene: MotionGraphicsSceneInput;
}): MotionGraphicsSafeZone[] => {
  const landscape = aspectRatio >= 1.2;
  const headlinePresent = Boolean(scene.headlineText || scene.subtextText);

  return [
    {
      id: `${scene.id}-title-safe`,
      kind: "title-safe",
      label: "Title Safe",
      leftPercent: landscape ? 14 : 10,
      topPercent: landscape ? 18 : 16,
      widthPercent: landscape ? 72 : 80,
      heightPercent: landscape ? 50 : 54
    },
    {
      id: `${scene.id}-text-safe`,
      kind: "text",
      label: "Headline Safe",
      leftPercent: landscape ? 22 : 12,
      topPercent: landscape ? 30 : 24,
      widthPercent: landscape ? 56 : 76,
      heightPercent: headlinePresent ? (landscape ? 22 : 28) : 18
    },
    {
      id: `${scene.id}-face-safe`,
      kind: "face",
      label: "Subject Safe",
      leftPercent: landscape ? 32 : 28,
      topPercent: landscape ? 12 : 12,
      widthPercent: landscape ? 36 : 44,
      heightPercent: landscape ? 44 : 40
    }
  ];
};

const buildRoleRequest = ({
  role,
  broadRequest,
  visibleText,
  transcriptText,
  sceneKind,
  tier
}: {
  role: MotionGraphicsAssetRole;
  broadRequest: AssetSearchRequest;
  visibleText: string;
  transcriptText: string;
  sceneKind?: MotionSceneKind;
  tier: MotionTier;
}): AssetSearchRequest => {
  if (role === "background-companion") {
    return {
      ...broadRequest,
      queryText: `${visibleText} ${transcriptText} subtle cinematic background companion behind centered headline`,
      desiredAssetTypes: ["background", "static_image", "motion_graphic", "animated_overlay", "accent"],
      positionRole: role,
      requireAnimated: false,
      compositionHints: uniqueStrings([
        ...(broadRequest.compositionHints ?? []),
        "soft support behind the headline",
        "no center obstruction"
      ])
    };
  }
  if (role === "typography-support") {
    return {
      ...broadRequest,
      queryText: `${visibleText} premium typography companion for centered headline`,
      desiredAssetTypes: ["typography_effect", "ui_card", "accent", "motion_graphic"],
      positionRole: role,
      compositionHints: uniqueStrings([
        ...(broadRequest.compositionHints ?? []),
        "support typography without overpowering it",
        "clean frame or card support"
      ])
    };
  }
  if (role === "transition") {
    return {
      ...broadRequest,
      queryText: `${transcriptText} cinematic transition accent sweep`,
      desiredAssetTypes: ["animated_overlay", "motion_graphic", "accent"],
      positionRole: role,
      requireAnimated: true,
      compositionHints: uniqueStrings([
        ...(broadRequest.compositionHints ?? []),
        "edge-based transition",
        "do not cut through the headline"
      ])
    };
  }

  return {
    ...broadRequest,
    queryText: `${transcriptText} ${sceneKind ?? "statement"} premium accent motion support`,
    desiredAssetTypes: ["motion_graphic", "animated_overlay", "accent", "typography_effect"],
    positionRole: role,
    requireAnimated: role === "foreground",
    compositionHints: uniqueStrings([
      ...(broadRequest.compositionHints ?? []),
      "side accent support",
      tier === "hero" ? "strong but controlled motion" : "restrained motion emphasis"
    ])
  };
};

const candidateHasCenterArtifactRisk = (candidate: AssetSearchResult): boolean => {
  const pool = [
    candidate.asset_id,
    candidate.retrieval_caption,
    candidate.semantic_description,
    ...candidate.tags,
    ...candidate.labels
  ].join(" ");

  return FORBIDDEN_CENTER_ARTIFACT_PATTERN.test(pool);
};

const assetWouldSabotageText = ({
  candidate,
  role,
  centerReserved
}: {
  candidate: AssetSearchResult;
  role: MotionGraphicsAssetRole;
  centerReserved: boolean;
}): boolean => {
  if (candidateHasCenterArtifactRisk(candidate)) {
    return true;
  }

  const pool = normalizeAssetText([
    candidate.retrieval_caption,
    candidate.semantic_description,
    ...candidate.tags,
    ...candidate.labels
  ].join(" "));

  if (centerReserved && role !== "background-companion" && /\b(full frame|full-frame|wallpaper|slab|full screen)\b/.test(pool)) {
    return true;
  }
  if (role === "background-companion" && /\b(explosion|burst|impact|aggressive)\b/.test(pool)) {
    return true;
  }
  if (role === "typography-support" && /\b(explosion|wipe|burst)\b/.test(pool)) {
    return true;
  }
  return false;
};

const resolveFallbackAsset = ({
  role,
  tier,
  usedAssetIds
}: {
  role: MotionGraphicsAssetRole;
  tier: MotionTier;
  usedAssetIds: Set<string>;
}): MotionAssetManifest | null => {
  const unifiedCatalog = getUnifiedMotionAssetCatalog();
  const baseCatalog = [...getMotionAssetCatalog(), ...unifiedCatalog];

  for (const assetId of fallbackAssetIdsByRole[role]) {
    const asset = baseCatalog.find((entry) => entry.id === assetId && !usedAssetIds.has(entry.id));
    if (asset) {
      return asset;
    }
  }

  return baseCatalog.find((asset) => asset.tier === tier && !usedAssetIds.has(asset.id)) ?? null;
};

const resolveRoleAnchor = ({
  role,
  result,
  centerReserved
}: {
  role: MotionGraphicsAssetRole;
  result?: AssetSearchResult;
  centerReserved: boolean;
}): MotionGraphicsDecisionAsset["position"]["anchor"] => {
  const pool = normalizeAssetText([
    result?.retrieval_caption,
    result?.semantic_description,
    ...(result?.tags ?? []),
    ...(result?.labels ?? [])
  ].join(" "));

  if (role === "background-companion" && /\b(ring|halo|circle|focus)\b/.test(pool)) {
    return "center";
  }
  if (role === "background-companion") {
    return "center";
  }
  if (role === "typography-support") {
    return "center";
  }
  if (role === "transition") {
    return centerReserved ? "right" : "left";
  }
  if (/\b(left|panel|card|quote box)\b/.test(pool)) {
    return "left";
  }
  if (/\b(right|sidebar|callout)\b/.test(pool)) {
    return "right";
  }
  return centerReserved ? "right" : "center";
};

const resolveRoleOpacity = (role: MotionGraphicsAssetRole, result?: AssetSearchResult): number => {
  const base = result?.motion_asset?.opacity ?? 0.5;
  if (role === "background-companion") {
    return clamp01(Math.min(0.28, 0.16 + base * 0.24));
  }
  if (role === "typography-support") {
    return clamp01(Math.min(0.4, 0.18 + base * 0.28));
  }
  if (role === "transition") {
    return clamp01(Math.min(0.78, 0.32 + base * 0.36));
  }
  return clamp01(Math.min(0.72, 0.28 + base * 0.34));
};

const resolveRoleBlendMode = (role: MotionGraphicsAssetRole, result?: AssetSearchResult): string => {
  if (role === "background-companion") {
    return result?.motion_asset?.blendMode ?? "soft-light";
  }
  if (role === "typography-support") {
    return result?.motion_asset?.blendMode ?? "screen";
  }
  return result?.motion_asset?.blendMode ?? "screen";
};

const resolveRoleAnimations = (role: MotionGraphicsAssetRole): {enter: string; exit: string} => {
  if (role === "background-companion") {
    return {enter: "fade-soft", exit: "fade-soft"};
  }
  if (role === "typography-support") {
    return {enter: "blur-rise", exit: "fade-soft"};
  }
  if (role === "transition") {
    return {enter: "side-sweep", exit: "fade-soft"};
  }
  return {enter: "rise-reveal", exit: "fade-soft"};
};

const maybeSelectRole = ({
  role,
  scene,
  broadRequest,
  queryVisibleText,
  transcriptText,
  tier,
  centerReserved,
  fps,
  usedAssetIds,
  rejectedCandidates,
  broadResults
}: {
  role: MotionGraphicsAssetRole;
  scene: MotionGraphicsSceneInput;
  broadRequest: AssetSearchRequest;
  queryVisibleText: string;
  transcriptText: string;
  tier: MotionTier;
  centerReserved: boolean;
  fps: number;
  usedAssetIds: Set<string>;
  rejectedCandidates: Array<{assetId: string; reason: string}>;
  broadResults: AssetSearchResult[];
}): MotionGraphicsDecisionAsset | null => {
  const request = buildRoleRequest({
    role,
    broadRequest,
    visibleText: queryVisibleText,
    transcriptText,
    sceneKind: scene.sceneKind,
    tier
  });
  const roleResults = searchUnifiedAssetSnapshot(request).results;
  const mergedResults = uniqueStrings([
    ...roleResults.map((result) => result.asset_id),
    ...broadResults.map((result) => result.asset_id)
  ]).map((assetId) => roleResults.find((result) => result.asset_id === assetId) ?? broadResults.find((result) => result.asset_id === assetId)).filter((result): result is AssetSearchResult => Boolean(result));

  const selectedResult = mergedResults.find((result) => {
    if (usedAssetIds.has(result.asset_id)) {
      rejectedCandidates.push({assetId: result.asset_id, reason: "duplicate asset rejected"});
      return false;
    }
    if (assetWouldSabotageText({
      candidate: result,
      role,
      centerReserved
    })) {
      rejectedCandidates.push({assetId: result.asset_id, reason: "candidate conflicts with safe layout or artifact guard"});
      return false;
    }
    return Boolean(result.motion_asset);
  }) ?? null;

  const selectedAsset = selectedResult?.motion_asset ?? resolveFallbackAsset({
    role,
    tier,
    usedAssetIds
  });

  if (!selectedAsset) {
    return null;
  }

  usedAssetIds.add(selectedAsset.id);
  const startFrame = Math.max(0, Math.floor((scene.startMs / 1000) * fps));
  const endFrame = Math.max(startFrame + 1, Math.ceil((scene.endMs / 1000) * fps));
  const animations = resolveRoleAnimations(role);

  return {
    assetId: selectedAsset.id,
    asset: selectedAsset,
    role,
    startFrame: role === "transition" ? Math.max(0, startFrame - Math.round(fps * 0.12)) : startFrame,
    endFrame,
    position: {
      anchor: resolveRoleAnchor({
        role,
        result: selectedResult ?? undefined,
        centerReserved
      })
    },
    scale: role === "background-companion" ? 1 : role === "typography-support" ? 1.02 : 1,
    opacity: resolveRoleOpacity(role, selectedResult ?? undefined),
    rotation: 0,
    blendMode: resolveRoleBlendMode(role, selectedResult ?? undefined),
    enterAnimation: animations.enter,
    exitAnimation: animations.exit,
    rationale: selectedResult
      ? `${role} selected from semantic retrieval because ${selectedResult.why_it_matched}.`
      : `${role} fell back to safe catalog asset ${selectedAsset.id} after retrieval rejected conflicting options.`,
    retrievalScore: selectedResult?.score,
    whyItMatched: selectedResult?.why_it_matched,
    recommendedUsage: selectedResult?.recommended_usage
  };
};

export const buildMotionGraphicsPlan = ({
  chunks,
  scenes,
  tier,
  fps,
  videoMetadata
}: {
  chunks: CaptionChunk[];
  scenes: MotionGraphicsSceneInput[];
  tier: MotionTier;
  fps: number;
  videoMetadata?: Pick<VideoMetadata, "width" | "height">;
}): MotionGraphicsPlan => {
  if (chunks.length === 0 || scenes.length === 0) {
    return {
      enabled: false,
      sceneDecisions: [],
      sceneMap: {},
      reasons: ["No scenes available for motion-graphics planning."],
      disableLegacyBackgroundOverlay: false,
      debug: {
        agentInvoked: false,
        artifactSource: "No active scenes.",
        mitigationSummary: []
      }
    };
  }

  const aspectRatio = videoMetadata && videoMetadata.width > 0 && videoMetadata.height > 0
    ? videoMetadata.width / videoMetadata.height
    : 9 / 16;
  const disableLegacyBackgroundOverlay = aspectRatio >= 1.2;
  const reasons = [
    "Motion graphics planner invoked for scene-level asset decisions.",
    disableLegacyBackgroundOverlay
      ? "Legacy background overlay planner disabled for landscape headline scenes to avoid center-beam artifacts."
      : "Legacy background overlay planner left enabled."
  ];
  const sceneDecisions = scenes.map((scene) => {
    const chunk = resolveSceneChunk(scene, chunks);
    const safeZones = buildSceneSafeZones({
      aspectRatio,
      scene
    });
    const query = buildMotionGraphicsAgentQuery({
      sceneId: scene.id,
      chunk,
      headlineText: scene.headlineText,
      subtextText: scene.subtextText,
      tier,
      sceneKind: scene.sceneKind,
      aspectRatio,
      safeZones
    });
    const usedAssetIds = new Set<string>();
    const rejectedCandidates: Array<{assetId: string; reason: string}> = [];
    const selectedAssets: MotionGraphicsDecisionAsset[] = [];
    const broadResults = searchUnifiedAssetSnapshot(query.request).results;
    const roles: MotionGraphicsAssetRole[] = query.motionIntensity === "high"
      ? ["background-companion", "typography-support", "accent", "transition"]
      : ["background-companion", "typography-support", "accent"];

    roles.forEach((role) => {
      const selected = maybeSelectRole({
        role,
        scene,
        broadRequest: query.request,
        queryVisibleText: query.visibleText,
        transcriptText: chunk.text,
        tier,
        centerReserved: query.placementConstraints.centerReserved,
        fps,
        usedAssetIds,
        rejectedCandidates,
        broadResults
      });
      if (selected) {
        selectedAssets.push(selected);
      }
    });

    if (selectedAssets.length === 0) {
      const fallback = resolveFallbackAsset({
        role: "background-companion",
        tier,
        usedAssetIds
      });
      if (fallback) {
        selectedAssets.push({
          assetId: fallback.id,
          asset: fallback,
          role: "background-companion",
          startFrame: Math.max(0, Math.floor((scene.startMs / 1000) * fps)),
          endFrame: Math.max(1, Math.ceil((scene.endMs / 1000) * fps)),
          position: {anchor: "center"},
          opacity: 0.18,
          blendMode: "soft-light",
          enterAnimation: "fade-soft",
          exitAnimation: "fade-soft",
          rationale: "Fallback background companion selected to avoid an empty motion layer."
        });
      }
    }

    const finalLayerStack = selectedAssets.map((selectedAsset) => `${selectedAsset.role}:${selectedAsset.assetId}`);

    return {
      sceneId: scene.id,
      enabled: selectedAssets.length > 0,
      rationale: selectedAssets.length > 0
        ? `Planner selected ${selectedAssets.length} motion layers for ${chunk.text}.`
        : "Planner could not find a safe motion layer.",
      sceneIntent: query.sceneIntent,
      energyLevel: query.motionIntensity,
      visualMode: query.visualMode,
      query,
      safeZones,
      selectedAssets,
      debug: {
        candidateResults: broadResults,
        rejectedCandidates,
        selectedAssetIds: selectedAssets.map((asset) => asset.assetId),
        finalLayerStack,
        artifactMitigation: [
          "center vertical beam assets rejected",
          "legacy landscape background overlay path disabled",
          "non-background decorative assets kept away from the centered headline"
        ],
        legacyBackgroundOverlayDisabled: disableLegacyBackgroundOverlay
      }
    } satisfies MotionGraphicsDecision;
  });

  return {
    enabled: sceneDecisions.some((decision) => decision.enabled),
    sceneDecisions,
    sceneMap: Object.fromEntries(sceneDecisions.map((decision) => [decision.sceneId, decision])),
    reasons,
    disableLegacyBackgroundOverlay,
    debug: {
      agentInvoked: true,
      artifactSource: "Legacy background overlay halos plus centered grade glows created the false pillar.",
      mitigationSummary: [
        "disabled legacy landscape background overlays",
        "rejected beam-like assets during retrieval selection",
        "moved decorative assets away from the headline safe zone"
      ]
    }
  };
};
