import { HORMOZI_WORD_LOCK_LAYOUT_VARIANT, HORMOZI_WORD_LOCK_MOTION_KEY, HORMOZI_WORD_LOCK_PROFILE_ID, HORMOZI_WORD_LOCK_STYLE_KEY } from "./stylebooks/hormozi-word-lock-v1";
import { createSvgVariantSelectionState, SVG_TYPOGRAPHY_LAYOUT_VARIANT, SVG_TYPOGRAPHY_PROFILE_ID, selectSvgTypographyVariant, toSvgTypographyMotionKey, toSvgTypographyStyleKey } from "./stylebooks/svg-typography-v1";
const SINGLE_WORD_STYLES = ["tall_cinematic_contrast", "tall_interesting_medium", "tall_agentic_heavy"];
const FOUR_PLUS_STYLES = ["quad_banner_tall", "quad_split_tall", "quad_serif_contrast", "quad_outline_compressed"];
const SLCP_TWO_WORD_STYLE = {
    styleKey: "duo_script_block",
    motionKey: "two_word_cinematic_pair",
    layoutVariant: "inline"
};
const SLCP_THREE_WORD_STYLE = {
    styleKey: "tall_generic_default",
    motionKey: "three_word_tall_blade",
    layoutVariant: "inline"
};
const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};
const pickDeterministic = (values, seed) => {
    if (values.length === 0) {
        return "";
    }
    return values[hashString(seed) % values.length];
};
const joinWordsSeed = (words) => {
    return words.map((word) => word.trim().toLowerCase()).filter(Boolean).join("|");
};
const routeDefaultStyle = (words) => {
    const count = words.length;
    const seed = joinWordsSeed(words);
    if (count <= 1) {
        return {
            styleKey: pickDeterministic(SINGLE_WORD_STYLES, seed),
            motionKey: "cinematic_focus_lock",
            layoutVariant: "inline"
        };
    }
    if (count === 2) {
        return SLCP_TWO_WORD_STYLE;
    }
    if (count === 3) {
        return SLCP_THREE_WORD_STYLE;
    }
    const isSixOrMore = count >= 6;
    return {
        styleKey: pickDeterministic(FOUR_PLUS_STYLES, seed),
        motionKey: isSixOrMore ? "six_word_quad_duo_depth" : pickDeterministic(["four_word_banner_drift", "four_word_split_stagger"], seed),
        layoutVariant: "fourplus-grid"
    };
};
const routeVariationStyle = (words, semantic) => {
    const count = words.length;
    if (semantic.intent === "name-callout") {
        if (count <= 1) {
            return routeDefaultStyle(words);
        }
        if (count === 2) {
            return SLCP_TWO_WORD_STYLE;
        }
        if (count === 3) {
            return SLCP_THREE_WORD_STYLE;
        }
        return {
            styleKey: "tall_cinematic_contrast",
            motionKey: count <= 2 ? "two_word_cinematic_pair" : "three_word_tall_blade",
            layoutVariant: "inline"
        };
    }
    if (count === 3) {
        return SLCP_THREE_WORD_STYLE;
    }
    return {
        styleKey: "tall_cinematic_contrast",
        motionKey: count <= 2 ? "two_word_cinematic_pair" : "three_word_tall_blade",
        layoutVariant: "inline"
    };
};
const routeHormoziWordLockStyle = () => {
    return {
        styleKey: HORMOZI_WORD_LOCK_STYLE_KEY,
        motionKey: HORMOZI_WORD_LOCK_MOTION_KEY,
        layoutVariant: HORMOZI_WORD_LOCK_LAYOUT_VARIANT
    };
};
const createSvgSelectionPreferences = ({ preferredMotionProfiles, preferredExitProfiles, extraDisfavoredMotionProfiles = [] }) => {
    return {
        allowLegacyVariants: false,
        preferredMotionProfiles,
        disfavoredMotionProfiles: ["typing", ...extraDisfavoredMotionProfiles],
        forbiddenMotionProfiles: ["sweep-heavy", "blur-heavy", "stacked", "typing"],
        preferredExitProfiles,
        forbiddenExitProfiles: ["integrated-sweep"]
    };
};
const getSvgSelectionPreferences = ({ words, semantic }) => {
    const count = words.length;
    const intent = semantic?.intent ?? "default";
    if (count <= 1) {
        return createSvgSelectionPreferences({
            preferredMotionProfiles: ["clean", "stagger", "impact"],
            preferredExitProfiles: ["fade-soft", "fade-late"]
        });
    }
    if (count === 2) {
        if (intent === "punch-emphasis") {
            return createSvgSelectionPreferences({
                preferredMotionProfiles: ["clean", "impact", "stagger"],
                preferredExitProfiles: ["fade-soft", "fade-late"]
            });
        }
        if (intent === "name-callout") {
            return createSvgSelectionPreferences({
                preferredMotionProfiles: ["clean", "stagger", "blur-heavy"],
                preferredExitProfiles: ["fade-soft", "fade-late"]
            });
        }
        return createSvgSelectionPreferences({
            preferredMotionProfiles: ["clean", "stagger", "impact"],
            preferredExitProfiles: ["fade-soft", "fade-late"]
        });
    }
    if (count === 3) {
        return createSvgSelectionPreferences({
            preferredMotionProfiles: ["stagger", "clean"],
            preferredExitProfiles: ["fade-soft", "fade-late"],
            extraDisfavoredMotionProfiles: ["impact"]
        });
    }
    return createSvgSelectionPreferences({
        preferredMotionProfiles: ["clean", "impact", "stagger"],
        preferredExitProfiles: ["fade-late", "fade-soft"]
    });
};
const routeSvgTypographyStyle = (words, semantic, options) => {
    const variant = selectSvgTypographyVariant({
        words,
        chunkIndex: options.chunkIndex ?? 0,
        intent: semantic?.intent ?? "default",
        selectionState: options.svgSelectionState,
        preferences: getSvgSelectionPreferences({ words, semantic })
    });
    return {
        styleKey: toSvgTypographyStyleKey(variant.id),
        motionKey: toSvgTypographyMotionKey(variant.id),
        layoutVariant: SVG_TYPOGRAPHY_LAYOUT_VARIANT
    };
};
export const routeStyleForWords = (words, semantic, options = {}) => {
    const cleanWords = words.map((word) => word.trim()).filter(Boolean);
    const profileId = options.profileId ?? "slcp";
    if (profileId === HORMOZI_WORD_LOCK_PROFILE_ID) {
        return routeHormoziWordLockStyle();
    }
    if (profileId === SVG_TYPOGRAPHY_PROFILE_ID) {
        return routeSvgTypographyStyle(cleanWords, semantic, options);
    }
    if (cleanWords.length === 0) {
        return {
            styleKey: "tall_generic_default",
            motionKey: "generic_single_word",
            layoutVariant: "inline"
        };
    }
    if (semantic?.isVariation && semantic.intent !== "default") {
        return routeVariationStyle(cleanWords, semantic);
    }
    return routeDefaultStyle(cleanWords);
};
export const rerouteSvgTypographyChunks = (chunks) => {
    const svgSelectionState = createSvgVariantSelectionState();
    let svgChunkIndex = 0;
    return chunks.map((chunk) => {
        const isSvgChunk = chunk.profileId === SVG_TYPOGRAPHY_PROFILE_ID || chunk.styleKey.startsWith("svg_typography_v1:");
        if (!isSvgChunk) {
            return chunk;
        }
        const rerouted = routeStyleForWords(chunk.words.map((word) => word.text), chunk.semantic, {
            profileId: SVG_TYPOGRAPHY_PROFILE_ID,
            chunkIndex: svgChunkIndex,
            svgSelectionState
        });
        svgChunkIndex += 1;
        return {
            ...chunk,
            styleKey: rerouted.styleKey,
            motionKey: rerouted.motionKey,
            layoutVariant: rerouted.layoutVariant,
            profileId: SVG_TYPOGRAPHY_PROFILE_ID
        };
    });
};
export const scoreWordForEmphasis = (word) => {
    let score = 0;
    if (/[A-Z]{2,}/.test(word.text)) {
        score += 3;
    }
    if (/[!?]/.test(word.text)) {
        score += 2;
    }
    if (word.text.length >= 7) {
        score += 1;
    }
    return score;
};
export const getDefaultEmphasisIndices = (words) => {
    if (words.length === 0) {
        return [];
    }
    const ranked = words
        .map((word, index) => ({ index, score: scoreWordForEmphasis(word) }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
    const topScore = ranked[0]?.score ?? 0;
    if (topScore <= 0) {
        if (words.length === 1) {
            return [0];
        }
        if (words.length === 2) {
            return [1];
        }
        return [1, Math.min(3, words.length - 1)];
    }
    const selected = ranked.filter((entry) => entry.score === topScore).slice(0, 2);
    return selected.map((entry) => entry.index).sort((a, b) => a - b);
};
