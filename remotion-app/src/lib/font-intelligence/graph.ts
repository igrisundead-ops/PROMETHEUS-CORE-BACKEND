import type {FontCompatibilityBreakdown, FontCompatibilityEdge, FontCompatibilityGraph, FontCompatibilityNode, FontEmbeddingRecord, FontManifestRecord} from "./types";
import {FONT_PAIRING_LANES} from "./taxonomy";
import {clamp} from "./utils";

const cosineSimilarity = (left: number[], right: number[]): number => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftNorm += left[index]! ** 2;
    rightNorm += right[index]! ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const pickRecommendedUsage = (pairingType: string): string[] => {
  switch (pairingType) {
    case "hero_to_support":
      return ["hero title + supporting deck", "headline card + metadata rail"];
    case "hero_to_body":
      return ["hero title + narrative body", "chapter opener + body card"];
    case "hero_to_subtitle":
      return ["headline + subtitle overlay", "hero lockup + deck"];
    case "quote_to_caption":
      return ["quote card + caption", "testimonial emphasis + attribution"];
    case "quote_to_support":
      return ["quote + support explainer", "editorial pull-quote + deck"];
    case "subtitle_to_caption":
      return ["subtitle + caption stack", "section heading + supporting caption"];
    case "support_to_caption":
      return ["support text + caption utility", "UI label + microcopy"];
    default:
      return ["paired editorial typography"];
  }
};

const buildBreakdown = ({
  source,
  target,
  embeddingSimilarity,
  pairingType
}: {
  source: FontManifestRecord;
  target: FontManifestRecord;
  embeddingSimilarity: number;
  pairingType: string;
}): FontCompatibilityBreakdown => {
  const roleContrast = source.inferred.primaryRole !== target.inferred.primaryRole ? 0.2 : 0.05;
  const readabilitySupportBonus = pairingType.includes("caption") || pairingType.includes("body") || pairingType.includes("support")
    ? target.inferred.readabilityScore * 0.22
    : target.inferred.readabilityScore * 0.1;
  const expressivenessContrast = Math.abs(source.inferred.expressivenessScore - target.inferred.expressivenessScore) * 0.18;
  const sameFamilyPenalty = source.familyId === target.familyId
    ? (Math.abs((source.observed.weightClass ?? 400) - (target.observed.weightClass ?? 400)) >= 250 ? -0.05 : -0.16)
    : 0;
  const decorativeSource = source.inferred.classifications.some((classification) => ["decorative", "script", "display"].includes(classification));
  const decorativeTarget = target.inferred.classifications.some((classification) => ["decorative", "script", "display"].includes(classification));
  const decorativeClashPenalty = decorativeSource && decorativeTarget ? -0.18 : 0;
  const sameClassificationPenalty = source.inferred.classifications.some((classification) => target.inferred.classifications.includes(classification))
    ? -0.04
    : 0.04;
  const licensePenalty = source.needsManualLicenseReview || target.needsManualLicenseReview ? -0.04 : 0;
  const unicodeCoverageBonus = (target.observed.unicodeRanges.length >= 3 ? 0.04 : 0) + (source.observed.unicodeRanges.length >= 3 ? 0.02 : 0);
  const styleContrastBonus = (
    (source.inferred.classifications.includes("serif") && target.inferred.classifications.includes("sans")) ||
    (source.inferred.classifications.includes("sans") && target.inferred.classifications.includes("serif"))
  )
    ? 0.14
    : 0;
  const embeddingSignal = embeddingSimilarity * 0.08;

  return {
    roleContrast: Number(roleContrast.toFixed(3)),
    readabilitySupportBonus: Number(readabilitySupportBonus.toFixed(3)),
    expressivenessContrast: Number(expressivenessContrast.toFixed(3)),
    sameFamilyPenalty: Number(sameFamilyPenalty.toFixed(3)),
    decorativeClashPenalty: Number(decorativeClashPenalty.toFixed(3)),
    sameClassificationPenalty: Number(sameClassificationPenalty.toFixed(3)),
    licensePenalty: Number(licensePenalty.toFixed(3)),
    unicodeCoverageBonus: Number(unicodeCoverageBonus.toFixed(3)),
    styleContrastBonus: Number(styleContrastBonus.toFixed(3)),
    embeddingSignal: Number(embeddingSignal.toFixed(3))
  };
};

