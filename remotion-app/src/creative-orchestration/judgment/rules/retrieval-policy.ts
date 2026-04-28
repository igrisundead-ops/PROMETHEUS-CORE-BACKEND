import type {JudgmentEngineInput, LibraryTarget, MatchStrategy, PreJudgmentSnapshot, RetrievalAction, RetrievalDecision, RetrievalTarget} from "../types";
import {uniqueStrings} from "../utils/ranking";

const buildTargets = (input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): RetrievalTarget[] => {
  const targets: RetrievalTarget[] = [];
  const libraries = new Map<LibraryTarget, {intent: RetrievalTarget["intent"]; reason: string}>();

  if (snapshot.retrievalDecision.needed === false) {
    return [];
  }

  if (snapshot.emphasisTargets.useBackgroundText) {
    libraries.set("typography-library", {
      intent: "typography",
      reason: "Typography references can support the isolated punch-word treatment."
    });
  }

  if (snapshot.allowedTreatmentFamilies.includes("emotional-cinematic")) {
    libraries.set("matte-treatment-library", {
      intent: "matte",
      reason: "Matte-aware references can inform behind-subject depth and restraint."
    });
  }

  if (input.moment.energy >= 0.62) {
    libraries.set("motion-library", {
      intent: "motion",
      reason: "Motion retrieval is allowed because the moment can sustain animated support."
    });
  }

  if (input.creatorStyleProfile?.premiumBias ?? 0.8 >= 0.72) {
    libraries.set("premium-reference-library", {
      intent: "reference",
      reason: "Premium references help bias the search toward cinematic taste rather than generic assets."
    });
  }

  if (input.assetFingerprints.length > 0) {
    libraries.set("asset-memory-library", {
      intent: "asset",
      reason: "Existing asset memory should be checked before improvising a new visual direction."
    });
  }

  return [...libraries.entries()].map(([library, value], index) => ({
    library,
    priority: index + 1,
    reason: value.reason,
    intent: value.intent
  }));
};

export const determineRetrievalPolicy = (input: JudgmentEngineInput, snapshot: Omit<PreJudgmentSnapshot, "retrievalDecision">): RetrievalDecision => {
  const localProposals = input.agentProposals.filter((proposal) => proposal.type === "asset" || proposal.type === "motion");
  const strongLocalCoverage = localProposals.some((proposal) => proposal.confidence >= 0.72);
  const noveltyBias = input.creatorStyleProfile?.noveltyPreference ?? 0.45;
  const consistencyBias = input.creatorStyleProfile?.consistencyPreference ?? 0.55;
  const needsSupport = snapshot.emotionalSpine === "luxury" || snapshot.rhetoricalPurpose === "proof" || snapshot.emphasisTargets.useBackgroundText || input.moment.importance >= 0.82;
  const shouldSkip = strongLocalCoverage && !needsSupport && snapshot.minimalismLevel !== "expressive";

  let action: RetrievalAction = "retrieve-full-support";
  let matchStrategy: MatchStrategy = noveltyBias >= 0.7 ? "diverse-set" : "single-strong";
  let skipReason: string | null = null;

  if (shouldSkip) {
    action = "skip";
    matchStrategy = "single-strong";
    skipReason = "Local deterministic treatment is already strong enough for this moment.";
  } else if (snapshot.minimalismLevel === "minimal") {
    action = "retrieve-reference-inspiration-only";
  } else if (!snapshot.spatialConstraints.behindSubjectTextLegal && snapshot.allowedTreatmentFamilies.includes("emotional-cinematic")) {
    action = "retrieve-matte-related-treatments";
  } else if (snapshot.emphasisTargets.allowedEffects.includes("background-text")) {
    action = "retrieve-typography-only";
  } else if (input.moment.energy >= 0.7) {
    action = "retrieve-motion-only";
  } else if (noveltyBias >= 0.72) {
    action = "retrieve-diverse-treatment-families";
  }

  const targets = buildTargets(input, {
    ...snapshot,
    retrievalDecision: {
      needed: action !== "skip",
      action,
      skipReason,
      targets: [],
      matchStrategy,
      noveltyBias,
      consistencyBias,
      allowedLibraries: []
    }
  });

  return {
    needed: action !== "skip",
    action,
    skipReason,
    targets,
    matchStrategy,
    noveltyBias,
    consistencyBias,
    allowedLibraries: uniqueStrings(targets.map((target) => target.library)) as LibraryTarget[]
  };
};
