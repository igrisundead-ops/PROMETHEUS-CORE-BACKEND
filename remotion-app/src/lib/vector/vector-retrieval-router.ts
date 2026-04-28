import type {CandidateTreatmentProfile, JudgmentEngineInput, PreJudgmentSnapshot} from "../../creative-orchestration/judgment/types";

import {DEFAULT_VECTOR_TOP_K} from "./collections";
import {type VectorPartition, type VectorSearchRequest} from "./schemas";

const createRequestId = (): string => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  return `vector-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
};

const libraryPartitions = (library: string): VectorPartition[] => {
  if (library === "typography-library") return ["typography"];
  if (library === "motion-library") return ["motion_graphics"];
  if (library === "gsap-library") return ["gsap_animation_logic"];
  if (library === "matte-treatment-library") return ["motion_graphics", "gsap_animation_logic"];
  if (library === "premium-reference-library" || library === "showcase-library") return ["references"];
  if (library === "asset-memory-library") return ["static_images"];
  return [];
};

export const resolvePartitionsForRetrievalAction = ({
  action,
  snapshot,
  selectedTreatment
}: {
  action: string;
  snapshot: PreJudgmentSnapshot;
  selectedTreatment: CandidateTreatmentProfile;
}): VectorPartition[] => {
  const byAction: Record<string, VectorPartition[]> = {
    skip: [],
    "retrieve-typography-only": ["typography"],
    "retrieve-motion-only": ["motion_graphics", "gsap_animation_logic"],
    "retrieve-matte-related-treatments": ["motion_graphics", "gsap_animation_logic"],
    "retrieve-reference-inspiration-only": ["references", "static_images", "motion_graphics"],
    "retrieve-diverse-treatment-families": ["static_images", "motion_graphics", "gsap_animation_logic"],
    "retrieve-full-support": []
  };

  let partitions = byAction[action] ?? [];
  if (action === "retrieve-full-support") {
    if (selectedTreatment.finalTreatment === "asset-led" || selectedTreatment.finalTreatment === "asset-supported" || snapshot.visualPriorityRanking.some((entry) => entry.subject === "product-object" || entry.subject === "symbolic-visual")) {
      partitions.push("static_images");
    }
    if (selectedTreatment.motionMode !== "none") {
      partitions.push("motion_graphics", "gsap_animation_logic");
    }
    if (selectedTreatment.typographyMode !== "no-text" || snapshot.emphasisTargets.useBackgroundText) {
      partitions.push("typography");
    }
    if ((snapshot.retrievalDecision.allowedLibraries.includes("premium-reference-library")) || selectedTreatment.preferredLibraries.includes("premium-reference-library")) {
      partitions.push("references");
    }
  }

  if (snapshot.retrievalDecision.allowedLibraries.length > 0) {
    const legal = snapshot.retrievalDecision.allowedLibraries.flatMap(libraryPartitions);
    partitions = partitions.filter((partition) => legal.includes(partition));
  }

  return uniqueStrings(partitions) as VectorPartition[];
};

const buildQueryText = ({
  input,
  snapshot,
  selectedTreatment
}: {
  input: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  selectedTreatment: CandidateTreatmentProfile;
}): string => {
  const priorities = snapshot.visualPriorityRanking.slice(0, 3).map((entry) => entry.subject.replace(/-/g, " "));
  const emphasis = snapshot.emphasisTargets.punchWord ? [`punch word ${snapshot.emphasisTargets.punchWord}`] : [];
  const creatorStyle = [
    (input.creatorStyleProfile?.premiumBias ?? 0.8) >= 0.72 ? "premium cinematic" : null,
    (input.creatorStyleProfile?.noveltyPreference ?? 0.45) >= 0.68 ? "novel diverse treatment" : "cohesive treatment"
  ];
  return uniqueStrings([
    input.transcriptSegment,
    snapshot.rhetoricalPurpose,
    snapshot.emotionalSpine,
    ...priorities,
    ...emphasis,
    selectedTreatment.family,
    selectedTreatment.motionMode,
    selectedTreatment.typographyMode,
    selectedTreatment.matteUsage,
    selectedTreatment.backgroundTextMode,
    ...creatorStyle
  ]).join(" ");
};

export const buildMilvusSearchRequests = ({
  input,
  snapshot,
  selectedTreatment
}: {
  input: JudgmentEngineInput;
  snapshot: PreJudgmentSnapshot;
  selectedTreatment: CandidateTreatmentProfile;
}): VectorSearchRequest[] => {
  if (snapshot.retrievalDecision.action === "skip") {
    return [];
  }

  const partitions = resolvePartitionsForRetrievalAction({
    action: snapshot.retrievalDecision.action,
    snapshot,
    selectedTreatment
  });
  if (partitions.length === 0) {
    return [];
  }

  return [{
    requestId: createRequestId(),
    action: snapshot.retrievalDecision.action,
    partitions,
    queryText: buildQueryText({input, snapshot, selectedTreatment}),
    topK: snapshot.retrievalDecision.action === "retrieve-diverse-treatment-families" ? 16 : DEFAULT_VECTOR_TOP_K,
    overfetchMultiplier: snapshot.retrievalDecision.matchStrategy === "diverse-set" ? 5 : 4,
    filters: {
      sourceLibraries: [],
      rhetoricalRoles: [snapshot.rhetoricalPurpose, input.moment.momentType],
      emotionalRoles: [snapshot.emotionalSpine],
      motionTags: uniqueStrings([
        selectedTreatment.motionMode,
        ...snapshot.emphasisTargets.allowedEffects,
        ...(snapshot.recentSequenceMetrics.preferRestraintNext ? ["restrained"] : [])
      ]),
      styleFamily: uniqueStrings([
        selectedTreatment.family,
        ...(input.creatorStyleProfile?.premiumBias ?? 0.8 >= 0.72 ? ["premium", "cinematic", "apple_style"] : [])
      ]),
      creatorFit: uniqueStrings([
        ...(input.creatorStyleProfile?.preferredTreatmentFamilies ?? []),
        snapshot.rhetoricalPurpose,
        snapshot.emotionalSpine
      ]),
      sceneUseCases: uniqueStrings([
        input.moment.momentType,
        ...snapshot.visualPriorityRanking.slice(0, 2).map((entry) => entry.subject)
      ]),
      compatibility: uniqueStrings([
        selectedTreatment.matteUsage === "behind-subject-text" ? "supportsBehindSubjectText" : null,
        selectedTreatment.matteUsage !== "none" ? "requiresMatting" : null
      ]),
      negativeGrammar: uniqueStrings([
        snapshot.recentSequenceMetrics.preferRestraintNext ? "moment_requires_restraint" : null
      ]),
      forbiddenTags: uniqueStrings([
        snapshot.spatialConstraints.busyFrame ? "busy background" : null,
        snapshot.spatialConstraints.mobileReadabilityRisk >= 0.45 ? "dense caption" : null,
        snapshot.recentSequenceMetrics.preferRestraintNext ? "aggressive motion" : null
      ]),
      supportedAspectRatio: "9:16",
      renderComplexityMax: input.moment.importance >= 0.82 ? "high" : "medium",
      matteRelatedOnly: snapshot.retrievalDecision.action === "retrieve-matte-related-treatments",
      inspirationOnly: snapshot.retrievalDecision.action === "retrieve-reference-inspiration-only",
      assetTypes: uniqueStrings(
        partitions.map((partition) => {
          if (partition === "static_images") return "static_image";
          if (partition === "motion_graphics") return "motion_graphic";
          if (partition === "gsap_animation_logic") return "gsap_animation_logic";
          if (partition === "typography") return "typography";
          return "reference";
        })
      ) as Array<"static_image" | "motion_graphic" | "gsap_animation_logic" | "typography" | "reference">
    },
    context: {
      segmentId: input.segmentId,
      rhetoricalPurpose: snapshot.rhetoricalPurpose,
      emotionalSpine: snapshot.emotionalSpine,
      selectedTreatmentFamily: selectedTreatment.family,
      motionMode: selectedTreatment.motionMode,
      typographyMode: selectedTreatment.typographyMode,
      matteUsage: selectedTreatment.matteUsage,
      visualPriorityRanking: snapshot.visualPriorityRanking.map((entry) => entry.subject)
    }
  }];
};
