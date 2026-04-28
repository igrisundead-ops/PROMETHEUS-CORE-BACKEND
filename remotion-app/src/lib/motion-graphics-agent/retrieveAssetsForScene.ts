import type {CreativeMoment} from "../../creative-orchestration/types";
import type {MotionAssetManifest} from "../types";
import {queryUnifiedAssetRetriever} from "../assets/retrieval";
import type {
  AssetSearchRequest,
  AssetSearchResponse,
  UnifiedAssetSourceLibrary,
  UnifiedAssetType
} from "../assets/types";

type SceneAssetRole =
  | "headline-support"
  | "underlay"
  | "background-support"
  | "transition-accent"
  | "motion-emphasis";

export type SceneAssetRetrieval = {
  request: AssetSearchRequest;
  response: AssetSearchResponse;
  primaryAsset: AssetSearchResponse["results"][number] | null;
  supportingAssets: AssetSearchResponse["results"];
  motionCatalogAssets: MotionAssetManifest[];
};

const resolveDesiredTypes = (role: SceneAssetRole): UnifiedAssetType[] => {
  if (role === "headline-support") {
    return ["typography_effect", "accent", "ui_card", "static_image"];
  }
  if (role === "underlay") {
    return ["accent", "animated_overlay", "motion_graphic", "background"];
  }
  if (role === "background-support") {
    return ["static_image", "background", "ui_card"];
  }
  if (role === "transition-accent") {
    return ["animated_overlay", "motion_graphic", "accent"];
  }
  return ["motion_graphic", "animated_overlay", "accent", "typography_effect"];
};

const buildRoleHints = (role: SceneAssetRole, moment: CreativeMoment): string[] => {
  const hints: string[] = [moment.momentType, moment.suggestedIntensity];

  if (role === "headline-support") {
    hints.push("centered headline support", "title-safe composition", "premium text reinforcement");
  }
  if (role === "underlay") {
    hints.push("underlay behind centered headline", "soft radial glow", "circular support accent");
  }
  if (role === "background-support") {
    hints.push("clean stage background", "landscape safe frame", "subtle support image");
  }
  if (role === "transition-accent") {
    hints.push("transition accent", "kinetic punctuation", "scene bridge");
  }
  if (role === "motion-emphasis") {
    hints.push("emphasis spike", "premium animated accent", "dynamic punch");
  }

  return hints;
};

const buildRoleAntiContexts = (role: SceneAssetRole): string[] => {
  if (role === "headline-support") {
    return ["explosion", "fast burst"];
  }
  if (role === "underlay") {
    return ["typing cursor", "selection animation", "step by step guide", "icon only"];
  }
  if (role === "background-support") {
    return ["headline text", "typing cursor", "aggressive burst"];
  }
  if (role === "transition-accent") {
    return ["still photo", "static wallpaper"];
  }
  return ["still photo"];
};

const buildRoleQueryText = (role: SceneAssetRole, moment: CreativeMoment): string => {
  if (role === "underlay") {
    return `${moment.transcriptText} premium circular underlay behind centered headline`;
  }
  if (role === "background-support") {
    return `${moment.transcriptText} clean static background support image`;
  }
  if (role === "transition-accent") {
    return `${moment.transcriptText} kinetic transition accent`;
  }
  if (role === "motion-emphasis") {
    return `${moment.transcriptText} premium animated emphasis accent`;
  }
  return `${moment.transcriptText} centered headline support`;
};

export const buildSceneAssetSearchRequest = ({
  moment,
  role,
  sourceLibraries,
  limit
}: {
  moment: CreativeMoment;
  role: SceneAssetRole;
  sourceLibraries?: UnifiedAssetSourceLibrary[];
  limit?: number;
}): AssetSearchRequest => {
  const wantsAnimated = role === "underlay" || role === "transition-accent" || role === "motion-emphasis";
  const wantsStatic = role === "background-support";

  return {
    queryText: buildRoleQueryText(role, moment),
    sceneIntent: `${moment.momentType} ${role}`,
    desiredAssetTypes: resolveDesiredTypes(role),
    sourceLibraries,
    mood: moment.suggestedIntensity === "hero"
      ? ["heroic", "authority", "premium"]
      : moment.suggestedIntensity === "minimal"
        ? ["calm", "subtle", "cool"]
        : ["cool", "premium"],
    contexts: [moment.momentType, moment.suggestedIntensity, role],
    antiContexts: buildRoleAntiContexts(role),
    motionLevel: moment.suggestedIntensity === "high" ? "premium" : moment.suggestedIntensity,
    positionRole: role,
    compositionHints: buildRoleHints(role, moment),
    timeWindowStartMs: moment.startMs,
    timeWindowEndMs: moment.endMs,
    requireAnimated: wantsAnimated,
    requireStatic: wantsStatic,
    limit: limit ?? 6
  };
};

export const retrieveAssetsForScene = async ({
  moment,
  role,
  policy
}: {
  moment: CreativeMoment;
  role: SceneAssetRole;
  policy?: {
    sourceLibraries?: UnifiedAssetSourceLibrary[];
    limit?: number;
  };
}): Promise<SceneAssetRetrieval> => {
  const request = buildSceneAssetSearchRequest({
    moment,
    role,
    sourceLibraries: policy?.sourceLibraries,
    limit: policy?.limit
  });
  const response = await queryUnifiedAssetRetriever(request);

  return {
    request,
    response,
    primaryAsset: response.results[0] ?? null,
    supportingAssets: response.results.slice(1, 4),
    motionCatalogAssets: response.results
      .map((result) => result.motion_asset)
      .filter((asset): asset is MotionAssetManifest => Boolean(asset))
  };
};
