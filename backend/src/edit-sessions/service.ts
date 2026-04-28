import {stat} from "node:fs/promises";
import path from "node:path";

import type {FastifyRequest} from "fastify";

import type {BackendEnv} from "../config";
import {transcribeWithAssemblyAI, streamAudioBufferWithAssemblyAI} from "../integrations/assemblyai";
import {probeVideoMetadata} from "../integrations/ffprobe";
import {runFfmpegBufferCommand} from "../sound-engine/ffmpeg";
import {InProcessQueue} from "../queue";
import {LocalPreviewRunner} from "../local-preview-runner";
import {createEditSessionId} from "../utils/ids";
import {
  editSessionCreateRequestSchema,
  editSessionPreviewManifestSchema,
  editSessionPlaceholderSchema,
  editSessionPreviewStartRequestSchema,
  type EditSessionPreviewManifest,
  type EditSessionPreviewManifestSourceKind,
  editSessionPublicStateSchema,
  editSessionRenderStartRequestSchema,
  editSessionStateSchema,
  editSessionUploadCompleteRequestSchema,
  type EditSessionMotionCue,
  type EditSessionPlaceholder,
  type EditSessionPublicState,
  type EditSessionRenderStartRequest,
  type EditSessionState,
  type EditSessionUploadCompleteRequest
} from "./types";
import {EditSessionStore} from "./store";

const PREVIEW_AUDIO_SAMPLE_RATE = 16000;
const PREVIEW_AUDIO_CHUNK_MS = 50;
const DEFAULT_PREVIEW_SECONDS = 8;
const PREVIEW_PROMOTION_DEBOUNCE_MS = 180;
const PREVIEW_PLACEHOLDER_COPY = "Loading the first typographic beat.";
const PREVIEW_PLACEHOLDER_LINE_2 = "Keep the motion lane warm.";
const PREVIEW_CAPTION_PROFILE_ID = "longform_eve_typography_v1";
const RENDER_STAGE_PROGRESS: Record<string, number> = {
  idle: 0,
  cleaning: 5,
  ingesting: 20,
  drafting: 55,
  mastering: 85,
  completed: 100,
  failed: 100
};

const nowIso = (deps: EditSessionDependencies): string => {
  return deps.now ? deps.now() : new Date().toISOString();
};

const normalizeText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const splitPreviewLines = (text: string): string[] => {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return [];
  }

  const sentenceChunks = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (sentenceChunks.length > 1) {
    return sentenceChunks.slice(0, 3);
  }

  const words = cleaned.split(/\s+/);
  if (words.length <= 4) {
    return [cleaned];
  }

  if (words.length <= 8) {
    const midpoint = Math.max(2, Math.ceil(words.length / 2));
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")].filter(Boolean);
  }

  return [words.slice(0, 4).join(" "), words.slice(4, 8).join(" "), words.slice(8).join(" ")].filter(Boolean);
};

const extractEmphasisWords = (text: string): string[] => {
  return normalizeText(text)
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""))
    .filter((word) => word.length >= 7)
    .slice(0, 4);
};

const buildPlaceholder = (
  styleId: EditSessionPlaceholder["styleId"] = PREVIEW_CAPTION_PROFILE_ID
): EditSessionPlaceholder => {
  return editSessionPlaceholderSchema.parse({
    active: true,
    styleId,
    copy: PREVIEW_PLACEHOLDER_COPY,
    reason: "waiting_for_audio",
    line1: PREVIEW_PLACEHOLDER_COPY,
    line2: PREVIEW_PLACEHOLDER_LINE_2
  });
};

const buildMotionCue = ({
  sessionId,
  text,
  lineIndex,
  source,
  createdAt,
  phase
}: {
  sessionId: string;
  text: string;
  lineIndex: number;
  source: EditSessionMotionCue["source"];
  createdAt: string;
  phase: EditSessionMotionCue["phase"];
}): EditSessionMotionCue => {
  const trimmed = normalizeText(text);
  const emphasisWords = extractEmphasisWords(trimmed);
  const animation =
    phase === "placeholder"
      ? "fade_up"
      : lineIndex === 0
        ? "fade_up"
        : lineIndex === 1
          ? "type_lock"
          : "soft_push";

  return {
    cueId: `${sessionId}_${source}_${lineIndex}_${createdAt}`,
    phase,
    animation,
    text: trimmed,
    lineIndex,
    startMs: lineIndex * 180,
    durationMs: lineIndex === 0 ? 760 : 640,
    emphasisWords,
    source,
    createdAt
  };
};

const buildMotionSequence = ({
  sessionId,
  text,
  source,
  createdAt
}: {
  sessionId: string;
  text: string;
  source: EditSessionMotionCue["source"];
  createdAt: string;
}): EditSessionMotionCue[] => {
  const lines = splitPreviewLines(text);
  if (lines.length === 0) {
    return [
      buildMotionCue({
        sessionId,
        text: PREVIEW_PLACEHOLDER_COPY,
        lineIndex: 0,
        source: "placeholder",
        createdAt,
        phase: "placeholder"
      })
    ];
  }

  return lines.map((line, index) =>
    buildMotionCue({
      sessionId,
      text: line,
      lineIndex: index,
      source,
      createdAt,
      phase: index === 0 ? "reveal" : "lock"
    })
  );
};

const buildAnalysisSummary = ({
  session,
  source
}: {
  session: EditSessionState;
  source: "placeholder" | "preview" | "transcript";
}): Record<string, unknown> => {
  return {
    styleId: session.captionProfileId,
    source,
    previewLineCount: session.previewLines.length,
    previewTextReady: session.previewStatus === "preview_text_ready",
    transcriptReady: session.transcriptStatus === "full_transcript_ready",
    guardrail: "debounce_motion_updates_on_turn_boundaries"
  };
};

