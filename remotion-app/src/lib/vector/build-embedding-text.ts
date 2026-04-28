import type {VectorAssetRecord} from "./schemas";

const unique = (values: Array<string | null | undefined>): string[] => {
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

const joinSentence = (values: string[]): string => values.length > 0 ? values.join(", ") : "none specified";

export const buildStaticImageEmbeddingText = (record: VectorAssetRecord): string => {
  const metadata = record.metadataJson;
  const detectedObjects = Array.isArray(metadata.detected_objects) ? metadata.detected_objects.map(String) : record.literalTags.slice(0, 8);
  const narrative = record.semanticTags.slice(0, 8);
  const brand = record.styleFamily.slice(0, 8);
  const motionReadiness = record.motionTags.slice(0, 6);
  const useCases = record.sceneUseCases.slice(0, 6);
  const aspect = record.supportedAspectRatios[0] ?? "unspecified aspect ratio";

  return [
    `Static visual asset showing ${joinSentence(detectedObjects)}.`,
    `Literal tags: ${joinSentence(record.literalTags.slice(0, 12))}.`,
    `Symbolic and narrative meaning: ${joinSentence(unique([...record.symbolicMeaning, ...narrative]).slice(0, 12))}.`,
    `Brand and conversion cues: ${joinSentence(unique([...brand, ...record.compatibility]).slice(0, 10))}.`,
    `Motion readiness: ${joinSentence(motionReadiness)}.`,
    `Best for ${joinSentence(useCases)} in ${aspect} layouts.`
  ].join(" ");
};

export const buildMotionGraphicsEmbeddingText = (record: VectorAssetRecord): string => {
  return [
    `Motion graphic for ${joinSentence(record.sceneUseCases.slice(0, 3))} using ${joinSentence(record.motionTags.slice(0, 8))}.`,
    `Primary rhetorical role: ${joinSentence(record.rhetoricalRoles.slice(0, 6))}.`,
    `Emotional role: ${joinSentence(record.emotionalRoles.slice(0, 6))}.`,
    `Style family: ${joinSentence(record.styleFamily.slice(0, 6))} with ${record.visualEnergy} visual energy.`,
    `Creator fit: ${joinSentence(record.creatorFit.slice(0, 6))}.`,
    `Features: ${joinSentence(record.features.slice(0, 8))}.`,
    `Best for ${joinSentence(record.sceneUseCases.slice(0, 8))}.`
  ].join(" ");
};

export const buildGsapAnimationEmbeddingText = (record: VectorAssetRecord): string => {
  const negativeGrammar = record.negativeGrammar.slice(0, 6);
  const replaceable = record.replaceableSlots.slice(0, 6);
  return [
    `GSAP animation logic for ${joinSentence(record.sceneUseCases.slice(0, 4))} using ${joinSentence(record.motionTags.slice(0, 10))}.`,
    `Primary animation function and scene role: ${joinSentence(record.rhetoricalRoles.slice(0, 8))}.`,
    `Supported asset types and replaceable slots: ${joinSentence(unique([...record.compatibility, ...replaceable]).slice(0, 10))}.`,
    `Timing and easing profile: ${record.visualEnergy} energy with ${joinSentence(record.styleFamily.slice(0, 6))}.`,
    `Judgment triggers and creator fit: ${joinSentence(unique([...record.creatorFit, ...record.emotionalRoles]).slice(0, 10))}.`,
    `Negative grammar risks: ${joinSentence(negativeGrammar)}.`
  ].join(" ");
};

export const buildTypographyEmbeddingText = (record: VectorAssetRecord): string => {
  return [
    `Typography treatment ${record.title} for ${joinSentence(record.sceneUseCases.slice(0, 6))}.`,
    `Style family: ${joinSentence(record.styleFamily.slice(0, 6))}.`,
    `Rhetorical roles: ${joinSentence(record.rhetoricalRoles.slice(0, 6))}.`,
    `Compatibility: ${joinSentence(record.compatibility.slice(0, 8))}.`
  ].join(" ");
};

export const buildReferenceEmbeddingText = (record: VectorAssetRecord): string => {
  return [
    `Premium reference asset ${record.title} for ${joinSentence(record.sceneUseCases.slice(0, 6))}.`,
    `Literal cues: ${joinSentence(record.literalTags.slice(0, 8))}.`,
    `Semantic cues: ${joinSentence(record.semanticTags.slice(0, 10))}.`,
    `Style family: ${joinSentence(record.styleFamily.slice(0, 6))}.`,
    `Creator fit: ${joinSentence(record.creatorFit.slice(0, 6))}.`
  ].join(" ");
};

export const buildEmbeddingTextForAsset = (record: VectorAssetRecord): string => {
  if (record.assetType === "static_image") {
    return buildStaticImageEmbeddingText(record);
  }
  if (record.assetType === "motion_graphic") {
    return buildMotionGraphicsEmbeddingText(record);
  }
  if (record.assetType === "gsap_animation_logic") {
    return buildGsapAnimationEmbeddingText(record);
  }
  if (record.assetType === "typography") {
    return buildTypographyEmbeddingText(record);
  }
  return buildReferenceEmbeddingText(record);
};

export const isWeakEmbeddingText = (text: string): boolean => {
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return text.trim().length < 80 || new Set(tokens).size < 12;
};
