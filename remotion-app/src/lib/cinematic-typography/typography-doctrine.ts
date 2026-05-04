import type {FontCategory} from "./font-system";

export const TYPOGRAPHY_ROLE_SLOT_IDS = [
  "hero_serif_primary",
  "hero_serif_alternate",
  "editorial_serif_support",
  "neutral_sans_core",
  "script_accent_rare",
  "display_sans_pressure_release"
] as const;

export type TypographyRoleSlotId = (typeof TYPOGRAPHY_ROLE_SLOT_IDS)[number];

export type TypographyCandidateStage = "benchmark" | "candidate" | "approved" | "legacy" | "rejected";
export type TypographyMotionTolerance = "low" | "medium" | "high";
export type TypographyIntensityBand = "low" | "medium" | "high";

export type TypographyRoleSlot = {
  id: TypographyRoleSlotId;
  label: string;
  purpose: string;
  allowedCategories: FontCategory[];
  usageContexts: string[];
  restrictions: string[];
  targetCount: number;
  primaryForSystem: boolean;
};

export type TypographyFontCandidate = {
  id: string;
  name: string;
  source: "current-system" | "reference-pool" | "external-target";
  stage: TypographyCandidateStage;
  categories: FontCategory[];
  eligibleRoles: TypographyRoleSlotId[];
  benchmarkForRole?: TypographyRoleSlotId;
  motionTolerance: TypographyMotionTolerance;
  premiumSignal: number;
  restraintSignal: number;
  intensityFit: TypographyIntensityBand[];
  notes: string[];
};

export type TypographyDoctrine = {
  version: string;
  doctrineStatement: string;
  operatingRules: string[];
  roleSlots: TypographyRoleSlot[];
  candidates: TypographyFontCandidate[];
};

export const TYPOGRAPHY_ROLE_SLOTS: TypographyRoleSlot[] = [
  {
    id: "hero_serif_primary",
    label: "Hero Serif Primary",
    purpose: "The main benchmark face for prestige openings, thesis moments, and dominant cinematic title statements.",
    allowedCategories: ["display-serif"],
    usageContexts: ["opening title", "hero payoff", "premium thesis", "monumental statement"],
    restrictions: [
      "Must remain rare and intentional.",
      "Cannot be used as default subtitle copy.",
      "Every alternate hero serif must justify existing next to this benchmark."
    ],
    targetCount: 1,
    primaryForSystem: true
  },
  {
    id: "hero_serif_alternate",
    label: "Hero Serif Alternate",
    purpose: "A secondary high-prestige serif used to create controlled variation without breaking identity.",
    allowedCategories: ["display-serif"],
    usageContexts: ["secondary hero", "luxury quote", "contrast headline"],
    restrictions: [
      "Must not collapse into the same silhouette as the primary benchmark.",
      "Should appear less often than the primary hero serif."
    ],
    targetCount: 1,
    primaryForSystem: false
  },
  {
    id: "editorial_serif_support",
    label: "Editorial Serif Support",
    purpose: "Supportive serif voice for quotes, documentary authority, and restrained editorial subheads.",
    allowedCategories: ["display-serif"],
    usageContexts: ["quote", "support headline", "documentary support", "editorial helper"],
    restrictions: [
      "Cannot overpower the hero serif tier.",
      "Should favor readability and cadence over spectacle."
    ],
    targetCount: 1,
    primaryForSystem: false
  },
  {
    id: "neutral_sans_core",
    label: "Neutral Sans Core",
    purpose: "Single neutral sans spine for UI, counters, sidecalls, captions, utility overlays, and all support information.",
    allowedCategories: ["neutral-sans"],
    usageContexts: ["ui", "support", "counter", "caption utility", "data overlay"],
    restrictions: [
      "This role should be singular.",
      "No second neutral sans should compete in active runtime use."
    ],
    targetCount: 1,
    primaryForSystem: true
  },
  {
    id: "script_accent_rare",
    label: "Script Accent Rare",
    purpose: "Rare accent handwriting for isolated luxury words and deliberate softness, never for routine structure.",
    allowedCategories: ["script", "decorative"],
    usageContexts: ["single accent word", "rare luxury pass", "editorial flourish"],
    restrictions: [
      "Never body copy.",
      "Never frequent enough to become a recognizable default."
    ],
    targetCount: 1,
    primaryForSystem: false
  },
  {
    id: "display_sans_pressure_release",
    label: "Display Sans Pressure Release",
    purpose: "A controlled non-default forceful display slot for urgency, directive contrast, and occasional structural pressure release.",
    allowedCategories: ["display-sans", "decorative"],
    usageContexts: ["aggressive punchline", "directive card", "pressure-release contrast"],
    restrictions: [
      "Must never become the default hero language again.",
      "Only useful when serif-led authority needs a harder counterweight."
    ],
    targetCount: 1,
    primaryForSystem: false
  }
];

