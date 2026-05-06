import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import type {BackendAppContext, BackendDependencies} from "../app";
import {buildMultipartBody, cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const waitFor = async (predicate: () => Promise<boolean>, attempts = 20, delayMs = 25): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timed out waiting for live preview session to settle.");
};

describe("edit session live preview route", () => {
  let tempDir: string;
  let context: BackendAppContext | null = null;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    if (context) {
      await context.app.close();
      context = null;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await cleanupTempDir(tempDir);
  });

  it("rejects audio-only uploads for the live compositor lane", async () => {
    const deps: BackendDependencies = {
      extractPreviewAudioBuffer: async ({sourcePath}) => {
        expect(path.basename(sourcePath)).toContain("speaker.mp3");
        return Buffer.from("preview-audio");
      },
      streamPreviewAudio: async ({callbacks}) => {
        await callbacks?.onBegin?.({sessionId: "stream-session-1", expiresAt: null});
        await callbacks?.onTurn?.({
          transcript: "Build systems that scale",
          utterance: "Build systems that scale",
          endOfTurn: true,
          turnOrder: 1,
          endOfTurnConfidence: 0.92,
          words: [],
          isFormatted: true
        });
        await callbacks?.onTermination?.({audioDurationSeconds: 1.2});
      },
      transcribeMedia: async () => ([
        {text: "Build", start_ms: 0, end_ms: 180},
        {text: "systems", start_ms: 180, end_ms: 430},
        {text: "that", start_ms: 430, end_ms: 560},
        {text: "scale", start_ms: 560, end_ms: 820}
      ])
    };

    context = await createTestApp({
      storageDir: tempDir,
      deps
    });

    const multipart = buildMultipartBody([
      {
        name: "source_video",
        value: Buffer.from("fake-audio-file"),
        filename: "speaker.mp3",
        contentType: "audio/mpeg"
      },
      {
        name: "captionProfileId",
        value: "longform_eve_typography_v1"
      },
      {
        name: "motionTier",
        value: "premium"
      }
    ]);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/edit-sessions/live-preview",
      payload: multipart.body,
      headers: {
        "content-type": multipart.contentType
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as {error?: string};
    expect(body.error).toContain("video file");
  });

  it("exposes the source media stream and probed video metadata for compositor previews", async () => {
    const deps: BackendDependencies = {
      probeVideoMetadata: async () => ({
        width: 1920,
        height: 1080,
        fps: 30,
        duration_seconds: 12,
        duration_in_frames: 360
      }),
      extractPreviewAudioBuffer: async () => Buffer.from("preview-audio"),
      streamPreviewAudio: async ({callbacks}) => {
        await callbacks?.onTurn?.({
          transcript: "Native compositor ready",
          utterance: "Native compositor ready",
          endOfTurn: true,
          turnOrder: 1,
          endOfTurnConfidence: 0.88,
          words: [],
          isFormatted: true
        });
      },
      transcribeMedia: async () => ([
        {text: "Native", start_ms: 0, end_ms: 180},
        {text: "compositor", start_ms: 180, end_ms: 480},
        {text: "ready", start_ms: 480, end_ms: 700}
      ])
    };

    context = await createTestApp({
      storageDir: tempDir,
      deps
    });

    const multipart = buildMultipartBody([
      {
        name: "source_video",
        value: Buffer.from("fake-video-file"),
        filename: "speaker.mp4",
        contentType: "video/mp4"
      },
      {
        name: "captionProfileId",
        value: "longform_eve_typography_v1"
      }
    ]);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/edit-sessions/live-preview",
      payload: multipart.body,
      headers: {
        "content-type": multipart.contentType
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json() as {id: string; urls: {status: string}};

    await waitFor(async () => {
      const statusResponse = await context!.app.inject({
        method: "GET",
        url: body.urls.status
      });
      const statusBody = statusResponse.json() as Record<string, unknown>;
      return statusBody["sourceHasVideo"] === true;
    });

    const statusResponse = await context.app.inject({
      method: "GET",
      url: body.urls.status
    });
    const statusBody = statusResponse.json() as Record<string, unknown>;
    expect(statusBody["sourceHasVideo"]).toBe(true);
    expect(statusBody["sourceWidth"]).toBe(1920);
    expect(statusBody["sourceHeight"]).toBe(1080);
    expect(statusBody["sourceFps"]).toBe(30);
    expect(statusBody["sourceDurationMs"]).toBe(12000);

    const sourceResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${body.id}/source`
    });

    expect(sourceResponse.statusCode).toBe(200);
    expect(sourceResponse.headers["content-type"]).toContain("video/mp4");
    expect(sourceResponse.body).toBe("fake-video-file");
  });
});