const buildMotionGraphicsSummary = ({
  session,
  source
}: {
  session: EditSessionState;
  source: "placeholder" | "preview" | "transcript";
}): Record<string, unknown> => {
  return {
    styleId: session.captionProfileId,
    source,
    motionCueCount: session.previewMotionSequence.length,
    minimalStyle: true,
    avoidedStyleFamily: "alex-mozzie",
    renderReady: session.previewStatus === "preview_text_ready" || session.previewStatus === "preview_placeholder_ready"
  };
};

const toPublicSession = (session: EditSessionState): EditSessionPublicState => {
  return editSessionPublicStateSchema.parse(session);
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "video/webm"
};

const inferMediaContentType = (filePath: string): string => {
  return CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
};

const sourcePathExists = async (candidatePath: string | null): Promise<boolean> => {
  if (!candidatePath) {
    return false;
  }

  try {
    await stat(candidatePath);
    return true;
  } catch {
    return false;
  }
};

const resolveLocalSourcePath = (session: EditSessionState): string | null => {
  const candidate = session.sourcePath?.trim();
  if (candidate) {
    return path.resolve(candidate);
  }

  const storageKey = session.storageKey?.trim();
  if (!storageKey) {
    return null;
  }

  if (storageKey.startsWith("file://")) {
    try {
      return path.resolve(new URL(storageKey).pathname);
    } catch {
      return null;
    }
  }

  if (path.isAbsolute(storageKey)) {
    return path.resolve(storageKey);
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(storageKey)) {
    return null;
  }

  return path.resolve(storageKey);
};

const resolvePreviewManifestSourceKind = (session: EditSessionState): EditSessionPreviewManifestSourceKind => {
  const metadataSource = typeof session.metadata.source === "string" ? session.metadata.source.trim().toLowerCase() : "";
  const hasDirectMediaUrl = Boolean(session.mediaUrl?.trim());
  const uploadedFromBrowser = session.metadata.uploadedFromBrowser === true;

  if (metadataSource === "r2") {
    return "r2_asset";
  }

  if (hasDirectMediaUrl) {
    return "remote_url";
  }

  if (uploadedFromBrowser) {
    return "session_source_stream";
  }

  if (resolveLocalSourcePath(session)) {
    return "local_test_asset";
  }

  return "none";
};

const resolvePreviewManifestSourceUrl = (session: EditSessionState): string | null => {
  const mediaUrl = session.mediaUrl?.trim();
  if (mediaUrl) {
    return mediaUrl;
  }

  const sourceKind = resolvePreviewManifestSourceKind(session);
  if (sourceKind === "session_source_stream" || sourceKind === "local_test_asset" || sourceKind === "r2_asset") {
    return `/api/edit-sessions/${session.id}/source`;
  }

  return null;
};

const extractPreviewAudioBuffer = async ({
  sourcePath,
  previewSeconds
}: {
  sourcePath: string;
  previewSeconds: number;
}): Promise<Buffer> => {
  const {stdout} = await runFfmpegBufferCommand([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(PREVIEW_AUDIO_SAMPLE_RATE),
    "-t",
    String(previewSeconds),
    "-f",
    "s16le",
    "pipe:1"
  ]);
  return stdout;
};

type RenderDriverSnapshot = {
  state: "idle" | "running" | "completed" | "failed";
  stage: string;
  outputUrl: string | null;
  outputPath: string | null;
  errorMessage: string | null;
  progress: number;
};

export type EditSessionSourceMediaAsset = {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  hasVideo: boolean;
};

export type EditSessionRenderDriver = {
  startRender: (input: {
    sourcePath: string;
    captionProfileId: string;
    motionTier: string;
    cleanRun: boolean;
    deliveryMode: "speed-draft" | "master-render";
  }) => Promise<void>;
  getStatus: () => Promise<RenderDriverSnapshot>;
};

const createDefaultRenderDriver = (): EditSessionRenderDriver => {
  const runner = new LocalPreviewRunner();
  return {
    startRender: async (input) => {
      const fakeRequest = {
        isMultipart: () => false,
        body: {
          sourcePath: input.sourcePath,
          cleanRun: input.cleanRun,
          captionProfileId: input.captionProfileId,
          motionTier: input.motionTier,
          transcriptionMode: "assemblyai",
          deliveryMode: input.deliveryMode
        }
      } as unknown as FastifyRequest;
      const normalized = await runner.parseRunRequest(fakeRequest);
      await runner.startRun(normalized);
    },
    getStatus: async () => {
      const status = await runner.getStatus();
      const progress = RENDER_STAGE_PROGRESS[status.stage] ?? 0;
      return {
        state:
          status.state === "completed"
            ? "completed"
            : status.state === "failed"
              ? "failed"
              : status.state === "running"
                ? "running"
                : "idle",
        stage: status.stage,
        outputUrl: status.outputUrl,
        outputPath: status.outputPath,
        errorMessage: status.errorMessage,
        progress
      };
    }
  };
};

export type EditSessionEvent = {
  type:
    | "session_snapshot"
    | "preview_initializing"
    | "preview_placeholder_ready"
    | "preview_text_ready"
    | "transcript_started"
    | "transcript_progress"
    | "transcript_ready"
    | "analysis_ready"
    | "motion_graphics_ready"
    | "render_started"
    | "render_progress"
    | "render_complete"
    | "failed";
  at: string;
  session: EditSessionPublicState;
  detail?: Record<string, unknown>;
};

