import path from "node:path";
import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises";

import type {BackendEnv} from "../config";
import {sha256Text} from "../utils/hash";
import {assessGodNeed} from "./detection";
import {buildGodGenerationBrief} from "./brief";
import {buildGodProviderChain, runGodProviderChain} from "./providers";
import {buildGodAssetId, buildGodAssetManifest, writeGodReviewFiles} from "./normalization";
import {buildGodBenchmarkResult, validateGodDraft} from "./validation";
import {GodStore} from "./store";
import {
  godGeneratedAssetRecordSchema,
  godNeedAssessmentSchema,
  godReviewUpdateSchema,
  type GodBenchmarkResult,
  type GodGeneratedAssetRecord,
  type GodGenerationBrief,
  type GodNeedAssessment,
  type GodReferenceAsset,
  type GodReviewUpdate,
  godSceneContextSchema,
  type GodSceneContext
} from "./types";

type FetchLike = typeof fetch;

const BACKEND_ROOT = process.cwd();
const WORKSPACE_ROOT = path.resolve(BACKEND_ROOT, "..");
const REMOTION_DATA_DIR = path.join(WORKSPACE_ROOT, "remotion-app", "src", "data");

const DEFAULT_REFERENCE_CATALOG_PATHS = [
  path.join(REMOTION_DATA_DIR, "motion-assets.remote.json"),
  path.join(REMOTION_DATA_DIR, "motion-assets.authoring.generated.json"),
  path.join(REMOTION_DATA_DIR, "god-assets.generated.json"),
  path.join(REMOTION_DATA_DIR, "showcase-assets.remote.json"),
  path.join(REMOTION_DATA_DIR, "showcase-assets.imports.local.json"),
  path.join(REMOTION_DATA_DIR, "showcase-assets.imports.prometheus-concrete.local.json")
] as const;

const BACKGROUND_OVERLAY_CATALOG_PATH = path.join(REMOTION_DATA_DIR, "background-overlays.local.json");

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

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

const scoreTokenOverlap = (left: string[], right: string[]): number => {
  const leftSet = new Set(left.map((value) => normalizeText(value)).filter(Boolean));
  const rightSet = new Set(right.map((value) => normalizeText(value)).filter(Boolean));
  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  leftSet.forEach((value) => {
    if (rightSet.has(value)) {
      intersection += 1;
    }
  });
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const manifestValue = (manifest: Record<string, unknown>, key: string): string => {
  return String(manifest[key] ?? "").trim();
};

const buildBriefSimilarityCorpus = (brief: GodGenerationBrief): string[] => {
  return unique(
    [
      brief.assetPurpose,
      brief.semanticRole,
      brief.visualTone,
      brief.motionLanguage,
      brief.promptText,
      brief.systemPrompt,
      brief.userPrompt,
      brief.reusabilityGoal,
      brief.sceneContext.sceneLabel,
      brief.sceneContext.exactMoment,
      brief.sceneContext.requiredText,
      brief.sceneContext.compositionNeed,
      brief.sceneContext.toneTarget,
      brief.sceneContext.templateFamily,
      brief.preferredForm,
      ...brief.sceneContext.requiredElements,
      ...brief.sceneContext.compositionConstraints,
      ...brief.sceneContext.paletteGuidance,
      ...brief.sceneContext.brandRules,
      ...brief.sceneContext.referenceTags,
      ...brief.requiredElements,
      ...brief.compositionConstraints,
      ...brief.paletteGuidance,
      ...brief.brandRules,
      ...brief.forbiddenElements,
      ...brief.referenceNotes,
      ...brief.exportConstraints,
      ...brief.existingAssetReferences.map((asset) => `${asset.label ?? ""}`),
      ...brief.backgroundReferences.map((asset) => `${asset.label ?? ""}`)
    ]
      .flatMap((value) => tokenize(String(value ?? "")))
  );
};

const buildManifestSimilarityCorpus = (manifest: Record<string, unknown>): string[] => {
  return unique(
    [
      manifestValue(manifest, "canonicalLabel"),
      manifestValue(manifest, "promptText"),
      manifestValue(manifest, "systemPrompt"),
      manifestValue(manifest, "userPrompt"),
      manifestValue(manifest, "assetRole"),
      manifestValue(manifest, "family"),
      manifestValue(manifest, "tier"),
      manifestValue(manifest, "sourceKind"),
      manifestValue(manifest, "visualTone"),
      manifestValue(manifest, "semanticRole"),
      manifestValue(manifest, "assetPurpose"),
      manifestValue(manifest, "motionLanguage"),
      manifestValue(manifest, "briefVersion"),
      manifestValue(manifest, "reusabilityGoal"),
      manifestValue(manifest, "label"),
      ...(Array.isArray(manifest.themeTags) ? manifest.themeTags.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.semanticTags) ? manifest.semanticTags.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.subjectTags) ? manifest.subjectTags.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.emotionalTags) ? manifest.emotionalTags.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.functionalTags) ? manifest.functionalTags.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.searchTerms) ? manifest.searchTerms.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.referenceNotes) ? manifest.referenceNotes.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.exportConstraints) ? manifest.exportConstraints.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.forbiddenElements) ? manifest.forbiddenElements.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.requiredElements) ? manifest.requiredElements.map((value) => String(value)) : []),
      ...(Array.isArray(manifest.compositionConstraints) ? manifest.compositionConstraints.map((value) => String(value)) : [])
    ]
      .flatMap((value) => tokenize(String(value ?? "")))
  );
};

