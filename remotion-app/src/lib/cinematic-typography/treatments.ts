import type {CaptionVerticalBias, MotionTier} from "../types";

import type {EditorialFontPaletteId} from "./editorial-fonts";

export type CinematicMotionPrimitiveId =
  | "split-reveal"
  | "blur-resolve"
  | "focus-isolation"
  | "rotating-transition"
  | "masked-reveal"
  | "directional-wipe"
  | "emphasis-pulse";

export type CinematicMotionUnit = "block" | "line" | "word";
export type CinematicCasePolicy = "sentence" | "title" | "uppercase";
export type CinematicLineBreakBehavior =
  | "single-anchor"
  | "balanced"
  | "focus-tail"
  | "accent-tail"
  | "staggered-pair";

export type CinematicHoldIsolation = "none" | "soft-dim" | "keyword-spotlight";
export type CinematicSurfaceTone = "light" | "dark" | "neutral";
export type CinematicSceneEnergy = "low" | "medium" | "high";
export type CinematicMotionDensity = "restrained" | "measured" | "present";
export type CinematicGpuCost = "low" | "medium";

export type CinematicMotionPrimitive = {
  id: CinematicMotionPrimitiveId;
  intensity: number;
  axis?: "x" | "y";
  direction?: "forward" | "backward" | "center";
  emphasisOnly?: boolean;
};

export type CinematicMotionPhase = {
  durationMs: number;
  lineStaggerMs: number;
  wordStaggerMs: number;
  easing: "standard" | "soft" | "crisp" | "slow";
  primitives: CinematicMotionPrimitive[];
};

export type CinematicTreatment = {
  id: string;
  visualFamily: string;
  semanticTags: string[];
  moodTags: string[];
  pacingProfile: string[];
  fontProfile: EditorialFontPaletteId;
  fallbackFontProfile: EditorialFontPaletteId;
  casePolicy: CinematicCasePolicy;
  trackingRules: {
    base: string;
    uppercase: string;
    emphasis: string;
    support: string;
  };
  lineHeightRules: {
    base: number;
    compact: number;
    relaxed: number;
  };
  lineBreakBehavior: CinematicLineBreakBehavior;
  compositionRules: {
    placement: "upper-middle" | "center" | "lower-middle";
    align: "center";
    maxLines: number;
    maxWidthCh: number;
    supportLeadIn: boolean;
  };
  captionLengthConstraints: {
    minWords: number;
    maxWords: number;
    maxChars: number;
    preferredWordRange: [number, number];
    preferredCharRange: [number, number];
  };
  emphasisRules: {
    maxWords: number;
    italicizeEmphasis: boolean;
    isolateKeywords: boolean;
    allowSupportLine: boolean;
  };
  motionGrammar: {
    unit: CinematicMotionUnit;
    entry: CinematicMotionPhase;
    hold: {
      focusIsolation: CinematicHoldIsolation;
      idleScale: number;
      activeScale: number;
      nonFocusOpacity: number;
      emphasisPulse: number;
    };
    exit: CinematicMotionPhase;
    continuity: {
      preferredBridgeIds: string[];
      sameFamilyDamping: number;
      shortGapBoost: number;
    };
  };
  entryBehavior: string;
  holdBehavior: string;
  exitBehavior: string;
  antiRepeatBudget: {
    maxSequentialUses: number;
    maxUsesInWindow: number;
    windowSize: number;
  };
  cooldownRules: {
    minChunksBetweenUses: number;
    minChunksBetweenVisualFamily: number;
  };
  sceneCompatibilityHints: {
    surfaceTones: CinematicSurfaceTone[];
    energy: CinematicSceneEnergy[];
    motionTiers: MotionTier[];
    captionBiases: CaptionVerticalBias[];
    semanticIntents: string[];
  };
  renderComplexityHints: {
    motionDensity: CinematicMotionDensity;
    gpuCost: CinematicGpuCost;
    wordTimedEmphasis: boolean;
  };
};

const phase = (
  durationMs: number,
  lineStaggerMs: number,
  wordStaggerMs: number,
  easing: CinematicMotionPhase["easing"],
  primitives: CinematicMotionPrimitive[]
): CinematicMotionPhase => ({
  durationMs,
  lineStaggerMs,
  wordStaggerMs,
  easing,
  primitives
});

