import {describe, expect, it} from "vitest";

import {hyperframesPreviewManifestSchema} from "../hyperframes/manifest-schema";

describe("hyperframesPreviewManifestSchema", () => {
  it("accepts the live preview manifest shape used by the Hyperframes lane", () => {
    const parsed = hyperframesPreviewManifestSchema.parse({
      schemaVersion: "hyperframes-preview-manifest/v1",
      sessionId: "session-1",
      captionProfileId: "longform_eve_typography_v1",
      motionTier: "premium",
      lanes: {
        defaultInteractive: "hyperframes",
        interactive: ["hyperframes", "remotion"],
        export: "remotion"
      },
      routes: {
        status: "/api/edit-sessions/session-1/status",
        preview: "/api/edit-sessions/session-1/preview",
        render: "/api/edit-sessions/session-1/render",
        renderStatus: "/api/edit-sessions/session-1/render-status",
        sourceMedia: "/api/edit-sessions/session-1/source"
      },
      baseVideo: {
        src: "/api/edit-sessions/session-1/source",
        sourceKind: "session_source_stream",
        sourceLabel: "demo.mp4",
        hasVideo: true,
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 12000
      },
      audio: {
        src: null,
        source: "video-element"
      },
      session: {
        id: "session-1",
        status: "preview_text_ready",
        previewStatus: "preview_text_ready",
        transcriptStatus: "full_transcript_ready",
        analysisStatus: "analysis_ready",
        motionGraphicsStatus: "motion_graphics_ready",
        renderStatus: "idle",
        previewText: "Build the message first",
        previewLines: ["Build the message first"],
        previewMotionSequence: [
          {
            cueId: "cue-1",
            text: "Build the message first",
            startMs: 0,
            durationMs: 720,
            lineIndex: 0
          }
        ],
        transcriptWords: [
          {
            text: "Build",
            start_ms: 0,
            end_ms: 120
          }
        ],
        errorMessage: null,
        sourceFilename: "demo.mp4",
        sourceDurationMs: 12000,
        sourceAspectRatio: "16:9",
        sourceWidth: 1920,
        sourceHeight: 1080,
        sourceFps: 30,
        sourceHasVideo: true,
        lastEventType: "preview_text_ready",
        previewPlaceholder: {
          active: false,
          styleId: "longform_eve_typography_v1",
          copy: "Build the message first",
          reason: "waiting_for_audio",
          line1: "Build the message first",
          line2: null
        },
        renderOutputUrl: null,
        renderOutputPath: null
      },
      overlayPlan: {
        previewText: "Build the message first",
        previewLines: ["Build the message first"],
        previewMotionSequence: [
          {
            cueId: "cue-1",
            text: "Build the message first",
            startMs: 0,
            durationMs: 720,
            lineIndex: 0
          }
        ],
        transcriptWords: [
          {
            text: "Build",
            start_ms: 0,
            end_ms: 120
          }
        ],
        placeholder: {
          active: false,
          styleId: "longform_eve_typography_v1",
          copy: "Build the message first",
          reason: "waiting_for_audio",
          line1: "Build the message first",
          line2: null
        }
      },
      export: {
        remotion: {
          available: true,
          renderStatus: "idle",
          outputUrl: null,
          outputPath: null
        }
      }
    });

    expect(parsed.lanes.defaultInteractive).toBe("hyperframes");
    expect(parsed.baseVideo.hasVideo).toBe(true);
    expect(parsed.overlayPlan.previewMotionSequence).toHaveLength(1);
  });
});