const scoreBriefSimilarity = (brief: GodGenerationBrief, manifest: Record<string, unknown>): number => {
  const briefCorpus = buildBriefSimilarityCorpus(brief);
  const manifestCorpus = buildManifestSimilarityCorpus(manifest);
  const tokenOverlap = scoreTokenOverlap(briefCorpus, manifestCorpus);
  const sameSemanticRole = normalizeText(manifestValue(manifest, "semanticRole")) === normalizeText(brief.semanticRole) ? 0.08 : 0;
  const samePreferredForm = normalizeText(manifestValue(manifest, "preferredForm")) === normalizeText(brief.preferredForm) ? 0.05 : 0;
  const sameAssetRole = normalizeText(manifestValue(manifest, "assetRole")) === normalizeText(brief.sceneContext.assetRole) ? 0.05 : 0;
  const sameTone = normalizeText(manifestValue(manifest, "visualTone")) === normalizeText(brief.visualTone) ? 0.04 : 0;
  const sameMotion = normalizeText(manifestValue(manifest, "motionLanguage")) === normalizeText(brief.motionLanguage) ? 0.04 : 0;
  const samePurpose = normalizeText(manifestValue(manifest, "assetPurpose")) === normalizeText(brief.assetPurpose) ? 0.04 : 0;

  return clamp01(tokenOverlap * 0.7 + sameSemanticRole + samePreferredForm + sameAssetRole + sameTone + sameMotion + samePurpose);
};

