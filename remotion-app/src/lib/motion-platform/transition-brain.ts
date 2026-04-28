import type {CaptionChunk, MotionTier} from "../types";

export type TransitionBrainProfileId =
  | "light-glitch"
  | "digital-glitch"
  | "film-burn"
  | "light-leak"
  | "seamless-zoom"
  | "point-mask"
  | "texture-reveal"
  | "relief-wipe"
  | "directional-wipe"
  | "l-cut"
  | "j-cut";

export type TransitionBrainCategory =
  | "glitch"
  | "organic-light"
  | "camera-mask"
  | "texture"
  | "wipe"
  | "audio-bridge";

export type TransitionBrainImplementationMode =
  | "overlay-only"
  | "overlay-plus-mask"
  | "camera-assisted"
  | "audio-bridge";

export type TransitionBrainAssetDependency = "none" | "optional" | "preferred";
export type TransitionBoundarySafety = "unsafe" | "guarded" | "clear";
export type TransitionBrainActivationStatus = "dormant";
export type TransitionAudioProtectionMode = "none" | "l-cut" | "j-cut";

export type TransitionBrainProfile = {
  id: TransitionBrainProfileId;
  label: string;
  category: TransitionBrainCategory;
  activationStatus: TransitionBrainActivationStatus;
  implementationMode: TransitionBrainImplementationMode;
  majorVisual: boolean;
  overlayFirst: boolean;
  assetDependency: TransitionBrainAssetDependency;
  allowedTiers: MotionTier[];
  minimumGapMs: number;
  preferredGapMs: number;
  maxContinuationRisk: number;
  recommendedDurationMs: number;
  captionSafeOpacityCap: number;
  assetSearchTerms: string[];
  recipeNotes: string[];
};

export type TransitionBoundaryAnalysis = {
  id: string;
  previousChunkId: string;
  nextChunkId: string;
  gapMs: number;
  endsSentence: boolean;
  endsBridgeWord: boolean;
  startsContinuationWord: boolean;
  continuationRisk: number;
  safety: TransitionBoundarySafety;
  recommendedAudioProtection: TransitionAudioProtectionMode;
  reasons: string[];
};

export type TransitionBrainCandidate = {
  profileId: TransitionBrainProfileId;
  score: number;
  blocked: boolean;
  reasons: string[];
};

export type TransitionBrainDecision = {
  boundaryId: string;
  previousChunkId: string;
  nextChunkId: string;
  profileId: TransitionBrainProfileId;
  activationStatus: TransitionBrainActivationStatus;
  implementationMode: TransitionBrainImplementationMode;
  majorVisual: boolean;
  overlayFirst: boolean;
  score: number;
  audioProtection: TransitionAudioProtectionMode;
  startMs: number;
  pivotMs: number;
  endMs: number;
  reasons: string[];
  alternates: TransitionBrainProfileId[];
  downgradedFromProfileId?: TransitionBrainProfileId;
};

export type TransitionBrainPlan = {
  activationStatus: TransitionBrainActivationStatus;
  tier: MotionTier;
  totalDurationMs: number;
  majorVisualBudget: number;
  majorVisualCount: number;
  boundaries: TransitionBoundaryAnalysis[];
  decisions: TransitionBrainDecision[];
  notes: string[];
};

const transitionProfile = (profile: TransitionBrainProfile): TransitionBrainProfile => profile;

const STRONG_STOP_PATTERN = /[.!?]["')\]]?$/;
const BRIDGE_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "but",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "their",
  "then",
  "this",
  "to",
  "was",
  "were",
  "with",
  "your"
]);
const CONTINUATION_WORDS = new Set([
  "and",
  "because",
  "but",
  "for",
  "if",
  "into",
  "is",
  "or",
  "so",
  "that",
  "then",
  "to",
  "when",
  "where",
  "while",
  "with"
]);

