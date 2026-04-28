import {TREATMENT_TO_FINAL_TREATMENT} from "../constants";
import type {CandidateTreatmentProfile, JudgmentEngineInput, PreJudgmentSnapshot, TreatmentFamily} from "../types";
import {uniqueStrings} from "../utils/ranking";

const baseFamilyPool = (
  snapshot: PreJudgmentSnapshot,
  input: JudgmentEngineInput
): TreatmentFamily[] => {
  const families: TreatmentFamily[] = ["safe-premium", "luxury-minimal"];

  if (snapshot.rhetoricalPurpose === "authority" || snapshot.rhetoricalPurpose === "proof") {
    families.push("high-authority");
  }
  if (snapshot.rhetoricalPurpose === "education") {
    families.push("educational-prestige");
  }
  if (snapshot.rhetoricalPurpose === "emotional-punch" || snapshot.emotionalSpine === "desire" || snapshot.emotionalSpine === "vulnerability") {
    families.push("emotional-cinematic");
  }
  if (snapshot.rhetoricalPurpose === "urgency" || snapshot.rhetoricalPurpose === "motivation") {
    families.push("aggressive-conversion");
  }
  if (snapshot.emotionalSpine === "luxury" || snapshot.rhetoricalPurpose === "luxury-premium") {
    families.push("elegant-founder-brand");
  }
  if (input.creatorStyleProfile?.noveltyPreference ?? 0.45 >= 0.72) {
    families.push("high-contrast-experimental", "expressive-premium");
  } else if (snapshot.minimalismLevel !== "minimal") {
    families.push("expressive-premium");
  }

  return uniqueStrings(families) as TreatmentFamily[];
};

export const selectAllowedTreatmentFamilies = (snapshot: Omit<PreJudgmentSnapshot, "allowedTreatmentFamilies" | "blockedTreatmentFamilies">, input: JudgmentEngineInput): {
  allowed: TreatmentFamily[];
  blocked: TreatmentFamily[];
} => {
  const noveltyPreference = input.creatorStyleProfile?.noveltyPreference ?? 0.45;
  const consistencyPreference = input.creatorStyleProfile?.consistencyPreference ?? 0.55;
  let allowed = baseFamilyPool(snapshot as PreJudgmentSnapshot, input);
  const blocked = new Set<TreatmentFamily>(input.creatorStyleProfile?.forbiddenTreatmentFamilies ?? []);

  if (snapshot.spatialConstraints.behindSubjectTextLegal === false) {
    blocked.add("emotional-cinematic");
  }
  if (snapshot.minimalismLevel === "minimal") {
    blocked.add("aggressive-conversion");
    blocked.add("high-contrast-experimental");
  }
  if (snapshot.spatialConstraints.frameNeedsRestraint) {
    blocked.add("high-contrast-experimental");
  }
  if (snapshot.editorialDoctrine.captain === "restraint") {
    blocked.add("aggressive-conversion");
    blocked.add("high-contrast-experimental");
  }
  if (snapshot.editorialDoctrine.captain === "asset") {
    blocked.add("luxury-minimal");
  }
  if (snapshot.editorialDoctrine.captain === "background") {
    blocked.add("aggressive-conversion");
  }
  if (noveltyPreference <= 0.35 && consistencyPreference >= 0.65) {
    blocked.add("high-contrast-experimental");
    blocked.add("expressive-premium");
  }

  return {
    allowed: allowed.filter((family) => !blocked.has(family)),
    blocked: [...blocked]
  };
};

