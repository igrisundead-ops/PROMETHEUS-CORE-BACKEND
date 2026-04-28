import path from "node:path";
import {mkdir, writeFile} from "node:fs/promises";

import {sha256Text} from "../utils/hash";
import type {
  GodBenchmarkResult,
  GodGeneratedAssetDraft,
  GodGenerationBrief,
  GodValidationResult
} from "./types";

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const buildRelativeAssetPath = (assetId: string): string => `motion-assets/god/${assetId}/asset.html`;

const buildRelativePreviewPath = (assetId: string): string => `motion-assets/god/${assetId}/preview.html`;

const buildRelativeMetadataPath = (assetId: string): string => `motion-assets/god/${assetId}/metadata.json`;

const buildRelativeBenchmarkPath = (assetId: string): string => `motion-assets/god/${assetId}/benchmark.json`;

const buildRelativeManifestPath = (assetId: string): string => `motion-assets/god/${assetId}/asset.manifest.json`;

const buildPreviewHtml = (assetId: string): string => {
  const relativeAssetPath = "./asset.html";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(assetId)} preview</title>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        background:
          linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25% 50%, rgba(255,255,255,0.06) 50% 75%, transparent 75%),
          linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25% 50%, rgba(255,255,255,0.06) 50% 75%, transparent 75%),
          radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05), rgba(0,0,0,0.28));
        background-size: 28px 28px, 28px 28px, 100% 100%;
        overflow: hidden;
      }
      .shell {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <iframe src="${relativeAssetPath}" loading="eager" title="${escapeHtml(assetId)} asset preview"></iframe>
    </div>
  </body>
</html>`;
};

const buildAssetHtml = (draft: GodGeneratedAssetDraft): string => {
  const html = draft.html.trim();
  if (/<html[\s>]/i.test(html) && /<\/html>/i.test(html)) {
    return html;
  }

  const css = draft.css?.trim() ?? "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(draft.title)}</title>
    <style>
${css}
    </style>
  </head>
  <body>
${html}
  </body>
</html>`;
};

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const deriveThemeTags = (brief: GodGenerationBrief, draft: GodGeneratedAssetDraft): string[] => {
  return unique([
    ...draft.themeTags,
    ...brief.sceneContext.referenceTags,
    brief.sceneContext.assetRole,
    brief.sceneContext.preferredForm,
    brief.visualTone,
    brief.sceneContext.toneTarget
  ]);
};

const deriveSearchTerms = (brief: GodGenerationBrief, draft: GodGeneratedAssetDraft, assetId: string): string[] => {
  return unique([
    assetId,
    draft.title,
    draft.label,
    brief.semanticRole,
    brief.assetPurpose,
    brief.visualTone,
    brief.motionLanguage,
    brief.sceneContext.compositionNeed,
    brief.sceneContext.sceneLabel,
    brief.sceneContext.exactMoment,
    brief.sceneContext.requiredText,
    ...draft.themeTags,
    ...draft.semanticTags,
    ...draft.subjectTags,
    ...draft.functionalTags,
    ...brief.sceneContext.referenceTags
  ]);
};

const derivePlacementPreference = (draft: GodGeneratedAssetDraft): string[] => {
  if (draft.placementZone === "foreground-cross") return ["center", "lower-third", "side-panels"];
  if (draft.placementZone === "background-depth") return ["background-depth", "full-frame"];
  if (draft.placementZone === "side-panels") return ["left", "right", "center"];
  if (draft.placementZone === "lower-third") return ["lower-third", "center"];
  return [draft.placementZone];
};

const deriveRuntimeParams = (draft: GodGeneratedAssetDraft): Record<string, unknown> => ({
  opacity: draft.opacity,
  depth: draft.assetRole === "background" ? 0.14 : 0.28,
  parallax: draft.assetRole === "background" ? 0.08 : 0.03,
  loop: draft.loopable,
  reveal: 1,
  timingOffsetMs: 0
});

const deriveVisualWeight = (draft: GodGeneratedAssetDraft): number => {
  const base = draft.assetRole === "background" ? 0.48 : 0.66;
  const formBoost = draft.preferredForm === "text-glow" ? 0.08 : draft.preferredForm === "panel" ? 0.05 : 0.04;
  return round(Math.min(1, base + formBoost));
};

const deriveIdealDurationMs = (brief: GodGenerationBrief, draft: GodGeneratedAssetDraft): number => {
  const [minDuration, maxDuration] = brief.motionMetadata.recommendedDurationRangeMs;
  const midpoint = (minDuration + maxDuration) / 2;
  return Math.max(240, Math.round(draft.loopable ? midpoint : midpoint * 0.92));
};

