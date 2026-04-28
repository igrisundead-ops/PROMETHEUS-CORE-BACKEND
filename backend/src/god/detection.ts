import type {GodNeedAssessment, GodNeedCandidate, GodReferenceAsset, GodSceneContext} from "./types";
import {godNeedAssessmentSchema} from "./types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const singularizeToken = (value: string): string => {
  if (value.length > 4 && /(ches|shes|xes|zes|ses)$/i.test(value)) {
    return value.slice(0, -2);
  }
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
};

const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(" ")
    .map(singularizeToken)
    .filter((token) => token.length > 1);
};

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const scoreOverlap = (queryTerms: string[], corpusTerms: string[]): number => {
  if (queryTerms.length === 0 || corpusTerms.length === 0) {
    return 0;
  }

  const corpus = new Set(corpusTerms.map((term) => normalizeText(term)));
  let score = 0;
  queryTerms.forEach((term) => {
    const normalized = normalizeText(term);
    if (!normalized) {
      return;
    }
    if (corpus.has(normalized)) {
      score += normalized.includes(" ") ? 0.12 : 0.05;
      return;
    }
    const partial = [...corpus].find((entry) => entry.includes(normalized) || normalized.includes(entry));
    if (partial) {
      score += partial.includes(" ") ? 0.08 : 0.03;
    }
  });
  return clamp01(score);
};

const buildQueryTerms = (context: GodSceneContext): string[] => {
  return unique([
    context.prompt,
    context.sceneLabel,
    context.exactMoment,
    context.semanticRole,
    context.visualTone,
    context.motionLanguage,
    context.compositionNeed,
    context.requiredText,
    context.notes,
    ...context.requiredElements,
    ...context.forbiddenElements,
    ...context.compositionConstraints,
    ...context.paletteGuidance,
    ...context.brandRules,
    ...context.referenceTags
  ].flatMap((value) => tokenize(String(value ?? ""))));
};

const inferPreferredForm = (context: GodSceneContext): GodSceneContext["preferredForm"] => {
  const text = normalizeText([
    context.prompt,
    context.semanticRole,
    context.compositionNeed,
    context.visualTone,
    context.requiredText
  ].join(" "));

  if (/(text|typography|quote|headline|letter|caption)/.test(text)) {
    return "text-glow";
  }
  if (/(panel|card|bubble|ui|fragment|window|sheet)/.test(text)) {
    return "panel";
  }
  if (/(frame|border|outline|edge|corner)/.test(text)) {
    return "frame";
  }
  if (/(flare|glow|light|beam|sweep|halo)/.test(text)) {
    return "flare";
  }
  if (/(symbol|icon|badge|mark|emblem|glyph)/.test(text)) {
    return "symbol";
  }
  if (/(texture|grain|noise|atmosphere|depth)/.test(text)) {
    return "texture";
  }
  return "orb";
};

const scoreCandidate = (context: GodSceneContext, asset: GodReferenceAsset): GodNeedCandidate => {
  const queryTerms = buildQueryTerms(context);
  const assetTerms = unique([
    asset.id,
    asset.label,
    asset.sourceKind,
    asset.assetRole,
    asset.family,
    asset.tier,
    asset.src,
    asset.sourceFile,
    asset.sourceHtml,
    asset.sourceBatch,
    ...(asset.themeTags ?? []),
    ...(asset.semanticTags ?? []),
    ...(asset.subjectTags ?? []),
    ...(asset.emotionalTags ?? []),
    ...(asset.functionalTags ?? []),
    ...(asset.searchTerms ?? [])
  ].flatMap((value) => tokenize(String(value ?? ""))));

  const semanticFit = scoreOverlap(
    [
      context.prompt,
      context.semanticRole,
      context.exactMoment,
      context.requiredText,
      ...context.requiredElements,
      ...context.referenceTags
    ].flatMap((value) => tokenize(String(value ?? ""))),
    assetTerms
  );

  const stylisticFit = scoreOverlap(
    [
      context.visualTone,
      context.toneTarget,
      context.motionLanguage,
      context.assetRole,
      context.preferredForm
    ].flatMap((value) => tokenize(String(value ?? ""))),
    assetTerms
  ) + (asset.assetRole === context.assetRole ? 0.16 : 0);

  const motionFit = clamp01(
    scoreOverlap(tokenize(context.motionLanguage), assetTerms) +
      (asset.renderMode === "iframe" && context.isOverlayAsset ? 0.12 : 0) +
      (asset.durationPolicy === "scene-span" ? 0.1 : 0) +
      (asset.loopable ? 0.06 : 0)
  );

  const compositionFit = clamp01(
    scoreOverlap(
      [
        context.compositionNeed,
        context.presentationMode,
        context.width ? `${context.width}` : "",
        context.height ? `${context.height}` : "",
        ...context.compositionConstraints
      ].flatMap((value) => tokenize(String(value ?? ""))),
      assetTerms
    ) +
      (asset.placementZone && context.isOverlayAsset ? 0.1 : 0) +
      (asset.safeArea === "avoid-caption-region" || asset.safeArea === "edge-safe" ? 0.08 : 0)
  );

  const emotionalFit = clamp01(
    scoreOverlap(
      [
        context.toneTarget,
        context.visualTone,
        context.prompt,
        ...context.paletteGuidance,
        ...context.brandRules
      ].flatMap((value) => tokenize(String(value ?? ""))),
      unique([...(asset.themeTags ?? []), ...(asset.emotionalTags ?? [])])
    ) +
      (asset.themeTags?.includes("authority") ? 0.04 : 0) +
      (asset.themeTags?.includes("heroic") ? 0.04 : 0)
  );

  const qualityScore = clamp01(
    (asset.metadataConfidence ?? 0.54) * 0.65 +
      (asset.idealDurationMs ? 0.12 : 0.04) +
      (asset.sourceHtml ? 0.12 : 0.02) +
      ((asset.semanticTags?.length ?? 0) > 0 ? 0.07 : 0)
  );

  const total = clamp01(
    semanticFit * 0.3 +
      stylisticFit * 0.2 +
      motionFit * 0.16 +
      compositionFit * 0.16 +
      emotionalFit * 0.08 +
      qualityScore * 0.1
  );

  const reasons = [
    semanticFit >= 0.72 ? "semantic-match-strong" : semanticFit >= 0.46 ? "semantic-match-moderate" : "semantic-match-weak",
    stylisticFit >= 0.72 ? "style-match-strong" : stylisticFit >= 0.48 ? "style-match-moderate" : "style-match-weak",
    motionFit >= 0.7 ? "motion-fit-strong" : motionFit >= 0.48 ? "motion-fit-moderate" : "motion-fit-weak",
    compositionFit >= 0.7 ? "composition-fit-strong" : compositionFit >= 0.48 ? "composition-fit-moderate" : "composition-fit-weak",
    emotionalFit >= 0.7 ? "tone-fit-strong" : emotionalFit >= 0.48 ? "tone-fit-moderate" : "tone-fit-weak",
    qualityScore >= 0.7 ? "quality-fit-strong" : qualityScore >= 0.48 ? "quality-fit-moderate" : "quality-fit-weak"
  ];

  return {
    asset,
    score: total,
    semanticFit,
    stylisticFit,
    motionFit,
    compositionFit,
    emotionalFit,
    qualityScore,
    reasons
  };
};