const toReferenceAsset = (manifest: Record<string, unknown>): GodReferenceAsset | null => {
  const id = manifestValue(manifest, "id");
  if (!id) {
    return null;
  }

  const label = manifestValue(manifest, "canonicalLabel") || manifestValue(manifest, "label") || id;
  const sourceKind = manifestValue(manifest, "sourceKind") || undefined;
  const assetRole = manifestValue(manifest, "assetRole") as GodReferenceAsset["assetRole"] | undefined;
  const family = manifestValue(manifest, "family") || undefined;
  const tier = manifestValue(manifest, "tier") as GodReferenceAsset["tier"] | undefined;
  const src = manifestValue(manifest, "src") || manifestValue(manifest, "sourceFile") || manifestValue(manifest, "sourceHtml") || undefined;
  const sourceFile = manifestValue(manifest, "sourceFile") || undefined;
  const sourceHtml = manifestValue(manifest, "sourceHtml") || undefined;
  const sourceBatch = manifestValue(manifest, "sourceBatch") || undefined;
  const themeTags = Array.isArray(manifest.themeTags) ? manifest.themeTags.map((value) => String(value)).filter(Boolean) : [];
  const semanticTags = Array.isArray(manifest.semanticTags) ? manifest.semanticTags.map((value) => String(value)).filter(Boolean) : [];
  const subjectTags = Array.isArray(manifest.subjectTags) ? manifest.subjectTags.map((value) => String(value)).filter(Boolean) : [];
  const emotionalTags = Array.isArray(manifest.emotionalTags) ? manifest.emotionalTags.map((value) => String(value)).filter(Boolean) as GodReferenceAsset["emotionalTags"] : [];
  const functionalTags = Array.isArray(manifest.functionalTags) ? manifest.functionalTags.map((value) => String(value)).filter(Boolean) : [];
  const placementZone = manifestValue(manifest, "placementZone") as GodReferenceAsset["placementZone"] | undefined;
  const safeArea = manifestValue(manifest, "safeArea") as GodReferenceAsset["safeArea"] | undefined;
  const durationPolicy = manifestValue(manifest, "durationPolicy") as GodReferenceAsset["durationPolicy"] | undefined;
  const renderMode = manifestValue(manifest, "renderMode") as GodReferenceAsset["renderMode"] | undefined;
  const loopableValue = manifest.loopable;
  const opacityValue = typeof manifest.opacity === "number" ? manifest.opacity : Number(manifest.opacity);
  const confidenceValue = typeof manifest.metadataConfidence === "number" ? manifest.metadataConfidence : Number(manifest.metadataConfidence);
  const idealDurationValue = typeof manifest.idealDurationMs === "number" ? manifest.idealDurationMs : Number(manifest.idealDurationMs);
  const scoreValue = typeof manifest.score === "number" ? manifest.score : Number(manifest.score);

  return {
    id,
    label,
    sourceKind,
    assetRole,
    family,
    tier,
    src,
    sourceFile,
    sourceHtml,
    sourceBatch,
    themeTags: themeTags.filter((tag): tag is NonNullable<GodReferenceAsset["themeTags"]>[number] => ["neutral", "warm", "cool", "calm", "kinetic", "authority", "heroic"].includes(tag)),
    semanticTags,
    subjectTags,
    emotionalTags: emotionalTags.filter((tag): tag is NonNullable<GodReferenceAsset["emotionalTags"]>[number] => ["neutral", "warm", "cool", "calm", "kinetic", "authority", "heroic"].includes(tag)),
    functionalTags,
    placementZone,
    safeArea,
    durationPolicy,
    renderMode,
    loopable: typeof loopableValue === "boolean" ? loopableValue : undefined,
    blendMode: manifestValue(manifest, "blendMode") || undefined,
    opacity: Number.isFinite(opacityValue) ? opacityValue : undefined,
    metadataConfidence: Number.isFinite(confidenceValue) ? confidenceValue : undefined,
    idealDurationMs: Number.isFinite(idealDurationValue) ? idealDurationValue : undefined,
    searchTerms: Array.isArray(manifest.searchTerms) ? manifest.searchTerms.map((value) => String(value)).filter(Boolean) : [],
    score: Number.isFinite(scoreValue) ? scoreValue : undefined
  };
};

const readJsonIfExists = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
};

const normalizeRecordList = (records: Array<Record<string, unknown>>): GodReferenceAsset[] => {
  const normalized: GodReferenceAsset[] = [];

  records.forEach((record) => {
    const candidate = {
      ...record,
      id: String(record.id ?? record.asset_id ?? record.assetId ?? "").trim(),
      label: String(record.label ?? record.canonicalLabel ?? record.displayName ?? record.assetName ?? record.id ?? "").trim(),
      sourceKind: String(record.sourceKind ?? record.source_kind ?? "").trim() || undefined,
      assetRole: record.assetRole ?? undefined,
      family: String(record.family ?? "").trim() || undefined,
      tier: String(record.tier ?? "").trim() || undefined,
      src: String(record.src ?? record.image_url ?? record.imageUrl ?? "").trim() || undefined,
      sourceFile: String(record.sourceFile ?? record.source_file ?? "").trim() || undefined,
      sourceHtml: String(record.sourceHtml ?? record.source_html ?? "").trim() || undefined,
      sourceBatch: String(record.sourceBatch ?? record.source_batch ?? "").trim() || undefined,
      themeTags: Array.isArray(record.themeTags) ? record.themeTags : Array.isArray(record.theme_tags) ? record.theme_tags : [],
      semanticTags: Array.isArray(record.semanticTags) ? record.semanticTags : [],
      subjectTags: Array.isArray(record.subjectTags) ? record.subjectTags : [],
      emotionalTags: Array.isArray(record.emotionalTags) ? record.emotionalTags : [],
      functionalTags: Array.isArray(record.functionalTags) ? record.functionalTags : [],
      placementZone: record.placementZone ?? record.placement_zone,
      safeArea: record.safeArea ?? record.safe_area,
      durationPolicy: record.durationPolicy ?? record.duration_policy,
      renderMode: record.renderMode ?? record.render_mode,
      loopable: typeof record.loopable === "boolean" ? record.loopable : undefined,
      blendMode: String(record.blendMode ?? record.blend_mode ?? "").trim() || undefined,
      opacity: typeof record.opacity === "number" ? record.opacity : undefined,
      metadataConfidence: typeof record.metadataConfidence === "number" ? record.metadataConfidence : undefined,
      idealDurationMs: typeof record.idealDurationMs === "number" ? record.idealDurationMs : undefined,
      searchTerms: Array.isArray(record.searchTerms) ? record.searchTerms : [],
      score: typeof record.score === "number" ? record.score : undefined
    };

    if (!candidate.id) {
      return;
    }

    normalized.push(candidate as GodReferenceAsset);
  });

  return normalized;
};