const DENSITY_PER_MINUTE: Record<MotionTier, number> = {
  minimal: 0.75,
  editorial: 1.15,
  premium: 1.5,
  hero: 1.9
};

const MIN_MAJOR_VISUAL_SPACING_MS = 7000;

export const transitionBrainProfiles: TransitionBrainProfile[] = [
  transitionProfile({
    id: "light-glitch",
    label: "Light Glitch",
    category: "glitch",
    activationStatus: "dormant",
    implementationMode: "overlay-only",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "optional",
    allowedTiers: ["editorial", "premium", "hero"],
    minimumGapMs: 220,
    preferredGapMs: 360,
    maxContinuationRisk: 38,
    recommendedDurationMs: 260,
    captionSafeOpacityCap: 0.08,
    assetSearchTerms: ["light streak", "flash frame", "soft glitch"],
    recipeNotes: [
      "Screen-blend white streaks plus short RGB split pulses.",
      "Keep opacity below caption-safe cap and never hard-cut dialog."
    ]
  }),
  transitionProfile({
    id: "digital-glitch",
    label: "Digital Glitch",
    category: "glitch",
    activationStatus: "dormant",
    implementationMode: "overlay-only",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "optional",
    allowedTiers: ["editorial", "premium", "hero"],
    minimumGapMs: 240,
    preferredGapMs: 400,
    maxContinuationRisk: 34,
    recommendedDurationMs: 240,
    captionSafeOpacityCap: 0.07,
    assetSearchTerms: ["rgb split", "digital interference", "scanline glitch"],
    recipeNotes: [
      "Use frame-skipping, channel offsets, and displacement masks as overlays.",
      "Reserve for emphatic beats, not fragile phrase handoffs."
    ]
  }),
  transitionProfile({
    id: "film-burn",
    label: "Film Burn",
    category: "organic-light",
    activationStatus: "dormant",
    implementationMode: "overlay-only",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "preferred",
    allowedTiers: ["editorial", "premium", "hero"],
    minimumGapMs: 420,
    preferredGapMs: 620,
    maxContinuationRisk: 26,
    recommendedDurationMs: 520,
    captionSafeOpacityCap: 0.06,
    assetSearchTerms: ["film burn overlay", "organic burn", "celluloid light leak"],
    recipeNotes: [
      "Best as additive or screen overlay with warm edge bloom.",
      "Treat as a soft passage marker, never a speech interrupt."
    ]
  }),
  transitionProfile({
    id: "light-leak",
    label: "Light Leak",
    category: "organic-light",
    activationStatus: "dormant",
    implementationMode: "overlay-only",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "preferred",
    allowedTiers: ["minimal", "editorial", "premium", "hero"],
    minimumGapMs: 320,
    preferredGapMs: 520,
    maxContinuationRisk: 28,
    recommendedDurationMs: 460,
    captionSafeOpacityCap: 0.06,
    assetSearchTerms: ["light leak", "lens flare wash", "warm leak overlay"],
    recipeNotes: [
      "Screen-blend leak with animated feathered vignette.",
      "Use when visual energy should rise without a destructive cut."
    ]
  }),
  transitionProfile({
    id: "seamless-zoom",
    label: "Seamless Zoom",
    category: "camera-mask",
    activationStatus: "dormant",
    implementationMode: "camera-assisted",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "none",
    allowedTiers: ["minimal", "editorial", "premium", "hero"],
    minimumGapMs: 180,
    preferredGapMs: 300,
    maxContinuationRisk: 40,
    recommendedDurationMs: 320,
    captionSafeOpacityCap: 0.04,
    assetSearchTerms: [],
    recipeNotes: [
      "Drive with camera scale and positional masking rather than re-encoding source media.",
      "Good for callouts, punch lines, and controlled visual acceleration."
    ]
  }),
  transitionProfile({
    id: "point-mask",
    label: "Point Mask",
    category: "camera-mask",
    activationStatus: "dormant",
    implementationMode: "overlay-plus-mask",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "optional",
    allowedTiers: ["editorial", "premium", "hero"],
    minimumGapMs: 240,
    preferredGapMs: 360,
    maxContinuationRisk: 36,
    recommendedDurationMs: 340,
    captionSafeOpacityCap: 0.05,
    assetSearchTerms: ["matte mask", "radial wipe", "focus iris"],
    recipeNotes: [
      "Use tracked point masks or procedural radial masks around the area of emphasis.",
      "Keep the reveal away from active caption safe zones."
    ]
  }),
  transitionProfile({
    id: "texture-reveal",
    label: "Texture Reveal",
    category: "texture",
    activationStatus: "dormant",
    implementationMode: "overlay-only",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "preferred",
    allowedTiers: ["editorial", "premium", "hero"],
    minimumGapMs: 360,
    preferredGapMs: 520,
    maxContinuationRisk: 30,
    recommendedDurationMs: 420,
    captionSafeOpacityCap: 0.06,
    assetSearchTerms: ["paper texture", "dust texture", "grit overlay"],
    recipeNotes: [
      "Use luma or grain textures to reveal the next beat without a hard splice.",
      "Best on editorial transitions and pacing resets."
    ]
  }),
  transitionProfile({
    id: "relief-wipe",
    label: "Relief Wipe",
    category: "wipe",
    activationStatus: "dormant",
    implementationMode: "overlay-plus-mask",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "optional",
    allowedTiers: ["editorial", "premium", "hero"],
    minimumGapMs: 260,
    preferredGapMs: 420,
    maxContinuationRisk: 34,
    recommendedDurationMs: 360,
    captionSafeOpacityCap: 0.05,
    assetSearchTerms: ["emboss map", "depth wipe", "relief matte"],
    recipeNotes: [
      "Treat this as a depth-based wipe with gentle highlight relief, not a flat page turn.",
      "Pair with low-opacity texture for cinematic lift."
    ]
  }),
  transitionProfile({
    id: "directional-wipe",
    label: "Directional Wipe",
    category: "wipe",
    activationStatus: "dormant",
    implementationMode: "overlay-plus-mask",
    majorVisual: true,
    overlayFirst: true,
    assetDependency: "none",
    allowedTiers: ["minimal", "editorial", "premium", "hero"],
    minimumGapMs: 220,
    preferredGapMs: 340,
    maxContinuationRisk: 32,
    recommendedDurationMs: 280,
    captionSafeOpacityCap: 0.05,
    assetSearchTerms: [],
    recipeNotes: [
      "This is the clean fallback wipe when nothing flashier is justified.",
      "Implement with clip-path or matte masks, not destructive media edits."
    ]
  }),
  transitionProfile({
    id: "l-cut",
    label: "L-Cut",
    category: "audio-bridge",
    activationStatus: "dormant",
    implementationMode: "audio-bridge",
    majorVisual: false,
    overlayFirst: true,
    assetDependency: "none",
    allowedTiers: ["minimal", "editorial", "premium", "hero"],
    minimumGapMs: -120,
    preferredGapMs: 80,
    maxContinuationRisk: 100,
    recommendedDurationMs: 220,
    captionSafeOpacityCap: 0,
    assetSearchTerms: [],
    recipeNotes: [
      "Let outgoing speech finish over the incoming visual so phrases are not clipped.",
      "This is the defensive transition for fragile statement continuity."
    ]
  }),
  transitionProfile({
    id: "j-cut",
    label: "J-Cut",
    category: "audio-bridge",
    activationStatus: "dormant",
    implementationMode: "audio-bridge",
    majorVisual: false,
    overlayFirst: true,
    assetDependency: "none",
    allowedTiers: ["minimal", "editorial", "premium", "hero"],
    minimumGapMs: -120,
    preferredGapMs: 80,
    maxContinuationRisk: 100,
    recommendedDurationMs: 220,
    captionSafeOpacityCap: 0,
    assetSearchTerms: [],
    recipeNotes: [
      "Let incoming speech arrive early to smooth the visual handoff.",
      "Use when the next idea should feel connected before the eye fully changes state."
    ]
  })
];