export const assessGodNeed = (context: GodSceneContext): GodNeedAssessment => {
  const preferredForm = context.preferredForm === "orb" ? inferPreferredForm(context) : context.preferredForm;
  const candidates = context.existingAssets
    .map((asset) => scoreCandidate(context, asset))
    .sort((left, right) => right.score - left.score || right.qualityScore - left.qualityScore || left.asset.id.localeCompare(right.asset.id));

  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const bestScore = best?.score ?? 0;
  const gap = best && second ? best.score - second.score : best ? best.score : 1;
  const premiumThresholdHit = Boolean(best && best.score >= 0.82 && best.qualityScore >= 0.68);
  const shouldEscalate =
    context.manualReviewRequested ||
    (best !== null && bestScore >= 0.58 && bestScore < 0.72 && Math.abs(gap) < 0.05) ||
    (best !== null && bestScore < 0.52 && candidates.length > 1 && Math.abs(gap) < 0.04);

  let decision: GodNeedAssessment["decision"] = "generate_new_asset";
  let shouldGenerateVariation = false;
  let rationale = "No suitable existing asset reached the governed quality threshold.";

  if (best && premiumThresholdHit && !context.variationRequested && !shouldEscalate) {
    decision = "use_existing_asset";
    rationale = `Existing asset ${best.asset.id} is a strong semantic/style/motion match.`;
  } else if (shouldEscalate) {
    decision = "escalate_for_manual_review";
    rationale = "The catalog signal is ambiguous or below the premium threshold, so human review should arbitrate before generation.";
  } else if (best && (context.variationRequested || context.isSceneSpecific || bestScore >= 0.62)) {
    decision = "generate_asset_variation";
    shouldGenerateVariation = true;
    rationale = `Existing asset ${best.asset.id} is directionally close, but the moment needs a governed variation.`;
  } else {
    decision = "generate_new_asset";
    rationale = "The current library does not express the requested visual moment with enough precision.";
  }

  const insufficientAspects: string[] = [];
  if (best) {
    if (best.semanticFit < 0.72) insufficientAspects.push("semantic-fit");
    if (best.stylisticFit < 0.72) insufficientAspects.push("stylistic-fit");
    if (best.motionFit < 0.68) insufficientAspects.push("motion-fit");
    if (best.compositionFit < 0.7) insufficientAspects.push("composition-fit");
    if (best.emotionalFit < 0.7) insufficientAspects.push("emotional-fit");
    if (best.qualityScore < 0.68) insufficientAspects.push("premium-quality");
  } else {
    insufficientAspects.push("no-close-existing-asset");
  }

  const assessment = godNeedAssessmentSchema.parse({
    decision,
    confidence: clamp01(
      best ? 0.45 + best.score * 0.4 + (gap > 0.12 ? 0.1 : 0) : 0.72
    ),
    rationale,
    preferredForm,
    shouldGenerateVariation,
    shouldEscalate,
    topCandidates: candidates.slice(0, 5),
    chosenAssetId: best?.asset.id ?? null,
    insufficientAspects: unique(insufficientAspects),
    needScore: clamp01(1 - bestScore),
    premiumThresholdHit,
    backgroundLibraryConsidered: context.backgroundAssets.length > 0
  });

  return assessment;
};