const mapBackgroundOverlayReferences = async (): Promise<GodReferenceAsset[]> => {
  const overlays = await readJsonIfExists<Array<Record<string, unknown>>>(BACKGROUND_OVERLAY_CATALOG_PATH);
  if (!overlays?.length) {
    return [];
  }

  return overlays.map((overlay) => ({
    id: String(overlay.id ?? overlay.label ?? "background-overlay").trim(),
    label: String(overlay.label ?? overlay.id ?? "background overlay").trim(),
    sourceKind: "background-stock",
    assetRole: "background",
    family: "texture",
    tier: (overlay.durationSeconds && Number(overlay.durationSeconds) > 30 ? "premium" : "editorial") as GodReferenceAsset["tier"],
    src: String(overlay.src ?? "").trim(),
    sourceFile: String(overlay.src ?? "").trim(),
    sourceHtml: undefined,
    sourceBatch: "background-overlays.local.json",
    themeTags: Array.isArray(overlay.themeTags) ? overlay.themeTags.filter((tag): tag is NonNullable<GodReferenceAsset["themeTags"]>[number] => ["neutral", "warm", "cool", "calm", "kinetic", "authority", "heroic"].includes(String(tag))) : ["neutral"],
    semanticTags: ["background", "overlay", "atmospheric"],
    subjectTags: ["background", "overlay"],
    emotionalTags: Array.isArray(overlay.themeTags) ? overlay.themeTags.filter((tag): tag is NonNullable<GodReferenceAsset["emotionalTags"]>[number] => ["neutral", "warm", "cool", "calm", "kinetic", "authority", "heroic"].includes(String(tag))) : ["calm"],
    functionalTags: ["background-depth", "texture"],
    placementZone: "background-depth",
    safeArea: "full-frame",
    durationPolicy: "scene-span",
    renderMode: "image",
    loopable: true,
    blendMode: "normal",
    opacity: 1,
    metadataConfidence: 0.52,
    idealDurationMs: typeof overlay.durationSeconds === "number" ? Math.round(overlay.durationSeconds * 1000) : undefined,
    searchTerms: unique([
      String(overlay.id ?? ""),
      String(overlay.label ?? ""),
      ...(Array.isArray(overlay.themeTags) ? overlay.themeTags.map((tag) => String(tag)) : [])
    ])
  }));
};

const mergeUniqueAssets = (assets: GodReferenceAsset[]): GodReferenceAsset[] => {
  const seen = new Set<string>();
  const merged: GodReferenceAsset[] = [];

  assets.forEach((asset) => {
    if (seen.has(asset.id)) {
      return;
    }
    seen.add(asset.id);
    merged.push(asset);
  });

  return merged;
};

const copyIfExists = async (sourcePath: string, destinationPath: string): Promise<void> => {
  try {
    await mkdir(path.dirname(destinationPath), {recursive: true});
    await copyFile(sourcePath, destinationPath);
  } catch {
    // Review bundles may be partial in failure states. Missing files should not block promotion bookkeeping.
  }
};

type SimilarApprovedAssetMatch = {
  asset: GodReferenceAsset;
  similarity: number;
  manifest: Record<string, unknown>;
};

export type GodGenerationResult = {
  decision: GodNeedAssessment["decision"];
  assessment: GodNeedAssessment;
  brief: GodGenerationBrief | null;
  reusedAsset: GodReferenceAsset | null;
  record: GodGeneratedAssetRecord | null;
  validation: GodGeneratedAssetRecord["validation"] | null;
  benchmark: GodBenchmarkResult | null;
  providerAttempts: Array<Record<string, unknown>>;
  manifest: Record<string, unknown> | null;
};