export type EditSessionDependencies = {
  now?: () => string;
  fetchImpl?: typeof fetch;
  probeVideoMetadata?: typeof probeVideoMetadata;
  extractPreviewAudioBuffer?: (input: {sourcePath: string; previewSeconds: number}) => Promise<Buffer>;
  streamPreviewAudio?: typeof streamAudioBufferWithAssemblyAI;
  transcribeMedia?: typeof transcribeWithAssemblyAI;
  renderDriver?: EditSessionRenderDriver;
};

export class EditSessionManager {
  private readonly store: EditSessionStore;
  private readonly env: BackendEnv;
  private readonly deps: EditSessionDependencies;
  private readonly sessions = new Map<string, EditSessionState>();
  private readonly subscribers = new Map<string, Set<(event: EditSessionEvent) => void>>();
  private readonly persistChains = new Map<string, Promise<void>>();
  private readonly renderQueue = new InProcessQueue(1);
  private readonly renderDriver: EditSessionRenderDriver;

  public constructor({
    store,
    env,
    deps
  }: {
    store: EditSessionStore;
    env: BackendEnv;
    deps?: EditSessionDependencies;
  }) {
    this.store = store;
    this.env = env;
    this.deps = deps ?? {};
    this.renderDriver = this.deps.renderDriver ?? createDefaultRenderDriver();
  }

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public async createSession(payload: unknown): Promise<EditSessionPublicState> {
    const input = editSessionCreateRequestSchema.parse(payload ?? {});
    const now = nowIso(this.deps);
    const sessionId = createEditSessionId();
    const session = editSessionStateSchema.parse({
      id: sessionId,
      status: "uploaded",
      mediaUrl: input.mediaUrl ?? null,
      storageKey: input.storageKey ?? null,
      sourcePath: null,
      sourceFilename: input.sourceFilename ?? null,
      sourceDurationMs: null,
      sourceAspectRatio: null,
      sourceWidth: null,
      sourceHeight: null,
      sourceFps: null,
      sourceHasVideo: false,
      captionProfileId: input.captionProfileId ?? PREVIEW_CAPTION_PROFILE_ID,
      motionTier: input.motionTier ?? "minimal",
      previewStatus: "idle",
      previewText: null,
      previewPlaceholder: buildPlaceholder(input.captionProfileId ?? PREVIEW_CAPTION_PROFILE_ID),
      previewLines: [],
      previewMotionSequence: [],
      transcriptStatus: "idle",
      transcriptProgress: 0,
      transcriptWords: [],
      transcriptText: null,
      analysisStatus: "idle",
      analysisSummary: {},
      motionGraphicsStatus: "idle",
      motionGraphicsSummary: {},
      renderStatus: "idle",
      renderProgress: 0,
      renderOutputUrl: null,
      renderOutputPath: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      previewStartedAt: null,
      transcriptStartedAt: null,
      transcriptCompletedAt: null,
      analysisStartedAt: null,
      analysisCompletedAt: null,
      motionGraphicsStartedAt: null,
      motionGraphicsCompletedAt: null,
      renderStartedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      metadata: input.metadata ?? {},
      streamSessionId: null,
      lastEventType: null,
      lastPreviewUpdateAt: null,
      lastTranscriptUpdateAt: null
    });

    this.sessions.set(sessionId, session);
    await this.persistSession(sessionId);
    return toPublicSession(session);
  }

  public async getSession(sessionId: string): Promise<EditSessionPublicState> {
    return toPublicSession(await this.loadSession(sessionId));
  }

  public async getPreview(sessionId: string): Promise<Record<string, unknown>> {
    const session = await this.loadSession(sessionId);
    return {
      id: session.id,
      status: session.previewStatus,
      styleId: session.captionProfileId,
      text: session.previewText,
      lines: session.previewLines,
      placeholder: session.previewPlaceholder,
      motionSequence: session.previewMotionSequence,
      lastTranscriptFragment: session.previewText ?? session.transcriptText,
      lastTurnAt: session.lastPreviewUpdateAt,
      readyAt: session.previewStatus === "preview_text_ready" ? session.lastPreviewUpdateAt : null,
      analysisStatus: session.analysisStatus,
      motionGraphicsStatus: session.motionGraphicsStatus
    };
  }

  public async getPreviewManifest(sessionId: string): Promise<EditSessionPreviewManifest> {
    const session = await this.loadSession(sessionId);
    const sourceUrl = resolvePreviewManifestSourceUrl(session);
    const sourceKind = resolvePreviewManifestSourceKind(session);
    const sourceLabel =
      typeof session.metadata.sourceDisplayName === "string" && session.metadata.sourceDisplayName.trim()
        ? session.metadata.sourceDisplayName.trim()
        : session.sourceFilename;
    const hasVideo = session.sourceHasVideo === true;
    const baseVideoSrc = hasVideo ? sourceUrl : null;
    const separateAudioSrc = hasVideo ? null : sourceUrl;

    return editSessionPreviewManifestSchema.parse({
      schemaVersion: "hyperframes-preview-manifest/v1",
      sessionId: session.id,
      captionProfileId: session.captionProfileId,
      motionTier: session.motionTier,
      lanes: {
        defaultInteractive: "hyperframes",
        interactive: ["hyperframes", "remotion"],
        export: "remotion"
      },
      routes: {
        status: `/api/edit-sessions/${session.id}/status`,
        preview: `/api/edit-sessions/${session.id}/preview`,
        render: `/api/edit-sessions/${session.id}/render`,
        renderStatus: `/api/edit-sessions/${session.id}/render-status`,
        sourceMedia: sourceUrl
      },
      baseVideo: {
        src: baseVideoSrc,
        sourceKind,
        sourceLabel: sourceLabel ?? null,
        hasVideo,
        width: session.sourceWidth,
        height: session.sourceHeight,
        fps: session.sourceFps,
        durationMs: session.sourceDurationMs
      },
      audio: {
        src: separateAudioSrc,
        source: hasVideo ? "video-element" : separateAudioSrc ? "separate-audio" : "none"
      },
      session: toPublicSession(session),
      overlayPlan: {
        previewText: session.previewText,
        previewLines: session.previewLines,
        previewMotionSequence: session.previewMotionSequence,
        transcriptWords: session.transcriptWords,
        placeholder: session.previewPlaceholder
      },
      export: {
        remotion: {
          available: true,
          renderStatus: session.renderStatus,
          outputUrl: session.renderOutputUrl,
          outputPath: session.renderOutputPath
        }
      }
    });
  }

