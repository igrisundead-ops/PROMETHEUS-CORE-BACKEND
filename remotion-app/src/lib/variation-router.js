import { captionPolicy } from "./caption-policy";
const intentPriority = (intent) => {
    switch (intent) {
        case "name-callout":
            return 2;
        case "punch-emphasis":
            return 1;
        default:
            return 0;
    }
};
export const applyVariationBudget = (chunks) => {
    const normalized = chunks.map((chunk) => ({
        ...chunk,
        semantic: {
            ...chunk.semantic,
            isVariation: false,
            suppressDefault: false
        }
    }));
    if (!captionPolicy.variation.enabled || normalized.length === 0) {
        return normalized;
    }
    const eligible = normalized
        .map((chunk, index) => ({ chunk, index }))
        .filter((entry) => entry.chunk.semantic.intent !== "default")
        .sort((a, b) => {
        const aPriority = intentPriority(a.chunk.semantic.intent);
        const bPriority = intentPriority(b.chunk.semantic.intent);
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }
        return a.index - b.index;
    });
    if (eligible.length === 0) {
        return normalized;
    }
    const rawBudget = Math.floor(normalized.length * captionPolicy.variation.maxRatio);
    const variationBudget = Math.max(1, rawBudget);
    let applied = 0;
    let lastAppliedIndex = -9999;
    for (const entry of eligible) {
        if (applied >= variationBudget) {
            break;
        }
        if (entry.index - lastAppliedIndex < captionPolicy.variation.minGapChunks) {
            continue;
        }
        normalized[entry.index].semantic.isVariation = true;
        normalized[entry.index].semantic.suppressDefault = captionPolicy.variation.mode === "replace-default";
        lastAppliedIndex = entry.index;
        applied += 1;
    }
    return normalized;
};
export const getVariationStats = (chunks) => {
    const variationCount = chunks.filter((chunk) => chunk.semantic.isVariation).length;
    const intents = chunks.reduce((acc, chunk) => {
        acc[chunk.semantic.intent] += 1;
        return acc;
    }, {
        default: 0,
        "name-callout": 0,
        "punch-emphasis": 0
    });
    return {
        totalChunks: chunks.length,
        variationCount,
        variationRatio: chunks.length > 0 ? Number((variationCount / chunks.length).toFixed(3)) : 0,
        intents
    };
};