export class GodService {
  public readonly env: BackendEnv;
  private readonly store: GodStore;
  private readonly fetchImpl: FetchLike;
  private readonly providers: ReturnType<typeof buildGodProviderChain>;

  public constructor({
    env,
    fetchImpl
  }: {
    env: BackendEnv;
    fetchImpl?: FetchLike;
  }) {
    this.env = env;
    this.fetchImpl = fetchImpl ?? fetch;
    this.providers = buildGodProviderChain({
      endpoint: env.GOD_PROVIDER_ENDPOINT,
      apiKey: env.GOD_PROVIDER_API_KEY,
      model: env.GOD_PROVIDER_MODEL || undefined,
      kind: env.GOD_PROVIDER_KIND,
      fetchImpl: this.fetchImpl,
      timeoutMs: env.GOD_PROVIDER_TIMEOUT_MS
    });
    this.store = new GodStore({
      rootDir: env.GOD_REVIEW_DIR,
      reviewRootDir: env.GOD_REVIEW_DIR,
      collectionDir: env.GOD_COLLECTION_DIR,
      collectionManifestPath: env.GOD_COLLECTION_MANIFEST_PATH,
      ledgerPath: path.join(env.GOD_REVIEW_DIR, "ledger.ndjson")
    });
  }

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  private async loadReferenceCatalogs(): Promise<GodReferenceAsset[]> {
    const catalogArrays = await Promise.all(
      [...DEFAULT_REFERENCE_CATALOG_PATHS].map(async (catalogPath) => {
        const parsed = await readJsonIfExists<Array<Record<string, unknown>>>(catalogPath);
        return parsed ?? [];
      })
    );
    const primaryAssets = mergeUniqueAssets(catalogArrays.flatMap((entries) => normalizeRecordList(entries)));
    const backgroundAssets = await mapBackgroundOverlayReferences();
    return mergeUniqueAssets([...primaryAssets, ...backgroundAssets]);
  }

  private async loadApprovedCatalogAssets(): Promise<GodReferenceAsset[]> {
    const approvedCatalog = await this.store.readApprovedCatalog();
    return mergeUniqueAssets(normalizeRecordList(approvedCatalog));
  }

  private async findSimilarApprovedAsset(brief: GodGenerationBrief): Promise<SimilarApprovedAssetMatch | null> {
    const approvedCatalog = await this.store.readApprovedCatalog();
    let best: SimilarApprovedAssetMatch | null = null;

    approvedCatalog.forEach((manifest) => {
      const sourceKind = String(manifest.sourceKind ?? manifest.source_kind ?? "").trim();
      if (sourceKind !== "god-generated" && !String(manifest.sourceBatch ?? "").includes("god")) {
        return;
      }

      const similarity = scoreBriefSimilarity(brief, manifest);
      if (!best || similarity > best.similarity) {
        const referenceAsset = toReferenceAsset(manifest) ?? null;
        if (!referenceAsset) {
          return;
        }
        best = {
          asset: referenceAsset,
          similarity,
          manifest
        };
      }
    });

    const bestMatch = best as SimilarApprovedAssetMatch | null;
    if (!bestMatch) {
      return null;
    }

    if (bestMatch.similarity < this.env.GOD_MAX_BRIEF_SIMILARITY) {
      return null;
    }

    return bestMatch;
  }

  private async resolveSceneContext(context: GodSceneContext): Promise<GodSceneContext> {
    const normalizedContext = godSceneContextSchema.parse(context);
    const [approvedAssets, referenceAssets] = await Promise.all([
      this.loadApprovedCatalogAssets(),
      this.loadReferenceCatalogs()
    ]);

    return {
      ...normalizedContext,
      preferredForm: normalizedContext.preferredForm,
      existingAssets: mergeUniqueAssets([...approvedAssets, ...referenceAssets, ...(normalizedContext.existingAssets ?? [])]),
      backgroundAssets: mergeUniqueAssets([
        ...(normalizedContext.backgroundAssets ?? []),
        ...referenceAssets.filter((asset) => asset.assetRole === "background")
      ])
    };
  }

