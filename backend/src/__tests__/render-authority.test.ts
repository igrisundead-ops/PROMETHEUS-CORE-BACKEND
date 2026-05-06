import {describe, expect, it} from "vitest";

import {resolveRenderAuthority} from "../render/render-authority";
import {loadRenderConfig} from "../config/render-flags";

describe("render authority", () => {
  it("never routes video preview into audio-only path when audio-only is disabled", () => {
    const config = loadRenderConfig({
      ENABLE_AUDIO_ONLY_PREVIEW: "false",
      ENABLE_LIVE_BROWSER_OVERLAY: "false",
      ENABLE_DARK_AUDIO_PREVIEW: "false",
      ENABLE_BLACK_PREVIEW_BACKGROUND: "false"
    });

    const trace = resolveRenderAuthority({
      jobId: "job_123",
      previewModeRequested: "video_preview",
      renderConfig: config,
      artifactAvailable: true
    });

    expect(trace.previewModeActuallyUsed).toBe("video_preview");
    expect(trace.audioOnlyPathUsed).toBe(false);
    expect(trace.darkPreviewPathUsed).toBe(false);
    expect(trace.frontendOverlayUsed).toBe(false);
  });
});

