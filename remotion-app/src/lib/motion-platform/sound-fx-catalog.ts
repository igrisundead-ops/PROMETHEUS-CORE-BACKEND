import soundFxCatalogJson from "../../data/sound-fx.local.json" with {type: "json"};
import type {
  MotionSoundAsset,
  MotionSoundIntensity,
  MotionSoundLibrarySection
} from "../types";

const soundFxCatalog = (soundFxCatalogJson as MotionSoundAsset[]).map((asset) => ({
  ...asset,
  librarySection: asset.librarySection as MotionSoundLibrarySection,
  intensity: asset.intensity as MotionSoundIntensity
}));

export const getMotionSoundFxCatalog = (): MotionSoundAsset[] => {
  return soundFxCatalog;
};

export const getMotionSoundFxBySection = (
  section: MotionSoundLibrarySection
): MotionSoundAsset[] => {
  return soundFxCatalog.filter((asset) => asset.librarySection === section);
};