  public async assessScene(context: GodSceneContext): Promise<GodNeedAssessment> {
    const resolved = await this.resolveSceneContext(context);
    return assessGodNeed(resolved);
  }

  private async buildBrief(context: GodSceneContext, assessment: GodNeedAssessment): Promise<GodGenerationBrief> {
    const resolved = await this.resolveSceneContext(context);
    return buildGodGenerationBrief({
      context: resolved,
      assessment,
      existingAssets: resolved.existingAssets,
      backgroundAssets: resolved.backgroundAssets
    });
  }

  public async prepareGeneration({
    context,
    forceGeneration = false
  }: {
    context: GodSceneContext;
    forceGeneration?: boolean;
  }): Promise<GodGenerationResult> {
    const resolved = await this.resolveSceneContext(context);
    const assessment = assessGodNeed(resolved);

    if (!forceGeneration && assessment.decision === "use_existing_asset") {
      const reusedAsset = assessment.topCandidates[0]?.asset ?? null;
      return {
        decision: assessment.decision,
        assessment,
        brief: null,
        reusedAsset,
        record: null,
        validation: null,
        benchmark: null,
        providerAttempts: [],
        manifest: null
      };
    }

    if (!forceGeneration && assessment.decision === "escalate_for_manual_review") {
      return {
        decision: assessment.decision,
        assessment,
        brief: null,
        reusedAsset: assessment.topCandidates[0]?.asset ?? null,
        record: null,
        validation: null,
        benchmark: null,
        providerAttempts: [],
        manifest: null
      };
    }

    const brief = await this.buildBrief(resolved, assessment);

    if (!forceGeneration && !resolved.variationRequested) {
      const similarApprovedAsset: SimilarApprovedAssetMatch | null = await this.findSimilarApprovedAsset(brief);
      if (similarApprovedAsset) {
        return {
          decision: "use_existing_asset",
          assessment: godNeedAssessmentSchema.parse({
            ...assessment,
            decision: "use_existing_asset",
            rationale: `A previously approved GOD asset (${similarApprovedAsset.asset.id}) is already an acceptable match for this brief.`,
            confidence: clamp01(Math.max(assessment.confidence, similarApprovedAsset.similarity)),
            chosenAssetId: similarApprovedAsset.asset.id,
            shouldGenerateVariation: false,
            shouldEscalate: false,
            insufficientAspects: assessment.insufficientAspects,
            premiumThresholdHit: true
          }),
          brief: null,
          reusedAsset: similarApprovedAsset.asset,
          record: null,
          validation: null,
          benchmark: null,
          providerAttempts: [],
          manifest: null
        };
      }
    }

    const {draft, attempts} = await runGodProviderChain({
      brief,
      providers: this.providers
    });

    const validation = validateGodDraft(brief, draft);
    const validationWithPaths: GodGeneratedAssetRecord["validation"] = {
      ...validation,
      normalizedHtmlPath: undefined,
      previewPath: undefined
    };
    const benchmark = buildGodBenchmarkResult({
      validation,
      env: this.env,
      userApproved: false
    });
    const assetId = buildGodAssetId(brief, draft);
    const reviewId = `god-review-${sha256Text(`${brief.briefId}:${assetId}`).slice(0, 12)}`;
    const reviewDir = path.join(this.store.paths.reviewRootDir, reviewId);
    const {assetHtmlPath, previewHtmlPath, metadataJsonPath, benchmarkJsonPath, manifestJsonPath} = await writeGodReviewFiles({
      reviewDir,
      reviewId,
      assetId,
      brief,
      draft,
      validation: validationWithPaths,
      benchmark
    });
    validationWithPaths.normalizedHtmlPath = assetHtmlPath;
    validationWithPaths.previewPath = previewHtmlPath;
    const manifest = buildGodAssetManifest({
      brief,
      draft,
      validation: validationWithPaths,
      benchmark,
      assetId,
      reviewId
    });

    const record = godGeneratedAssetRecordSchema.parse({
      reviewId,
      assetId,
      sceneId: resolved.sceneId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: benchmark.passed ? "pending_user_approval" : "draft",
      decision: assessment.decision,
      context: resolved,
      assessment,
      brief,
      providerAttempts: attempts,
      draft,
      validation: validationWithPaths,
      benchmark,
      files: {
        reviewDir,
        assetHtml: assetHtmlPath,
        previewHtml: previewHtmlPath,
        metadataJson: metadataJsonPath,
        benchmarkJson: benchmarkJsonPath,
        manifestJson: manifestJsonPath
      },
      dedupeKey: sha256Text(JSON.stringify({
        briefHash: brief.briefId,
        contentHash: validation.contentHash,
        assetId
      })),
      briefHash: brief.briefId,
      contentHash: validation.contentHash,
      notes: [
        `GOD invoked because ${assessment.rationale}`,
        ...validation.warnings,
        ...benchmark.reasons
      ],
      error: validation.hardErrors.length > 0 ? validation.hardErrors.join(" | ") : null
    });

    await this.store.writeReviewRecord(record);
    await this.store.appendLedger({
      type: "generate",
      reviewId,
      assetId,
      decision: assessment.decision,
      state: record.state,
      providerAttempts: attempts.map((attempt) => ({
        providerId: attempt.providerId,
        providerKind: attempt.providerKind,
        status: attempt.status,
        confidence: attempt.confidence
      })),
      createdAt: record.createdAt
    });

    return {
      decision: assessment.decision,
      assessment,
      brief,
      reusedAsset: null,
      record,
      validation: validationWithPaths,
      benchmark,
      providerAttempts: attempts as Array<Record<string, unknown>>,
      manifest
    };
  }

