import {z} from "zod";

const previewMotionCueSchema = z.object({
  cueId: z.string(),
  text: z.string(),
  startMs: z.number(),
  durationMs: z.number(),
  lineIndex: z.number().int().nonnegative(),
  phase: z.string().optional(),
  animation: z.string().optional(),
  emphasisWords: z.array(z.string()).optional(),
  source: z.string().optional(),
  createdAt: z.string().optional()
});

const transcriptWordSchema = z.object({
  text: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
  confidence: z.number().optional()
});

const sessionPlaceholderSchema = z.object({
  active: z.boolean(),
  styleId: z.string(),
  copy: z.string(),
  reason: z.string(),
  line1: z.string(),
  line2: z.string().nullable()
});

const previewSessionStateSchema = z.object({
  id: z.string(),
  status: z.string(),
  previewStatus: z.string(),
  transcriptStatus: z.string(),
  analysisStatus: z.string(),
  motionGraphicsStatus: z.string(),
  renderStatus: z.string(),
  previewText: z.string().nullable(),
  previewLines: z.array(z.string()),
  previewMotionSequence: z.array(previewMotionCueSchema),
  transcriptWords: z.array(transcriptWordSchema),
  errorMessage: z.string().nullable(),
  sourceFilename: z.string().nullable().optional(),
  sourceDurationMs: z.number().nullable().optional(),
  sourceAspectRatio: z.string().nullable().optional(),
  sourceWidth: z.number().nullable().optional(),
  sourceHeight: z.number().nullable().optional(),
  sourceFps: z.number().nullable().optional(),
  sourceHasVideo: z.boolean(),
  lastEventType: z.string().nullable().optional(),
  previewPlaceholder: sessionPlaceholderSchema,
  renderOutputUrl: z.string().nullable().optional(),
  renderOutputPath: z.string().nullable().optional()
});

export const hyperframesPreviewManifestSchema = z.object({
  schemaVersion: z.literal("hyperframes-preview-manifest/v1"),
  sessionId: z.string(),
  captionProfileId: z.string(),
  motionTier: z.string(),
  lanes: z.object({
    defaultInteractive: z.enum(["hyperframes", "remotion"]),
    interactive: z.array(z.enum(["hyperframes", "remotion"])),
    export: z.literal("remotion")
  }),
  routes: z.object({
    status: z.string(),
    preview: z.string(),
    render: z.string(),
    renderStatus: z.string(),
    sourceMedia: z.string().nullable()
  }),
  baseVideo: z.object({
    src: z.string().nullable(),
    sourceKind: z.enum([
      "session_source_stream",
      "remote_url",
      "r2_asset",
      "local_test_asset",
      "none"
    ]),
    sourceLabel: z.string().nullable(),
    hasVideo: z.boolean(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    fps: z.number().nullable(),
    durationMs: z.number().nullable()
  }),
  audio: z.object({
    src: z.string().nullable(),
    source: z.enum(["video-element", "separate-audio", "none"])
  }),
  session: previewSessionStateSchema,
  overlayPlan: z.object({
    previewText: z.string().nullable(),
    previewLines: z.array(z.string()),
    previewMotionSequence: z.array(previewMotionCueSchema),
    transcriptWords: z.array(transcriptWordSchema),
    placeholder: sessionPlaceholderSchema
  }),
  export: z.object({
    remotion: z.object({
      available: z.boolean(),
      renderStatus: z.string(),
      outputUrl: z.string().nullable(),
      outputPath: z.string().nullable()
    })
  })
});

export type HyperframesPreviewManifest = z.infer<typeof hyperframesPreviewManifestSchema>;
