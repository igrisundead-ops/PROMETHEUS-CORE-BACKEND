import React, {useEffect, useMemo, useRef, useState} from "react";

import {CreativeLiveAudioPreview} from "./CreativeLiveAudioPreview";
import {DisplayGodPreviewStage} from "./DisplayGodPreviewStage";
import {NativePreviewStage} from "./NativePreviewStage";
import type {PreviewPlaybackHealth} from "./preview-telemetry";
import {RemotionPreviewPlayer} from "./RemotionPreviewPlayer";
import {buildMotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {
  CaptionStyleProfileId,
  MotionTier,
  PresentationModeSetting,
  VideoMetadata
} from "../lib/types";
import {
  buildAudioCreativePreviewSession,
  buildFastAudioCreativePreviewSession,
  type AudioCreativePreviewAudioStatus,
  type AudioCreativePreviewSession,
  type AudioCreativePreviewState,
  type LivePreviewBackendWord,
  type LivePreviewMotionCue,
  resolveAudioCreativePreviewVideoMetadata
} from "./audio-creative-preview-session";
import {buildDisplayTimelineFromPreviewSession} from "./display-god/display-timeline";
import {
  hyperframesPreviewManifestSchema,
  type HyperframesPreviewManifest
} from "./hyperframes/manifest-schema";
import {
  isLikelyVideoFileLike,
  planAudioPreviewSource,
  resolveAudioPreviewUrl,
  resolveEditSessionSourceUrl
} from "./audio-preview-source";

export type CreativeAudioLivePlayerProps = {
  readonly jobId: string;
  readonly captionProfileId: CaptionStyleProfileId;
  readonly motionTier: MotionTier | "auto";
  readonly presentationMode?: PresentationModeSetting | null;
  readonly apiBase?: string;
  readonly sourceFile?: File | null;
  readonly sourcePath?: string | null;
  readonly sourceMediaSrc?: string | null;
  readonly sourceLabel?: string | null;
  readonly previewTimelineResetVersion?: number;
  readonly previewRenderer?: "hyperframes" | "remotion";
  readonly showDebugOverlay?: boolean;
  readonly showPlaybackHud?: boolean;
  readonly onPreviewStateChange?: (state: AudioCreativePreviewState) => void;
  readonly onAudioStatusChange?: (status: AudioCreativePreviewAudioStatus, errorMessage: string | null) => void;
  readonly onLiveSessionChange?: (state: LiveAudioPreviewBackendState | null) => void;
};

type BuildState = "idle" | "building-timeline" | "ready" | "error";

type PreviewGovernorMode = "lite-preview" | "full-live-preview";

type PreviewTimingState = {
  runId: string;
  startedAtMs: number;
  requestPostedAtMs: number | null;
  sessionId: string | null;
  firstBackendStateAtMs: number | null;
  firstRenderableAtMs: number | null;
  firstReadyAtMs: number | null;
  fullReadyAtMs: number | null;
};

const STATUS_FALLBACK_POLL_INTERVAL_MS = 4000;
const BACKEND_UPDATE_STALE_AFTER_MS = 3200;
const FULL_PREVIEW_MIN_TRANSCRIPT_WORDS = 12;
const EDIT_SESSION_EVENT_TYPES = [
  "preview_initializing",
  "preview_placeholder_ready",
  "preview_text_ready",
  "transcript_started",
  "transcript_progress",
  "transcript_ready",
  "analysis_ready",
  "motion_graphics_ready",
  "failed"
] as const;

type LiveEditSessionPublicState = {
  id: string;
  status: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier | "auto";
  previewStatus: string;
  previewLines: string[];
  previewMotionSequence: LivePreviewMotionCue[];
  transcriptStatus: string;
  transcriptWords: LivePreviewBackendWord[];
  analysisStatus: string;
  motionGraphicsStatus: string;
  renderStatus: string;
  errorMessage: string | null;
  lastEventType: string | null;
  sourceFilename?: string | null;
  sourceDurationMs?: number | null;
  sourceAspectRatio?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceFps?: number | null;
  sourceHasVideo?: boolean;
};

type LivePreviewPayload = {
  id: string;
  status: string;
  previewArtifactUrl?: string | null;
  previewArtifactKind?: "html_composition" | "video" | null;
  previewArtifactContentType?: string | null;
  diagnostics?: Record<string, unknown>;
};

export type LiveAudioPreviewBackendState = {
  sessionId: string | null;
  status: string;
  previewStatus: string;
  transcriptStatus: string;
  analysisStatus: string;
  motionGraphicsStatus: string;
  renderStatus: string;
  previewLineCount: number;
  previewMotionCueCount: number;
  transcriptWordCount: number;
  overlayReady: boolean;
  momentCount: number;
  trackCount: number;
  errorMessage: string | null;
  lastEventType: string | null;
  sourceHasVideo: boolean;
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourceFps: number | null;
  sourceDurationMs: number | null;
};

const loadingStyles: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "#E2E8F0",
  background:
    "radial-gradient(circle at 50% 20%, rgba(214, 177, 107, 0.18), transparent 36%), linear-gradient(180deg, rgba(5, 7, 11, 0.92), rgba(2, 6, 23, 0.98))",
  textAlign: "center"
};

const panelStyles: React.CSSProperties = {
  maxWidth: 540,
  padding: "22px 24px",
  borderRadius: 24,
  border: "1px solid rgba(243, 245, 248, 0.1)",
  background: "rgba(10, 12, 18, 0.74)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.34)"
};

const statusChipStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid rgba(243, 245, 248, 0.12)",
  color: "#F8FAFC",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase"
};

const stageStatusOverlayStyles: React.CSSProperties = {
  gridArea: "1 / 1",
  alignSelf: "start",
  justifySelf: "center",
  width: "min(100%, 720px)",
  padding: 18,
  pointerEvents: "none"
};