export const TYPOGRAPHY_DOCTRINE_V1: TypographyDoctrine = {
  version: "v1",
  doctrineStatement: "Prometheus typography is serif-led, role-restricted, and sequence-aware. Variation is allowed only inside a premium constrained taste system.",
  operatingRules: [
    "Typography starts from rhetorical role before pairwise compatibility.",
    "The system optimizes for restriction, not maximum font count.",
    "Hero serif identity is benchmarked against Jugendreisen until a stronger house benchmark exists.",
    "Neutral sans support is singular and stable.",
    "Scripts and decorative faces are accent tools, not structural defaults.",
    "Display sans is a pressure-release mechanism, not the house voice."
  ],
  roleSlots: TYPOGRAPHY_ROLE_SLOTS,
  candidates: [
    {
      id: "jugendreisen",
      name: "Jugendreisen",
      source: "reference-pool",
      stage: "benchmark",
      categories: ["display-serif"],
      eligibleRoles: ["hero_serif_primary"],
      benchmarkForRole: "hero_serif_primary",
      motionTolerance: "medium",
      premiumSignal: 0.98,
      restraintSignal: 0.9,
      intensityFit: ["medium", "high"],
      notes: [
        "Primary benchmark for hero serif taste.",
        "High-contrast prestige with strong identity.",
        "Future hero candidates must beat or complement this benchmark, not merely resemble it.",
        "Not a general alternate lane fallback."
      ]
    },
    {
      id: "louize",
      name: "Louize",
      source: "reference-pool",
      stage: "candidate",
      categories: ["display-serif"],
      eligibleRoles: ["hero_serif_alternate"],
      benchmarkForRole: "hero_serif_alternate",
      motionTolerance: "medium",
      premiumSignal: 0.9,
      restraintSignal: 0.84,
      intensityFit: ["low", "medium"],
      notes: [
        "Benchmark candidate for the alternate hero serif role.",
        "The soft counterpoint to Jugendreisen.",
        "No longer dual-purposed as a routine editorial support default."
      ]
    },
    {
      id: "noto-serif-display",
      name: "Noto Serif Display",
      source: "current-system",
      stage: "candidate",
      categories: ["display-serif"],
      eligibleRoles: ["hero_serif_alternate"],
      motionTolerance: "medium",
      premiumSignal: 0.82,
      restraintSignal: 0.8,
      intensityFit: ["high"],
      notes: [
        "Current-system monument serif challenger.",
        "Statement-only challenger for monumental title-card situations.",
        "Not a general alternate hero serif."
      ]
    },
    {
      id: "playfair-display",
      name: "Playfair Display",
      source: "current-system",
      stage: "candidate",
      categories: ["display-serif"],
      eligibleRoles: ["editorial_serif_support"],
      motionTolerance: "medium",
      premiumSignal: 0.8,
      restraintSignal: 0.76,
      intensityFit: ["low", "medium"],
      notes: [
        "Fallback editorial serif challenger.",
        "Removed from the hero-alternate lane to avoid prestige redundancy with Louize and Jugendreisen."
      ]
    },
    {
      id: "cormorant-garamond",
      name: "Cormorant Garamond",
      source: "current-system",
      stage: "legacy",
      categories: ["display-serif"],
      eligibleRoles: ["editorial_serif_support"],
      motionTolerance: "medium",
      premiumSignal: 0.68,
      restraintSignal: 0.74,
      intensityFit: ["low", "medium"],
      notes: [
        "Legacy fallback support serif.",
        "Demoted out of premium core contention so editorial support can stay cleaner and more disciplined.",
        "Emergency fallback only, not a preferred live support choice."
      ]
    },
    {
      id: "fraunces",
      name: "Fraunces",
      source: "current-system",
      stage: "candidate",
      categories: ["display-serif"],
      eligibleRoles: ["editorial_serif_support"],
      benchmarkForRole: "editorial_serif_support",
      motionTolerance: "high",
      premiumSignal: 0.84,
      restraintSignal: 0.82,
      intensityFit: ["low", "medium"],
      notes: [
        "Benchmark candidate for editorial serif support.",
        "Very useful for editorial support and cinematic warmth.",
        "Locked to support duty so Louize can own the alternate hero lane."
      ]
    },
    {
      id: "crimson-pro",
      name: "Crimson Pro",
      source: "current-system",
      stage: "candidate",
      categories: ["display-serif"],
      eligibleRoles: ["editorial_serif_support"],
      motionTolerance: "high",
      premiumSignal: 0.73,
      restraintSignal: 0.9,
      intensityFit: ["low", "medium"],
      notes: [
        "Primary documentary-support challenger under Fraunces.",
        "Best used when the scene needs authority, humanity, and lower visual temperature than the benchmark support serif."
      ]
    },
    {
      id: "instrument-serif",
      name: "Instrument Serif",
      source: "current-system",
      stage: "candidate",
      categories: ["display-serif"],
      eligibleRoles: ["editorial_serif_support"],
      motionTolerance: "medium",
      premiumSignal: 0.78,
      restraintSignal: 0.83,
      intensityFit: ["low", "medium"],
      notes: [
        "Soft luxury support challenger only.",
        "Demoted out of the hero-alternate lane so it cannot compete with Louize for prestige identity.",
        "Useful when editorial support needs hush, softness, and less documentary weight than Crimson Pro."
      ]
    },
    {
      id: "dm-sans",
      name: "DM Sans",
      source: "current-system",
      stage: "approved",
      categories: ["neutral-sans"],
      eligibleRoles: ["neutral_sans_core"],
      benchmarkForRole: "neutral_sans_core",
      motionTolerance: "high",
      premiumSignal: 0.72,
      restraintSignal: 0.95,
      intensityFit: ["low", "medium", "high"],
      notes: [
        "Chosen singular neutral sans spine.",
        "Carries UI, counters, overlays, captions, and utility text."
      ]
    },
    {
      id: "ivar-script",
      name: "Ivar Script",
      source: "reference-pool",
      stage: "candidate",
      categories: ["script"],
      eligibleRoles: ["script_accent_rare"],
      benchmarkForRole: "script_accent_rare",
      motionTolerance: "low",
      premiumSignal: 0.94,
      restraintSignal: 0.7,
      intensityFit: ["low", "medium"],
      notes: [
        "Benchmark candidate for the rare script accent role.",
        "Should only survive if it behaves well in very short isolated moments."
      ]
    },
    {
      id: "bs-acapulko",
      name: "BS Acapulko",
      source: "reference-pool",
      stage: "candidate",
      categories: ["script"],
      eligibleRoles: ["script_accent_rare"],
      motionTolerance: "low",
      premiumSignal: 0.88,
      restraintSignal: 0.66,
      intensityFit: ["low", "medium"],
      notes: [
        "Challenger to Ivar Script for the rare accent slot.",
        "Stylish accent candidate, but risks becoming noisy if overused."
      ]
    },
    {
      id: "sokoli",
      name: "Sokoli",
      source: "reference-pool",
      stage: "candidate",
      categories: ["decorative"],
      eligibleRoles: ["display_sans_pressure_release"],
      motionTolerance: "medium",
      premiumSignal: 0.79,
      restraintSignal: 0.58,
      intensityFit: ["medium", "high"],
      notes: [
        "Could become a pressure-release face if it earns a very narrow directive role."
      ]
    },
    {
      id: "anton",
      name: "Anton",
      source: "current-system",
      stage: "legacy",
      categories: ["display-sans"],
      eligibleRoles: ["display_sans_pressure_release"],
      motionTolerance: "high",
      premiumSignal: 0.46,
      restraintSignal: 0.35,
      intensityFit: ["medium", "high"],
      notes: [
        "Legacy pressure font.",
        "Only survives if a harder commercial/directive lane truly needs it."
      ]
    },
    {
      id: "bebas-neue",
      name: "Bebas Neue",
      source: "current-system",
      stage: "legacy",
      categories: ["display-sans"],
      eligibleRoles: ["display_sans_pressure_release"],
      motionTolerance: "high",
      premiumSignal: 0.38,
      restraintSignal: 0.28,
      intensityFit: ["medium", "high"],
      notes: [
        "The old default hero language.",
        "Now explicitly demoted out of the main house voice."
      ]
    }
  ]
};

export const getTypographyRoleSlot = (roleId: TypographyRoleSlotId): TypographyRoleSlot => {
  return TYPOGRAPHY_DOCTRINE_V1.roleSlots.find((role) => role.id === roleId) ?? TYPOGRAPHY_DOCTRINE_V1.roleSlots[0];
};

export const getTypographyCandidatesForRole = (roleId: TypographyRoleSlotId): TypographyFontCandidate[] => {
  return TYPOGRAPHY_DOCTRINE_V1.candidates.filter((candidate) => candidate.eligibleRoles.includes(roleId));
};

export const getTypographyBenchmarkForRole = (roleId: TypographyRoleSlotId): TypographyFontCandidate | null => {
  return TYPOGRAPHY_DOCTRINE_V1.candidates.find((candidate) => candidate.benchmarkForRole === roleId) ?? null;
};
