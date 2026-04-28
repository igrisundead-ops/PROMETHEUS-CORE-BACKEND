export const gradeProfiles = {
    neutral: {
        id: "neutral",
        label: "Neutral Clean",
        contrast: 1.03,
        saturation: 1.02,
        brightness: 1,
        temperature: 0,
        lift: 0.01,
        gamma: 1,
        gain: 1.02,
        vignette: 0.18,
        bloom: 0.08,
        grain: 0.08,
        shadowTint: "rgba(10, 18, 32, 0.14)",
        highlightTint: "rgba(255, 245, 226, 0.06)"
    },
    "warm-cinematic": {
        id: "warm-cinematic",
        label: "Warm Cinematic",
        contrast: 1.1,
        saturation: 1.08,
        brightness: 0.98,
        temperature: 14,
        lift: 0.015,
        gamma: 0.99,
        gain: 1.04,
        vignette: 0.24,
        bloom: 0.14,
        grain: 0.12,
        shadowTint: "rgba(12, 16, 32, 0.2)",
        highlightTint: "rgba(255, 182, 104, 0.14)"
    },
    "premium-contrast": {
        id: "premium-contrast",
        label: "Premium Contrast",
        contrast: 1.18,
        saturation: 1.12,
        brightness: 0.97,
        temperature: 8,
        lift: 0.02,
        gamma: 0.97,
        gain: 1.08,
        vignette: 0.3,
        bloom: 0.2,
        grain: 0.15,
        shadowTint: "rgba(8, 12, 28, 0.28)",
        highlightTint: "rgba(255, 214, 143, 0.18)"
    },
    "cool-editorial": {
        id: "cool-editorial",
        label: "Cool Editorial",
        contrast: 1.12,
        saturation: 1.04,
        brightness: 0.99,
        temperature: -16,
        lift: 0.012,
        gamma: 1.01,
        gain: 1.03,
        vignette: 0.22,
        bloom: 0.1,
        grain: 0.1,
        shadowTint: "rgba(8, 14, 36, 0.2)",
        highlightTint: "rgba(120, 168, 255, 0.12)"
    }
};
export const resolveGradeProfile = (profileId) => {
    return gradeProfiles[profileId] ?? gradeProfiles.neutral;
};
export const getDefaultGradeProfileIdForTier = (tier) => {
    if (tier === "minimal") {
        return "neutral";
    }
    if (tier === "editorial") {
        return "cool-editorial";
    }
    if (tier === "premium") {
        return "premium-contrast";
    }
    return "warm-cinematic";
};
export const buildGradeFilter = (profile) => {
    const warmth = profile.temperature / 140;
    const hueRotate = warmth * 8;
    return [
        `contrast(${profile.contrast})`,
        `saturate(${profile.saturation})`,
        `brightness(${profile.brightness})`,
        `sepia(${Math.max(0, warmth * 0.1)})`,
        `hue-rotate(${hueRotate}deg)`
    ].join(" ");
};