const createTreatment = (treatment: CinematicTreatment): CinematicTreatment => treatment;

export const CINEMATIC_TREATMENTS: CinematicTreatment[] = [
  createTreatment({
    id: "editorial-bridge",
    visualFamily: "editorial-caption",
    semanticTags: ["subtitle", "bridge", "continuity", "voiceover"],
    moodTags: ["editorial", "cinematic", "restrained"],
    pacingProfile: ["medium", "fast"],
    fontProfile: "dm-sans-core",
    fallbackFontProfile: "crimson-voice",
    casePolicy: "sentence",
    trackingRules: {
      base: "-0.012em",
      uppercase: "0.028em",
      emphasis: "0em",
      support: "0.04em"
    },
    lineHeightRules: {
      base: 0.94,
      compact: 0.88,
      relaxed: 1.02
    },
    lineBreakBehavior: "balanced",
    compositionRules: {
      placement: "lower-middle",
      align: "center",
      maxLines: 2,
      maxWidthCh: 26,
      supportLeadIn: false
    },
    captionLengthConstraints: {
      minWords: 2,
      maxWords: 8,
      maxChars: 48,
      preferredWordRange: [3, 6],
      preferredCharRange: [12, 34]
    },
    emphasisRules: {
      maxWords: 2,
      italicizeEmphasis: false,
      isolateKeywords: true,
      allowSupportLine: false
    },
    motionGrammar: {
      unit: "word",
      entry: phase(430, 38, 28, "standard", [
        {id: "directional-wipe", intensity: 0.52, axis: "x", direction: "forward"},
        {id: "blur-resolve", intensity: 0.34}
      ]),
      hold: {
        focusIsolation: "soft-dim",
        idleScale: 1,
        activeScale: 1.035,
        nonFocusOpacity: 0.74,
        emphasisPulse: 0.06
      },
      exit: phase(240, 18, 12, "soft", [
        {id: "masked-reveal", intensity: 0.2, axis: "y", direction: "backward"},
        {id: "blur-resolve", intensity: 0.16}
      ]),
      continuity: {
        preferredBridgeIds: ["precision-directive", "crimson-echo"],
        sameFamilyDamping: 0.72,
        shortGapBoost: 0.14
      }
    },
    entryBehavior: "Words glide in with a restrained left-to-right wipe and a fast blur resolve.",
    holdBehavior: "Support words dim slightly while the active acoustic beat holds the eye.",
    exitBehavior: "Text clears with a soft matte collapse instead of a hard drop.",
    antiRepeatBudget: {
      maxSequentialUses: 1,
      maxUsesInWindow: 3,
      windowSize: 6
    },
    cooldownRules: {
      minChunksBetweenUses: 1,
      minChunksBetweenVisualFamily: 1
    },
    sceneCompatibilityHints: {
      surfaceTones: ["dark", "neutral", "light"],
      energy: ["medium", "high"],
      motionTiers: ["minimal", "editorial", "premium", "hero"],
      captionBiases: ["middle", "bottom"],
      semanticIntents: ["default", "punch-emphasis"]
    },
    renderComplexityHints: {
      motionDensity: "restrained",
      gpuCost: "low",
      wordTimedEmphasis: true
    }
  }),
  createTreatment({
    id: "fraunces-pullquote",
    visualFamily: "editorial-pullquote",
    semanticTags: ["quote", "headline", "focus", "reveal"],
    moodTags: ["editorial", "luxury", "emotional"],
    pacingProfile: ["slow", "medium"],
    fontProfile: "fraunces-editorial",
    fallbackFontProfile: "crimson-voice",
    casePolicy: "sentence",
    trackingRules: {
      base: "-0.018em",
      uppercase: "0.024em",
      emphasis: "-0.022em",
      support: "0.045em"
    },
    lineHeightRules: {
      base: 0.92,
      compact: 0.86,
      relaxed: 1.04
    },
    lineBreakBehavior: "focus-tail",
    compositionRules: {
      placement: "center",
      align: "center",
      maxLines: 2,
      maxWidthCh: 22,
      supportLeadIn: false
    },
    captionLengthConstraints: {
      minWords: 2,
      maxWords: 7,
      maxChars: 42,
      preferredWordRange: [3, 5],
      preferredCharRange: [10, 28]
    },
    emphasisRules: {
      maxWords: 2,
      italicizeEmphasis: true,
      isolateKeywords: true,
      allowSupportLine: false
    },
    motionGrammar: {
      unit: "line",
      entry: phase(620, 64, 0, "slow", [
        {id: "split-reveal", intensity: 0.48, axis: "y", direction: "forward"},
        {id: "blur-resolve", intensity: 0.42}
      ]),
      hold: {
        focusIsolation: "keyword-spotlight",
        idleScale: 1,
        activeScale: 1.028,
        nonFocusOpacity: 0.68,
        emphasisPulse: 0.04
      },
      exit: phase(280, 18, 0, "soft", [
        {id: "masked-reveal", intensity: 0.24, axis: "x", direction: "backward"}
      ]),
      continuity: {
        preferredBridgeIds: ["crimson-echo", "instrument-italics"],
        sameFamilyDamping: 0.66,
        shortGapBoost: 0.1
      }
    },
    entryBehavior: "Lines split upward into place with a lens-like blur resolve.",
    holdBehavior: "The emphasized phrase stays optically closer while support language recedes.",
    exitBehavior: "A narrow matte closes the composition without killing the hold too early.",
    antiRepeatBudget: {
      maxSequentialUses: 1,
      maxUsesInWindow: 2,
      windowSize: 5
    },
    cooldownRules: {
      minChunksBetweenUses: 2,
      minChunksBetweenVisualFamily: 1
    },
    sceneCompatibilityHints: {
      surfaceTones: ["dark", "neutral"],
      energy: ["low", "medium"],
      motionTiers: ["editorial", "premium", "hero"],
      captionBiases: ["middle"],
      semanticIntents: ["default", "name-callout"]
    },
    renderComplexityHints: {
      motionDensity: "restrained",
      gpuCost: "low",
      wordTimedEmphasis: true
    }
  }),
  createTreatment({
    id: "instrument-italics",
    visualFamily: "luxe-italic",
    semanticTags: ["name-callout", "quote", "keyword", "focus"],
    moodTags: ["luxury", "editorial", "restrained"],
    pacingProfile: ["slow", "medium"],
    fontProfile: "instrument-nocturne",
    fallbackFontProfile: "fraunces-editorial",
    casePolicy: "title",
    trackingRules: {
      base: "-0.02em",
      uppercase: "0.04em",
      emphasis: "-0.032em",
      support: "0.05em"
    },
    lineHeightRules: {
      base: 0.9,
      compact: 0.84,
      relaxed: 1.02
    },
    lineBreakBehavior: "accent-tail",
    compositionRules: {
      placement: "center",
      align: "center",
      maxLines: 2,
      maxWidthCh: 20,
      supportLeadIn: false
    },
    captionLengthConstraints: {
      minWords: 1,
      maxWords: 5,
      maxChars: 28,
      preferredWordRange: [2, 4],
      preferredCharRange: [6, 20]
    },
    emphasisRules: {
      maxWords: 2,
      italicizeEmphasis: true,
      isolateKeywords: true,
      allowSupportLine: false
    },
    motionGrammar: {
      unit: "block",
      entry: phase(540, 0, 0, "soft", [
        {id: "masked-reveal", intensity: 0.46, axis: "y", direction: "forward"},
        {id: "blur-resolve", intensity: 0.26}
      ]),
      hold: {
        focusIsolation: "keyword-spotlight",
        idleScale: 1,
        activeScale: 1.024,
        nonFocusOpacity: 0.72,
        emphasisPulse: 0.05
      },
      exit: phase(260, 0, 0, "soft", [
        {id: "directional-wipe", intensity: 0.18, axis: "y", direction: "backward"}
      ]),
      continuity: {
        preferredBridgeIds: ["fraunces-pullquote", "noto-monument"],
        sameFamilyDamping: 0.64,
        shortGapBoost: 0.08
      }
    },
    entryBehavior: "A single premium card-like composition opens from a narrow matte.",
    holdBehavior: "The isolated keyword can lean into italic emphasis without destabilizing the frame.",
    exitBehavior: "The whole phrase breathes away with almost no perceived jitter.",
    antiRepeatBudget: {
      maxSequentialUses: 1,
      maxUsesInWindow: 2,
      windowSize: 6
    },
    cooldownRules: {
      minChunksBetweenUses: 2,
      minChunksBetweenVisualFamily: 2
    },
    sceneCompatibilityHints: {
      surfaceTones: ["dark", "neutral", "light"],
      energy: ["low", "medium"],
      motionTiers: ["editorial", "premium"],
      captionBiases: ["middle", "top"],
      semanticIntents: ["name-callout", "default"]
    },
    renderComplexityHints: {
      motionDensity: "restrained",
      gpuCost: "low",
      wordTimedEmphasis: true
    }
  }),
  createTreatment({
    id: "noto-monument",
    visualFamily: "monument-display",
    semanticTags: ["headline", "statement", "name-callout", "transition"],
    moodTags: ["cinematic", "dramatic", "luxury"],
    pacingProfile: ["medium", "fast"],
    fontProfile: "noto-display",
    fallbackFontProfile: "playfair-contrast",
    casePolicy: "title",
    trackingRules: {
      base: "-0.024em",
      uppercase: "0.05em",
      emphasis: "-0.03em",
      support: "0.06em"
    },
    lineHeightRules: {
      base: 0.88,
      compact: 0.82,
      relaxed: 0.98
    },
    lineBreakBehavior: "single-anchor",
    compositionRules: {
      placement: "center",
      align: "center",
      maxLines: 2,
      maxWidthCh: 18,
      supportLeadIn: true
    },
    captionLengthConstraints: {
      minWords: 1,
      maxWords: 5,
      maxChars: 24,
      preferredWordRange: [1, 3],
      preferredCharRange: [4, 18]
    },
    emphasisRules: {
      maxWords: 1,
      italicizeEmphasis: true,
      isolateKeywords: true,
      allowSupportLine: true
    },
    motionGrammar: {
      unit: "block",
      entry: phase(460, 0, 0, "crisp", [
        {id: "split-reveal", intensity: 0.52, axis: "y", direction: "forward"},
        {id: "directional-wipe", intensity: 0.24, axis: "x", direction: "forward"},
        {id: "rotating-transition", intensity: 0.12}
      ]),
      hold: {
        focusIsolation: "none",
        idleScale: 1,
        activeScale: 1.018,
        nonFocusOpacity: 0.82,
        emphasisPulse: 0.03
      },
      exit: phase(220, 0, 0, "standard", [
        {id: "masked-reveal", intensity: 0.16, axis: "y", direction: "backward"}
      ]),
      continuity: {
        preferredBridgeIds: ["playfair-aperture", "editorial-bridge"],
        sameFamilyDamping: 0.7,
        shortGapBoost: 0.14
      }
    },
    entryBehavior: "Short statements arrive with a controlled monument-scale rise and a very slight pivot.",
    holdBehavior: "The type holds still like a title card rather than chasing constant kinetic energy.",
    exitBehavior: "The frame clears quickly so the next beat can inherit momentum cleanly.",
    antiRepeatBudget: {
      maxSequentialUses: 1,
      maxUsesInWindow: 2,
      windowSize: 5
    },
    cooldownRules: {
      minChunksBetweenUses: 2,
      minChunksBetweenVisualFamily: 2
    },
    sceneCompatibilityHints: {
      surfaceTones: ["dark", "neutral"],
      energy: ["medium", "high"],
      motionTiers: ["premium", "hero"],
      captionBiases: ["middle", "top"],
      semanticIntents: ["name-callout", "punch-emphasis", "default"]
    },
    renderComplexityHints: {
      motionDensity: "measured",
      gpuCost: "medium",
      wordTimedEmphasis: true
    }
  }),
  createTreatment({
    id: "playfair-aperture",
    visualFamily: "aperture-editorial",
    semanticTags: ["headline", "transition", "hook", "focus"],
    moodTags: ["editorial", "dramatic", "cinematic"],
    pacingProfile: ["medium"],
    fontProfile: "playfair-contrast",
    fallbackFontProfile: "fraunces-editorial",
    casePolicy: "title",
    trackingRules: {
      base: "-0.018em",
      uppercase: "0.032em",
      emphasis: "-0.024em",
      support: "0.05em"
    },
    lineHeightRules: {
      base: 0.9,
      compact: 0.84,
      relaxed: 1
    },
    lineBreakBehavior: "balanced",
    compositionRules: {
      placement: "center",
      align: "center",
      maxLines: 2,
      maxWidthCh: 24,
      supportLeadIn: true
    },
    captionLengthConstraints: {
      minWords: 2,
      maxWords: 6,
      maxChars: 34,
      preferredWordRange: [2, 4],
      preferredCharRange: [8, 24]
    },
    emphasisRules: {
      maxWords: 2,
      italicizeEmphasis: true,
      isolateKeywords: true,
      allowSupportLine: true
    },
    motionGrammar: {
      unit: "line",
      entry: phase(500, 48, 0, "standard", [
        {id: "masked-reveal", intensity: 0.42, axis: "x", direction: "forward"},
        {id: "split-reveal", intensity: 0.22, axis: "y", direction: "forward"}
      ]),
      hold: {
        focusIsolation: "keyword-spotlight",
        idleScale: 1,
        activeScale: 1.022,
        nonFocusOpacity: 0.7,
        emphasisPulse: 0.05
      },
      exit: phase(230, 24, 0, "soft", [
        {id: "directional-wipe", intensity: 0.16, axis: "x", direction: "backward"}
      ]),
      continuity: {
        preferredBridgeIds: ["noto-monument", "editorial-bridge"],
        sameFamilyDamping: 0.7,
        shortGapBoost: 0.12
      }
    },
    entryBehavior: "The composition opens like an aperture, revealing line groups rather than noisy individual words.",
    holdBehavior: "Emphasis feels optically closer while support text stays stable and calm.",
    exitBehavior: "A narrow side wipe preserves continuity into the next caption beat.",
    antiRepeatBudget: {
      maxSequentialUses: 1,
      maxUsesInWindow: 2,
      windowSize: 5
    },
    cooldownRules: {
      minChunksBetweenUses: 1,
      minChunksBetweenVisualFamily: 1
    },
    sceneCompatibilityHints: {
      surfaceTones: ["dark", "neutral", "light"],
      energy: ["medium", "high"],
      motionTiers: ["editorial", "premium", "hero"],
      captionBiases: ["middle", "top"],
      semanticIntents: ["default", "punch-emphasis"]
    },
    renderComplexityHints: {
      motionDensity: "measured",
      gpuCost: "medium",
      wordTimedEmphasis: true
    }
  }),
  createTreatment({
    id: "precision-directive",
    visualFamily: "precision-sans",
    semanticTags: ["subtitle", "directive", "tech", "keyword"],
    moodTags: ["tech", "cinematic", "restrained"],
    pacingProfile: ["fast", "medium"],
    fontProfile: "dm-sans-core",
    fallbackFontProfile: "fraunces-editorial",
    casePolicy: "sentence",
    trackingRules: {
      base: "-0.016em",
      uppercase: "0.03em",
      emphasis: "-0.01em",
      support: "0.045em"
    },
    lineHeightRules: {
      base: 0.96,
      compact: 0.9,
      relaxed: 1.04
    },
    lineBreakBehavior: "staggered-pair",
    compositionRules: {
      placement: "lower-middle",
      align: "center",
      maxLines: 3,
      maxWidthCh: 24,
      supportLeadIn: false
    },
    captionLengthConstraints: {
      minWords: 2,
      maxWords: 8,
      maxChars: 44,
      preferredWordRange: [3, 7],
      preferredCharRange: [12, 32]
    },
    emphasisRules: {
      maxWords: 2,
      italicizeEmphasis: true,
      isolateKeywords: true,
      allowSupportLine: false
    },
    motionGrammar: {
      unit: "word",
      entry: phase(360, 24, 18, "crisp", [
        {id: "directional-wipe", intensity: 0.38, axis: "x", direction: "forward"},
        {id: "split-reveal", intensity: 0.18, axis: "y", direction: "forward"}
      ]),
      hold: {
        focusIsolation: "soft-dim",
        idleScale: 1,
        activeScale: 1.04,
        nonFocusOpacity: 0.7,
        emphasisPulse: 0.08
      },
      exit: phase(200, 10, 10, "standard", [
        {id: "blur-resolve", intensity: 0.12}
      ]),
      continuity: {
        preferredBridgeIds: ["editorial-bridge", "noto-monument"],
        sameFamilyDamping: 0.74,
        shortGapBoost: 0.18
      }
    },
    entryBehavior: "Words land cleanly and fast, with directional control but no social-template bounce.",
    holdBehavior: "Acoustic emphasis is carried through active word timing and restrained micro-pulse.",
    exitBehavior: "The phrase clears almost invisibly so pacing stays tight.",
    antiRepeatBudget: {
      maxSequentialUses: 1,
      maxUsesInWindow: 3,
      windowSize: 6
    },
    cooldownRules: {
      minChunksBetweenUses: 1,
      minChunksBetweenVisualFamily: 1
    },
    sceneCompatibilityHints: {
      surfaceTones: ["dark", "neutral", "light"],
      energy: ["medium", "high"],
      motionTiers: ["minimal", "editorial", "premium", "hero"],
      captionBiases: ["middle", "bottom"],
      semanticIntents: ["default", "punch-emphasis"]
    },
    renderComplexityHints: {
      motionDensity: "measured",
      gpuCost: "low",
      wordTimedEmphasis: true
    }
  }),
  createTreatment({
    id: "crimson-echo",
    visualFamily: "documentary-echo",
    semanticTags: ["quote", "subtitle", "bridge", "reflection"],
    moodTags: ["documentary", "emotional", "restrained"],
    pacingProfile: ["slow", "medium"],
    fontProfile: "crimson-voice",
    fallbackFontProfile: "lora-documentary",
    casePolicy: "sentence",
    trackingRules: {
      base: "-0.014em",
      uppercase: "0.022em",
      emphasis: "-0.02em",
      support: "0.04em"
    },
    lineHeightRules: {
      base: 0.96,
      compact: 0.9,
      relaxed: 1.06
    },
    lineBreakBehavior: "balanced",
    compositionRules: {
      placement: "center",
      align: "center",
      maxLines: 2,
      maxWidthCh: 26,
      supportLeadIn: false
    },
    captionLengthConstraints: {
      minWords: 2,
      maxWords: 8,
      maxChars: 46,
      preferredWordRange: [3, 6],
      preferredCharRange: [14, 36]
    },
    emphasisRules: {
      maxWords: 2,
      italicizeEmphasis: true,
      isolateKeywords: false,
      allowSupportLine: false
    },
    motionGrammar: {
      unit: "line",
      entry: phase(560, 52, 0, "slow", [
        {id: "blur-resolve", intensity: 0.38},
        {id: "masked-reveal", intensity: 0.18, axis: "y", direction: "forward"}
      ]),
      hold: {
        focusIsolation: "soft-dim",
        idleScale: 1,
        activeScale: 1.02,
        nonFocusOpacity: 0.78,
        emphasisPulse: 0.03
      },
      exit: phase(260, 18, 0, "soft", [
        {id: "blur-resolve", intensity: 0.18}
      ]),
      continuity: {
        preferredBridgeIds: ["fraunces-pullquote", "editorial-bridge"],
        sameFamilyDamping: 0.7,
        shortGapBoost: 0.12
      }
    },
    entryBehavior: "A quiet blur resolve brings the whole line into place like a lens finding the right plane.",
    holdBehavior: "The composition stays nearly still and lets timing, pacing, and italic emphasis carry the drama.",
    exitBehavior: "A late dissolve clears the space with minimal typographic noise.",
    antiRepeatBudget: {
      maxSequentialUses: 1,
      maxUsesInWindow: 2,
      windowSize: 6
    },
    cooldownRules: {
      minChunksBetweenUses: 2,
      minChunksBetweenVisualFamily: 1
    },
    sceneCompatibilityHints: {
      surfaceTones: ["dark", "neutral", "light"],
      energy: ["low", "medium"],
      motionTiers: ["minimal", "editorial", "premium"],
      captionBiases: ["middle", "bottom"],
      semanticIntents: ["default"]
    },
    renderComplexityHints: {
      motionDensity: "restrained",
      gpuCost: "low",
      wordTimedEmphasis: true
    }
  })
];

export const CINEMATIC_TREATMENT_MAP = new Map(CINEMATIC_TREATMENTS.map((treatment) => [treatment.id, treatment]));
