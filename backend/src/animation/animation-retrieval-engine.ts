import type {RenderConfig} from "../config/render-flags";

export type AnimationRetrievalInput = {
  rhetoricalIntent: "authority" | "emphasis" | "premium_explain" | "neutral";
  motionIntensity: number;
  typographyMode: "svg_longform_typography_v1" | "minimal_premium";
  avoidFamilies?: string[];
  renderConfig: RenderConfig;
};

export type AnimationRetrievalDecision = {
  family: "fade_up" | "type_lock" | "soft_push" | "settle";
  retrievedFromMilvus: boolean;
  retrievedAnimationId?: string;
  fallbackUsed: boolean;
  fallbackReasons: string[];
  motionIntensity: number;
  entryMs: number;
  holdMs: number;
  exitMs: number;
};

export type AnimationRetriever = (input: AnimationRetrievalInput) => Promise<{id: string; family: "fade_up" | "type_lock" | "soft_push" | "settle"} | null>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const selectTextAnimation = async (
  input: AnimationRetrievalInput,
  retrieveFromMilvus?: AnimationRetriever
): Promise<AnimationRetrievalDecision> => {
  const fallbackReasons: string[] = [];
  const boundedIntensity = clamp01(input.motionIntensity);
  const avoid = new Set(input.avoidFamilies ?? []);

  if (input.renderConfig.ENABLE_MILVUS_ANIMATION_RETRIEVAL && retrieveFromMilvus) {
    const retrieved = await retrieveFromMilvus(input);
    if (retrieved && !avoid.has(retrieved.family)) {
      return {
        family: retrieved.family,
        retrievedFromMilvus: true,
        retrievedAnimationId: retrieved.id,
        fallbackUsed: false,
        fallbackReasons: [],
        motionIntensity: boundedIntensity,
        entryMs: 320,
        holdMs: 620,
        exitMs: 260
      };
    }
    fallbackReasons.push("Milvus retrieval returned no compatible animation.");
  } else if (input.renderConfig.ENABLE_MILVUS_ANIMATION_RETRIEVAL) {
    fallbackReasons.push("Milvus retrieval enabled but no retriever adapter was provided.");
  }

  const defaultFamily =
    input.rhetoricalIntent === "authority"
      ? "fade_up"
      : input.rhetoricalIntent === "emphasis"
        ? "type_lock"
        : "soft_push";
  const family = avoid.has(defaultFamily) ? "settle" : defaultFamily;

  return {
    family,
    retrievedFromMilvus: false,
    fallbackUsed: true,
    fallbackReasons,
    motionIntensity: boundedIntensity,
    entryMs: 280,
    holdMs: 580,
    exitMs: 240
  };
};
