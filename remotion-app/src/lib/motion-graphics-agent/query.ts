import {searchUnifiedAssetSnapshot} from "../assets/retrieval";
import {buildSearchTerms, inferMoodTags, normalizeAssetText, uniqueStrings} from "../assets/text-utils";
import type {AssetSearchRequest} from "../assets/types";
import type {CaptionChunk, MotionSceneKind, MotionTier} from "../types";

import type {
  MotionGraphicsAgentQuery,
  MotionGraphicsCandidateSummary,
  MotionGraphicsEnergyLevel,
  MotionGraphicsSafeZone,
  MotionGraphicsVisualMode
} from "./types";

type BuildMotionGraphicsAgentQueryInput = {
  sceneId: string;
  chunk: CaptionChunk;
  headlineText?: string;
  subtextText?: string;
  tier: MotionTier;
  sceneKind?: MotionSceneKind;
  aspectRatio: number;
  safeZones: MotionGraphicsSafeZone[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const extractKeywords = (text: string): string[] => {
  return buildSearchTerms(text)
    .filter((term) => term.length > 2)
    .slice(0, 10);
};

const resolveEnergyLevel = (chunk: CaptionChunk): MotionGraphicsEnergyLevel => {
  const text = normalizeAssetText(chunk.text);
  const emphasisBoost = Math.min(0.26, (chunk.emphasisWordIndices?.length ?? 0) * 0.09);
  const punctuationBoost = /[!?]/.test(text) ? 0.2 : 0;
  const semanticBoost = chunk.semantic?.intent === "punch-emphasis"
    ? 0.3
    : chunk.semantic?.intent === "name-callout"
      ? 0.14
      : 0.06;
  const score = clamp01(0.32 + emphasisBoost + punctuationBoost + semanticBoost);

  if (score >= 0.72) {
    return "high";
  }
  if (score >= 0.46) {
    return "medium";
  }
  return "low";
};

const resolveVisualMode = ({
  tier,
  sceneKind,
  energyLevel
}: {
  tier: MotionTier;
  sceneKind?: MotionSceneKind;
  energyLevel: MotionGraphicsEnergyLevel;
}): MotionGraphicsVisualMode => {
  if (sceneKind === "comparison" || sceneKind === "stat") {
    return "clean-tech";
  }
  if (energyLevel === "high" || tier === "hero") {
    return "aggressive";
  }
  if (tier === "minimal") {
    return "minimal";
  }
  return "cinematic";
};

const resolveDesiredOutcome = (sceneKind: MotionSceneKind | undefined, text: string): string => {
  if (sceneKind === "quote") {
    return "Support the spoken line with elegant typography companions.";
  }
  if (sceneKind === "comparison") {
    return "Clarify contrast without blocking the central headline.";
  }
  if (sceneKind === "stat") {
    return "Elevate the number or claim with precise emphasis assets.";
  }
  if (sceneKind === "cta") {
    return "Drive attention toward the core message with premium motion punctuation.";
  }
  if (/\b(think|thought|reflect|decide|consider)\b/i.test(text)) {
    return "Add reflective cinematic support around the message.";
  }
  return "Use premium cinematic support assets that strengthen the main line.";
};

const resolveTone = (chunk: CaptionChunk, tier: MotionTier): string => {
  const moods = inferMoodTags([
    chunk.text,
    chunk.semantic?.intent ?? "default",
    tier
  ]);
  if (moods.includes("calm")) {
    return "restrained reflective";
  }
  if (moods.includes("heroic")) {
    return "bold premium";
  }
  if (moods.includes("cool")) {
    return "clean editorial tech";
  }
  return "cinematic premium";
};

export const buildMotionGraphicsAgentQuery = ({
  sceneId,
  chunk,
  headlineText,
  subtextText,
  tier,
  sceneKind,
  aspectRatio,
  safeZones
}: BuildMotionGraphicsAgentQueryInput): MotionGraphicsAgentQuery => {
  const visibleText = [headlineText, subtextText, chunk.text].filter(Boolean).join(" | ");
  const energyLevel = resolveEnergyLevel(chunk);
  const visualMode = resolveVisualMode({
    tier,
    sceneKind,
    energyLevel
  });
  const transcriptSegment = chunk.text.trim();
  const keywords = extractKeywords(`${chunk.text} ${headlineText ?? ""} ${subtextText ?? ""}`);
  const textOccupiesCenterFrame = aspectRatio >= 1.2;
  const subjectOccupiesCenterFrame = aspectRatio >= 1.2;
  const avoidList = uniqueStrings([
    "vertical beam",
    "glass pillar",
    "blur column",
    "full-height translucent slab",
    "main text obstruction",
    "face obstruction"
  ]);
  const request: AssetSearchRequest = {
    queryText: [
      transcriptSegment,
      headlineText,
      sceneKind,
      visualMode === "clean-tech" ? "clean tech motion support" : "premium cinematic motion support",
      textOccupiesCenterFrame ? "centered headline safe area" : "asymmetric composition"
    ].filter(Boolean).join(" "),
    sceneIntent: `${sceneKind ?? "statement"} scene for ${tier} ${visualMode} support`,
    desiredAssetTypes: [
      "motion_graphic",
      "animated_overlay",
      "accent",
      "typography_effect",
      "ui_card",
      "background",
      "static_image"
    ],
    mood: inferMoodTags([transcriptSegment, tier, visualMode]),
    contexts: uniqueStrings([
      sceneKind ?? "statement",
      aspectRatio >= 1.2 ? "landscape" : "portrait",
      visualMode,
      energyLevel,
      "title-safe composition",
      "headline support"
    ]),
    antiContexts: avoidList,
    constraints: uniqueStrings([
      "do not block main text",
      "do not cover face",
      "no fake glass pillar",
      textOccupiesCenterFrame ? "keep center headline readable" : ""
    ]),
    motionLevel: tier,
    positionRole: "scene-layer",
    compositionHints: uniqueStrings([
      resolveDesiredOutcome(sceneKind, transcriptSegment),
      "prefer cinematic support rather than clutter",
      "avoid decorative center overlays unless the center is intentionally free",
      textOccupiesCenterFrame ? "center is occupied by text" : "center may remain open"
    ]),
    requireAnimated: energyLevel === "high",
    limit: 10
  };
  const response = searchUnifiedAssetSnapshot(request);
  const assetCandidates: MotionGraphicsCandidateSummary[] = response.results.slice(0, 8).map((result) => ({
    assetId: result.asset_id,
    assetType: result.asset_type,
    score: result.score,
    tags: result.tags,
    labels: result.labels,
    retrievalCaption: result.retrieval_caption,
    semanticDescription: result.semantic_description,
    animated: Boolean(result.motion_asset?.loopable ?? /\.(mp4|webm|mov|html)$/i.test(result.public_path)),
    confidence: result.confidence
  }));

  return {
    sceneId,
    transcriptSegment,
    hookScore: clamp01(chunk.semantic?.intent === "punch-emphasis" ? 0.88 : 0.42 + (chunk.emphasisWordIndices?.length ?? 0) * 0.08),
    emphasisScore: clamp01(0.34 + (chunk.emphasisWordIndices?.length ?? 0) * 0.13),
    desiredOutcome: resolveDesiredOutcome(sceneKind, transcriptSegment),
    tone: resolveTone(chunk, tier),
    motionIntensity: energyLevel,
    creatorStylePreset: tier,
    visualMode,
    sceneIntent: request.sceneIntent ?? "statement scene",
    sceneKind,
    keywords,
    visibleText,
    assetCandidates,
    avoidList,
    placementConstraints: {
      avoidList,
      forbiddenRegions: safeZones.filter((zone) => zone.kind === "text" || zone.kind === "face"),
      preferredAnchors: textOccupiesCenterFrame
        ? ["left", "right", "top-left", "top-right", "bottom-left", "bottom-right"]
        : ["center", "left", "right"],
      textSafeZoneId: safeZones.find((zone) => zone.kind === "text")?.id,
      faceSafeZoneId: safeZones.find((zone) => zone.kind === "face")?.id,
      centerReserved: textOccupiesCenterFrame || subjectOccupiesCenterFrame,
      notes: [
        "Do not block main text.",
        "Do not cover the subject's face.",
        "Do not place decorative assets in the center unless the center is intentionally free.",
        "Do not use assets that create random blur columns or fake glass pillars.",
        "Choose assets that elevate narrative emphasis.",
        "Return JSON only."
      ]
    },
    safeAreaConstraints: safeZones,
    backgroundLuminanceNote: "Backdrop is dark, contrast can support light-edged assets but should stay restrained.",
    contrastNote: "Headline contrast is the top priority.",
    subjectOccupiesCenterFrame,
    textOccupiesCenterFrame,
    request
  };
};
