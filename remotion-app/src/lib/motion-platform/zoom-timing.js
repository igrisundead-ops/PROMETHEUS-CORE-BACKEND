export const ZOOM_TIMING_FAMILY_ORDER = [
    "assertive",
    "bobby",
    "glide",
    "linger",
    "reveal"
];
const ZOOM_TIMING_FAMILY_DEFINITIONS = {
    assertive: {
        totalRangeMs: [1850, 2200],
        zoomInRatioRange: [0.24, 0.29],
        holdRatioRange: [0.18, 0.24],
        peakScaleRange: [1.1, 1.14],
        leadInMsRange: [140, 210],
        easeIn: "power3.out",
        easeOut: "power2.inOut"
    },
    bobby: {
        totalRangeMs: [2900, 3600],
        zoomInRatioRange: [0.22, 0.28],
        holdRatioRange: [0.36, 0.44],
        peakScaleRange: [1.07, 1.11],
        leadInMsRange: [220, 320],
        easeIn: "sine.out",
        easeOut: "sine.inOut"
    },
    glide: {
        totalRangeMs: [2050, 2450],
        zoomInRatioRange: [0.26, 0.31],
        holdRatioRange: [0.24, 0.3],
        peakScaleRange: [1.09, 1.13],
        leadInMsRange: [170, 240],
        easeIn: "sine.out",
        easeOut: "sine.inOut"
    },
    linger: {
        totalRangeMs: [2350, 3000],
        zoomInRatioRange: [0.29, 0.34],
        holdRatioRange: [0.28, 0.36],
        peakScaleRange: [1.08, 1.12],
        leadInMsRange: [190, 260],
        easeIn: "power2.out",
        easeOut: "sine.inOut"
    },
    reveal: {
        totalRangeMs: [2100, 2750],
        zoomInRatioRange: [0.25, 0.3],
        holdRatioRange: [0.31, 0.39],
        peakScaleRange: [1.11, 1.15],
        leadInMsRange: [180, 250],
        easeIn: "power3.out",
        easeOut: "power1.inOut"
    }
};
const clampNumber = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};
export const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};
const seededUnit = (seed) => {
    return (hashString(seed) % 10000) / 9999;
};
export const getZoomTimingFamilyDefinition = (family) => {
    return ZOOM_TIMING_FAMILY_DEFINITIONS[family];
};
const sortFamiliesForSeed = (families, seed) => {
    return [...families].sort((a, b) => {
        return (hashString(`${seed}|${a}`) % 1000) - (hashString(`${seed}|${b}`) % 1000);
    });
};
const dedupeFamilies = (families) => {
    return [...new Set(families)];
};
export const buildZoomTimingFamilyOrder = ({ seed, preferredFamilies = [], previousFamily }) => {
    const preferred = dedupeFamilies(preferredFamilies);
    const fallback = ZOOM_TIMING_FAMILY_ORDER.filter((family) => !preferred.includes(family));
    const ranked = [
        ...sortFamiliesForSeed(preferred, `${seed}|preferred`),
        ...sortFamiliesForSeed(fallback, `${seed}|fallback`)
    ];
    if (!previousFamily || ranked[0] !== previousFamily) {
        return ranked;
    }
    const alternateIndex = ranked.findIndex((family) => family !== previousFamily);
    if (alternateIndex <= 0) {
        return ranked;
    }
    const reordered = [...ranked];
    const [alternate] = reordered.splice(alternateIndex, 1);
    reordered.unshift(alternate);
    return reordered;
};
const seededNumberInRange = (seed, min, max) => {
    return min + (max - min) * seededUnit(seed);
};
export const buildZoomEnvelope = ({ family, seed, contentDurationMs, contentStartMs, scaleBoost = 0 }) => {
    const definition = getZoomTimingFamilyDefinition(family);
    const centeredDurationMs = clampNumber(contentDurationMs + 900, definition.totalRangeMs[0], definition.totalRangeMs[1]);
    const durationVariance = Math.round((seededUnit(`${seed}|variance`) - 0.5) * 180);
    const totalMs = clampNumber(centeredDurationMs + durationVariance, definition.totalRangeMs[0], definition.totalRangeMs[1]);
    const zoomInRatio = seededNumberInRange(`${seed}|zoom-in-ratio`, definition.zoomInRatioRange[0], definition.zoomInRatioRange[1]);
    const holdRatio = seededNumberInRange(`${seed}|hold-ratio`, definition.holdRatioRange[0], definition.holdRatioRange[1]);
    let zoomInMs = Math.round(totalMs * zoomInRatio);
    let holdMs = Math.round(totalMs * holdRatio);
    let zoomOutMs = totalMs - zoomInMs - holdMs;
    if (zoomOutMs < 360) {
        const deficit = 360 - zoomOutMs;
        holdMs = Math.max(360, holdMs - Math.ceil(deficit / 2));
        zoomInMs = Math.max(420, zoomInMs - Math.floor(deficit / 2));
        zoomOutMs = totalMs - zoomInMs - holdMs;
    }
    if (holdMs < 360) {
        const deficit = 360 - holdMs;
        zoomOutMs = Math.max(360, zoomOutMs - deficit);
        holdMs = totalMs - zoomInMs - zoomOutMs;
    }
    const leadInMs = Math.round(seededNumberInRange(`${seed}|lead-in`, definition.leadInMsRange[0], definition.leadInMsRange[1]));
    const startMs = Math.max(0, contentStartMs - leadInMs);
    const peakStartMs = startMs + zoomInMs;
    const peakEndMs = peakStartMs + holdMs;
    const endMs = peakEndMs + zoomOutMs;
    const peakScale = clampNumber(seededNumberInRange(`${seed}|peak-scale`, definition.peakScaleRange[0], definition.peakScaleRange[1]) + scaleBoost, definition.peakScaleRange[0], 1.2);
    return {
        startMs,
        peakStartMs,
        peakEndMs,
        endMs,
        zoomInMs,
        holdMs,
        zoomOutMs,
        peakScale
    };
};