const profileMap = new Map(transitionBrainProfiles.map((profile) => [profile.id, profile]));

const getWords = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const lastWord = (text: string): string => {
  const words = getWords(text);
  return words.length === 0 ? "" : words[words.length - 1];
};

const firstWord = (text: string): string => {
  const words = getWords(text);
  return words[0] ?? "";
};

const isStrongStop = (text: string): boolean => STRONG_STOP_PATTERN.test(text.trim());

const getContinuationRisk = ({
  previousChunk,
  nextChunk,
  gapMs
}: {
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
  gapMs: number;
}): number => {
  let risk = 0;
  const previousLastWord = lastWord(previousChunk.text);
  const nextFirstWord = firstWord(nextChunk.text);

  if (gapMs < 120) {
    risk += 42;
  } else if (gapMs < 220) {
    risk += 28;
  } else if (gapMs < 380) {
    risk += 12;
  }
  if (!isStrongStop(previousChunk.text)) {
    risk += 20;
  }
  if (BRIDGE_WORDS.has(previousLastWord)) {
    risk += 18;
  }
  if (CONTINUATION_WORDS.has(nextFirstWord)) {
    risk += 14;
  }
  if (previousChunk.words.length <= 2) {
    risk += 8;
  }
  if (nextChunk.words.length <= 2) {
    risk += 6;
  }
  if (previousChunk.semantic?.intent === "punch-emphasis" || nextChunk.semantic?.intent === "punch-emphasis") {
    risk -= 4;
  }

  return clamp(risk, 0, 100);
};