const scoreBreakdown = (breakdown: FontCompatibilityBreakdown): number => {
  return clamp(
    0.45 +
      breakdown.roleContrast +
      breakdown.readabilitySupportBonus +
      breakdown.expressivenessContrast +
      breakdown.sameFamilyPenalty +
      breakdown.decorativeClashPenalty +
      breakdown.sameClassificationPenalty +
      breakdown.licensePenalty +
      breakdown.unicodeCoverageBonus +
      breakdown.styleContrastBonus +
      breakdown.embeddingSignal,
    0,
    1
  );
};

const explainEdge = ({
  source,
  target,
  pairingType
}: {
  source: FontManifestRecord;
  target: FontManifestRecord;
  pairingType: string;
}): string => {
  const sourceTone = source.inferred.personality[0] ?? source.inferred.classifications[0] ?? "expressive";
  const targetTone = target.inferred.personality[0] ?? target.inferred.classifications[0] ?? "readable";
  return `${sourceTone} ${source.inferred.primaryRole} typography pairs well with ${targetTone} ${pairingType.split("_to_")[1] ?? "support"} typography for contrast and readability.`;
};

export const buildFontCompatibilityGraph = ({
  fonts,
  embeddings = [],
  topMatchesPerFont = 12
}: {
  fonts: FontManifestRecord[];
  embeddings?: FontEmbeddingRecord[];
  topMatchesPerFont?: number;
}): FontCompatibilityGraph => {
  const embeddingMap = new Map(embeddings.map((entry) => [entry.font_id, entry.embedding]));
  const nodes: FontCompatibilityNode[] = fonts.map((font) => ({
    id: font.fontId,
    family: font.observed.familyName,
    style: font.observed.subfamilyName,
    roles: font.inferred.roles,
    primary_role: font.inferred.primaryRole,
    personality: font.inferred.personality,
    metadata: font
  }));

  const edges: FontCompatibilityEdge[] = [];
  for (const source of fonts) {
    const laneEdges = new Map<string, FontCompatibilityEdge[]>();
    for (const target of fonts) {
      if (source.fontId === target.fontId) {
        continue;
      }
      for (const lane of FONT_PAIRING_LANES) {
        if (!source.inferred.roles.includes(lane.from) || !target.inferred.roles.includes(lane.to)) {
          continue;
        }
        const embeddingSimilarity = cosineSimilarity(
          embeddingMap.get(source.fontId) ?? [],
          embeddingMap.get(target.fontId) ?? []
        );
        const breakdown = buildBreakdown({
          source,
          target,
          embeddingSimilarity,
          pairingType: lane.pairingType
        });
        const score = Number(scoreBreakdown(breakdown).toFixed(3));
        if (score < 0.45) {
          continue;
        }
        const edge: FontCompatibilityEdge = {
          from: source.fontId,
          to: target.fontId,
          pairing_type: lane.pairingType,
          score,
          reason: explainEdge({source, target, pairingType: lane.pairingType}),
          recommended_usage: pickRecommendedUsage(lane.pairingType),
          needs_manual_license_review: source.needsManualLicenseReview || target.needsManualLicenseReview,
          breakdown
        };
        const bucket = laneEdges.get(lane.pairingType) ?? [];
        bucket.push(edge);
        laneEdges.set(lane.pairingType, bucket);
      }
    }
    const selected = [...laneEdges.values()]
      .flatMap((bucket) => bucket.sort((left, right) => right.score - left.score).slice(0, 2))
      .sort((left, right) => right.score - left.score)
      .slice(0, topMatchesPerFont);
    edges.push(...selected);
  }

  return {
    nodes,
    edges
  };
};
