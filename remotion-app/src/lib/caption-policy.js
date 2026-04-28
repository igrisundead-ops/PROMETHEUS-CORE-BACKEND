export const captionPolicy = {
    chunking: {
        hardMinWords: 1,
        hardMaxWords: 7,
        softMinWords: 3,
        softMaxWords: 6,
        pauseBreakMs: 280,
        strongPauseMs: 520,
        maxLineChars: 22,
        hardMaxLineChars: 26
    },
    styling: {
        baseStyleProfile: "uppercase-cinematic",
        uppercaseByDefault: true,
        keepProperCaseNames: true,
        forbidSplitContrast: true,
        wordHighlightMode: "word-timed"
    },
    variation: {
        enabled: true,
        maxRatio: 0.15,
        minGapChunks: 4,
        mode: "replace-default"
    },
    singleActiveChunk: true
};
export const isHardWordCountAllowed = (count) => {
    return count >= captionPolicy.chunking.hardMinWords && count <= captionPolicy.chunking.hardMaxWords;
};
export const isSoftWordCountPreferred = (count) => {
    return count >= captionPolicy.chunking.softMinWords && count <= captionPolicy.chunking.softMaxWords;
};