const stageStatusCardStyles: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 16px",
  borderRadius: 18,
  border: "1px solid rgba(243, 245, 248, 0.12)",
  background: "rgba(3, 7, 18, 0.72)",
  boxShadow: "0 18px 44px rgba(0, 0, 0, 0.28)",
  backdropFilter: "blur(16px)",
  color: "#F8FAFC",
  textAlign: "left"
};

const LoadingShell: React.FC<{
  buildState: BuildState;
  mediaStatus: AudioCreativePreviewAudioStatus;
}> = ({buildState, mediaStatus}) => {
  return (
    <div style={loadingStyles}>
      <div style={panelStyles}>
        <div style={statusChipStyles}>
          <span>Live Compositor Preview</span>
          <span>|</span>
          <span>{buildState === "building-timeline" ? "Building timeline" : "Waiting"}</span>
        </div>
        <div style={{marginTop: 16, display: "grid", gap: 10}}>
          <strong style={{fontSize: "clamp(24px, 4vw, 42px)", lineHeight: 1.04}}>
            The native browser compositor is warming up.
          </strong>
          <span style={{fontSize: 15, lineHeight: 1.55, color: "#CBD5E1"}}>
            AssemblyAI and the overlay timeline are locking to the source. The stage appears as soon as the first real
            moments land.
          </span>
          <span style={{fontSize: 13, lineHeight: 1.45, color: "#94A3B8"}}>
            Media status: {mediaStatus}. Video sources stay on the native browser playback path whenever they are
            available.
          </span>
        </div>
      </div>
    </div>
  );
};

const StageStatusOverlay: React.FC<{
  buildState: BuildState;
  mediaStatus: AudioCreativePreviewAudioStatus;
  errorMessage?: string | null;
}> = ({buildState, mediaStatus, errorMessage}) => {
  const isError = Boolean(errorMessage) || buildState === "error";

  return (
    <div style={stageStatusOverlayStyles}>
      <div style={stageStatusCardStyles}>
        <div style={{
          ...statusChipStyles,
          width: "fit-content",
          color: isError ? "#FECACA" : "#F8FAFC",
          borderColor: isError ? "rgba(248, 113, 113, 0.22)" : "rgba(243, 245, 248, 0.12)"
        }}>
          <span>Live Compositor Preview</span>
          <span>|</span>
          <span>{isError ? "Overlay issue" : "Building timeline"}</span>
        </div>
        <strong style={{fontSize: 16, lineHeight: 1.2}}>
          {isError
            ? "The source video is live, but the overlay timeline needs another pass."
            : "The source video is live. Overlays are still locking to timecode."}
        </strong>
        <span style={{fontSize: 13, lineHeight: 1.45, color: isError ? "#FECACA" : "#CBD5E1"}}>
          {isError
            ? errorMessage
            : "You can already play or scrub the footage while captions and motion cues finish wiring in."}
        </span>
        <span style={{fontSize: 12, lineHeight: 1.4, color: "#94A3B8"}}>
          Media status: {mediaStatus}.
        </span>
      </div>
    </div>
  );
};

const ErrorShell: React.FC<{
  message: string;
  mediaStatus: AudioCreativePreviewAudioStatus;
}> = ({message, mediaStatus}) => {
  return (
    <div style={loadingStyles}>
      <div style={panelStyles}>
        <div style={statusChipStyles}>
          <span>Live Compositor Preview</span>
          <span>|</span>
          <span>Error</span>
        </div>
        <div style={{marginTop: 16, display: "grid", gap: 10}}>
          <strong style={{fontSize: "clamp(22px, 3.6vw, 36px)", lineHeight: 1.08}}>
            The live preview hit a timeline build issue.
          </strong>
          <span style={{fontSize: 15, lineHeight: 1.55, color: "#FBCFE8"}}>
            {message}
          </span>
          <span style={{fontSize: 13, lineHeight: 1.45, color: "#CBD5E1"}}>
            Media status: {mediaStatus}. The source can still stay browser-native, but the overlay timeline needs
            another pass.
          </span>
        </div>
      </div>
    </div>
  );
};

const normalizeSessionSnapshot = (payload: LiveEditSessionPublicState): LiveEditSessionPublicState => {
  return {
    ...payload,
    previewLines: Array.isArray(payload.previewLines) ? payload.previewLines : [],
    previewMotionSequence: Array.isArray(payload.previewMotionSequence) ? payload.previewMotionSequence : [],
    transcriptWords: Array.isArray(payload.transcriptWords) ? payload.transcriptWords : [],
    sourceHasVideo: payload.sourceHasVideo === true
  };
};

const buildSessionSignature = (
  state: LiveEditSessionPublicState,
  input: {
    captionProfileId: CaptionStyleProfileId;
    motionTier: MotionTier | "auto";
    presentationMode: PresentationModeSetting | null;
  }
): string => {
  return JSON.stringify({
    captionProfileId: input.captionProfileId,
    motionTier: input.motionTier,
    presentationMode: input.presentationMode,
    previewStatus: state.previewStatus,
    transcriptStatus: state.transcriptStatus,
    previewLines: state.previewLines,
    sourceWidth: state.sourceWidth ?? null,
    sourceHeight: state.sourceHeight ?? null,
    sourceFps: state.sourceFps ?? null,
    sourceDurationMs: state.sourceDurationMs ?? null,
    sourceHasVideo: state.sourceHasVideo === true,
    previewMotionSequence: state.previewMotionSequence.map((cue) => ({
      cueId: cue.cueId,
      startMs: cue.startMs,
      durationMs: cue.durationMs,
      text: cue.text
    })),
    transcriptWordSignature:
      state.transcriptWords.length > 0
        ? {
            count: state.transcriptWords.length,
            firstStartMs: state.transcriptWords[0]?.start_ms ?? 0,
            lastEndMs: state.transcriptWords.at(-1)?.end_ms ?? 0
          }
        : null
  });
};

