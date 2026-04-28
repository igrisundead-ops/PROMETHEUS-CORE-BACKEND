import matteManifestData from "../../data/video.matte.json" with {type: "json"};
import type {MatteManifest, MotionMatteMode, MotionTier} from "../types";

export const matteManifests: MatteManifest[] = [matteManifestData as MatteManifest];

export const resolveMatteManifest = (matteId?: string): MatteManifest | null => {
  if (!matteId) {
    return matteManifests[0] ?? null;
  }
  return matteManifests.find((manifest) => manifest.id === matteId) ?? null;
};

export const shouldUseMatte = ({
  mode,
  tier,
  manifest
}: {
  mode: MotionMatteMode;
  tier: MotionTier;
  manifest: MatteManifest | null;
}): boolean => {
  if (mode === "off" || !manifest) {
    return false;
  }
  if (manifest.status !== "ready" || !manifest.foregroundSrc) {
    return false;
  }
  if (mode === "prefer-matte") {
    return true;
  }
  return tier === "hero";
};