const getRecommendedAudioProtection = ({
  previousChunk,
  nextChunk,
  continuationRisk
}: {
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
  continuationRisk: number;
}): TransitionAudioProtectionMode => {
  if (continuationRisk < 20) {
    return "none";
  }
  if (!isStrongStop(previousChunk.text) || BRIDGE_WORDS.has(lastWord(previousChunk.text))) {
    return "l-cut";
  }
  if (CONTINUATION_WORDS.has(firstWord(nextChunk.text)) || nextChunk.semantic?.intent === "punch-emphasis") {
    return "j-cut";
  }
  return continuationRisk >= 55 ? "l-cut" : "j-cut";
};

export const resolveTransitionBrainProfile = (profileId: TransitionBrainProfileId): TransitionBrainProfile => {
  const profile = profileMap.get(profileId);
  if (!profile) {
    throw new Error(`Unknown transition brain profile: ${profileId}`);
  }
  return profile;
};

export const getTransitionBrainProfiles = (): TransitionBrainProfile[] => transitionBrainProfiles;

export const analyzeTransitionBoundary = ({
  previousChunk,
  nextChunk
}: {
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
}): TransitionBoundaryAnalysis => {
  const gapMs = nextChunk.startMs - previousChunk.endMs;
  const endsSentence = isStrongStop(previousChunk.text);
  const endsBridgeWord = BRIDGE_WORDS.has(lastWord(previousChunk.text));
  const startsContinuationWord = CONTINUATION_WORDS.has(firstWord(nextChunk.text));
  const continuationRisk = getContinuationRisk({
    previousChunk,
    nextChunk,
    gapMs
  });
  const reasons: string[] = [];

  if (gapMs < 120) {
    reasons.push("Very tight handoff window.");
  } else if (gapMs < 300) {
    reasons.push("Limited pause window.");
  } else {
    reasons.push("Usable visual pause window.");
  }
  if (!endsSentence) {
    reasons.push("Previous chunk does not land on strong punctuation.");
  }
  if (endsBridgeWord) {
    reasons.push("Previous chunk ends on a bridge word, so the thought may still be open.");
  }
  if (startsContinuationWord) {
    reasons.push("Next chunk starts like a continuation, not a fresh sentence.");
  }

  const safety: TransitionBoundarySafety = continuationRisk >= 60 || gapMs < 120
    ? "unsafe"
    : continuationRisk >= 32 || gapMs < 320
      ? "guarded"
      : "clear";

  return {
    id: `${previousChunk.id}__${nextChunk.id}`,
    previousChunkId: previousChunk.id,
    nextChunkId: nextChunk.id,
    gapMs,
    endsSentence,
    endsBridgeWord,
    startsContinuationWord,
    continuationRisk,
    safety,
    recommendedAudioProtection: getRecommendedAudioProtection({
      previousChunk,
      nextChunk,
      continuationRisk
    }),
    reasons
  };
};