  public async getRenderStatus(sessionId: string): Promise<Record<string, unknown>> {
    const session = await this.loadSession(sessionId);
    return {
      id: session.id,
      status: session.renderStatus,
      progress: session.renderProgress,
      outputUrl: session.renderOutputUrl,
      outputPath: session.renderOutputPath,
      startedAt: session.renderStartedAt,
      completedAt: session.completedAt,
      errorCode: session.errorCode,
      errorMessage: session.errorMessage
    };
  }

  public async completeUpload(
    sessionId: string,
    payload: unknown
  ): Promise<EditSessionPublicState> {
    const input = editSessionUploadCompleteRequestSchema.parse(payload ?? {});
    const updated = await this.updateSession(sessionId, (current) => {
      const resolvedSourcePath = input.sourcePath ? path.resolve(input.sourcePath) : resolveLocalSourcePath(current);
      return {
        mediaUrl: input.mediaUrl ?? current.mediaUrl,
        storageKey: input.storageKey ?? current.storageKey,
        sourcePath: resolvedSourcePath,
        sourceFilename:
          input.sourceFilename ??
          current.sourceFilename ??
          (resolvedSourcePath ? path.basename(resolvedSourcePath) : null),
        sourceDurationMs: input.sourceDurationMs ?? current.sourceDurationMs,
        sourceAspectRatio: input.sourceAspectRatio ?? current.sourceAspectRatio,
        sourceWidth: input.sourceWidth ?? current.sourceWidth,
        sourceHeight: input.sourceHeight ?? current.sourceHeight,
        sourceFps: input.sourceFps ?? current.sourceFps,
        sourceHasVideo: input.sourceHasVideo ?? current.sourceHasVideo,
        metadata: {
          ...current.metadata,
          ...(input.metadata ?? {})
        },
        status: current.status
      };
    });

    const resolvedSourcePath = resolveLocalSourcePath(updated);
    if (
      resolvedSourcePath &&
      (
        updated.sourceDurationMs === null ||
        updated.sourceAspectRatio === null ||
        updated.sourceWidth === null ||
        updated.sourceHeight === null ||
        updated.sourceFps === null ||
        updated.sourceHasVideo === false
      )
    ) {
      const probe = this.deps.probeVideoMetadata ?? probeVideoMetadata;
      try {
        const metadata = await probe(resolvedSourcePath);
        await this.updateSession(sessionId, (current) => ({
          sourceDurationMs: current.sourceDurationMs ?? Math.round(metadata.duration_seconds * 1000),
          sourceAspectRatio: current.sourceAspectRatio ?? `${metadata.width}:${metadata.height}`,
          sourceWidth: current.sourceWidth ?? metadata.width,
          sourceHeight: current.sourceHeight ?? metadata.height,
          sourceFps: current.sourceFps ?? metadata.fps,
          sourceHasVideo: true,
          sourceFilename: current.sourceFilename ?? path.basename(resolvedSourcePath)
        }));
      } catch {
        // Metadata is optional. The preview lane can still proceed with a fallback placeholder.
      }
    }

    if (input.autoStartPreview ?? true) {
      void this.startPreview(sessionId).catch(() => undefined);
    }

    return this.getSession(sessionId);
  }

  public async getSourceMediaAsset(sessionId: string): Promise<EditSessionSourceMediaAsset> {
    const session = await this.loadSession(sessionId);
    const resolvedSourcePath = resolveLocalSourcePath(session);
    if (!resolvedSourcePath || !(await sourcePathExists(resolvedSourcePath))) {
      throw new Error("Source media not found.");
    }

    const details = await stat(resolvedSourcePath);
    if (!details.isFile()) {
      throw new Error("Source media not found.");
    }

    return {
      filePath: resolvedSourcePath,
      fileName: session.sourceFilename ?? path.basename(resolvedSourcePath),
      fileSizeBytes: details.size,
      contentType: inferMediaContentType(resolvedSourcePath),
      hasVideo: session.sourceHasVideo
    };
  }

