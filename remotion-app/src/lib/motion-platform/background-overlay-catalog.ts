import backgroundOverlayCatalogJson from "../../data/background-overlays.local.json" with {type: "json"};
import type {MotionBackgroundOverlayAsset} from "../types";

const overlayAsset = (asset: MotionBackgroundOverlayAsset): MotionBackgroundOverlayAsset => asset;

const backgroundOverlayCatalog: MotionBackgroundOverlayAsset[] = (backgroundOverlayCatalogJson as MotionBackgroundOverlayAsset[])
  .map((asset) => overlayAsset(asset));

export const getBackgroundOverlayCatalog = (): MotionBackgroundOverlayAsset[] => backgroundOverlayCatalog;

export const getBackgroundOverlayAsset = (assetId: string): MotionBackgroundOverlayAsset | null => {
  return backgroundOverlayCatalog.find((asset) => asset.id === assetId) ?? null;
};

export const getBackgroundOverlayCatalogSummary = () => {
  return {
    totalCount: backgroundOverlayCatalog.length,
    portraitCount: backgroundOverlayCatalog.filter((asset) => asset.height > asset.width).length,
    landscapeCount: backgroundOverlayCatalog.filter((asset) => asset.width >= asset.height).length
  };
};