const scoreProfile = ({
  profile,
  previousChunk,
  nextChunk,
  boundary,
  tier
}: {
  profile: TransitionBrainProfile;
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
  boundary: TransitionBoundaryAnalysis;
  tier: MotionTier;
}): TransitionBrainCandidate => {
  const reasons: string[] = [];
  if (!profile.allowedTiers.includes(tier)) {
    return {
      profileId: profile.id,
      score: 0,
      blocked: true,
      reasons: ["Tier is below this transition's comfort floor."]
    };
  }

  if (profile.majorVisual) {
    if (boundary.gapMs < profile.minimumGapMs) {
      return {
        profileId: profile.id,
        score: 0,
        blocked: true,
        reasons: ["Pause window is too small for a visual transition."]
      };
    }
    if (boundary.continuationRisk > profile.maxContinuationRisk) {
      return {
        profileId: profile.id,
        score: 0,
        blocked: true,
        reasons: ["Phrase continuity risk is too high for this visual treatment."]
      };
    }
  }

  let score = profile.majorVisual ? 46 : 40;
  if (boundary.gapMs >= profile.preferredGapMs) {
    score += 12;
    reasons.push("Boundary has enough breathing room for this treatment.");
  } else if (boundary.gapMs >= profile.minimumGapMs) {
    score += 6;
    reasons.push("Boundary meets the minimum timing window.");
  }

  if (boundary.endsSentence) {
    score += 8;
    reasons.push("Previous chunk closes cleanly.");
  }

  if (profile.id === "light-glitch" || profile.id === "digital-glitch") {
    if (previousChunk.semantic?.intent === "punch-emphasis" || nextChunk.semantic?.intent === "punch-emphasis") {
      score += 18;
      reasons.push("Punch emphasis supports a sharper glitch handoff.");
    }
  }

  if (profile.id === "film-burn" || profile.id === "light-leak") {
    if (boundary.gapMs >= 500 && previousChunk.semantic?.intent !== "punch-emphasis") {
      score += 16;
      reasons.push("Softer pause makes an organic light transition viable.");
    }
  }

  if (profile.id === "seamless-zoom" || profile.id === "point-mask") {
    if (nextChunk.semantic?.intent === "name-callout" || nextChunk.semantic?.intent === "punch-emphasis") {
      score += 16;
      reasons.push("Incoming emphasis is a good anchor for a zoom or point mask.");
    }
  }

  if (profile.id === "texture-reveal" || profile.id === "relief-wipe") {
    if (tier === "editorial" || tier === "premium" || tier === "hero") {
      score += 10;
      reasons.push("Tier supports a more designed editorial transition.");
    }
  }

  if (profile.id === "directional-wipe") {
    score += 8;
    reasons.push("Clean wipe is the safest general-purpose visual fallback.");
  }

  if (profile.id === "l-cut") {
    if (boundary.recommendedAudioProtection === "l-cut") {
      score += 20;
      reasons.push("Outgoing phrase should finish after the eye moves.");
    }
    if (boundary.safety === "unsafe") {
      score += 18;
      reasons.push("Unsafe boundary needs a continuity-first fallback.");
    }
  }

  if (profile.id === "j-cut") {
    if (boundary.recommendedAudioProtection === "j-cut") {
      score += 20;
      reasons.push("Incoming phrase should lead the eye change.");
    }
    if (nextChunk.semantic?.intent === "punch-emphasis") {
      score += 10;
      reasons.push("Early audio entry can sharpen the next beat.");
    }
  }

  score -= Math.round(boundary.continuationRisk * (profile.majorVisual ? 0.35 : 0.08));

  return {
    profileId: profile.id,
    score: clamp(score, 0, 100),
    blocked: false,
    reasons
  };
};

