// Deprecated live lane: the canonical non-SVG renderer now uses
// `src/lib/cinematic-typography/*` plus `CinematicCaptionOverlay.tsx`.
// These preset tables remain only as compatibility shims for legacy chunk data.

export type TypographyPartPreset = {
  fontFamily?: string;
  fontWeight?: string;
  sizeMult?: number;
  letterSpacing?: string;
  textTransform?: string;
  stroke?: string;
  glow?: string;
  color?: string;
};

export type TypographyPreset = {
  mode?: "two-word-contrast" | "three-word-contrast";
  fontFamily: string;
  fontWeight: string;
  letterSpacing: string;
  textTransform: string;
  stroke: string;
  glow: string;
  blurBase: string;
  scaleX: string;
  lineHeight: string;
  color: string;
  twoLayoutGap?: string;
  threeLayoutGap?: string;
  fourPlusMinRowGapEm?: number;
  fourPlusMaxRowGapEm?: number;
  fourPlusMinColGapEm?: number;
  fourPlusPartScaleFloor?: number;
  descriptorFontFamily?: string;
  descriptorFontStyle?: string;
  descriptorSizeMult?: number;
  descriptorLetterSpacing?: string;
  descriptorColor?: string;
  descriptorGlow?: string;
  twoA?: TypographyPartPreset;
  twoB?: TypographyPartPreset;
  threeA?: TypographyPartPreset;
  threeB?: TypographyPartPreset;
  threeC?: TypographyPartPreset;
};