export const buildCandidateFromFamily = (family: TreatmentFamily, snapshot: PreJudgmentSnapshot, input: JudgmentEngineInput): CandidateTreatmentProfile => {
  const noveltyBias = input.creatorStyleProfile?.noveltyPreference ?? 0.45;
  const consistencyBias = input.creatorStyleProfile?.consistencyPreference ?? 0.55;
  const behindSubjectAllowed = snapshot.spatialConstraints.behindSubjectTextLegal;
  const baseReasoning = [
    `Family ${family} matches ${snapshot.rhetoricalPurpose}.`,
    `Emotional spine ${snapshot.emotionalSpine} pushes the intensity toward ${snapshot.minimalismLevel}.`,
    `The editorial captain is ${snapshot.editorialDoctrine.captain}, so supporting tools must follow that lead.`
  ];

  const definitions: Record<TreatmentFamily, Omit<CandidateTreatmentProfile, "id" | "family" | "preferredProposalIds" | "reasoning">> = {
    "safe-premium": {
      finalTreatment: "caption-only",
      typographyMode: "full-caption",
      motionMode: "gentle-drift",
      emphasisMode: "restrained-keyword",
      matteUsage: "none",
      backgroundTextMode: snapshot.editorialDoctrine.captain === "background" ? "subtle" : "none",
      placementMode: "center-stage",
      intensity: snapshot.minimalismLevel === "expressive" ? "balanced" : snapshot.minimalismLevel,
      noveltyLevel: 0.28 + noveltyBias * 0.2,
      consistencyLevel: 0.7 + consistencyBias * 0.2,
      allowedProposalTypes: ["text", "background", "layout", "sound"],
      blockedProposalTypes: ["camera"],
      allowedTextModes: ["full-caption", "title-card"],
      preferredLibraries: ["asset-memory-library", "premium-reference-library"]
    },
    "expressive-premium": {
      finalTreatment: "keyword-emphasis",
      typographyMode: "keyword-only",
      motionMode: "blur-slide-up",
      emphasisMode: "isolated-punch-word",
      matteUsage: "supporting-depth",
      backgroundTextMode: snapshot.editorialDoctrine.supportToolBudget === "none" ? "none" : snapshot.emphasisTargets.useBackgroundText ? "subtle" : "none",
      placementMode: "center-stage",
      intensity: "expressive",
      noveltyLevel: 0.54 + noveltyBias * 0.28,
      consistencyLevel: 0.45 + consistencyBias * 0.18,
      allowedProposalTypes: ["text", "motion", "sound", "background"],
      blockedProposalTypes: [],
      allowedTextModes: ["keyword-only", "title-card"],
      preferredLibraries: ["typography-library", "motion-library", "premium-reference-library"]
    },
    "luxury-minimal": {
      finalTreatment: "caption-only",
      typographyMode: "full-caption",
      motionMode: "none",
      emphasisMode: "whispered-contrast",
      matteUsage: "none",
      backgroundTextMode: "none",
      placementMode: "center-stage",
      intensity: "minimal",
      noveltyLevel: 0.22 + noveltyBias * 0.12,
      consistencyLevel: 0.84 + consistencyBias * 0.1,
      allowedProposalTypes: ["text", "layout", "background"],
      blockedProposalTypes: ["motion", "camera"],
      allowedTextModes: ["full-caption", "no-text"],
      preferredLibraries: ["premium-reference-library"]
    },
    "high-authority": {
      finalTreatment: "title-card",
      typographyMode: "title-card",
      motionMode: "depth-card-float",
      emphasisMode: "headline-command",
      matteUsage: behindSubjectAllowed ? "supporting-depth" : "none",
      backgroundTextMode: "none",
      placementMode: "left-anchor",
      intensity: snapshot.minimalismLevel === "minimal" ? "restrained" : "balanced",
      noveltyLevel: 0.36 + noveltyBias * 0.12,
      consistencyLevel: 0.74 + consistencyBias * 0.16,
      allowedProposalTypes: snapshot.editorialDoctrine.captain === "asset" ? ["text", "asset", "background", "sound"] : ["text", "background", "motion", "sound"],
      blockedProposalTypes: ["asset"],
      allowedTextModes: ["title-card", "full-caption"],
      preferredLibraries: ["typography-library", "premium-reference-library"]
    },
    "emotional-cinematic": {
      finalTreatment: behindSubjectAllowed ? "behind-speaker-depth" : "asset-supported",
      typographyMode: "keyword-only",
      motionMode: "light-sweep-reveal",
      emphasisMode: "isolated-punch-word",
      matteUsage: behindSubjectAllowed ? "behind-subject-text" : "supporting-depth",
      backgroundTextMode: snapshot.editorialDoctrine.supportToolBudget === "paired" && snapshot.emphasisTargets.useBackgroundText ? "hero" : "subtle",
      placementMode: behindSubjectAllowed ? "behind-subject" : "right-anchor",
      intensity: snapshot.minimalismLevel === "minimal" ? "restrained" : "balanced",
      noveltyLevel: 0.58 + noveltyBias * 0.18,
      consistencyLevel: 0.42 + consistencyBias * 0.16,
      allowedProposalTypes: ["text", "motion", "matting", "background", "sound"],
      blockedProposalTypes: [],
      allowedTextModes: ["keyword-only", "title-card"],
      preferredLibraries: ["matte-treatment-library", "motion-library", "premium-reference-library"]
    },
    "educational-prestige": {
      finalTreatment: "asset-supported",
      typographyMode: snapshot.editorialDoctrine.conceptReductionMode === "hero-word" ? "keyword-only" : "full-caption",
      motionMode: "gentle-drift",
      emphasisMode: "clean-callout",
      matteUsage: "none",
      backgroundTextMode: "none",
      placementMode: "right-anchor",
      intensity: "balanced",
      noveltyLevel: 0.34 + noveltyBias * 0.16,
      consistencyLevel: 0.7 + consistencyBias * 0.16,
      allowedProposalTypes: ["text", "asset", "layout", "background"],
      blockedProposalTypes: ["camera"],
      allowedTextModes: ["full-caption", "keyword-only"],
      preferredLibraries: ["asset-memory-library", "typography-library", "showcase-library"]
    },
    "aggressive-conversion": {
      finalTreatment: "asset-led",
      typographyMode: "keyword-only",
      motionMode: "zoom-through-layer",
      emphasisMode: "conversion-trigger",
      matteUsage: "supporting-depth",
      backgroundTextMode: snapshot.editorialDoctrine.supportToolBudget === "none" ? "subtle" : "hero",
      placementMode: "full-frame",
      intensity: "expressive",
      noveltyLevel: 0.62 + noveltyBias * 0.24,
      consistencyLevel: 0.38 + consistencyBias * 0.14,
      allowedProposalTypes: ["text", "asset", "motion", "sound", "background"],
      blockedProposalTypes: [],
      allowedTextModes: ["keyword-only", "no-text", "title-card"],
      preferredLibraries: ["motion-library", "asset-memory-library", "gsap-library"]
    },
    "elegant-founder-brand": {
      finalTreatment: "background-overlay",
      typographyMode: "title-card",
      motionMode: "gentle-drift",
      emphasisMode: "quiet-command",
      matteUsage: "none",
      backgroundTextMode: "subtle",
      placementMode: "left-anchor",
      intensity: "restrained",
      noveltyLevel: 0.3 + noveltyBias * 0.1,
      consistencyLevel: 0.8 + consistencyBias * 0.14,
      allowedProposalTypes: snapshot.editorialDoctrine.captain === "background" ? ["text", "background", "asset"] : ["text", "background"],
      blockedProposalTypes: ["sound"],
      allowedTextModes: ["title-card", "full-caption"],
      preferredLibraries: ["premium-reference-library", "showcase-library"]
    },
    "high-contrast-experimental": {
      finalTreatment: "cinematic-transition",
      typographyMode: "keyword-only",
      motionMode: "zoom-through-layer",
      emphasisMode: "aggressive-isolation",
      matteUsage: behindSubjectAllowed ? "supporting-depth" : "none",
      backgroundTextMode: snapshot.editorialDoctrine.supportToolBudget === "paired" ? "hero" : "subtle",
      placementMode: "full-frame",
      intensity: "expressive",
      noveltyLevel: 0.78 + noveltyBias * 0.18,
      consistencyLevel: 0.24 + consistencyBias * 0.1,
      allowedProposalTypes: ["text", "motion", "background", "sound", "asset"],
      blockedProposalTypes: [],
      allowedTextModes: ["keyword-only", "title-card", "no-text"],
      preferredLibraries: ["motion-library", "gsap-library", "premium-reference-library"]
    }
  };

  const definition = definitions[family];
  return {
    id: `${snapshot.segmentId}-${family}`,
    family,
    preferredProposalIds: [],
    reasoning: [...baseReasoning, ...(behindSubjectAllowed ? [] : ["Matte risk forced the candidate away from critical behind-subject typography."])],
    ...definition,
    finalTreatment: definition.finalTreatment ?? TREATMENT_TO_FINAL_TREATMENT[family]
  };
};
