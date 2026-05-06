import {z} from "zod";

export const renderDiagnosticsSchema = z.object({
  jobId: z.string(),
  previewEngine: z.enum(["hyperframes", "remotion"]),
  previewUrl: z.string().nullable(),
  previewArtifactKind: z.enum(["html_composition", "video"]).nullable().optional(),
  previewArtifactContentType: z.string().nullable().optional(),
  manifestVersion: z.string(),
  renderTimeMs: z.number().nonnegative().nullable(),
  compositionGenerationTimeMs: z.number().nonnegative().nullable(),
  fontsUsed: z.array(z.string()),
  fontGraphUsed: z.boolean(),
  customFontsUsed: z.boolean(),
  milvusUsed: z.boolean(),
  retrievedAnimationId: z.string().nullable(),
  animationFamily: z.string().nullable(),
  fallbackUsed: z.boolean(),
  fallbackReasons: z.array(z.string()),
  legacyOverlayUsed: z.boolean(),
  remotionUsed: z.boolean(),
  hyperframesUsed: z.boolean(),
  overlapCheckPassed: z.boolean().nullable(),
  fontProof: z.object({
    fontsRequestedFromManifest: z.array(z.string()),
    fontFilesResolved: z.array(z.string()),
    fontFilesLoadedIntoComposition: z.array(z.string()),
    fontCssGenerated: z.boolean(),
    fallbackFontsUsed: z.array(z.string()),
    fallbackReasons: z.array(z.string())
  }),
  animationProof: z.object({
    animationRequestedFromManifest: z.string().nullable(),
    animationRetrievedFromMilvus: z.boolean(),
    retrievedAnimationId: z.string().nullable(),
    gsapTimelineGenerated: z.boolean(),
    fallbackAnimationUsed: z.boolean(),
    fallbackReasons: z.array(z.string())
  }),
  warnings: z.array(z.string()),
  pipelineTrace: z.object({
    jobId: z.string(),
    previewModeRequested: z.string(),
    previewModeActuallyUsed: z.string(),
    renderEngineRequested: z.string(),
    renderEngineActuallyUsed: z.string(),
    oldFallbackTriggered: z.boolean(),
    fallbackReason: z.string().nullable(),
    audioOnlyPathUsed: z.boolean(),
    darkPreviewPathUsed: z.boolean(),
    legacyOverlayUsed: z.boolean(),
    remotionUsed: z.boolean(),
    hyperframesUsed: z.boolean(),
    manifestUsed: z.boolean(),
    textRendererUsed: z.string(),
    fontSelectorUsed: z.string(),
    animationSelectorUsed: z.string(),
    frontendOverlayUsed: z.boolean(),
    backendCompositionUsed: z.boolean(),
    videoElementCount: z.number().int().nonnegative(),
    audioElementCount: z.number().int().nonnegative()
  }).optional()
});

export type RenderDiagnostics = z.infer<typeof renderDiagnosticsSchema>;
