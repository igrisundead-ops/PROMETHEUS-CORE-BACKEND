import {captionPolicy} from "./caption-policy";
import type {TypographyPartPreset, TypographyPreset} from "./presets/typography-presets";

const CAPS_SAFE_ITALIC_FONT_FAMILY = "\"Cormorant Garamond\", \"Times New Roman\", serif";
const CAPS_UNSAFE_ITALIC_FONT_PATTERN = /(great vibes|allura|cursive)/i;

const sanitizeFontFamilyForUppercase = (fontFamily: string | undefined): string | undefined => {
  if (!fontFamily) {
    return undefined;
  }

  if (!captionPolicy.styling.uppercaseByDefault) {
    return fontFamily;
  }

  return CAPS_UNSAFE_ITALIC_FONT_PATTERN.test(fontFamily) ? CAPS_SAFE_ITALIC_FONT_FAMILY : fontFamily;
};

const sanitizePartPreset = (part: TypographyPartPreset | undefined, fallbackTransform: string): TypographyPartPreset | undefined => {
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

export const sanitizeTypographyPresetForSeries = (preset: TypographyPreset): TypographyPreset => {
  const textTransform = captionPolicy.styling.uppercaseByDefault ? "uppercase" : preset.textTransform;
  const sanitized: TypographyPreset = {
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

const presetCache = new Map<string, TypographyPreset>();

export const getSanitizedTypographyPreset = (
  styleKey: string,
  presets: Record<string, TypographyPreset>,
  fallbackKey: string
): TypographyPreset => {
  if (presetCache.has(styleKey)) {
    return presetCache.get(styleKey) as TypographyPreset;
  }

  const base = presets[styleKey] ?? presets[fallbackKey];
  const sanitized = sanitizeTypographyPresetForSeries(base);
  presetCache.set(styleKey, sanitized);
  return sanitized;
};
