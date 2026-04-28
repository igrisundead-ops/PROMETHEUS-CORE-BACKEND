import { captionPolicy } from "./caption-policy";
const CAPS_SAFE_ITALIC_FONT_FAMILY = "\"Cormorant Garamond\", \"Times New Roman\", serif";
const CAPS_UNSAFE_ITALIC_FONT_PATTERN = /(great vibes|allura|cursive)/i;
const sanitizeFontFamilyForUppercase = (fontFamily) => {
    if (!fontFamily) {
        return undefined;
    }
    if (!captionPolicy.styling.uppercaseByDefault) {
        return fontFamily;
    }
    return CAPS_UNSAFE_ITALIC_FONT_PATTERN.test(fontFamily) ? CAPS_SAFE_ITALIC_FONT_FAMILY : fontFamily;
};
const sanitizePartPreset = (part, fallbackTransform) => {
    if (!part) {
        return undefined;
    }
    return {
        ...part,
        fontFamily: sanitizeFontFamilyForUppercase(part.fontFamily),
        sizeMult: captionPolicy.styling.forbidSplitContrast ? 1 : part.sizeMult,
        textTransform: captionPolicy.styling.uppercaseByDefault ? "uppercase" : part.textTransform ?? fallbackTransform
    };
};
export const sanitizeTypographyPresetForSeries = (preset) => {
    const textTransform = captionPolicy.styling.uppercaseByDefault ? "uppercase" : preset.textTransform;
    const sanitized = {
        ...preset,
        textTransform,
        twoA: sanitizePartPreset(preset.twoA, textTransform),
        twoB: sanitizePartPreset(preset.twoB, textTransform),
        threeA: sanitizePartPreset(preset.threeA, textTransform),
        threeB: sanitizePartPreset(preset.threeB, textTransform),
        threeC: sanitizePartPreset(preset.threeC, textTransform)
    };
    return sanitized;
};
const presetCache = new Map();
export const getSanitizedTypographyPreset = (styleKey, presets, fallbackKey) => {
    if (presetCache.has(styleKey)) {
        return presetCache.get(styleKey);
    }
    const base = presets[styleKey] ?? presets[fallbackKey];
    const sanitized = sanitizeTypographyPresetForSeries(base);
    presetCache.set(styleKey, sanitized);
    return sanitized;
};
