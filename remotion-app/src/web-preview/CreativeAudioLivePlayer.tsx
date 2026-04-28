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
  const [browserVideoMetadata, setBrowserVideoMetadata] = useState<Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null>(null);
  const [nativePreviewHealth, setNativePreviewHealth] = useState<PreviewPlaybackHealth>("booting");
  const [nativePreviewErrorMessage, setNativePreviewErrorMessage] = useState<string | null>(null);
  const [displayGodFallbackReason, setDisplayGodFallbackReason] = useState<string | null>(null);
  const previewStateCallbackRef = useRef(onPreviewStateChange);
  const audioStatusCallbackRef = useRef(onAudioStatusChange);
  const liveSessionCallbackRef = useRef(onLiveSessionChange);
  const sessionBuildSignatureRef = useRef("");
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
            overlayReady: Boolean(session && session.creativeTimeline.tracks.length > 0 && session.creativeTimeline.moments.length > 0),
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
    const abortController = new AbortController();

    const updateSessionFromBackend = async (payload: LiveEditSessionPublicState): Promise<void> => {
      if (cancelled) {
        return;
      }

      const nextState = normalizeSessionSnapshot(payload);
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
        const nextSession = await buildAudioCreativePreviewSession({
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
      previewStateCallbackRef.current?.("building-timeline");

      try {
        const endpoint = `${apiBase.replace(/\/+$/, "")}/api/edit-sessions/live-preview`;
        const backendSourcePath = sourcePlan.kind === "backend" ? sourcePlan.sourcePath : null;
        let response: Response;

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
          urls?: {status?: string};
        });
        if (!response.ok || !payload.id) {
          throw new Error(payload.error ?? `Live preview session request failed with ${response.status}.`);
        }

        await updateSessionFromBackend(payload);

        const statusUrl = payload.urls?.status
          ? `${apiBase.replace(/\/+$/, "")}${payload.urls.status}`
          : `${apiBase.replace(/\/+$/, "")}/api/edit-sessions/${payload.id}/status`;

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

        intervalId = window.setInterval(() => {
          void refreshStatus();
        }, 1200);

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
      manifestReady: Boolean(previewManifest)
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
  const canRenderNativeVideoStage = Boolean(resolvedVideoSrc);
  const shouldUseDisplayGod = Boolean(
    previewRenderer === "hyperframes" &&
    canRenderNativeVideoStage &&
    displayTimeline &&
    !displayGodFallbackReason
  );
  const shouldUseRemotionPreview = Boolean(previewRenderer === "remotion" && canRenderNativeVideoStage);
  const stageStatusMessage = nativePreviewErrorMessage ?? buildError;

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