  public async approveReview(reviewId: string, update: GodReviewUpdate): Promise<GodGeneratedAssetRecord> {
    const normalizedUpdate = godReviewUpdateSchema.parse(update);
    const current = await this.store.readReviewRecord(reviewId);
    if (!current) {
      throw new Error(`God review ${reviewId} was not found.`);
    }

    const approvedAt = new Date().toISOString();
    const nextBenchmark = buildGodBenchmarkResult({
      validation: current.validation,
      env: this.env,
      userApproved: normalizedUpdate.approved
    });
    const autoPromote = this.env.GOD_AUTO_PROMOTE === "true";
    const shouldPromote = normalizedUpdate.approved && !normalizedUpdate.sceneOnly && (normalizedUpdate.promoteToCollection || autoPromote) && (nextBenchmark.passed || normalizedUpdate.overrideBenchmarkFailures);
    const nextState =
      !normalizedUpdate.approved
        ? "rejected"
        : normalizedUpdate.sceneOnly
          ? "approved_scene_only"
          : shouldPromote
            ? "promoted"
            : "approved_pending_promotion";

    let nextRecord: GodGeneratedAssetRecord = godGeneratedAssetRecordSchema.parse({
      ...current,
      state: nextState,
      updatedAt: approvedAt,
      userApproval: {
        approved: normalizedUpdate.approved,
        sceneOnly: normalizedUpdate.sceneOnly,
        reuseEligible: normalizedUpdate.reuseEligible,
        promoteToCollection: normalizedUpdate.promoteToCollection,
        approvedBy: normalizedUpdate.approvedBy ?? null,
        approvedAt,
        notes: normalizedUpdate.notes ?? null,
        overrideBenchmarkFailures: normalizedUpdate.overrideBenchmarkFailures
      },
      benchmark: nextBenchmark,
      notes: unique([
        ...current.notes,
        normalizedUpdate.notes,
        normalizedUpdate.approved ? "User approval recorded." : "User rejected the asset."
      ])
    } as unknown);

    if (shouldPromote) {
      const permanentAssetDir = this.store.permanentAssetDir(current.assetId);
      await mkdir(permanentAssetDir, {recursive: true});

      await Promise.all([
        copyIfExists(current.files.assetHtml, path.join(permanentAssetDir, "asset.html")),
        copyIfExists(current.files.previewHtml ?? "", path.join(permanentAssetDir, "preview.html")),
        copyIfExists(current.files.metadataJson, path.join(permanentAssetDir, "metadata.json")),
        copyIfExists(current.files.benchmarkJson, path.join(permanentAssetDir, "benchmark.json")),
        copyIfExists(current.files.manifestJson, path.join(permanentAssetDir, "asset.manifest.json")),
        copyIfExists(this.store.reviewRecordPath(reviewId), path.join(permanentAssetDir, "review.json"))
      ]);

      const manifest = await readJsonIfExists<Record<string, unknown>>(current.files.manifestJson);
      if (manifest) {
        const approvedManifest = {
          ...manifest,
          promotedAt: approvedAt,
          approvalState: "approved",
          userApproval: {
            approved: normalizedUpdate.approved,
            sceneOnly: normalizedUpdate.sceneOnly,
            reuseEligible: normalizedUpdate.reuseEligible,
            promoteToCollection: normalizedUpdate.promoteToCollection,
            overrideBenchmarkFailures: normalizedUpdate.overrideBenchmarkFailures,
            approvedBy: normalizedUpdate.approvedBy ?? null,
            approvedAt,
            notes: normalizedUpdate.notes ?? null
          },
          promotion: {
            promotedAt: approvedAt,
            permanentManifestPath: this.store.permanentManifestPath(),
            permanentAssetDir,
            catalogPath: this.store.permanentManifestPath()
          }
        };
        await writeFile(path.join(permanentAssetDir, "asset.manifest.json"), `${JSON.stringify(approvedManifest, null, 2)}\n`, "utf-8");
        await this.store.upsertApprovedAsset(approvedManifest);
      }

      nextRecord = godGeneratedAssetRecordSchema.parse({
        ...nextRecord,
        state: "promoted",
        updatedAt: approvedAt,
        promotion: {
          promotedAt: approvedAt,
          permanentManifestPath: this.store.permanentManifestPath(),
          permanentAssetDir,
          catalogPath: this.store.permanentManifestPath()
        }
      } as unknown);
    }

    await this.store.writeReviewRecord(nextRecord);
    await this.store.appendLedger({
      type: normalizedUpdate.approved ? "approve" : "reject",
      reviewId,
      assetId: current.assetId,
      state: nextRecord.state,
      userApproved: normalizedUpdate.approved,
      sceneOnly: normalizedUpdate.sceneOnly,
      reuseEligible: normalizedUpdate.reuseEligible,
      promoteToCollection: normalizedUpdate.promoteToCollection,
      overrideBenchmarkFailures: normalizedUpdate.overrideBenchmarkFailures,
      approvedAt
    });

    return nextRecord;
  }