const shouldUseFullPreviewBuild = (state: LiveEditSessionPublicState): boolean => {
  return state.transcriptStatus === "full_transcript_ready" || state.transcriptWords.length >= FULL_PREVIEW_MIN_TRANSCRIPT_WORDS;
};

const createPreviewTimingState = (jobId: string, resetVersion: number): PreviewTimingState => ({
  runId: `${jobId}:${resetVersion}:${Date.now()}`,
  startedAtMs: performance.now(),
  requestPostedAtMs: null,
  sessionId: null,
  firstBackendStateAtMs: null,
  firstRenderableAtMs: null,
  firstReadyAtMs: null,
  fullReadyAtMs: null
});

const logPreviewGovernorStage = (
  timing: PreviewTimingState | null,
  stage: string,
  detail: Record<string, unknown> = {}
): void => {
  if (!timing) {
    return;
  }

  console.info("[preview-governor]", {
    runId: timing.runId,
    sessionId: timing.sessionId,
    stage,
    elapsedMs: Math.round(performance.now() - timing.startedAtMs),
    ...detail
  });
};

const toActionableBuildErrorMessage = (message: string, apiBase: string): string => {
  return /failed to fetch|networkerror|load failed/i.test(message)
    ? `Cannot reach the local backend at ${apiBase.replace(/\/+$/, "")}. Start the backend so AssemblyAI captions and live motion can load.`
    : message;
};

const buildBaseVideoMetadata = (
  state: LiveEditSessionPublicState | null
): Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null => {
  if (!state) {
    return null;
  }

  const width = state.sourceWidth ?? 0;
  const height = state.sourceHeight ?? 0;
  const fps = state.sourceFps ?? 0;
  if (width <= 0 || height <= 0 || fps <= 0) {
    return null;
  }

  const durationSeconds = Math.max(1, (state.sourceDurationMs ?? 0) / 1000);
  return {
    width,
    height,
    fps,
    durationSeconds,
    durationInFrames: Math.max(1, Math.ceil(durationSeconds * fps))
  };
};