  public async startRender(
    sessionId: string,
    payload: unknown = {}
  ): Promise<EditSessionPublicState> {
    const input = editSessionRenderStartRequestSchema.parse(payload ?? {});
    const current = await this.loadSession(sessionId);
    if (current.renderStartedAt || current.renderStatus === "render_complete") {
      return toPublicSession(current);
    }

    const resolvedSourcePath = resolveLocalSourcePath(current);
    if (!resolvedSourcePath || !(await sourcePathExists(resolvedSourcePath))) {
      const failed = await this.updateSession(sessionId, (session) => ({
        renderStatus: "failed",
        status: "failed",
        errorCode: session.errorCode ?? "render_source_missing",
        errorMessage: session.errorMessage ?? "Render could not start because the source media is unavailable."
      }), "failed");
      return toPublicSession(failed);
    }

    const now = nowIso(this.deps);
    await this.updateSession(sessionId, () => ({
      renderStartedAt: now,
      renderStatus: "render_pending",
      status: "render_pending",
      renderProgress: 0
    }), "render_started");

    this.renderQueue.enqueue(async () => {
      try {
        await this.updateSession(sessionId, () => ({
          renderStatus: "rendering",
          status: "rendering",
          renderProgress: 0
        }), "render_progress");

        await this.renderDriver.startRender({
          sourcePath: resolvedSourcePath,
          captionProfileId: current.captionProfileId,
          motionTier: current.motionTier,
          cleanRun: input.cleanRun ?? true,
          deliveryMode: input.deliveryMode ?? "master-render"
        });

        while (true) {
          const snapshot = await this.renderDriver.getStatus();
          const progress = Number.isFinite(snapshot.progress) ? snapshot.progress : RENDER_STAGE_PROGRESS[snapshot.stage] ?? 0;
          await this.updateSession(sessionId, (session) => ({
            renderStatus:
              snapshot.state === "completed"
                ? "render_complete"
                : snapshot.state === "failed"
                  ? "failed"
                  : "rendering",
            status:
              snapshot.state === "completed"
                ? "render_complete"
                : snapshot.state === "failed"
                  ? "failed"
                  : "rendering",
            renderProgress: progress,
            renderOutputUrl: snapshot.outputUrl ?? session.renderOutputUrl,
            renderOutputPath: snapshot.outputPath ?? session.renderOutputPath,
            errorMessage: snapshot.errorMessage ?? session.errorMessage,
            completedAt: snapshot.state === "completed" ? nowIso(this.deps) : session.completedAt
          }), snapshot.state === "completed" ? "render_complete" : "render_progress");

          if (snapshot.state === "completed" || snapshot.state === "failed") {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        await this.updateSession(sessionId, (session) => ({
          renderStatus: "failed",
          status: "failed",
          errorCode: session.errorCode ?? "render_failed",
          errorMessage: session.errorMessage ?? (error instanceof Error ? error.message : String(error))
        }), "failed");
      }
    });

    return this.getSession(sessionId);
  }

  public async failSession(
    sessionId: string,
    payload: {
      errorCode?: string;
      errorMessage: string;
    }
  ): Promise<EditSessionPublicState> {
    const failed = await this.updateSession(sessionId, (current) => {
      const previewResolved = current.previewStatus === "preview_text_ready";
      const previewPlaceholder = editSessionPlaceholderSchema.parse(
        previewResolved
          ? {
              ...current.previewPlaceholder,
              active: false,
              reason: "waiting_for_audio",
              copy: current.previewText ?? current.previewPlaceholder.copy,
              line1: current.previewLines[0] ?? current.previewPlaceholder.line1,
              line2: current.previewLines[1] ?? current.previewPlaceholder.line2
            }
          : {
              ...current.previewPlaceholder,
              active: true,
              reason: current.previewText ? "transcript_delayed" : "transcript_failed",
              copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
              line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
              line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
            }
      );

      return {
        status: "failed",
        previewStatus: previewResolved ? "preview_text_ready" : "preview_placeholder_ready",
        transcriptStatus:
          current.transcriptStatus === "full_transcript_ready"
            ? current.transcriptStatus
            : "failed",
        analysisStatus:
          current.analysisStatus === "analysis_ready"
            ? current.analysisStatus
            : "failed",
        motionGraphicsStatus:
          current.motionGraphicsStatus === "motion_graphics_ready"
            ? current.motionGraphicsStatus
            : "failed",
        renderStatus:
          current.renderStatus === "render_complete"
            ? current.renderStatus
            : "failed",
        previewPlaceholder,
        errorCode: current.errorCode ?? payload.errorCode ?? "session_failed",
        errorMessage: current.errorMessage ?? payload.errorMessage,
        completedAt: current.completedAt ?? nowIso(this.deps)
      };
    }, "failed");

    return toPublicSession(failed);
  }

  public subscribe(sessionId: string, listener: (event: EditSessionEvent) => void): () => void {
    const listeners = this.subscribers.get(sessionId) ?? new Set<(event: EditSessionEvent) => void>();
    listeners.add(listener);
    this.subscribers.set(sessionId, listeners);

    void this.loadSession(sessionId)
      .then((session) => {
        listener({
          type: "session_snapshot",
          at: nowIso(this.deps),
          session: toPublicSession(session)
        });
      })
      .catch(() => undefined);

    return () => {
      const current = this.subscribers.get(sessionId);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.subscribers.delete(sessionId);
      }
    };
  }

  private async runPreviewWorker(
    sessionId: string,
    previewSeconds: number,
    resolvedSourcePath: string | null
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!resolvedSourcePath || !(await sourcePathExists(resolvedSourcePath))) {
      return;
    }

    let publishedPreviewText = session.previewText ?? null;
    let lastPromotedAt = 0;
    let streamSessionId: string | null = session.streamSessionId;
    const createdAt = nowIso(this.deps);
    const streamImpl = this.deps.streamPreviewAudio ?? streamAudioBufferWithAssemblyAI;

    try {
      const audioExtractor = this.deps.extractPreviewAudioBuffer ?? extractPreviewAudioBuffer;
      const audioBuffer = await audioExtractor({
        sourcePath: resolvedSourcePath,
        previewSeconds
      });

      await streamImpl({
        audioBuffer,
        apiKey: this.env.ASSEMBLYAI_API_KEY,
        fetchImpl: this.deps.fetchImpl,
        sampleRate: PREVIEW_AUDIO_SAMPLE_RATE,
        speechModel: "u3-rt-pro",
        chunkMs: PREVIEW_AUDIO_CHUNK_MS,
        chunkDelayMs: 0,
        formatTurns: true,
        inactivityTimeoutSeconds: 20,
        endOfTurnConfidenceThreshold: 0.35,
        callbacks: {
          onBegin: ({sessionId: incomingSessionId}) => {
            streamSessionId = incomingSessionId;
            void this.updateSession(sessionId, () => ({
              streamSessionId: incomingSessionId
            }));
          },
          onTurn: (turn) => {
            const candidate = normalizeText(turn.utterance || turn.transcript);
            if (!candidate) {
              return;
            }

            const now = Date.now();
            const shouldPromote =
              !publishedPreviewText ||
              turn.endOfTurn ||
              candidate.length >= publishedPreviewText.length + 12 ||
              now - lastPromotedAt >= PREVIEW_PROMOTION_DEBOUNCE_MS;

            if (!shouldPromote) {
              return;
            }

            publishedPreviewText = candidate;
            lastPromotedAt = now;
            const lines = splitPreviewLines(candidate);
            const motionSequence = buildMotionSequence({
              sessionId,
              text: candidate,
              source: turn.endOfTurn ? "final_transcript" : "streaming_turn",
              createdAt
            });

            void this.updateSession(sessionId, (current) => ({
              previewStatus: "preview_text_ready",
              status: "preview_text_ready",
              previewText: lines.join("\n"),
              previewLines: lines,
              previewMotionSequence: motionSequence,
              previewPlaceholder: {
                ...current.previewPlaceholder,
                active: false,
                reason: "waiting_for_audio",
                copy: lines.join("\n"),
                line1: lines[0] ?? current.previewPlaceholder.line1,
                line2: lines[1] ?? null
              },
              lastPreviewUpdateAt: nowIso(this.deps),
              analysisStatus: "analysis_ready",
              motionGraphicsStatus: "motion_graphics_ready",
              analysisCompletedAt: nowIso(this.deps),
              motionGraphicsCompletedAt: nowIso(this.deps),
              analysisSummary: buildAnalysisSummary({
                session: {
                  ...current,
                  previewStatus: "preview_text_ready",
                  previewText: lines.join("\n"),
                  previewLines: lines,
                  previewMotionSequence: motionSequence
                },
                source: "preview"
              }),
              motionGraphicsSummary: buildMotionGraphicsSummary({
                session: {
                  ...current,
                  previewStatus: "preview_text_ready",
                  previewText: lines.join("\n"),
                  previewLines: lines,
                  previewMotionSequence: motionSequence
                },
                source: "preview"
              }),
              lastEventType: "preview_text_ready"
            }), "preview_text_ready", {
              turnOrder: turn.turnOrder,
              endOfTurn: turn.endOfTurn
            });
          },
          onTermination: ({audioDurationSeconds}) => {
            void this.updateSession(sessionId, (current) => ({
              previewPlaceholder: {
                ...current.previewPlaceholder,
                active: current.previewStatus !== "preview_text_ready",
                reason: current.previewStatus === "preview_text_ready" ? "waiting_for_audio" : "transcript_delayed",
                copy: current.previewText ?? current.previewPlaceholder.copy,
                line1: current.previewLines[0] ?? current.previewPlaceholder.line1,
                line2: current.previewLines[1] ?? current.previewPlaceholder.line2
              },
              metadata: {
                ...current.metadata,
                previewAudioDurationSeconds: audioDurationSeconds ?? current.metadata.previewAudioDurationSeconds ?? null
              }
            }));
          },
          onError: (error) => {
            void this.updateSession(sessionId, (current) => ({
              previewPlaceholder: {
                ...current.previewPlaceholder,
                active: true,
                reason: current.previewText ? "transcript_delayed" : "transcript_failed",
                copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
                line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
                line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
              },
              errorCode: current.errorCode ?? "preview_stream_error",
              errorMessage: current.errorMessage ?? error.message
            }), "failed");
          }
        }
      });

      if (!publishedPreviewText) {
        await this.updateSession(sessionId, (current) => ({
          previewPlaceholder: {
            ...current.previewPlaceholder,
            active: true,
            reason: "transcript_delayed",
            copy: PREVIEW_PLACEHOLDER_COPY,
            line1: PREVIEW_PLACEHOLDER_COPY,
            line2: PREVIEW_PLACEHOLDER_LINE_2
          },
          previewStatus: "preview_placeholder_ready",
          status: "preview_placeholder_ready"
        }), "preview_placeholder_ready");
      }
    } catch (error) {
      await this.updateSession(sessionId, (current) => ({
        previewPlaceholder: {
          ...current.previewPlaceholder,
          active: true,
          reason: current.previewText ? "transcript_delayed" : "transcript_failed",
          copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
          line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
          line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
        },
        previewStatus: current.previewText ? "preview_text_ready" : "preview_placeholder_ready",
        status: current.previewText ? "preview_text_ready" : current.status,
        errorCode: current.errorCode ?? "preview_stream_failed",
        errorMessage: current.errorMessage ?? (error instanceof Error ? error.message : String(error)),
        streamSessionId: streamSessionId
      }), "failed");
    }
  }

