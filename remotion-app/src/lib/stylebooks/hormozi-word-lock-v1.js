export const HORMOZI_WORD_LOCK_PROFILE_ID = "hormozi_word_lock_v1";
export const HORMOZI_WORD_LOCK_DISPLAY_NAME = "Hormozi Word-Lock v1";
export const HORMOZI_WORD_LOCK_STYLE_KEY = "hormozi_word_lock_base";
export const HORMOZI_WORD_LOCK_MOTION_KEY = "hormozi_word_lock_snap";
export const HORMOZI_WORD_LOCK_LAYOUT_VARIANT = "inline";
export const hormoziWordLockV1 = {
    id: HORMOZI_WORD_LOCK_PROFILE_ID,
    displayName: HORMOZI_WORD_LOCK_DISPLAY_NAME,
    tokens: {
        fontFamily: "\"Anton\", \"Bebas Neue\", \"Impact\", sans-serif",
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        inactiveTextColor: "rgba(255, 255, 255, 0.92)",
        activeRectFill: "#FFD400",
        activeTextColor: "#111111",
        activeRectRadiusPx: 4,
        activeRectPaddingXEm: 0.18,
        activeRectPaddingYEm: 0.08
    },
    grouping: {
        hardMinWords: 1,
        hardMaxWords: 4,
        softMinWords: 2,
        softMaxWords: 3,
        pauseBreakMs: 260,
        strongPauseMs: 480,
        maxLineChars: 20,
        hardMaxLineChars: 24
    },
    timing: {
        source: "word-timestamps",
        transitionMode: "strict-word-lock",
        boundaryMode: "start-inclusive-end-exclusive",
        clampToOneFrameWhenInvalid: true
    },
    routing: {
        styleKey: HORMOZI_WORD_LOCK_STYLE_KEY,
        motionKey: HORMOZI_WORD_LOCK_MOTION_KEY,
        layoutVariant: HORMOZI_WORD_LOCK_LAYOUT_VARIANT
    },
    svgContract: {
        text: {
            fontFamily: "font-family",
            fontWeight: "font-weight",
            textTransform: "text-transform",
            letterSpacing: "letter-spacing"
        },
        activeRect: {
            fill: "fill",
            cornerRadius: "rx",
            paddingX: "data-padding-x-em",
            paddingY: "data-padding-y-em"
        },
        activeWord: {
            fill: "fill"
        },
        timingSource: "caption.words[].startMs/endMs (shared with Remotion)"
    }
};
export const clampWordTimingToFrame = ({ startMs, endMs, fps }) => {
    const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
    const minDurationMs = 1000 / safeFps;
    const normalizedStart = Number.isFinite(startMs) ? startMs : 0;
    const normalizedEnd = Number.isFinite(endMs) ? endMs : normalizedStart;
    if (normalizedEnd <= normalizedStart) {
        return {
            startMs: normalizedStart,
            endMs: normalizedStart + minDurationMs
        };
    }
    return {
        startMs: normalizedStart,
        endMs: normalizedEnd
    };
};
export const isHormoziWordLockStyleKey = (styleKey) => {
    return styleKey === HORMOZI_WORD_LOCK_STYLE_KEY;
};
