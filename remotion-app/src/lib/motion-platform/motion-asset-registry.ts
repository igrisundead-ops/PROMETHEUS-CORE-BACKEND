import remoteMotionAssetCache from "../../data/motion-assets.remote.json" with {type: "json"};
import godMotionAssetCache from "../../data/god-assets.generated.json" with {type: "json"};
import type {MotionAssetManifest} from "../types";
import {motionAssetLibrary} from "./asset-manifests";
import {getShowcaseAssetCatalog} from "./showcase-asset-catalog";
import {enrichMotionAssetManifest, scoreMotionAssetProximity} from "./motion-asset-taxonomy";

export type MotionAssetRegistrySummary = {
  totalCount: number;
  localCount: number;
  showcaseCount: number;
  remoteCount: number;
  godCount: number;
  authoringCount: number;
};

export type MotionAssetMatch = {
  asset: MotionAssetManifest;
  score: number;
  reason: string;
};

const uniqueById = (records: MotionAssetManifest[]): MotionAssetManifest[] => {
  const seen = new Set<string>();
  const normalized: MotionAssetManifest[] = [];

  records.forEach((record) => {
    if (seen.has(record.id)) {
      return;
    }
    seen.add(record.id);
    normalized.push(enrichMotionAssetManifest(record));
  });

  return normalized;
};

const authoringAssetIds = new Set(
  getShowcaseAssetCatalog()
    .filter((asset) => asset.sourceKind === "authoring-batch")
    .map((asset) => asset.id)
);

const combinedCatalog = uniqueById([
  ...motionAssetLibrary,
  ...(godMotionAssetCache as MotionAssetManifest[]),
  ...(remoteMotionAssetCache as MotionAssetManifest[]),
  ...getShowcaseAssetCatalog()
]);

export const getUnifiedMotionAssetCatalog = (): MotionAssetManifest[] => {
  return [...combinedCatalog];
};

export const getUnifiedMotionAssetCatalogSummary = (): MotionAssetRegistrySummary => {
  return combinedCatalog.reduce<MotionAssetRegistrySummary>(
    (summary, asset) => ({
      totalCount: summary.totalCount + 1,
      localCount: summary.localCount + (asset.sourceKind === "local-public" ? 1 : 0),
      showcaseCount: summary.showcaseCount + (asset.assetRole === "showcase" ? 1 : 0),
      remoteCount: summary.remoteCount + (asset.sourceKind === "remote-cache" ? 1 : 0),
      godCount: summary.godCount + (asset.sourceKind === "god-generated" ? 1 : 0),
      authoringCount: summary.authoringCount + (asset.sourceKind === "authoring-batch" ? 1 : 0)
    }),
    {
      totalCount: 0,
      localCount: 0,
      showcaseCount: 0,
      remoteCount: 0,
      godCount: 0,
      authoringCount: 0
    }
  );
};

export const rankMotionAssetsForQuery = ({
  queryText,
  catalog = combinedCatalog
}: {
  queryText: string;
  catalog?: MotionAssetManifest[];
}): MotionAssetMatch[] => {
  const normalizedQuery = queryText.trim();
  if (!normalizedQuery) {
    return [];
  }

  return catalog
    .map((asset) => {
      const proximityScore = scoreMotionAssetProximity({
        queryText: normalizedQuery,
        asset
      });
      const preloadScore = asset.preloadPriority ?? 0;
      const familyScore = asset.assetRole === "showcase" ? 6 : 0;
      const totalScore = proximityScore + Math.round(preloadScore * 0.12) + familyScore;
      return {
        asset,
        score: totalScore,
        reason: `proximity=${proximityScore} preload=${asset.preloadPriority ?? 0} source=${asset.sourceKind ?? "local-public"}`
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      return right.score - left.score || (right.asset.preloadPriority ?? 0) - (left.asset.preloadPriority ?? 0) ||
        left.asset.id.localeCompare(right.asset.id);
    });
};

export const selectMotionAssetsForPreview = ({
  queryText,
  limit = 12,
  catalog = combinedCatalog
}: {
  queryText?: string;
  limit?: number;
  catalog?: MotionAssetManifest[];
}): MotionAssetManifest[] => {
  const ranked = queryText ? rankMotionAssetsForQuery({queryText, catalog}) : catalog
    .slice()
    .sort((left, right) => {
      return (right.preloadPriority ?? 0) - (left.preloadPriority ?? 0) || left.id.localeCompare(right.id);
    })
    .map((asset) => ({
      asset,
      score: asset.preloadPriority ?? 0,
      reason: `preload=${asset.preloadPriority ?? 0}`
    }));

  return ranked
    .slice(0, limit)
    .map((entry) => entry.asset);
};

export const getAuthoringAssetIds = (): string[] => {
  return [...authoringAssetIds];
};
