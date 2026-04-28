import type {CreativeTreatment} from "./types";

export const RHETORICAL_PURPOSES = [
  "authority",
  "proof",
  "emotional-punch",
  "curiosity",
  "escalation",
  "tension",
  "payoff",
  "transformative",
  "urgency",
  "luxury-premium",
  "trust",
  "aspiration",
  "education",
  "motivation",
  "objection-handling",
  "resolution",
  "contrast"
] as const;

export const EMOTIONAL_SPINES = [
  "calm",
  "tension",
  "urgency",
  "authority",
  "aspiration",
  "trust",
  "luxury",
  "vulnerability",
  "excitement",
  "confidence",
  "surprise",
  "desire"
] as const;

export const DEFAULT_SCORING_WEIGHTS = {
  readability: 0.12,
  semanticAlignment: 0.08,
  rhetoricalAlignment: 0.09,
  emotionalAlignment: 0.08,
  premiumFeel: 0.08,
  elegance: 0.08,
  nonRepetition: 0.06,
  novelty: 0.05,
  breathingRoom: 0.07,
  visualHierarchy: 0.08,
  renderability: 0.07,
  timingAlignment: 0.05,
  retentionPotential: 0.06,
  creatorStyleAdherence: 0.06,
  humanMadeFeel: 0.05,
  sequenceContrast: 0.06,
  escalationFit: 0.05,
  surprisePreservation: 0.05,
  pacingVariation: 0.04,
  restraintBalance: 0.05,
  emotionalProgression: 0.05,
  climaxBudget: 0.05,
  noveltyAcrossSequence: 0.04,
  clutterPenalty: 0.1,
  repetitionPenalty: 0.12
} as const;

export const DEFAULT_SAFE_ZONES = ["center", "top-safe", "bottom-safe"] as const;

export const DEFAULT_ALLOWED_EFFECTS = ["underline", "scale", "contrast"] as const;

export const TREATMENT_TO_FINAL_TREATMENT: Record<string, CreativeTreatment> = {
  "safe-premium": "caption-only",
  "expressive-premium": "keyword-emphasis",
  "luxury-minimal": "caption-only",
  "high-authority": "title-card",
  "emotional-cinematic": "behind-speaker-depth",
  "educational-prestige": "asset-supported",
  "aggressive-conversion": "asset-led",
  "elegant-founder-brand": "background-overlay",
  "high-contrast-experimental": "cinematic-transition"
};

export const RETRIEVAL_LIBRARY_PRIORITY = [
  "asset-memory-library",
  "motion-library",
  "typography-library",
  "premium-reference-library",
  "matte-treatment-library",
  "gsap-library",
  "showcase-library"
] as const;

export const MAX_ACTIVE_FOCAL_ELEMENTS = 4;
export const BUSY_FRAME_THRESHOLD = 0.72;
export const WEAK_MATTE_THRESHOLD = 0.58;
export const LONG_INFORMATIONAL_COPY_WORDS = 10;
export const DEFAULT_SEQUENCE_LOOKBACK_WINDOW = 3;
