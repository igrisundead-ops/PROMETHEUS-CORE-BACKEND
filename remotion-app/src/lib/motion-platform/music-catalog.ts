import musicCatalogJson from "../../data/music.local.json" with {type: "json"};
import type {
  MotionSoundAsset,
  MotionSoundIntensity,
  MotionSoundLibrarySection
} from "../types";

const musicCatalog = (musicCatalogJson as MotionSoundAsset[]).map((asset) => ({
  ...asset,
  librarySection: asset.librarySection as MotionSoundLibrarySection,
  intensity: asset.intensity as MotionSoundIntensity
}));

export const getMotionMusicCatalog = (): MotionSoundAsset[] => {
  return musicCatalog;
};
