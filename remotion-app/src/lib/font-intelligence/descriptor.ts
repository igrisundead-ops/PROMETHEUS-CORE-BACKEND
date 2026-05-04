import {sha256Text} from "../hash";

import {DEFAULT_LIKELY_USE_CASES, LICENSE_REVIEW_PHRASES, NAME_TOKEN_CLASSIFICATIONS, NAME_TOKEN_PERSONALITY} from "./taxonomy";
import type {FontClassification, FontHeuristicProfile, FontManifestRecord, FontObservedMetadata, FontPersonality, FontRole} from "./types";
import {clamp, unique} from "./utils";

const classifyWidth = (widthClass: number | null): FontClassification[] => {
  if (widthClass !== null && widthClass <= 3) {
    return ["condensed"];
  }
  if (widthClass !== null && widthClass >= 7) {
    return ["wide"];
  }
  return [];
};

const guessClassifications = (observed: FontObservedMetadata): FontClassification[] => {
  const probe = [
    observed.familyName,
    observed.subfamilyName,
    observed.fullName,
    observed.postscriptName,
    observed.filename
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matches = NAME_TOKEN_CLASSIFICATIONS
    .filter((entry) => entry.tokens.some((token) => probe.includes(token)))
    .map((entry) => entry.classification);

  if (observed.variationAxes.length > 0) {
    matches.push("variable");
  }

  return unique([...matches, ...classifyWidth(observed.widthClass)]);
};

const guessPersonality = (observed: FontObservedMetadata, classifications: FontClassification[]): FontPersonality[] => {
  const probe = [
    observed.familyName,
    observed.subfamilyName,
    observed.fullName,
    observed.postscriptName,
    observed.filename
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matches = NAME_TOKEN_PERSONALITY.flatMap((entry) => {
    return entry.tokens.some((token) => probe.includes(token)) ? entry.tags : [];
  });

  if (observed.glyphCount !== null && observed.glyphCount >= 350) {
    matches.push("readable");
  }
  if ((observed.weightClass ?? 0) >= 800) {
    matches.push("dramatic", "authoritative");
  }
  if ((observed.weightClass ?? 999) <= 300) {
    matches.push("minimal");
  }
  if (classifications.includes("script")) {
    matches.push("expressive", "decorative");
  }
  if (classifications.includes("serif")) {
    matches.push("editorial");
  }
  if (classifications.includes("sans")) {
    matches.push("clean", "neutral");
  }
  if (classifications.includes("display")) {
    matches.push("dramatic", "expressive");
  }
  if (classifications.includes("decorative")) {
    matches.push("decorative");
  }

  return unique(matches).slice(0, 8);
};

const computeReadabilityScore = (observed: FontObservedMetadata, classifications: FontClassification[]): number => {
  let score = 0.45;
  if ((observed.glyphCount ?? 0) >= 350) score += 0.15;
  if ((observed.weightClass ?? 400) >= 300 && (observed.weightClass ?? 400) <= 600) score += 0.15;
  if ((observed.widthClass ?? 5) >= 4 && (observed.widthClass ?? 5) <= 6) score += 0.1;
  if (observed.italic === false) score += 0.05;
  if (observed.xHeight !== null && observed.capHeight !== null && observed.capHeight > 0) {
    const ratio = observed.xHeight / observed.capHeight;
    if (ratio >= 0.55) score += 0.1;
  }
  if (classifications.includes("script") || classifications.includes("decorative") || classifications.includes("blackletter")) {
    score -= 0.3;
  }
  if (classifications.includes("display")) {
    score -= 0.15;
  }
  return clamp(Number(score.toFixed(3)), 0, 1);
};

const computeExpressivenessScore = (observed: FontObservedMetadata, classifications: FontClassification[]): number => {
  let score = 0.3;
  if (classifications.includes("display")) score += 0.25;
  if (classifications.includes("script")) score += 0.25;
  if (classifications.includes("decorative")) score += 0.2;
  if ((observed.weightClass ?? 0) >= 700) score += 0.15;
  if (observed.italic === true) score += 0.08;
  if (classifications.includes("sans") && !classifications.includes("display")) score -= 0.08;
  return clamp(Number(score.toFixed(3)), 0, 1);
};

const deriveRoles = ({
  classifications,
  readabilityScore,
  expressivenessScore,
  observed
}: {
  classifications: FontClassification[];
  readabilityScore: number;
  expressivenessScore: number;
  observed: FontObservedMetadata;
}): {primaryRole: FontRole; roles: FontRole[]} => {
  const roles = new Set<FontRole>();
  if (expressivenessScore >= 0.55 || classifications.includes("display") || classifications.includes("script")) {
    roles.add("hero");
  }
  if (readabilityScore >= 0.55) {
    roles.add("support");
  }
  if (readabilityScore >= 0.7) {
    roles.add("body");
    roles.add("caption");
  }
  if (readabilityScore >= 0.55 || expressivenessScore >= 0.45) {
    roles.add("subtitle");
  }
  if (classifications.includes("serif") || observed.italic === true || classifications.includes("script")) {
    roles.add("quote");
  }
  if (roles.size === 0) {
    roles.add("support");
  }

  const roleList = [...roles];
  const primaryRole = roleList.includes("hero")
    ? "hero"
    : roleList.includes("body")
      ? "body"
      : roleList.includes("support")
        ? "support"
        : roleList[0];

  return {
    primaryRole,
    roles: unique([primaryRole, ...roleList])
  };
};

const inferLikelyUseCases = ({
  roles,
  personality,
  classifications,
  readabilityScore
}: {
  roles: FontRole[];
  personality: FontPersonality[];
  classifications: FontClassification[];
  readabilityScore: number;
}): string[] => {
  const uses = new Set<string>();
  if (roles.includes("hero")) uses.add("cinematic hero titles");
  if (roles.includes("subtitle")) uses.add("subtitle overlays");
  if (roles.includes("support")) uses.add("supporting deck typography");
  if (roles.includes("body") && readabilityScore >= 0.75) uses.add("body copy and narrative cards");
  if (roles.includes("caption") && readabilityScore >= 0.7) uses.add("captions and lower-thirds");
  if (roles.includes("quote")) uses.add("editorial quotes and emphasis cards");
  if (classifications.includes("script")) uses.add("signature moments and premium callouts");
  if (personality.includes("luxury")) uses.add("luxury product reveals");
  return unique([...uses, ...DEFAULT_LIKELY_USE_CASES]).slice(0, 6);
};

const inferAvoidUseCases = ({
  readabilityScore,
  classifications,
  observed
}: {
  readabilityScore: number;
  classifications: FontClassification[];
  observed: FontObservedMetadata;
}): string[] => {
  const avoids = new Set<string>();
  if (readabilityScore < 0.55) avoids.add("dense captions");
  if (readabilityScore < 0.65) avoids.add("long-form body copy");
  if (classifications.includes("script") || classifications.includes("decorative")) avoids.add("small mobile text");
  if ((observed.weightClass ?? 400) >= 800) avoids.add("quiet support copy");
  if ((observed.widthClass ?? 5) <= 3) avoids.add("narrow multiline paragraphs");
  return [...avoids];
};

const inferPairingGuidance = ({
  classifications,
  readabilityScore,
  expressivenessScore
}: {
  classifications: FontClassification[];
  readabilityScore: number;
  expressivenessScore: number;
}): string[] => {
  const guidance = new Set<string>();
  if (classifications.includes("display") || expressivenessScore >= 0.65) {
    guidance.add("Pairs best with restrained readable support fonts.");
  }
  if (classifications.includes("serif")) {
    guidance.add("Works well against clean sans support faces for contrast.");
  }
  if (classifications.includes("sans") && readabilityScore >= 0.65) {
    guidance.add("Supports expressive editorial or cinematic headline partners.");
  }
  if (classifications.includes("script")) {
    guidance.add("Keep companions neutral and spacing-conscious.");
  }
  if (guidance.size === 0) {
    guidance.add("Contrast role, tone, and readability when pairing.");
  }
  return [...guidance];
};

const inferMotionCompatibility = ({
  readabilityScore,
  expressivenessScore,
  classifications
}: {
  readabilityScore: number;
  expressivenessScore: number;
  classifications: FontClassification[];
}): string[] => {
  const motion = new Set<string>();
  if (readabilityScore >= 0.7) {
    motion.add("fade-up");
    motion.add("clean tracking");
    motion.add("subtle slide");
  }
  if (expressivenessScore >= 0.65) {
    motion.add("blur-in");
    motion.add("slow scale reveal");
  }
  if (classifications.includes("script")) {
    motion.add("soft opacity wipe");
  }
  return [...motion];
};

export const determineMetadataConfidence = (observed: FontObservedMetadata, status: "ok" | "fallback"): FontManifestRecord["metadataConfidence"] => {
  if (status === "fallback") {
    return "low";
  }
  let signals = 0;
  if (observed.familyName) signals += 1;
  if (observed.fullName) signals += 1;
  if (observed.weightClass !== null) signals += 1;
  if (observed.glyphCount !== null) signals += 1;
  if (observed.unicodeRanges.length > 0) signals += 1;
  if (signals >= 4) return "high";
  if (signals >= 2) return "medium";
  return "low";
};

export const needsManualLicenseReview = (observed: FontObservedMetadata): boolean => {
  if (observed.licenseTexts.length === 0) {
    return true;
  }
  const probe = observed.licenseTexts.join(" ").toLowerCase();
  return LICENSE_REVIEW_PHRASES.some((phrase) => probe.includes(phrase));
};

export const buildFontHeuristicProfile = (observed: FontObservedMetadata): FontHeuristicProfile => {
  const classifications = guessClassifications(observed);
  const personality = guessPersonality(observed, classifications);
  const readabilityScore = computeReadabilityScore(observed, classifications);
  const expressivenessScore = computeExpressivenessScore(observed, classifications);
  const roles = deriveRoles({classifications, readabilityScore, expressivenessScore, observed});

  return {
    classifications,
    primaryRole: roles.primaryRole,
    roles: roles.roles,
    personality,
    likelyUseCases: inferLikelyUseCases({roles: roles.roles, personality, classifications, readabilityScore}),
    avoidUseCases: inferAvoidUseCases({readabilityScore, classifications, observed}),
    pairingGuidance: inferPairingGuidance({classifications, readabilityScore, expressivenessScore}),
    motionCompatibility: inferMotionCompatibility({readabilityScore, expressivenessScore, classifications}),
    readabilityScore,
    expressivenessScore,
    confidence: clamp(Number((((readabilityScore + expressivenessScore) / 2) * 0.75 + 0.25).toFixed(3)), 0, 1)
  };
};

const widthLabel = (widthClass: number | null): string => {
  if (widthClass === null) return "normal";
  if (widthClass <= 3) return "condensed";
  if (widthClass >= 7) return "wide";
  return "normal";
};

export const buildFontDescriptorText = ({
  observed,
  inferred
}: {
  observed: FontObservedMetadata;
  inferred: FontHeuristicProfile;
}): string => {
  const fontName = observed.fullName ?? observed.postscriptName ?? observed.filename;
  const descriptorLines = [
    `Font: ${fontName}.`,
    `Family: ${observed.familyName ?? "Unknown family"}.`,
    `Style: ${observed.subfamilyName ?? "Unknown style"}.`,
    `Weight: ${observed.weightClass ?? "unknown"}.`,
    `Width: ${widthLabel(observed.widthClass)}.`,
    `Italic: ${observed.italic === true ? "true" : "false"}.`,
    `Classifications: ${inferred.classifications.join(", ") || "unknown"}.`,
    `Primary role: ${inferred.primaryRole}.`,
    `Supported roles: ${inferred.roles.join(", ")}.`,
    `Visual personality: ${inferred.personality.join(", ") || "neutral"}.`,
    `Readability score: ${inferred.readabilityScore}.`,
    `Expressiveness score: ${inferred.expressivenessScore}.`,
    `Best used for: ${inferred.likelyUseCases.join(", ")}.`,
    `Avoid using for: ${inferred.avoidUseCases.join(", ") || "none called out"}.`,
    `Pairing guidance: ${inferred.pairingGuidance.join(" ")}`,
    `Motion compatibility: ${inferred.motionCompatibility.join(", ") || "clean transitions"}.`,
    `Unicode support: ${observed.unicodeRanges.join(", ") || "unknown"}.`,
    `License review needed: ${needsManualLicenseReview(observed) ? "true" : "false"}.`
  ];
  return descriptorLines.join(" ");
};

export const buildDescriptorHash = (descriptor: string): string => sha256Text(descriptor);