export const typographyPresets: Record<string, TypographyPreset> = {
  tall_agentic_heavy: {
    fontFamily: "\"Anton\", \"Oswald\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(255, 231, 205, 0.55)",
    glow: "0 0 24px rgba(255, 176, 88, 0.38)",
    blurBase: "0px",
    scaleX: "0.78",
    lineHeight: "0.84",
    color: "#fff4e7"
  },
  tall_interesting_medium: {
    fontFamily: "\"Oswald\", \"Anton\", sans-serif",
    fontWeight: "600",
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    stroke: "0.7px rgba(213, 227, 255, 0.54)",
    glow: "0 0 26px rgba(112, 158, 255, 0.42)",
    blurBase: "0px",
    scaleX: "0.76",
    lineHeight: "0.85",
    color: "#eef3ff"
  },
  tall_cinematic_contrast: {
    fontFamily: "\"Anton\", \"Oswald\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.11em",
    textTransform: "uppercase",
    stroke: "1px rgba(255, 255, 255, 0.72)",
    glow: "0 0 30px rgba(250, 255, 255, 0.38)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.82",
    color: "#f8fbff"
  },
  tall_generic_default: {
    fontFamily: "\"Oswald\", \"Anton\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    stroke: "0.7px rgba(255, 255, 255, 0.5)",
    glow: "0 0 22px rgba(255, 214, 143, 0.34)",
    blurBase: "0px",
    scaleX: "0.77",
    lineHeight: "0.84",
    color: "#f3f6ff"
  },
  duo_script_block: {
    mode: "two-word-contrast",
    fontFamily: "\"Oswald\", \"Anton\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    stroke: "0.7px rgba(248, 252, 255, 0.62)",
    glow: "0 0 24px rgba(187, 216, 255, 0.36)",
    blurBase: "0px",
    scaleX: "0.76",
    lineHeight: "0.83",
    color: "#f5f8ff",
    twoLayoutGap: "0.24em",
    twoA: {
      fontFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
      fontWeight: "400",
      sizeMult: 1.1,
      letterSpacing: "0.02em",
      textTransform: "none",
      stroke: "0.4px rgba(255, 255, 255, 0.7)",
      glow: "0 0 20px rgba(180, 213, 255, 0.4)",
      color: "#f0f6ff"
    },
    twoB: {
      fontFamily: "\"Anton\", \"Oswald\", sans-serif",
      fontWeight: "700",
      sizeMult: 1.02,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      stroke: "0.8px rgba(255, 255, 255, 0.75)",
      glow: "0 0 26px rgba(220, 236, 255, 0.46)",
      color: "#f8fbff"
    }
  },
  duo_clean_punch: {
    mode: "two-word-contrast",
    fontFamily: "\"Anton\", \"Oswald\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(244, 247, 255, 0.64)",
    glow: "0 0 25px rgba(171, 207, 255, 0.38)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.83",
    color: "#f4f8ff",
    twoLayoutGap: "0.1em",
    twoA: {
      fontFamily: "\"Oswald\", \"Anton\", sans-serif",
      fontWeight: "600",
      sizeMult: 0.82,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      stroke: "0.6px rgba(235, 245, 255, 0.64)",
      glow: "0 0 18px rgba(152, 186, 255, 0.32)",
      color: "#dbe8ff"
    },
    twoB: {
      fontFamily: "\"Anton\", \"Oswald\", sans-serif",
      fontWeight: "700",
      sizeMult: 1.14,
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      stroke: "0.9px rgba(255, 255, 255, 0.8)",
      glow: "0 0 30px rgba(230, 241, 255, 0.5)",
      color: "#fbfcff"
    }
  },
  duo_serif_strike: {
    mode: "two-word-contrast",
    fontFamily: "\"Oswald\", \"Anton\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(248, 249, 255, 0.62)",
    glow: "0 0 26px rgba(170, 198, 255, 0.4)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.82",
    color: "#f7faff",
    twoLayoutGap: "0.11em",
    twoA: {
      fontFamily: "\"Cormorant Garamond\", serif",
      fontWeight: "700",
      sizeMult: 1.05,
      letterSpacing: "0.02em",
      textTransform: "none",
      stroke: "0.5px rgba(255, 255, 255, 0.68)",
      glow: "0 0 20px rgba(165, 199, 255, 0.38)",
      color: "#ebf2ff"
    },
    twoB: {
      fontFamily: "\"Anton\", \"Oswald\", sans-serif",
      fontWeight: "700",
      sizeMult: 1.08,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      stroke: "0.9px rgba(255, 255, 255, 0.8)",
      glow: "0 0 30px rgba(234, 243, 255, 0.54)",
      color: "#fdfefe"
    }
  },
  duo_outline_blade: {
    mode: "two-word-contrast",
    fontFamily: "\"Anton\", \"Oswald\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    stroke: "1px rgba(255, 255, 255, 0.82)",
    glow: "0 0 28px rgba(208, 229, 255, 0.48)",
    blurBase: "0px",
    scaleX: "0.73",
    lineHeight: "0.82",
    color: "#f8fbff",
    twoLayoutGap: "0.08em"
  },
  duo_luxe_whisper: {
    mode: "two-word-contrast",
    fontFamily: "\"Oswald\", \"Anton\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(245, 247, 255, 0.66)",
    glow: "0 0 24px rgba(182, 214, 255, 0.44)",
    blurBase: "0px",
    scaleX: "0.75",
    lineHeight: "0.83",
    color: "#f5f8ff",
    twoLayoutGap: "0.12em"
  },
  duo_script_caption: {
    mode: "two-word-contrast",
    fontFamily: "\"Oswald\", \"League Gothic\", sans-serif",
    fontWeight: "600",
    letterSpacing: "0.055em",
    textTransform: "uppercase",
    stroke: "0.85px rgba(241, 248, 255, 0.72)",
    glow: "0 0 20px rgba(212, 230, 255, 0.42), 0 8px 18px rgba(0, 0, 0, 0.78)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.8",
    color: "#eff6ff"
  },
  trio_serif_punch_middle: {
    mode: "three-word-contrast",
    fontFamily: "\"Cormorant Garamond\", serif",
    fontWeight: "700",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(248, 252, 255, 0.7)",
    glow: "0 0 24px rgba(201, 225, 255, 0.42)",
    blurBase: "0px",
    scaleX: "0.85",
    lineHeight: "0.86",
    color: "#f7fbff",
    threeLayoutGap: "0.1em"
  },
  trio_tall_punch_middle: {
    mode: "three-word-contrast",
    fontFamily: "\"Anton\", \"Oswald\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    stroke: "0.9px rgba(247, 251, 255, 0.74)",
    glow: "0 0 26px rgba(186, 216, 255, 0.44)",
    blurBase: "0px",
    scaleX: "0.73",
    lineHeight: "0.83",
    color: "#f5f9ff",
    threeLayoutGap: "0.08em"
  },
  trio_script_punch_middle: {
    mode: "three-word-contrast",
    fontFamily: "\"Oswald\", \"Anton\", sans-serif",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(246, 250, 255, 0.7)",
    glow: "0 0 24px rgba(186, 214, 255, 0.42)",
    blurBase: "0px",
    scaleX: "0.76",
    lineHeight: "0.84",
    color: "#f2f8ff",
    threeLayoutGap: "0.1em"
  },
  trio_ref_dream_big_now_v1: {
    mode: "three-word-contrast",
    fontFamily: "\"Anton\", \"Bebas Neue\", sans-serif",
    fontWeight: "400",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(235, 242, 252, 0.78)",
    glow: "0 0 16px rgba(236, 243, 255, 0.34), 0 7px 18px rgba(0, 0, 0, 0.82)",
    blurBase: "0px",
    scaleX: "0.79",
    lineHeight: "0.78",
    color: "#eef4ff"
  },
  trio_ref_your_master_mind_v1: {
    mode: "three-word-contrast",
    fontFamily: "\"Anton\", \"Bebas Neue\", sans-serif",
    fontWeight: "400",
    letterSpacing: "0.018em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(228, 236, 248, 0.72)",
    glow: "0 0 18px rgba(232, 241, 255, 0.42), 0 7px 18px rgba(0, 0, 0, 0.86)",
    blurBase: "0px",
    scaleX: "0.82",
    lineHeight: "0.8",
    color: "#e6edf8"
  },
  trio_ref_take_action_now_v1: {
    mode: "three-word-contrast",
    fontFamily: "\"Anton\", \"Bebas Neue\", sans-serif",
    fontWeight: "400",
    letterSpacing: "0.016em",
    textTransform: "uppercase",
    stroke: "0.85px rgba(233, 241, 252, 0.78)",
    glow: "0 0 18px rgba(237, 244, 255, 0.42), 0 8px 20px rgba(0, 0, 0, 0.88)",
    blurBase: "0px",
    scaleX: "0.8",
    lineHeight: "0.78",
    color: "#ebf2ff"
  },
  trio_ref_build_legacy_your_v1: {
    mode: "three-word-contrast",
    fontFamily: "\"Anton\", \"Bebas Neue\", sans-serif",
    fontWeight: "400",
    letterSpacing: "0.018em",
    textTransform: "uppercase",
    stroke: "0.85px rgba(233, 241, 252, 0.8)",
    glow: "0 0 16px rgba(234, 244, 255, 0.4), 0 7px 18px rgba(0, 0, 0, 0.86)",
    blurBase: "0px",
    scaleX: "0.81",
    lineHeight: "0.79",
    color: "#ebf2ff"
  },
  quad_banner_tall: {
    mode: "three-word-contrast",
    fontFamily: "\"Oswald\", \"League Gothic\", sans-serif",
    fontWeight: "600",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    stroke: "0.9px rgba(238, 246, 255, 0.7)",
    glow: "0 0 20px rgba(214, 232, 255, 0.38), 0 8px 18px rgba(0, 0, 0, 0.74)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.84",
    color: "#eff5ff",
    fourPlusMinRowGapEm: 0.14,
    fourPlusMaxRowGapEm: 0.34,
    fourPlusMinColGapEm: 0.08,
    fourPlusPartScaleFloor: 0.78
  },
  quad_split_tall: {
    mode: "three-word-contrast",
    fontFamily: "\"League Gothic\", \"Bebas Neue\", sans-serif",
    fontWeight: "400",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(236, 245, 255, 0.68)",
    glow: "0 0 18px rgba(200, 222, 255, 0.34), 0 8px 20px rgba(0, 0, 0, 0.76)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.84",
    color: "#ebf3ff",
    fourPlusMinRowGapEm: 0.13,
    fourPlusMaxRowGapEm: 0.32,
    fourPlusMinColGapEm: 0.075,
    fourPlusPartScaleFloor: 0.78
  },
  quad_serif_contrast: {
    mode: "three-word-contrast",
    fontFamily: "\"Cinzel\", \"Bodoni Moda\", serif",
    fontWeight: "600",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    stroke: "0.8px rgba(241, 247, 255, 0.74)",
    glow: "0 0 20px rgba(220, 236, 255, 0.36), 0 7px 18px rgba(0, 0, 0, 0.74)",
    blurBase: "0px",
    scaleX: "0.84",
    lineHeight: "0.86",
    color: "#f2f8ff",
    fourPlusMinRowGapEm: 0.14,
    fourPlusMaxRowGapEm: 0.34,
    fourPlusMinColGapEm: 0.08,
    fourPlusPartScaleFloor: 0.76
  },
  quad_outline_compressed: {
    mode: "three-word-contrast",
    fontFamily: "\"Oswald\", \"Bebas Neue\", sans-serif",
    fontWeight: "600",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    stroke: "1px rgba(246, 252, 255, 0.86)",
    glow: "0 0 20px rgba(214, 233, 255, 0.42), 0 8px 20px rgba(0, 0, 0, 0.8)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.84",
    color: "#f4f9ff",
    fourPlusMinRowGapEm: 0.13,
    fourPlusMaxRowGapEm: 0.33,
    fourPlusMinColGapEm: 0.08,
    fourPlusPartScaleFloor: 0.78
  },
  six_quad_duo_cinematic: {
    mode: "three-word-contrast",
    fontFamily: "\"Oswald\", \"League Gothic\", sans-serif",
    fontWeight: "600",
    letterSpacing: "0.045em",
    textTransform: "uppercase",
    stroke: "0.85px rgba(238, 246, 255, 0.74)",
    glow: "0 0 19px rgba(209, 229, 255, 0.36), 0 9px 22px rgba(0, 0, 0, 0.8)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.84",
    color: "#eef5ff",
    fourPlusMinRowGapEm: 0.14,
    fourPlusMaxRowGapEm: 0.34,
    fourPlusMinColGapEm: 0.08,
    fourPlusPartScaleFloor: 0.78,
    descriptorFontFamily: "\"Allura\", \"Cormorant Garamond\", serif",
    descriptorFontStyle: "italic",
    descriptorSizeMult: 0.72,
    descriptorLetterSpacing: "0.012em",
    descriptorColor: "#e9f1ff",
    descriptorGlow: "0 0 14px rgba(219, 234, 255, 0.42)"
  },
  six_quad_duo_joiner_locale: {
    mode: "three-word-contrast",
    fontFamily: "\"Oswald\", \"League Gothic\", sans-serif",
    fontWeight: "600",
    letterSpacing: "0.045em",
    textTransform: "uppercase",
    stroke: "0.85px rgba(238, 246, 255, 0.74)",
    glow: "0 0 19px rgba(209, 229, 255, 0.36), 0 9px 22px rgba(0, 0, 0, 0.8)",
    blurBase: "0px",
    scaleX: "0.74",
    lineHeight: "0.84",
    color: "#eef5ff",
    fourPlusMinRowGapEm: 0.14,
    fourPlusMaxRowGapEm: 0.34,
    fourPlusMinColGapEm: 0.055,
    fourPlusPartScaleFloor: 0.8,
    descriptorFontFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    descriptorFontStyle: "italic",
    descriptorSizeMult: 0.68,
    descriptorLetterSpacing: "0.01em",
    descriptorColor: "#dfebff",
    descriptorGlow: "0 0 11px rgba(205, 224, 255, 0.35)"
  },
  hormozi_word_lock_base: {
    mode: "three-word-contrast",
    fontFamily: "\"Anton\", \"Bebas Neue\", \"Impact\", sans-serif",
    fontWeight: "800",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    stroke: "0px transparent",
    glow: "none",
    blurBase: "0px",
    scaleX: "1",
    lineHeight: "0.9",
    color: "rgba(255, 255, 255, 0.92)"
  }
};
