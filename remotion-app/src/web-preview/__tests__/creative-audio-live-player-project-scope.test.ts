import {describe, expect, it} from "vitest";

import {
  buildBackendPreviewPlan,
  buildPreviewManifestFromSessionState,
  createProjectScopedPreviewResetState,
  type LiveEditSessionPublicState
} from "../CreativeAudioLivePlayer";

const liveSessionState: LiveEditSessionPublicState = {
  id: "project-a",
  status: "preview_text_ready",
  captionProfileId: "longform_svg_typography_v1",
  motionTier: "premium",
  previewStatus: "preview_text_ready",
  previewLines: ["Project A live preview"],
  previewMotionSequence: [
    {
      cueId: "cue-project-a-1",
      text: "Project A live preview",
      startMs: 0,
      durationMs: 900,
      lineIndex: 0
    }
  ],
  transcriptStatus: "full_transcript_ready",
  transcriptWords: [
    {text: "Project", start_ms: 0, end_ms: 160},
    {text: "A", start_ms: 160, end_ms: 260}
  ],
  analysisStatus: "analysis_ready",
  motionGraphicsStatus: "motion_graphics_ready",
  renderStatus: "idle",
  errorMessage: null,
  lastEventType: "preview_text_ready",
  sourceFilename: "project-a.mp4",
  sourceDurationMs: 12000,
  sourceAspectRatio: "16:9",
  sourceWidth: 1920,
  sourceHeight: 1080,
  sourceFps: 30,
  sourceHasVideo: true,
  routes: {
    status: "/api/edit-sessions/project-a/status",
    previewManifest: "/api/edit-sessions/project-a/preview-manifest",
    previewArtifact: "/api/edit-sessions/project-a/preview-artifact",
    preview: "/api/edit-sessions/project-a/preview",
    render: "/api/edit-sessions/project-a/render",
    renderStatus: "/api/edit-sessions/project-a/render-status",
    sourceMedia: "/api/edit-sessions/project-a/source",
    events: "/api/edit-sessions/project-a/events"
  },
  lanes: {
    defaultInteractive: "hyperframes",
    interactive: ["hyperframes"],
    export: "remotion"
  },
  sourceMediaUrl: "/api/edit-sessions/project-a/source",
  sourceMediaKind: "session_source_stream",
  sourceLabel: "Project A",
  previewArtifactUrl: "/preview-artifacts/project-a.html",
  previewArtifactKind: "html_composition",
  previewArtifactContentType: "text/html; charset=utf-8",
  previewDiagnostics: {
    sessionId: "project-a"
  }
};

describe("CreativeAudioLivePlayer project scope", () => {
  it("derives project-scoped preview outputs from the active session only", () => {
    const manifest = buildPreviewManifestFromSessionState(liveSessionState, "http://127.0.0.1:8000");
    const backendPreviewPlan = buildBackendPreviewPlan(liveSessionState);

    expect(manifest?.sessionId).toBe("project-a");
    expect(manifest?.baseVideo.src).toBe("http://127.0.0.1:8000/api/edit-sessions/project-a/source");
    expect(backendPreviewPlan?.previewLines).toEqual(["Project A live preview"]);
  });

  it("clears stale manifest and backend-plan state on project switch reset", () => {
    const resetState = createProjectScopedPreviewResetState();

    expect(resetState.session).toBeNull();
    expect(resetState.liveSessionState).toBeNull();
    expect(resetState.buildState).toBe("building-timeline");
    expect(resetState.buildError).toBeNull();
    expect(resetState.sessionBuildSignature).toBe("");
    expect(buildPreviewManifestFromSessionState(resetState.liveSessionState, "http://127.0.0.1:8000")).toBeNull();
  });
});