export const CreativeAudioLivePlayer: React.FC<CreativeAudioLivePlayerProps> = ({
  jobId,
  captionProfileId,
  motionTier,
  presentationMode = "long-form",
  apiBase = "http://127.0.0.1:8000",
  sourceFile,
  sourcePath,
  sourceMediaSrc,
  sourceLabel,
  previewTimelineResetVersion = 0,
  previewRenderer = "hyperframes",
  showDebugOverlay = true,
  showPlaybackHud = true,
  onPreviewStateChange,
  onAudioStatusChange,
  onLiveSessionChange
}) => {
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [session, setSession] = useState<AudioCreativePreviewSession | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [resolvedAudioSrc, setResolvedAudioSrc] = useState("");
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState("");
  const [playbackSourcePending, setPlaybackSourcePending] = useState(false);
  const [playbackSourceError, setPlaybackSourceError] = useState<string | null>(null);
  const [liveSessionState, setLiveSessionState] = useState<LiveEditSessionPublicState | null>(null);
  const [previewManifest, setPreviewManifest] = useState<HyperframesPreviewManifest | null>(null);
  const [previewArtifactUrl, setPreviewArtifactUrl] = useState<string | null>(null);
  const [previewArtifactKind, setPreviewArtifactKind] = useState<"html_composition" | "video" | null>(null);
  const [previewArtifactContentType, setPreviewArtifactContentType] = useState<string | null>(null);
  const [previewDiagnostics, setPreviewDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [browserVideoMetadata, setBrowserVideoMetadata] = useState<Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null>(null);
  const [nativePreviewHealth, setNativePreviewHealth] = useState<PreviewPlaybackHealth>("booting");
  const [nativePreviewErrorMessage, setNativePreviewErrorMessage] = useState<string | null>(null);
  const [displayGodFallbackReason, setDisplayGodFallbackReason] = useState<string | null>(null);
  const previewStateCallbackRef = useRef(onPreviewStateChange);
  const audioStatusCallbackRef = useRef(onAudioStatusChange);
  const liveSessionCallbackRef = useRef(onLiveSessionChange);
  const sessionBuildSignatureRef = useRef("");
  const previewTimingRef = useRef<PreviewTimingState | null>(null);
  const lastBackendUpdateAtRef = useRef(0);
  const sourcePlan = useMemo(
    () =>
      planAudioPreviewSource({
        sourceAudioSrc: sourceMediaSrc,
        sourceFile,
        sourcePath
      }),
    [sourceFile, sourceMediaSrc, sourcePath]
  );
  const directBrowserVideoSrc = useMemo(() => {
    const candidate = sourceMediaSrc?.trim() ?? "";
    if (!candidate || !isLikelyVideoFileLike(sourceFile)) {
      return "";
    }
    return candidate;
  }, [sourceFile, sourceMediaSrc]);
  const sessionVideoSrc = useMemo(() => {
    if (!liveSessionState?.id || liveSessionState.sourceHasVideo !== true) {
      return "";
    }
    return resolveEditSessionSourceUrl(apiBase, liveSessionState.id);
  }, [apiBase, liveSessionState]);
  const fallbackVideoMetadata = useMemo(() => {
    const liveVideoMetadata = buildBaseVideoMetadata(liveSessionState);
    const fallbackDurationMs = liveSessionState?.sourceDurationMs ??
      (browserVideoMetadata?.durationSeconds ? browserVideoMetadata.durationSeconds * 1000 : null);

    return resolveAudioCreativePreviewVideoMetadata({
      presentationMode,
      durationMs: fallbackDurationMs,
      baseVideoMetadata: liveVideoMetadata ?? browserVideoMetadata
    });
  }, [browserVideoMetadata, liveSessionState, presentationMode]);
  const fallbackMotionModel = useMemo(() => {
    return buildMotionCompositionModel({
      chunks: [],
      tier: motionTier,
      fps: fallbackVideoMetadata.fps,
      videoMetadata: fallbackVideoMetadata,
      captionProfileId,
      suppressAmbientAssets: true,
      transitionOverlayMode: "off",
      motion3DMode: "off"
    });
  }, [captionProfileId, fallbackVideoMetadata, motionTier]);
  const displayTimeline = useMemo(() => {
    if (!resolvedVideoSrc) {
      return null;
    }

    return buildDisplayTimelineFromPreviewSession({
      jobId,
      videoSrc: resolvedVideoSrc,
      audioSrc: resolvedAudioSrc || null,
      session,
      fallbackMotionModel,
      fallbackVideoMetadata,
      captionProfileId,
      sourceLabel
    });
  }, [
    captionProfileId,
    fallbackMotionModel,
    fallbackVideoMetadata,
    jobId,
    resolvedAudioSrc,
    resolvedVideoSrc,
    session,
    sourceLabel
  ]);

  useEffect(() => {
    previewStateCallbackRef.current = onPreviewStateChange;
  }, [onPreviewStateChange]);

  useEffect(() => {
    audioStatusCallbackRef.current = onAudioStatusChange;
  }, [onAudioStatusChange]);

  useEffect(() => {
    liveSessionCallbackRef.current = onLiveSessionChange;
  }, [onLiveSessionChange]);

  useEffect(() => {
    const current = liveSessionState;
    liveSessionCallbackRef.current?.(
      current
        ? {
            sessionId: current.id,
            status: current.status,
            previewStatus: current.previewStatus,
            transcriptStatus: current.transcriptStatus,
            analysisStatus: current.analysisStatus,
            motionGraphicsStatus: current.motionGraphicsStatus,
            renderStatus: current.renderStatus,
            previewLineCount: current.previewLines.length,
            previewMotionCueCount: current.previewMotionSequence.length,
            transcriptWordCount: current.transcriptWords.length,
            overlayReady: Boolean(
              session &&
              (session.captionChunks.length > 0 ||
                (session.creativeTimeline.tracks.length > 0 && session.creativeTimeline.moments.length > 0))
            ),
            momentCount: session?.creativeTimeline.moments.length ?? 0,
            trackCount: session?.creativeTimeline.tracks.length ?? 0,
            errorMessage: current.errorMessage,
            lastEventType: current.lastEventType,
            sourceHasVideo: current.sourceHasVideo === true,
            sourceWidth: current.sourceWidth ?? null,
            sourceHeight: current.sourceHeight ?? null,
            sourceFps: current.sourceFps ?? null,
            sourceDurationMs: current.sourceDurationMs ?? null
          }
        : null
    );
  }, [liveSessionState, session]);

  useEffect(() => {
    setNativePreviewHealth("booting");
    setNativePreviewErrorMessage(null);
    setDisplayGodFallbackReason(null);
    setPreviewArtifactUrl(null);
    setPreviewArtifactKind(null);
    setPreviewArtifactContentType(null);
    setPreviewDiagnostics(null);
  }, [previewTimelineResetVersion, resolvedVideoSrc]);

  useEffect(() => {
    const sessionId = liveSessionState?.id;
    if (!sessionId) {
      setPreviewManifest(null);
      return;
    }

    let cancelled = false;
    let intervalId = 0;
    const abortController = new AbortController();
    const manifestUrl = `${apiBase.replace(/\/+$/, "")}/api/edit-sessions/${sessionId}/preview-manifest`;

    const refreshManifest = async (): Promise<void> => {
      try {
        const response = await fetch(manifestUrl, {
          cache: "no-store",
          signal: abortController.signal
        });
        if (!response.ok) {
          throw new Error(`Preview manifest request failed with ${response.status}.`);
        }

        const payload = hyperframesPreviewManifestSchema.parse(await response.json());
        if (!cancelled) {
          setPreviewManifest(payload);
        }
      } catch (error) {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        if (import.meta.env.DEV) {
          console.warn("[CreativeAudioLivePlayer] Preview manifest refresh failed", {
            sessionId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    };

    setPreviewManifest(null);
    void refreshManifest();
    intervalId = window.setInterval(() => {
      void refreshManifest();
    }, 1200);

    return () => {
      cancelled = true;
      abortController.abort();
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
      }
    };
  }, [apiBase, liveSessionState?.id, previewTimelineResetVersion]);

  useEffect(() => {
    const sessionId = liveSessionState?.id;
    if (!sessionId) {
      setPreviewArtifactUrl(null);
      setPreviewDiagnostics(null);
      return;
    }

    let cancelled = false;
    let intervalId = 0;
    const abortController = new AbortController();
    const endpoint = `${apiBase.replace(/\/+$/, "")}/api/edit-sessions/${sessionId}/preview`;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: abortController.signal
        });
        if (!response.ok) {
          return;
        }

        const payload = await response.json() as LivePreviewPayload;
        if (cancelled) {
          return;
        }

        const nextUrl = typeof payload.previewArtifactUrl === "string" && payload.previewArtifactUrl.trim()
          ? `${apiBase.replace(/\/+$/, "")}${payload.previewArtifactUrl}`
          : null;
        setPreviewArtifactUrl(nextUrl);
        setPreviewArtifactKind(payload.previewArtifactKind ?? null);
        setPreviewArtifactContentType(payload.previewArtifactContentType ?? null);
        setPreviewDiagnostics(payload.diagnostics ?? null);
      } catch {
        if (!cancelled && !abortController.signal.aborted) {
          // Keep the last successful artifact payload.
        }
      }
    };

    void refresh();
    intervalId = window.setInterval(() => {
      void refresh();
    }, 1200);

    return () => {
      cancelled = true;
      abortController.abort();
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
      }
    };
  }, [apiBase, liveSessionState?.id]);

  useEffect(() => {
    if (!directBrowserVideoSrc || typeof document === "undefined") {
      setBrowserVideoMetadata(null);
      return;
    }

    let cancelled = false;
    const probeVideo = document.createElement("video");
    const fallbackFps = liveSessionState?.sourceFps && liveSessionState.sourceFps > 0 ? liveSessionState.sourceFps : 30;

    const handleLoadedMetadata = (): void => {
      if (cancelled) {
        return;
      }

      const width = Math.max(1, Math.round(probeVideo.videoWidth || 0));
      const height = Math.max(1, Math.round(probeVideo.videoHeight || 0));
      if (width <= 0 || height <= 0) {
        return;
      }

      const durationSeconds = Number.isFinite(probeVideo.duration) && probeVideo.duration > 0
        ? probeVideo.duration
        : fallbackVideoMetadata.durationSeconds;

      setBrowserVideoMetadata({
        width,
        height,
        fps: fallbackFps,
        durationSeconds,
        durationInFrames: Math.max(1, Math.ceil(durationSeconds * fallbackFps))
      });
    };

    const handleError = (): void => {
      if (!cancelled) {
        setBrowserVideoMetadata(null);
      }
    };

    probeVideo.preload = "metadata";
    probeVideo.muted = true;
    probeVideo.playsInline = true;
    probeVideo.addEventListener("loadedmetadata", handleLoadedMetadata);
    probeVideo.addEventListener("error", handleError);
    probeVideo.src = directBrowserVideoSrc;
    probeVideo.load();

    return () => {
      cancelled = true;
      probeVideo.removeEventListener("loadedmetadata", handleLoadedMetadata);
      probeVideo.removeEventListener("error", handleError);
      probeVideo.pause();
      probeVideo.removeAttribute("src");
      probeVideo.load();
    };
  }, [directBrowserVideoSrc, fallbackVideoMetadata.durationSeconds, liveSessionState?.sourceFps]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    if (sourcePlan.kind === "missing") {
      setResolvedAudioSrc("");
      setResolvedVideoSrc("");
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("missing", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (directBrowserVideoSrc) {
      setResolvedVideoSrc(directBrowserVideoSrc);
      setResolvedAudioSrc("");
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (sessionVideoSrc) {
      setResolvedVideoSrc(sessionVideoSrc);
      setResolvedAudioSrc("");
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (sourcePlan.kind === "direct") {
      setResolvedVideoSrc("");
      setResolvedAudioSrc(sourcePlan.src);
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (!liveSessionState?.id) {
      setResolvedVideoSrc("");
      setResolvedAudioSrc("");
      setPlaybackSourcePending(true);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    const resolveBackendAudio = async (): Promise<void> => {
      setResolvedVideoSrc("");
      setResolvedAudioSrc("");
      setPlaybackSourcePending(true);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);

      try {
        const endpoint = `${apiBase.replace(/\/+$/, "")}/api/local-preview/audio-preview`;
        let response: Response;

        if (sourceFile) {
          const formData = new FormData();
          formData.append("source_video", sourceFile);
          if (sourcePlan.sourcePath) {
            formData.append("sourcePath", sourcePlan.sourcePath);
          }

          response = await fetch(endpoint, {
            method: "POST",
            body: formData,
            signal: abortController.signal
          });
        } else {
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sourcePath: sourcePlan.sourcePath ?? ""
            }),
            signal: abortController.signal
          });
        }

        const payload = await response.json() as {audioUrl?: string; error?: string};
        if (!response.ok || !payload.audioUrl) {
          throw new Error(payload.error ?? `Audio preview request failed with ${response.status}.`);
        }

        if (cancelled) {
          return;
        }

        setResolvedAudioSrc(resolveAudioPreviewUrl(apiBase, payload.audioUrl));
        setPlaybackSourcePending(false);
        setPlaybackSourceError(null);
      } catch (error) {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setResolvedAudioSrc("");
        setPlaybackSourcePending(false);
        setPlaybackSourceError(message);
        audioStatusCallbackRef.current?.("error", message);
      }
    };

    void resolveBackendAudio();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [apiBase, directBrowserVideoSrc, liveSessionState?.id, sessionVideoSrc, sourceFile, sourcePlan]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;
    let eventSource: EventSource | null = null;
    const abortController = new AbortController();

    const updateSessionFromBackend = async (payload: LiveEditSessionPublicState): Promise<void> => {
      if (cancelled) {
        return;
      }

      const nextState = normalizeSessionSnapshot(payload);
      const timing = previewTimingRef.current;
      lastBackendUpdateAtRef.current = Date.now();
      if (timing) {
        timing.sessionId = nextState.id;
        if (timing.firstBackendStateAtMs === null) {
          timing.firstBackendStateAtMs = performance.now();
          logPreviewGovernorStage(timing, "backend_state_received", {
            previewStatus: nextState.previewStatus,
            transcriptStatus: nextState.transcriptStatus
          });
        }
      }
      setLiveSessionState(nextState);

      const hasRenderableData =
        nextState.transcriptWords.length > 0 ||
        nextState.previewMotionSequence.length > 0 ||
        nextState.previewLines.length > 0;

      if (!hasRenderableData) {
        setBuildState("building-timeline");
        previewStateCallbackRef.current?.("building-timeline");
        return;
      }

      if (timing && timing.firstRenderableAtMs === null) {
        timing.firstRenderableAtMs = performance.now();
        logPreviewGovernorStage(timing, "first_renderable_state", {
          previewLines: nextState.previewLines.length,
          previewCues: nextState.previewMotionSequence.length,
          transcriptWords: nextState.transcriptWords.length
        });
      }

      const nextSignature = buildSessionSignature(nextState, {
        captionProfileId,
        motionTier,
        presentationMode
      });

      if (sessionBuildSignatureRef.current === nextSignature) {
        if (session) {
          setBuildState("ready");
          setBuildError(null);
          previewStateCallbackRef.current?.("ready");
        }
        return;
      }

      try {
        const baseVideoMetadata = buildBaseVideoMetadata(nextState);
        const governorMode: PreviewGovernorMode = shouldUseFullPreviewBuild(nextState)
          ? "full-live-preview"
          : "lite-preview";
        const buildStartedAtMs = performance.now();
        const nextSession = governorMode === "full-live-preview"
          ? await buildAudioCreativePreviewSession({
              jobId: nextState.id,
              captionProfileId,
              motionTier,
              presentationMode,
              baseVideoMetadata,
              transcriptWords: nextState.transcriptWords,
              previewLines: nextState.previewLines,
              previewMotionSequence: nextState.previewMotionSequence,
              allowFallbackDemoData: false
            })
          : await buildFastAudioCreativePreviewSession({
              jobId: nextState.id,
              captionProfileId,
              motionTier,
              presentationMode,
              baseVideoMetadata,
              transcriptWords: nextState.transcriptWords,
              previewLines: nextState.previewLines,
              previewMotionSequence: nextState.previewMotionSequence,
              allowFallbackDemoData: false
            });

        if (cancelled) {
          return;
        }

        sessionBuildSignatureRef.current = nextSignature;
        setSession(nextSession);
        setBuildState("ready");
        setBuildError(null);
        previewStateCallbackRef.current?.("ready");
        if (timing) {
          const buildElapsedMs = Math.round(performance.now() - buildStartedAtMs);
          if (timing.firstReadyAtMs === null) {
            timing.firstReadyAtMs = performance.now();
            logPreviewGovernorStage(timing, "preview_ready", {
              governorMode,
              buildElapsedMs
            });
          } else if (governorMode === "full-live-preview" && timing.fullReadyAtMs === null) {
            timing.fullReadyAtMs = performance.now();
            logPreviewGovernorStage(timing, "preview_upgraded", {
              governorMode,
              buildElapsedMs,
              transcriptWords: nextState.transcriptWords.length
            });
          } else {
            logPreviewGovernorStage(timing, "preview_rebuilt", {
              governorMode,
              buildElapsedMs,
              transcriptWords: nextState.transcriptWords.length
            });
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = toActionableBuildErrorMessage(
          error instanceof Error ? error.message : String(error),
          apiBase
        );
        setBuildError(message);
        setBuildState("error");
        previewStateCallbackRef.current?.("error");
      }
    };

    const run = async (): Promise<void> => {
      if (sourcePlan.kind === "missing") {
        setSession(null);
        setLiveSessionState(null);
        setBuildState("idle");
        setBuildError(null);
        sessionBuildSignatureRef.current = "";
        previewStateCallbackRef.current?.("idle");
        return;
      }

      setSession(null);
      setLiveSessionState(null);
      setBuildState("building-timeline");
      setBuildError(null);
      sessionBuildSignatureRef.current = "";
      previewTimingRef.current = createPreviewTimingState(jobId, previewTimelineResetVersion);
      lastBackendUpdateAtRef.current = 0;
      previewStateCallbackRef.current?.("building-timeline");

      try {
        const endpoint = `${apiBase.replace(/\/+$/, "")}/api/edit-sessions/live-preview`;
        const backendSourcePath = sourcePlan.kind === "backend" ? sourcePlan.sourcePath : null;
        let response: Response;
        previewTimingRef.current!.requestPostedAtMs = performance.now();
        logPreviewGovernorStage(previewTimingRef.current, "request_started", {
          sourceKind: sourcePlan.kind,
          sourceFile: sourceFile?.name ?? null
        });

        if (sourceFile) {
          const formData = new FormData();
          formData.append("source_video", sourceFile);
          formData.append("captionProfileId", captionProfileId);
          formData.append("motionTier", motionTier);
          if (backendSourcePath) {
            formData.append("sourcePath", backendSourcePath);
          }

          response = await fetch(endpoint, {
            method: "POST",
            body: formData,
            signal: abortController.signal
          });
        } else {
          if (!backendSourcePath) {
            throw new Error("A local source path is required to build the live preview session.");
          }

          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sourcePath: backendSourcePath,
              captionProfileId,
              motionTier
            }),
            signal: abortController.signal
          });
        }

        const payload = await response.json() as (LiveEditSessionPublicState & {
          error?: string;
          urls?: {status?: string; events?: string};
        });
        if (!response.ok || !payload.id) {
          throw new Error(payload.error ?? `Live preview session request failed with ${response.status}.`);
        }

        logPreviewGovernorStage(previewTimingRef.current, "request_accepted", {
          status: response.status,
          previewStatus: payload.previewStatus,
          transcriptStatus: payload.transcriptStatus
        });
        await updateSessionFromBackend(payload);

        const statusUrl = payload.urls?.status
          ? `${apiBase.replace(/\/+$/, "")}${payload.urls.status}`
          : `${apiBase.replace(/\/+$/, "")}/api/edit-sessions/${payload.id}/status`;
        const eventsUrl = payload.urls?.events
          ? `${apiBase.replace(/\/+$/, "")}${payload.urls.events}`
          : null;

        const refreshStatus = async (): Promise<void> => {
          try {
            const statusResponse = await fetch(statusUrl, {
              cache: "no-store",
              signal: abortController.signal
            });
            if (!statusResponse.ok) {
              throw new Error(`Live preview status request failed with ${statusResponse.status}.`);
            }

            const nextState = await statusResponse.json() as LiveEditSessionPublicState;
            await updateSessionFromBackend(nextState);
          } catch (error) {
            if (cancelled || abortController.signal.aborted) {
              return;
            }

            if (!sessionBuildSignatureRef.current) {
              const message = toActionableBuildErrorMessage(
                error instanceof Error ? error.message : String(error),
                apiBase
              );
              setBuildError(message);
              setBuildState("error");
              previewStateCallbackRef.current?.("error");
            }
          }
        };

        if (eventsUrl && typeof window !== "undefined" && typeof window.EventSource === "function") {
          eventSource = new window.EventSource(eventsUrl);
          const handleEvent = (event: MessageEvent<string>): void => {
            try {
              const payload = JSON.parse(event.data) as {session?: LiveEditSessionPublicState};
              if (payload.session) {
                void updateSessionFromBackend(payload.session);
              }
            } catch (error) {
              console.warn("[CreativeAudioLivePlayer] Failed to parse live preview event payload", {
                error: error instanceof Error ? error.message : String(error)
              });
            }
          };

          EDIT_SESSION_EVENT_TYPES.forEach((eventType) => {
            eventSource?.addEventListener(eventType, handleEvent as EventListener);
          });
          eventSource.addEventListener("open", () => {
            logPreviewGovernorStage(previewTimingRef.current, "event_stream_open");
          });
          eventSource.addEventListener("error", () => {
            logPreviewGovernorStage(previewTimingRef.current, "event_stream_error");
          });
        }

        intervalId = window.setInterval(() => {
          if (Date.now() - lastBackendUpdateAtRef.current >= BACKEND_UPDATE_STALE_AFTER_MS) {
            void refreshStatus();
          }
        }, STATUS_FALLBACK_POLL_INTERVAL_MS);

        void refreshStatus();
      } catch (error) {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        const message = toActionableBuildErrorMessage(
          error instanceof Error ? error.message : String(error),
          apiBase
        );
        setBuildError(message);
        setBuildState("error");
        previewStateCallbackRef.current?.("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
      abortController.abort();
      eventSource?.close();
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    apiBase,
    captionProfileId,
    motionTier,
    presentationMode,
    previewTimelineResetVersion,
    sourceFile,
    sourcePlan
  ]);

  useEffect(() => {
    if (!resolvedVideoSrc) {
      return;
    }

    if (nativePreviewErrorMessage) {
      audioStatusCallbackRef.current?.("error", nativePreviewErrorMessage);
      return;
    }

    if (nativePreviewHealth === "ready") {
      audioStatusCallbackRef.current?.("ready", null);
      return;
    }

    audioStatusCallbackRef.current?.("loading", null);
  }, [nativePreviewErrorMessage, nativePreviewHealth, resolvedVideoSrc]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.info("[CreativeAudioLivePlayer]", {
      jobId,
      buildState,
      hasSession: Boolean(session),
      liveSessionId: liveSessionState?.id ?? null,
      previewStatus: liveSessionState?.previewStatus ?? "idle",
      transcriptStatus: liveSessionState?.transcriptStatus ?? "idle",
      previewLineCount: liveSessionState?.previewLines.length ?? 0,
      previewMotionCueCount: liveSessionState?.previewMotionSequence.length ?? 0,
      transcriptWordCount: liveSessionState?.transcriptWords.length ?? 0,
      sourceMediaSrcPresent: Boolean(sourceMediaSrc?.trim()),
      sourceVideoSrcPresent: Boolean(resolvedVideoSrc),
      sourceAudioSrcPresent: Boolean(resolvedAudioSrc),
      playbackSourcePending,
      playbackSourceError: playbackSourceError ?? nativePreviewErrorMessage,
      sourceLabel,
      previewTimelineResetVersion,
      renderJobActive: false,
      videoLoaded: nativePreviewHealth === "ready",
      previewRenderer,
      manifestReady: Boolean(previewManifest),
      previewArtifactUrl,
      previewDiagnostics
    });
  }, [
    buildState,
    jobId,
    liveSessionState,
    previewManifest,
    nativePreviewErrorMessage,
    nativePreviewHealth,
    playbackSourceError,
    playbackSourcePending,
    previewRenderer,
    previewTimelineResetVersion,
    previewArtifactUrl,
    previewDiagnostics,
    resolvedAudioSrc,
    resolvedVideoSrc,
    session,
    sourceLabel,
    sourceMediaSrc
  ]);

  const shellMediaStatus: AudioCreativePreviewAudioStatus = nativePreviewErrorMessage || playbackSourceError
    ? "error"
    : sourcePlan.kind === "missing"
      ? "missing"
      : resolvedVideoSrc
        ? nativePreviewHealth === "ready"
          ? "ready"
          : "loading"
        : playbackSourcePending
          ? "loading"
          : resolvedAudioSrc
            ? "loading"
            : "missing";
  const captionsReadyForRender = liveSessionState?.transcriptStatus === "full_transcript_ready";
  const canRenderNativeVideoStage = Boolean(resolvedVideoSrc);
  const shouldUseDisplayGod = Boolean(
    previewRenderer === "hyperframes" &&
    canRenderNativeVideoStage &&
    captionsReadyForRender &&
    displayTimeline &&
    !displayGodFallbackReason
  );
  const remotionInteractiveAllowed = previewManifest?.lanes.interactive.includes("remotion") ?? false;
  const shouldUseRemotionPreview = Boolean(
    previewRenderer === "remotion" &&
    remotionInteractiveAllowed &&
    canRenderNativeVideoStage
  );
  const stageStatusMessage = nativePreviewErrorMessage ?? buildError;
  const canRenderArtifact = Boolean(previewArtifactUrl);
  const allowLegacyInteractiveFallback = Boolean(showDebugOverlay && import.meta.env.DEV);
  const enforceArtifactOnly = previewRenderer === "hyperframes" && !allowLegacyInteractiveFallback;
  const shouldRenderVideoArtifact = canRenderArtifact && previewArtifactKind === "video";
  const artifactWidth = previewManifest?.baseVideo.width ??
    liveSessionState?.sourceWidth ??
    browserVideoMetadata?.width ??
    16;
  const artifactHeight = previewManifest?.baseVideo.height ??
    liveSessionState?.sourceHeight ??
    browserVideoMetadata?.height ??
    9;
  const artifactAspectRatio = `${Math.max(1, artifactWidth)} / ${Math.max(1, artifactHeight)}`;
  const artifactFrameStyles: React.CSSProperties = {
    width: "100%",
    aspectRatio: artifactAspectRatio,
    minHeight: 420,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: 16,
    background: "#020617",
    display: "block"
  };

  if (canRenderArtifact && previewArtifactUrl) {
    return (
      <div style={{display: "grid", gap: 10}}>
        {shouldRenderVideoArtifact ? (
          <video
            src={previewArtifactUrl}
            controls
            playsInline
            style={artifactFrameStyles}
          />
        ) : (
          <iframe
            title="HyperFrames Composition Preview"
            src={previewArtifactUrl}
            scrolling="no"
            style={{
              ...artifactFrameStyles,
              background: "transparent"
            }}
          />
        )}
        {previewDiagnostics ? (
          <pre style={{
            margin: 0,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(148, 163, 184, 0.2)",
            background: "rgba(15, 23, 42, 0.78)",
            color: "#cbd5e1",
            fontSize: 11,
            lineHeight: 1.4,
            maxHeight: 160,
            overflow: "auto"
          }}>
            {JSON.stringify(previewDiagnostics, null, 2)}
          </pre>
        ) : null}
        <div style={{fontSize: 12, color: "#94a3b8"}}>
          {shouldRenderVideoArtifact
            ? `Artifact kind: video${previewArtifactContentType ? ` (${previewArtifactContentType})` : ""}`
            : `Artifact kind: html composition${previewArtifactContentType ? ` (${previewArtifactContentType})` : ""}`}
        </div>
      </div>
    );
  }

  if (enforceArtifactOnly) {
    return (
      <LoadingShell
        mediaStatus={shellMediaStatus}
        buildState={buildState === "error" ? "building-timeline" : buildState}
      />
    );
  }

  if (buildState === "error" && !canRenderNativeVideoStage) {
    return (
      <ErrorShell
        mediaStatus={shellMediaStatus}
        message={buildError ?? nativePreviewErrorMessage ?? playbackSourceError ?? "Unknown preview build error."}
      />
    );
  }

  if (canRenderNativeVideoStage) {
    return (
      <div style={{display: "grid"}}>
        <div style={{gridArea: "1 / 1"}}>
          {shouldUseRemotionPreview ? (
            <RemotionPreviewPlayer
              videoSrc={resolvedVideoSrc}
              videoMetadata={session?.videoMetadata ?? fallbackVideoMetadata}
              motionModel={session?.motionModel ?? fallbackMotionModel}
              captionProfileId={captionProfileId}
              previewPerformanceMode="balanced"
              onHealthChange={(health) => {
                setNativePreviewHealth(health);
              }}
              onErrorMessageChange={(message) => {
                setNativePreviewErrorMessage(message);
                if (message) {
                  audioStatusCallbackRef.current?.("error", message);
                  previewStateCallbackRef.current?.("error");
                }
              }}
            />
          ) : shouldUseDisplayGod && displayTimeline ? (
            <DisplayGodPreviewStage
              displayTimeline={displayTimeline}
              manifest={previewManifest}
              previewPerformanceMode="balanced"
              onHealthChange={(health) => {
                setNativePreviewHealth(health);
              }}
              onErrorMessageChange={(message) => {
                setNativePreviewErrorMessage(message);
                if (message) {
                  audioStatusCallbackRef.current?.("error", message);
                  previewStateCallbackRef.current?.("error");
                }
              }}
              onFallbackRequested={(message) => {
                if (import.meta.env.DEV) {
                  console.warn("[CreativeAudioLivePlayer] Display God fallback engaged", {
                    jobId,
                    reason: message
                  });
                }
                setDisplayGodFallbackReason(message);
              }}
            />
          ) : (
            <NativePreviewStage
              videoSrc={resolvedVideoSrc}
              videoMetadata={session?.videoMetadata ?? fallbackVideoMetadata}
              model={session?.motionModel ?? fallbackMotionModel}
              captionProfileId={captionProfileId}
              previewPerformanceMode="balanced"
              suppressCaptions={!captionsReadyForRender}
              onHealthChange={(health) => {
                setNativePreviewHealth(health);
              }}
              onErrorMessageChange={(message) => {
                setNativePreviewErrorMessage(message);
                if (message) {
                  audioStatusCallbackRef.current?.("error", message);
                  previewStateCallbackRef.current?.("error");
                }
              }}
            />
          )}
        </div>
        {(buildState !== "ready" || Boolean(stageStatusMessage)) ? (
          <StageStatusOverlay
            buildState={buildState}
            mediaStatus={shellMediaStatus}
            errorMessage={stageStatusMessage}
          />
        ) : null}
      </div>
    );
  }

  if (!session || buildState === "building-timeline" || buildState === "idle") {
    return (
      <LoadingShell
        mediaStatus={shellMediaStatus}
        buildState={buildState}
      />
    );
  }

  return (
    <CreativeLiveAudioPreview
      jobId={jobId}
      audioSrc={resolvedAudioSrc}
      audioPending={playbackSourcePending}
      audioPreparationError={playbackSourceError}
      durationMs={session.durationMs}
      captionChunks={session.captionChunks}
      captionProfileId={captionProfileId}
      creativeTimeline={session.creativeTimeline}
      debugReport={session.debugReport}
      motionModel={session.motionModel}
      videoMetadata={session.videoMetadata}
      showDebugOverlay={showDebugOverlay}
      showPlaybackHud={showPlaybackHud}
      sourceLabel={sourceLabel}
      previewTimelineResetVersion={previewTimelineResetVersion}
      onPreviewStateChange={onPreviewStateChange}
      onAudioStatusChange={(status, errorMessage) => {
        audioStatusCallbackRef.current?.(status, errorMessage);
      }}
    />
  );
};
