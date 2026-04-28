import unifiedAssetDocuments from "../../data/unified-asset-documents.generated.json" with {type: "json"};
import unifiedMotionAssets from "../../data/unified-motion-assets.generated.json" with {type: "json"};
import type {CreativeAsset} from "../../creative-orchestration/types";
import type {MotionAssetManifest} from "../types";

import type {NormalizedAssetDocument} from "./types";
import {toCreativeAsset} from "./runtime-catalog";

const documentCatalog = unifiedAssetDocuments as NormalizedAssetDocument[];
const motionCatalog = unifiedMotionAssets as MotionAssetManifest[];

let creativeCatalogCache: CreativeAsset[] | null = null;

export const getUnifiedAssetDocuments = (): NormalizedAssetDocument[] => documentCatalog;
export const getUnifiedMotionAssetCatalog = (): MotionAssetManifest[] => motionCatalog;

export const getUnifiedCreativeAssetCatalog = (): CreativeAsset[] => {
  if (!creativeCatalogCache) {
    creativeCatalogCache = documentCatalog.map(toCreativeAsset);
  }

  return creativeCatalogCache;
};