const deriveReuseLimit = (draft: GodGeneratedAssetDraft): number => {
  return draft.assetRole === "background" ? 5 : draft.preferredForm === "text-glow" ? 3 : 4;
};

const deriveConflictRules = (draft: GodGeneratedAssetDraft): string[] => {
  const rules = new Set<string>([
    "transparent-background-default",
    "composite-cleanly",
    "avoid-hard-matte"
  ]);
  if (draft.assetRole === "background") {
    rules.add("avoid-caption-collision");
    rules.add("preserve-negative-space");
  }
  if (draft.preferredForm === "text-glow") {
    rules.add("keep-text-baked-in-only-when-requested");
  }
  return [...rules];
};

const deriveRedundancyRisk = (draft: GodGeneratedAssetDraft): number => {
  if (draft.preferredForm === "text-glow") return 0.34;
  if (draft.preferredForm === "frame") return 0.26;
  if (draft.assetRole === "background") return 0.24;
  return 0.28;
};

const buildAccessPolicy = (draft: GodGeneratedAssetDraft): Record<string, unknown> => ({
  visibility: "public",
  requiresSourceBundle: true,
  allowsRuntimeParameterOverrides: true,
  lockedFields: ["background", "sourceHash", "provider", "sourceProvider", "reviewId"]
});

export const buildGodAssetId = (brief: GodGenerationBrief, draft: GodGeneratedAssetDraft, variationIndex = 0): string => {
  const seed = sha256Text(
    JSON.stringify({
      briefId: brief.briefId,
      preferredForm: draft.preferredForm,
      semanticRole: brief.semanticRole,
      visualTone: brief.visualTone,
      variationIndex
    })
  ).slice(0, 10);
  const base = slugify(`${brief.semanticRole}-${draft.preferredForm}-${brief.sceneContext.assetRole}-${seed}`);
  return `god-${base}`;
};

export const buildGodAssetManifest = ({
  brief,
  draft,
  validation,
  benchmark,
  assetId,
  reviewId
}: {
  brief: GodGenerationBrief;
  draft: GodGeneratedAssetDraft;
  validation: GodValidationResult;
  benchmark: GodBenchmarkResult;
  assetId: string;
  reviewId: string;
}): Record<string, unknown> => {
  const assetPath = buildRelativeAssetPath(assetId);

  return {
    id: assetId,
    assetRole: draft.assetRole,
    canonicalLabel: draft.label,
    briefId: brief.briefId,
    briefVersion: brief.briefVersion,
    generatedAt: new Date().toISOString(),
    assetPurpose: brief.assetPurpose,
    semanticRole: brief.semanticRole,
    visualTone: brief.visualTone,
    preferredForm: brief.preferredForm,
    motionLanguage: brief.motionLanguage,
    promptText: brief.promptText,
    systemPrompt: brief.systemPrompt,
    userPrompt: brief.userPrompt,
    referenceNotes: brief.referenceNotes,
    existingAssetReferences: brief.existingAssetReferences,
    backgroundReferences: brief.backgroundReferences,
    exportConstraints: brief.exportConstraints,
    paletteGuidance: brief.paletteGuidance,
    reusabilityGoal: brief.reusabilityGoal,
    forbiddenElements: brief.forbiddenElements,
    requiredElements: brief.requiredElements,
    compositionConstraints: brief.compositionConstraints,
    motionMetadata: draft.motionMetadata,
    sourceProvider: draft.sourceProvider,
    providerConfidence: draft.providerConfidence,
    validationSummary: {
      passed: validation.passed,
      technicalScore: validation.technicalScore,
      compositingScore: validation.compositingScore,
      aestheticScore: validation.aestheticScore,
      styleScore: validation.styleScore,
      motionScore: validation.motionScore,
      reuseScore: validation.reuseScore,
      overallScore: validation.overallScore
    },
    benchmarkSummary: {
      passed: benchmark.passed,
      overallScore: benchmark.overallScore,
      userApproved: benchmark.userApproved
    },
    originTrace: {
      reviewId,
      assetId,
      sourceProvider: draft.sourceProvider,
      providerConfidence: draft.providerConfidence,
      briefHash: brief.briefId,
      draftHash: draft.draftHash,
      validationHash: validation.contentHash,
      fileHash: validation.fileHash
    },
    showcasePlacementHint: brief.sceneContext.assetRole === "background" ? "center" : "auto",
    virtualAsset: false,
    sourceKind: "god-generated",
    sourceFile: assetPath,
    sourceHtml: assetPath,
    sourceBatch: `god/reviews/${reviewId}`,
    family: draft.family,
    tier: draft.tier,
    src: assetPath,
    alphaMode: "straight",
    placementZone: draft.placementZone,
    durationPolicy: draft.durationPolicy,
    themeTags: deriveThemeTags(brief, draft),
    searchTerms: deriveSearchTerms(brief, draft, assetId),
    semanticTags: draft.semanticTags,
    subjectTags: draft.subjectTags,
    emotionalTags: draft.emotionalTags,
    functionalTags: draft.functionalTags,
    semanticTriggers: unique([
      brief.semanticRole,
      brief.assetPurpose,
      brief.sceneContext.compositionNeed,
      brief.sceneContext.motionLanguage,
      brief.preferredForm
    ]),
    visualWeight: deriveVisualWeight(draft),
    idealDurationMs: deriveIdealDurationMs(brief, draft),
    placementPreference: derivePlacementPreference(draft),
    reuseFrequencyLimit: deriveReuseLimit(draft),
    conflictRules: deriveConflictRules(draft),
    redundancyRiskScore: deriveRedundancyRisk(draft),
    structuralRegions: [],
    partialRevealSupported: true,
    replaceableTextSlots: brief.sceneContext.requiredText ? 1 : 0,
    replaceableNumericSlots: 0,
    showMode: draft.assetRole === "background" ? "background" : "accent",
    metadataConfidence: validation.technicalScore,
    coverageStatus: validation.passed ? "complete" : "review",
    lifecycle: "authoring",
    accessPolicy: buildAccessPolicy(draft),
    preloadPriority: Math.round(40 + validation.overallScore * 60),
    runtimeParams: deriveRuntimeParams(draft),
    renderMode: draft.renderMode,
    safeArea: draft.safeArea,
    loopable: draft.loopable,
    blendMode: draft.blendMode,
    opacity: draft.opacity,
    source: "local",
    sourceId: assetId,
    remoteUrl: assetPath,
    score: benchmark.overallScore,
    aliases: unique([
      assetId,
      draft.label,
      draft.title,
      brief.semanticRole,
      brief.assetPurpose,
      brief.sceneContext.sceneLabel,
      brief.sceneContext.requiredText
    ])
  };
};

