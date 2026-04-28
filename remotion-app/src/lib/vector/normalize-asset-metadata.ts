import {CAPTION_STYLE_PROFILE_IDS, getCaptionStyleProfile} from "../stylebooks/caption-style-profiles";

import {buildEmbeddingTextForAsset} from "./build-embedding-text";
import {vectorAssetRecordSchema, type VectorAssetRecord, type VectorRenderComplexity} from "./schemas";

type StaticImageAssetMetadata = {
  id: string;
  filename: string;
  folder?: string;
  relative_path?: string;
  file_size_bytes?: number;
  dimensions?: {
    width?: number;
    height?: number;
    aspect_ratio?: string;
  };
  detected_objects?: string[];
  folder_context?: {
    category?: string;
    brand_context?: string;
    use_cases?: string[];
  };
  literal_tags?: string[];
  symbolic_tags?: string[];
  narrative_tags?: string[];
  brand_tags?: string[];
  motion_tags?: string[];
  conversion_tags?: string[];
};

type MotionGraphicMetadata = {
  assetId: string;
  assetName: string;
  primaryFunction?: string;
  secondaryFunctions?: string[];
  emotionalRoles?: string[];
  rhetoricalRoles?: string[];
  visualEnergy?: string;
  motionBehavior?: string[];
  styleFamily?: string[];
  creatorFit?: string[];
  sceneUseCases?: string[];
  symbolicMeaning?: string[];
  renderComplexity?: string;
  recommendedPlacement?: string[];
  vectorSearchText?: string;
  animationDuration?: string;
  features?: Record<string, boolean>;
};

type GsapModuleMetadata = {
  moduleId: string;
  moduleName: string;
  relativePath?: string;
  primaryAnimationFunction?: string;
  secondaryAnimationFunctions?: string[];
  rhetoricalRoles?: string[];
  emotionalRoles?: string[];
  sceneUseCases?: string[];
  motionGrammar?: string[];
  supportedAssetTypes?: string[];
  replaceableSlots?: Array<{slotName?: string; slotType?: string; description?: string}>;
  compatibility?: Record<string, boolean>;
  negativeGrammar?: {
    forbiddenPairings?: string[];
    riskFactors?: string[];
    avoidWhen?: string[];
    overuseRisk?: string;
  };
  judgmentEngineHints?: {
    bestWhen?: string[];
    avoidWhen?: string[];
  };
  renderProfile?: {
    complexity?: string;
    performanceCost?: string;
  };
  styleFamily?: string[];
  creatorFit?: string[];
  symbolicMeaning?: string[];
  tags?: string[];
  vectorSearchText?: string;
  timingProfile?: {
    estimatedDurationMs?: number;
    tempo?: string;
    pacingShape?: string;
  };
  easingProfile?: {
    easePersonality?: string;
    premiumFeel?: string;
  };
  layoutBehavior?: {
    aspectRatioFit?: string[];
  };
};

type ReferenceAssetMetadata = {
  id: string;
  canonicalLabel?: string;
  src?: string;
  remoteUrl?: string;
  searchTerms?: string[];
  themeTags?: string[];
  showcasePlacementHint?: string;
  family?: string;
  tier?: string;
  safeArea?: string;
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

const toComplexity = (value: string | undefined): VectorRenderComplexity => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "low" || normalized === "simple" || normalized === "light") return "low";
  if (normalized === "medium" || normalized === "moderate") return "medium";
  if (normalized === "high" || normalized === "heavy") return "high";
  return "unknown";
};

const nowIso = (): string => new Date().toISOString();

const finalizeRecord = (record: Omit<VectorAssetRecord, "vectorSearchText"> & {vectorSearchText?: string}): VectorAssetRecord => {
  const parsed = vectorAssetRecordSchema.parse({
    ...record,
    vectorSearchText: record.vectorSearchText ?? ""
  });
  return {
    ...parsed,
    vectorSearchText: parsed.vectorSearchText || buildEmbeddingTextForAsset(parsed)
  };
};