const chooseBoundaryDecision = ({
  previousChunk,
  nextChunk,
  boundary,
  tier
}: {
  previousChunk: CaptionChunk;
  nextChunk: CaptionChunk;
  boundary: TransitionBoundaryAnalysis;
  tier: MotionTier;
}): TransitionBrainDecision => {
  const candidates = transitionBrainProfiles
    .map((profile) => scoreProfile({profile, previousChunk, nextChunk, boundary, tier}))
    .sort((a, b) => b.score - a.score || a.profileId.localeCompare(b.profileId));
  const viable = candidates.filter((candidate) => !candidate.blocked);
  const audioFallbackId = boundary.recommendedAudioProtection === "l-cut" ? "l-cut" : "j-cut";
  const bestVisual = viable.find((candidate) => resolveTransitionBrainProfile(candidate.profileId).majorVisual);
  const bestAudio = viable.find((candidate) => candidate.profileId === audioFallbackId) ??
    viable.find((candidate) => !resolveTransitionBrainProfile(candidate.profileId).majorVisual);

  const selectedCandidate =
    boundary.safety === "unsafe"
      ? bestAudio ?? viable[0]
      : boundary.safety === "guarded" && (bestVisual?.score ?? 0) < 68
        ? bestAudio ?? bestVisual ?? viable[0]
        : bestVisual ?? bestAudio ?? viable[0];
  const selectedProfile = resolveTransitionBrainProfile(selectedCandidate?.profileId ?? audioFallbackId);
  const pivotMs = previousChunk.endMs + Math.max(0, boundary.gapMs / 2);
  const halfDuration = Math.round(selectedProfile.recommendedDurationMs / 2);
  const protectiveLeadMs = boundary.recommendedAudioProtection === "j-cut" ? 120 : 80;
  const protectiveTrailMs = boundary.recommendedAudioProtection === "l-cut" ? 180 : 100;

  return {
    boundaryId: boundary.id,
    previousChunkId: previousChunk.id,
    nextChunkId: nextChunk.id,
    profileId: selectedProfile.id,
    activationStatus: "dormant",
    implementationMode: selectedProfile.implementationMode,
    majorVisual: selectedProfile.majorVisual,
    overlayFirst: selectedProfile.overlayFirst,
    score: selectedCandidate?.score ?? 0,
    audioProtection: selectedProfile.majorVisual
      ? boundary.recommendedAudioProtection
      : (selectedProfile.id === "l-cut" || selectedProfile.id === "j-cut" ? selectedProfile.id : boundary.recommendedAudioProtection),
    startMs: Math.max(previousChunk.startMs, previousChunk.endMs - protectiveLeadMs, pivotMs - halfDuration),
    pivotMs,
    endMs: Math.min(nextChunk.endMs, nextChunk.startMs + protectiveTrailMs, pivotMs + halfDuration),
    reasons: [
      ...boundary.reasons,
      ...(selectedCandidate?.reasons ?? [])
    ],
    alternates: viable
      .map((candidate) => candidate.profileId)
      .filter((profileId) => profileId !== selectedProfile.id)
      .slice(0, 3)
  };
};

const getMajorVisualBudget = ({
  totalDurationMs,
  tier
}: {
  totalDurationMs: number;
  tier: MotionTier;
}): number => {
  const minutes = Math.max(1, totalDurationMs / 60000);
  return Math.max(1, Math.round(minutes * DENSITY_PER_MINUTE[tier]));
};