  public async rejectReview(reviewId: string, notes?: string): Promise<GodGeneratedAssetRecord> {
    return this.approveReview(reviewId, {
      approved: false,
      sceneOnly: false,
      reuseEligible: false,
      promoteToCollection: false,
      overrideBenchmarkFailures: false,
      notes
    });
  }

  public async requestVariation({
    reviewId,
    context,
    forceGeneration = true
  }: {
    reviewId?: string;
    context: GodSceneContext;
    forceGeneration?: boolean;
  }): Promise<GodGenerationResult> {
    const variationContext = {
      ...context,
      variationRequested: true,
      variationOfAssetId: reviewId ?? context.variationOfAssetId,
      manualReviewRequested: context.manualReviewRequested
    };
    return this.prepareGeneration({
      context: variationContext,
      forceGeneration
    });
  }

  public async listAssets(): Promise<{
    approved: Record<string, unknown>[];
    reviews: GodGeneratedAssetRecord[];
    summary: {
      approvedCount: number;
      reviewCount: number;
      promotedCount: number;
      pendingCount: number;
      rejectedCount: number;
    };
  }> {
    const [approved, reviews] = await Promise.all([
      this.store.readApprovedCatalog(),
      this.store.listReviewRecords()
    ]);
    return {
      approved,
      reviews,
      summary: {
        approvedCount: approved.length,
        reviewCount: reviews.length,
        promotedCount: reviews.filter((record) => record.state === "promoted").length,
        pendingCount: reviews.filter((record) => record.state === "pending_user_approval" || record.state === "draft").length,
        rejectedCount: reviews.filter((record) => record.state === "rejected").length
      }
    };
  }

  public async getReview(reviewId: string): Promise<GodGeneratedAssetRecord> {
    const record = await this.store.readReviewRecord(reviewId);
    if (!record) {
      throw new Error(`God review ${reviewId} was not found.`);
    }
    return record;
  }

  public async getAsset(assetId: string): Promise<Record<string, unknown> | null> {
    const approved = await this.store.readApprovedCatalog();
    const matchedApproved = approved.find((entry) => String(entry.id ?? "") === assetId);
    if (matchedApproved) {
      return matchedApproved;
    }

    const reviews = await this.store.listReviewRecords();
    const matchedReview = reviews.find((entry) => entry.assetId === assetId || entry.reviewId === assetId);
    return matchedReview ?? null;
  }
}