export const writeGodReviewFiles = async ({
  reviewDir,
  reviewId,
  assetId,
  brief,
  draft,
  validation,
  benchmark
}: {
  reviewDir: string;
  reviewId: string;
  assetId: string;
  brief: GodGenerationBrief;
  draft: GodGeneratedAssetDraft;
  validation: GodValidationResult;
  benchmark: GodBenchmarkResult;
}): Promise<{
  assetDir: string;
  assetHtmlPath: string;
  previewHtmlPath: string;
  metadataJsonPath: string;
  benchmarkJsonPath: string;
  manifestJsonPath: string;
}> => {
  const assetDir = path.join(reviewDir, assetId);
  const assetHtmlPath = path.join(assetDir, "asset.html");
  const previewHtmlPath = path.join(assetDir, "preview.html");
  const metadataJsonPath = path.join(assetDir, "metadata.json");
  const benchmarkJsonPath = path.join(assetDir, "benchmark.json");
  const manifestJsonPath = path.join(assetDir, "asset.manifest.json");

  await mkdir(assetDir, {recursive: true});
  await writeFile(assetHtmlPath, `${buildAssetHtml(draft)}\n`, "utf-8");
  await writeFile(previewHtmlPath, `${buildPreviewHtml(assetId)}\n`, "utf-8");
  const enrichedValidation = {
    ...validation,
    normalizedHtmlPath: assetHtmlPath,
    previewPath: previewHtmlPath
  };
  await writeFile(
    metadataJsonPath,
    `${JSON.stringify({
      assetId,
      reviewId,
      briefId: brief.briefId,
      title: draft.title,
      label: draft.label,
      preferredForm: draft.preferredForm,
      sourceProvider: draft.sourceProvider,
      providerConfidence: draft.providerConfidence,
      briefHash: draft.briefHash,
      draftHash: draft.draftHash,
      validation: enrichedValidation,
      benchmark,
      originTrace: {
        reviewId,
        assetId,
        sourceProvider: draft.sourceProvider,
        providerConfidence: draft.providerConfidence,
        briefHash: brief.briefId,
        draftHash: draft.draftHash,
        validationHash: validation.contentHash,
        fileHash: validation.fileHash
      },
      generatedAt: new Date().toISOString()
    }, null, 2)}\n`,
    "utf-8"
  );
  await writeFile(benchmarkJsonPath, `${JSON.stringify(benchmark, null, 2)}\n`, "utf-8");

  const manifest = buildGodAssetManifest({
    brief,
    draft,
    validation,
    benchmark,
    assetId,
    reviewId
  });
  await writeFile(manifestJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  return {
    assetDir,
    assetHtmlPath,
    previewHtmlPath,
    metadataJsonPath,
    benchmarkJsonPath,
    manifestJsonPath
  };
};
