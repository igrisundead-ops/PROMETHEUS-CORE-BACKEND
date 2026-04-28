import matteManifestData from "../../data/video.matte.json";
export const matteManifests = [matteManifestData];
export const resolveMatteManifest = (matteId) => {
    if (!matteId) {
        return matteManifests[0] ?? null;
    }
    return matteManifests.find((manifest) => manifest.id === matteId) ?? null;
};
export const shouldUseMatte = ({ mode, tier, manifest }) => {
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