const applyMajorVisualThrottle = ({
  decisions,
  tier
}: {
  decisions: TransitionBrainDecision[];
  tier: MotionTier;
}): TransitionBrainDecision[] => {
  const totalDurationMs = decisions.length === 0
    ? 0
    : Math.max(...decisions.map((decision) => decision.endMs)) - Math.min(...decisions.map((decision) => decision.startMs));
  const budget = getMajorVisualBudget({
    totalDurationMs,
    tier
  });
  const keepIds = new Set<string>();
  const keptPivots: number[] = [];

  const rankedVisuals = decisions
    .filter((decision) => decision.majorVisual)
    .sort((a, b) => b.score - a.score || a.pivotMs - b.pivotMs);

  rankedVisuals.forEach((decision) => {
    if (keepIds.size >= budget) {
      return;
    }
    const tooClose = keptPivots.some((pivot) => Math.abs(pivot - decision.pivotMs) < MIN_MAJOR_VISUAL_SPACING_MS);
    if (tooClose) {
      return;
    }
    keepIds.add(decision.boundaryId);
    keptPivots.push(decision.pivotMs);
  });

  return decisions.map((decision) => {
    if (!decision.majorVisual || keepIds.has(decision.boundaryId)) {
      return decision;
    }
    const fallbackId = decision.audioProtection === "l-cut" ? "l-cut" : "j-cut";
    const fallbackProfile = resolveTransitionBrainProfile(fallbackId);
    return {
      ...decision,
      profileId: fallbackId,
      implementationMode: fallbackProfile.implementationMode,
      majorVisual: false,
      overlayFirst: true,
      downgradedFromProfileId: decision.profileId,
      reasons: [
        ...decision.reasons,
        "Downgraded to an audio bridge to keep transition density cinematic instead of amateurishly busy."
      ]
    };
  });
};

export const buildTransitionBrainPlan = ({
  chunks,
  tier
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
}): TransitionBrainPlan => {
  if (chunks.length < 2) {
    return {
      activationStatus: "dormant",
      tier,
      totalDurationMs: chunks[0] ? chunks[0].endMs - chunks[0].startMs : 0,
      majorVisualBudget: 0,
      majorVisualCount: 0,
      boundaries: [],
      decisions: [],
      notes: [
        "Transition brain is dormant and not wired into runtime.",
        "At least two chunks are required before a handoff can be planned."
      ]
    };
  }

  const boundaries: TransitionBoundaryAnalysis[] = [];
  const provisionalDecisions: TransitionBrainDecision[] = [];

  for (let index = 0; index < chunks.length - 1; index += 1) {
    const previousChunk = chunks[index];
    const nextChunk = chunks[index + 1];
    const boundary = analyzeTransitionBoundary({
      previousChunk,
      nextChunk
    });
    boundaries.push(boundary);
    provisionalDecisions.push(chooseBoundaryDecision({
      previousChunk,
      nextChunk,
      boundary,
      tier
    }));
  }

  const decisions = applyMajorVisualThrottle({
    decisions: provisionalDecisions,
    tier
  });
  const totalDurationMs = chunks[chunks.length - 1].endMs - chunks[0].startMs;
  const majorVisualBudget = getMajorVisualBudget({totalDurationMs, tier});
  const majorVisualCount = decisions.filter((decision) => decision.majorVisual).length;

  return {
    activationStatus: "dormant",
    tier,
    totalDurationMs,
    majorVisualBudget,
    majorVisualCount,
    boundaries,
    decisions,
    notes: [
      "Transition brain is stored only as a dormant planner and is not used by the active renderer.",
      "The planner is overlay-first by design so future transitions can avoid destructive source re-encoding.",
      "Unsafe phrase handoffs are intentionally downgraded to L-cuts or J-cuts to preserve spoken continuity."
    ]
  };
};