export const normalizeStaticImageMetadata = (asset: StaticImageAssetMetadata): VectorAssetRecord => {
  const literalTags = uniqueStrings([...(asset.literal_tags ?? []), ...(asset.detected_objects ?? [])]);
  const semanticTags = uniqueStrings([
    ...(asset.symbolic_tags ?? []),
    ...(asset.narrative_tags ?? []),
    ...(asset.brand_tags ?? []),
    ...(asset.conversion_tags ?? [])
  ]);
  const aspectRatio = asset.dimensions?.aspect_ratio ? [String(asset.dimensions.aspect_ratio)] : [];
  return finalizeRecord({
    id: `static:${asset.id}`,
    assetId: asset.id,
    assetType: "static_image",
    partition: "static_images",
    sourceLibrary: "static-image-metadata",
    title: asset.filename,
    relativePath: asset.relative_path ?? "",
    absolutePath: "",
    publicPath: "",
    literalTags,
    semanticTags,
    rhetoricalRoles: uniqueStrings([asset.folder_context?.category, ...((asset.folder_context?.use_cases ?? []).map((value) => String(value)))]),
    emotionalRoles: uniqueStrings(asset.brand_tags ?? []),
    motionTags: uniqueStrings(asset.motion_tags ?? []),
    styleFamily: uniqueStrings([asset.folder_context?.brand_context, ...(asset.brand_tags ?? [])]),
    creatorFit: uniqueStrings(asset.brand_tags ?? []),
    sceneUseCases: uniqueStrings(asset.folder_context?.use_cases ?? []),
    symbolicMeaning: uniqueStrings(asset.symbolic_tags ?? []),
    compatibility: uniqueStrings(asset.conversion_tags ?? []),
    negativeGrammar: [],
    renderComplexity: "low",
    visualEnergy: "static",
    supportedAspectRatios: aspectRatio,
    replaceableSlots: [],
    features: uniqueStrings([
      ...(asset.motion_tags ?? []),
      asset.folder_context?.category
    ]),
    metadataJson: asset as unknown as Record<string, unknown>,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
};

export const normalizeMotionGraphicMetadata = (asset: MotionGraphicMetadata): VectorAssetRecord => {
  const features = Object.entries(asset.features ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  return finalizeRecord({
    id: `motion:${asset.assetId}`,
    assetId: asset.assetId,
    assetType: "motion_graphic",
    partition: "motion_graphics",
    sourceLibrary: "motion-graphics-metadata",
    title: asset.assetName,
    relativePath: asset.assetId,
    absolutePath: "",
    publicPath: "",
    literalTags: uniqueStrings([asset.primaryFunction, ...(asset.secondaryFunctions ?? [])]),
    semanticTags: uniqueStrings([...(asset.symbolicMeaning ?? []), ...(asset.secondaryFunctions ?? [])]),
    rhetoricalRoles: uniqueStrings(asset.rhetoricalRoles ?? []),
    emotionalRoles: uniqueStrings(asset.emotionalRoles ?? []),
    motionTags: uniqueStrings(asset.motionBehavior ?? []),
    styleFamily: uniqueStrings(asset.styleFamily ?? []),
    creatorFit: uniqueStrings(asset.creatorFit ?? []),
    sceneUseCases: uniqueStrings([...(asset.sceneUseCases ?? []), ...(asset.recommendedPlacement ?? [])]),
    symbolicMeaning: uniqueStrings(asset.symbolicMeaning ?? []),
    compatibility: uniqueStrings(features),
    negativeGrammar: [],
    renderComplexity: toComplexity(asset.renderComplexity),
    visualEnergy: asset.visualEnergy ?? "unknown",
    supportedAspectRatios: ["9:16", "16:9", "1:1"],
    replaceableSlots: [],
    features,
    vectorSearchText: asset.vectorSearchText,
    metadataJson: asset as unknown as Record<string, unknown>,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
};

export const normalizeGsapAnimationMetadata = (asset: GsapModuleMetadata): VectorAssetRecord => {
  const compatibility = Object.entries(asset.compatibility ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const negativeGrammar = uniqueStrings([
    ...(asset.negativeGrammar?.forbiddenPairings ?? []),
    ...(asset.negativeGrammar?.riskFactors ?? []),
    ...(asset.negativeGrammar?.avoidWhen ?? [])
  ]);
  const replaceableSlots = uniqueStrings((asset.replaceableSlots ?? []).flatMap((slot) => [
    slot.slotName,
    slot.slotType,
    slot.description
  ]));
  return finalizeRecord({
    id: `gsap:${asset.moduleId}`,
    assetId: asset.moduleId,
    assetType: "gsap_animation_logic",
    partition: "gsap_animation_logic",
    sourceLibrary: "gsap-animation-metadata",
    title: asset.moduleName,
    relativePath: asset.relativePath ?? asset.moduleId,
    absolutePath: "",
    publicPath: "",
    literalTags: uniqueStrings([asset.primaryAnimationFunction, ...(asset.secondaryAnimationFunctions ?? []), ...(asset.tags ?? [])]),
    semanticTags: uniqueStrings([...(asset.symbolicMeaning ?? []), ...(asset.judgmentEngineHints?.bestWhen ?? [])]),
    rhetoricalRoles: uniqueStrings(asset.rhetoricalRoles ?? []),
    emotionalRoles: uniqueStrings(asset.emotionalRoles ?? []),
    motionTags: uniqueStrings(asset.motionGrammar ?? []),
    styleFamily: uniqueStrings([
      ...(asset.styleFamily ?? []),
      asset.easingProfile?.easePersonality,
      asset.easingProfile?.premiumFeel,
      asset.timingProfile?.tempo,
      asset.timingProfile?.pacingShape
    ]),
    creatorFit: uniqueStrings(asset.creatorFit ?? []),
    sceneUseCases: uniqueStrings(asset.sceneUseCases ?? []),
    symbolicMeaning: uniqueStrings(asset.symbolicMeaning ?? []),
    compatibility: uniqueStrings([...(asset.supportedAssetTypes ?? []), ...compatibility]),
    negativeGrammar,
    renderComplexity: toComplexity(asset.renderProfile?.complexity ?? asset.renderProfile?.performanceCost),
    visualEnergy: asset.timingProfile?.tempo ?? "unknown",
    supportedAspectRatios: uniqueStrings(asset.layoutBehavior?.aspectRatioFit ?? []),
    replaceableSlots,
    features: uniqueStrings([
      ...(asset.supportedAssetTypes ?? []),
      asset.primaryAnimationFunction,
      asset.easingProfile?.easePersonality
    ]),
    vectorSearchText: asset.vectorSearchText,
    metadataJson: asset as unknown as Record<string, unknown>,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
};

export const normalizeTypographyAssets = (): VectorAssetRecord[] => {
  return CAPTION_STYLE_PROFILE_IDS.map((profileId) => {
    const profile = getCaptionStyleProfile(profileId);
    const styleFamily = uniqueStrings([
      profile.displayName,
      profileId.includes("svg") ? "svg-typography" : null,
      profileId.includes("longform") ? "longform" : "shortform",
      profileId.includes("hormozi") ? "conversion" : "editorial"
    ]);
    const sceneUseCases = uniqueStrings([
      profileId.includes("semantic") ? "explanation" : "hook",
      profileId.includes("longform") ? "education" : "headline",
      profileId.includes("hormozi") ? "cta" : "authority"
    ]);
    return finalizeRecord({
      id: `typography:${profile.id}`,
      assetId: profile.id,
      assetType: "typography",
      partition: "typography",
      sourceLibrary: "caption-style-profiles",
      title: profile.displayName,
      relativePath: profile.id,
      absolutePath: "",
      publicPath: "",
      literalTags: uniqueStrings([profile.id, profile.displayName]),
      semanticTags: uniqueStrings(sceneUseCases),
      rhetoricalRoles: uniqueStrings(sceneUseCases),
      emotionalRoles: uniqueStrings(profile.id.includes("hormozi") ? ["urgency", "confidence"] : ["clarity", "authority"]),
      motionTags: uniqueStrings([
        profile.id.includes("svg") ? "shape-driven-typography" : "caption-motion",
        profile.strictWordLockHighlight ? "word-lock" : "phrase-flow"
      ]),
      styleFamily,
      creatorFit: uniqueStrings(profile.id.includes("hormozi") ? ["conversion-editor"] : ["cinematic-editor", "authority-builder"]),
      sceneUseCases,
      symbolicMeaning: uniqueStrings(["clarity", "readability", "typographic-emphasis"]),
      compatibility: uniqueStrings([
        `default-bias:${profile.defaultCaptionBias ?? "middle"}`,
        `hard-max-words:${profile.groupingPolicy.hardMaxWords}`,
        `soft-max-words:${profile.groupingPolicy.softMaxWords}`
      ]),
      negativeGrammar: uniqueStrings([
        profile.groupingPolicy.hardMaxWords >= 6 ? "can-overload-short-hooks" : null
      ]),
      renderComplexity: profile.id.includes("svg") ? "medium" : "low",
      visualEnergy: profile.id.includes("hormozi") ? "punchy" : "restrained",
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      replaceableSlots: ["headline", "caption"],
      features: uniqueStrings([
        profile.strictWordLockHighlight ? "strict-highlight" : "phrase-emphasis",
        `default-bias:${profile.defaultCaptionBias ?? "middle"}`
      ]),
      metadataJson: profile as unknown as Record<string, unknown>,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  });
};

export const normalizeReferenceMetadata = (assets: ReferenceAssetMetadata[]): VectorAssetRecord[] => {
  return assets.map((asset) => finalizeRecord({
    id: `reference:${asset.id}`,
    assetId: asset.id,
    assetType: "reference",
    partition: "references",
    sourceLibrary: "showcase-reference-assets",
    title: asset.canonicalLabel ?? asset.id,
    relativePath: asset.src ?? asset.remoteUrl ?? asset.id,
    absolutePath: "",
    publicPath: asset.src ?? "",
    literalTags: uniqueStrings([asset.canonicalLabel, ...(asset.searchTerms ?? [])]),
    semanticTags: uniqueStrings([...(asset.themeTags ?? []), asset.family, asset.showcasePlacementHint]),
    rhetoricalRoles: uniqueStrings([asset.family, asset.showcasePlacementHint]),
    emotionalRoles: uniqueStrings(asset.themeTags ?? []),
    motionTags: uniqueStrings([asset.showcasePlacementHint, asset.safeArea]),
    styleFamily: uniqueStrings([asset.family, asset.tier]),
    creatorFit: uniqueStrings(asset.tier === "hero" ? ["premium_creator", "authority_builder"] : ["editorial_creator"]),
    sceneUseCases: uniqueStrings([asset.family, asset.showcasePlacementHint]),
    symbolicMeaning: uniqueStrings(asset.themeTags ?? []),
    compatibility: uniqueStrings([asset.safeArea, asset.showcasePlacementHint]),
    negativeGrammar: [],
    renderComplexity: "low",
    visualEnergy: asset.tier ?? "unknown",
    supportedAspectRatios: ["9:16", "16:9", "1:1"],
    replaceableSlots: [],
    features: uniqueStrings(asset.searchTerms ?? []),
    metadataJson: asset as unknown as Record<string, unknown>,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }));
};