  private async runTranscriptWorker(sessionId: string, sourcePath: string): Promise<void> {
    if (!(await sourcePathExists(sourcePath))) {
      await this.updateSession(sessionId, (current) => ({
        transcriptStatus: "failed",
        errorCode: current.errorCode ?? "transcript_source_missing",
        errorMessage: current.errorMessage ?? "The transcript source file is missing."
      }), "failed");
      return;
    }

    const startedAt = nowIso(this.deps);
    await this.updateSession(sessionId, (current) => ({
      transcriptStartedAt: current.transcriptStartedAt ?? startedAt,
      transcriptStatus: "full_transcript_pending",
      transcriptProgress: Math.max(current.transcriptProgress, 1)
    }), "transcript_started");

    const transcribeImpl = this.deps.transcribeMedia ?? transcribeWithAssemblyAI;
    try {
      const words = await transcribeImpl({
        filePath: sourcePath,
        apiKey: this.env.ASSEMBLYAI_API_KEY,
        fetchImpl: this.deps.fetchImpl,
        onPoll: ({attempt, maxPollAttempts, status}) => {
          const progress = status === "completed" ? 100 : Math.min(95, Math.round((attempt / Math.max(1, maxPollAttempts)) * 100));
          void this.updateSession(sessionId, () => ({
            transcriptProgress: progress,
            transcriptStatus: status === "error" ? "failed" : "full_transcript_pending",
            lastTranscriptUpdateAt: nowIso(this.deps)
          }), "transcript_progress", {
            attempt,
            status
          });
        }
      });

      const transcriptText = normalizeText(words.map((word) => word.text).join(" "));
      await this.updateSession(sessionId, (current) => {
        const previewLines =
          current.previewStatus === "preview_text_ready" && current.previewLines.length > 0
            ? current.previewLines
            : splitPreviewLines(transcriptText);
        const previewText = current.previewText ?? previewLines.join("\n");
        const previewMotionSequence =
          current.previewMotionSequence.length > 0
            ? current.previewMotionSequence
            : buildMotionSequence({
                sessionId,
                text: previewText,
                source: "final_transcript",
                createdAt: nowIso(this.deps)
              });
        const sessionSnapshot = {
          ...current,
          previewText,
          previewLines,
          previewMotionSequence
        };

        return {
          transcriptStatus: "full_transcript_ready",
          transcriptProgress: 100,
          transcriptWords: words,
          transcriptText,
          transcriptCompletedAt: nowIso(this.deps),
          previewStatus: "preview_text_ready",
          previewText,
          previewLines,
          previewMotionSequence,
          previewPlaceholder: {
            ...current.previewPlaceholder,
            active: current.previewStatus !== "preview_text_ready",
            reason: "waiting_for_audio",
            copy: previewText,
            line1: previewLines[0] ?? current.previewPlaceholder.line1,
            line2: previewLines[1] ?? null
          },
          analysisStatus: "analysis_ready",
          motionGraphicsStatus: "motion_graphics_ready",
          analysisCompletedAt: nowIso(this.deps),
          motionGraphicsCompletedAt: nowIso(this.deps),
          analysisSummary: buildAnalysisSummary({
            session: sessionSnapshot,
            source: "transcript"
          }),
          motionGraphicsSummary: buildMotionGraphicsSummary({
            session: sessionSnapshot,
            source: "transcript"
          }),
          status: "full_transcript_ready"
        };
      }, "transcript_ready");
    } catch (error) {
      await this.updateSession(sessionId, (current) => ({
        transcriptStatus: "failed",
        errorCode: current.errorCode ?? "transcript_failed",
        errorMessage: current.errorMessage ?? (error instanceof Error ? error.message : String(error)),
        previewPlaceholder: {
          ...current.previewPlaceholder,
          active: current.previewStatus !== "preview_text_ready",
          reason: current.previewText ? "transcript_delayed" : "transcript_failed",
          copy: current.previewText ?? PREVIEW_PLACEHOLDER_COPY,
          line1: current.previewLines[0] ?? PREVIEW_PLACEHOLDER_COPY,
          line2: current.previewLines[1] ?? PREVIEW_PLACEHOLDER_LINE_2
        }
      }), "failed");
    }
  }

  private async emitDerivedReadiness(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, (current) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready",
      analysisSummary: buildAnalysisSummary({
        session: current,
        source: "placeholder"
      }),
      motionGraphicsSummary: buildMotionGraphicsSummary({
        session: current,
        source: "placeholder"
      })
    }), "analysis_ready");

    await this.updateSession(sessionId, (current) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready"
    }), "motion_graphics_ready");
  }

  private async loadSession(sessionId: string): Promise<EditSessionState> {
    const cached = this.sessions.get(sessionId);
    if (cached) {
      return cached;
    }

    const session = await this.store.readSession(sessionId);
    this.sessions.set(sessionId, session);
    return session;
  }

  private async updateSession(
    sessionId: string,
    updater: (current: EditSessionState) => Partial<EditSessionState>,
    eventType?: EditSessionEvent["type"],
    detail?: Record<string, unknown>
  ): Promise<EditSessionState> {
    const current = await this.loadSession(sessionId);
    const now = nowIso(this.deps);
    const merged = editSessionStateSchema.parse({
      ...current,
      ...updater(current),
      updatedAt: now,
      lastEventType: eventType ?? current.lastEventType
    });
    this.sessions.set(sessionId, merged);

    const persist = this.persistSession(sessionId);
    if (eventType) {
      this.broadcast(sessionId, {
        type: eventType,
        at: now,
        session: toPublicSession(merged),
        detail
      });
    }
    await persist;
    return merged;
  }

  private async persistSession(sessionId: string): Promise<void> {
    const previous = this.persistChains.get(sessionId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const current = this.sessions.get(sessionId);
        if (current) {
          await this.store.writeSession(current);
        }
      })
      .catch(() => undefined);
    this.persistChains.set(sessionId, next);
    return next;
  }

  private broadcast(sessionId: string, event: EditSessionEvent): void {
    const listeners = this.subscribers.get(sessionId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        listeners.delete(listener);
      }
    }

    if (listeners.size === 0) {
      this.subscribers.delete(sessionId);
    }
  }
  public async startPreview(
    sessionId: string,
    payload: unknown = {}
  ): Promise<EditSessionPublicState> {
    const input = editSessionPreviewStartRequestSchema.parse(payload ?? {});
    const current = await this.loadSession(sessionId);
    if (current.previewStartedAt) {
      return toPublicSession(current);
    }

    const now = nowIso(this.deps);
    await this.updateSession(sessionId, (session) => ({
      previewStartedAt: now,
      startedAt: session.startedAt ?? now,
      status: "preview_pending",
      previewStatus: "preview_pending",
      previewPlaceholder: {
        ...session.previewPlaceholder,
        active: true,
        copy: PREVIEW_PLACEHOLDER_COPY,
        reason: "waiting_for_audio",
        line1: PREVIEW_PLACEHOLDER_COPY,
        line2: PREVIEW_PLACEHOLDER_LINE_2
      },
      transcriptStatus: session.sourcePath ? "full_transcript_pending" : session.transcriptStatus,
      analysisStatus: "analysis_pending",
      motionGraphicsStatus: "motion_graphics_pending",
      analysisStartedAt: now,
      motionGraphicsStartedAt: now
    }), "preview_initializing");

    await this.updateSession(sessionId, (session) => ({
      previewStatus: "preview_placeholder_ready",
      status: "preview_placeholder_ready",
      previewPlaceholder: {
        ...session.previewPlaceholder,
        active: true,
        copy: PREVIEW_PLACEHOLDER_COPY,
        reason: "waiting_for_audio",
        line1: PREVIEW_PLACEHOLDER_COPY,
        line2: PREVIEW_PLACEHOLDER_LINE_2
      },
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready",
      analysisCompletedAt: nowIso(this.deps),
      motionGraphicsCompletedAt: nowIso(this.deps),
      analysisSummary: buildAnalysisSummary({
        session,
        source: "placeholder"
      }),
      motionGraphicsSummary: buildMotionGraphicsSummary({
        session,
        source: "placeholder"
      })
    }), "preview_placeholder_ready");

    await this.updateSession(sessionId, (session) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready"
    }), "analysis_ready");

    await this.updateSession(sessionId, (session) => ({
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready"
    }), "motion_graphics_ready");

    const latest = await this.loadSession(sessionId);
    const resolvedSourcePath = resolveLocalSourcePath(latest);
    void this.runPreviewWorker(sessionId, input.previewSeconds ?? DEFAULT_PREVIEW_SECONDS, resolvedSourcePath).catch((error) => {
      void this.updateSession(sessionId, (session) => ({
        previewPlaceholder: {
          ...session.previewPlaceholder,
          active: true,
          reason: session.previewText ? "transcript_delayed" : "transcript_failed",
          copy: session.previewText ?? PREVIEW_PLACEHOLDER_COPY,
          line1: session.previewText ? session.previewLines[0] ?? session.previewText : PREVIEW_PLACEHOLDER_COPY,
          line2: session.previewText && session.previewLines.length > 1 ? session.previewLines[1] ?? null : PREVIEW_PLACEHOLDER_LINE_2
        },
        previewStatus: session.previewText ? "preview_text_ready" : "preview_placeholder_ready",
        status: session.previewText ? "preview_text_ready" : session.status,
        errorCode: session.errorCode ?? "preview_stream_failed",
        errorMessage: session.errorMessage ?? (error instanceof Error ? error.message : String(error))
      }), "failed");
    });

    if (latest.sourcePath) {
      void this.runTranscriptWorker(sessionId, latest.sourcePath).catch((error) => {
        void this.updateSession(sessionId, (session) => ({
          transcriptStatus: "failed",
          errorCode: session.errorCode ?? "transcript_failed",
          errorMessage: session.errorMessage ?? (error instanceof Error ? error.message : String(error)),
          previewPlaceholder: {
            ...session.previewPlaceholder,
            active: session.previewStatus !== "preview_text_ready",
            reason: session.previewStatus === "preview_text_ready" ? "waiting_for_audio" : "transcript_failed",
            copy: session.previewText ?? PREVIEW_PLACEHOLDER_COPY,
            line1: session.previewText?.split("\n")[0] ?? PREVIEW_PLACEHOLDER_COPY,
            line2: session.previewText && session.previewLines.length > 1 ? session.previewLines[1] ?? null : PREVIEW_PLACEHOLDER_LINE_2
          }
        }), "failed");
      });
    } else {
      void this.updateSession(sessionId, (session) => ({
        transcriptStatus: "failed",
        errorCode: session.errorCode ?? "missing_source_path",
        errorMessage: session.errorMessage ?? "No local source path is available for transcript streaming."
      }), "failed");
    }

    return this.getSession(sessionId);
  }
}
