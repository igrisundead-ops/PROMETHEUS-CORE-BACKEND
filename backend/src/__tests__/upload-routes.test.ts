import {writeFile} from "node:fs/promises";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

type JsonResponse = {
  statusCode: number;
  json: () => any;
};

const waitForResponse = async (
  getResponse: () => Promise<JsonResponse>,
  predicate: (value: any) => boolean,
  timeoutMs = 15000,
  intervalMs = 100
): Promise<JsonResponse> => {
  const startedAt = Date.now();
  let response = await getResponse();
  while (!predicate(response.json())) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for upload session state to settle.");
    }
    await sleep(intervalMs);
    response = await getResponse();
  }
  return response;
};

describe("R2 upload routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("returns a presigned PUT url and the required upload headers", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        r2Service: {
          isConfigured: true,
          createUploadUrl: async ({filename, contentType, userId}) => {
            return {
              uploadUrl: `https://upload.example/${userId ?? "anonymous"}/${filename}`,
              key: `uploads/${userId ?? "anonymous"}/123-${filename}`,
              bucket: "prometheus-uploads",
              publicUrl: `https://public.example/uploads/${filename}`,
              expiresInSeconds: 600,
              requiredHeaders: {
                "Content-Type": contentType
              }
            };
          },
          downloadObject: async () => {
            throw new Error("downloadObject should not be called for upload-url");
          }
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/upload-url",
      payload: {
        filename: "Dan Martell, Scared of Achieving.mp4",
        contentType: "video/mp4",
        userId: "josh"
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.uploadUrl).toContain("https://upload.example/josh/");
    expect(body.key).toContain("uploads/josh/");
    expect(body.bucket).toBe("prometheus-uploads");
    expect(body.publicUrl).toContain("https://public.example/uploads/");
    expect(body.requiredHeaders["Content-Type"]).toBe("video/mp4");

    await context.app.close();
  });

  it("creates a session from an R2 object and starts the preview pipeline asynchronously", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          duration_seconds: 69.335011,
          duration_in_frames: 2080,
          fps: 30
        }),
        extractPreviewAudioBuffer: async () => Buffer.alloc(2048),
        streamPreviewAudio: async ({callbacks}) => {
          await callbacks?.onBegin?.({sessionId: "stream_test", expiresAt: null});
          await callbacks?.onTurn?.({
            turnOrder: 0,
            transcript: "Launch fast and keep the motion clean.",
            utterance: "Launch fast and keep the motion clean.",
            endOfTurn: true,
            endOfTurnConfidence: 0.98,
            words: [],
            isFormatted: true
          });
          await callbacks?.onTermination?.({audioDurationSeconds: 8});
        },
        transcribeMedia: async ({onPoll}) => {
          await onPoll?.({
            attempt: 0,
            maxPollAttempts: 10,
            status: "processing",
            transcriptId: "transcript_test",
            words: 0
          });
          await onPoll?.({
            attempt: 1,
            maxPollAttempts: 10,
            status: "completed",
            transcriptId: "transcript_test",
            words: 7
          });
          return [
            {text: "Launch", start_ms: 0, end_ms: 200, confidence: 0.99},
            {text: "fast", start_ms: 200, end_ms: 400, confidence: 0.99},
            {text: "and", start_ms: 400, end_ms: 600, confidence: 0.99},
            {text: "keep", start_ms: 600, end_ms: 800, confidence: 0.99},
            {text: "the", start_ms: 800, end_ms: 1000, confidence: 0.99},
            {text: "motion", start_ms: 1000, end_ms: 1200, confidence: 0.99},
            {text: "clean.", start_ms: 1200, end_ms: 1400, confidence: 0.99}
          ];
        },
        r2Service: {
          isConfigured: true,
          createUploadUrl: async () => {
            throw new Error("createUploadUrl should not be called for process");
          },
          downloadObject: async ({destinationPath}) => {
            await writeFile(destinationPath, Buffer.from("fake-video-data"));
            return {
              bucket: "prometheus-uploads",
              key: "uploads/josh/test.mp4",
              destinationPath,
              sizeBytes: 15
            };
          }
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/process",
      payload: {
        bucket: "prometheus-uploads",
        key: "uploads/josh/test.mp4",
        filename: "Dan Martell, Scared of Achieving.mp4",
        contentType: "video/mp4",
        userId: "josh",
        mediaUrl: "https://public.example/uploads/josh/test.mp4",
        metadata: {
          note: "sample upload"
        }
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^edit_/);
    expect(body.sessionId).toBe(body.jobId);
    expect(body.status).toBe("queued");

    await context.queue.onIdle();

    const statusResponse = await waitForResponse(
      () =>
        context.app.inject({
          method: "GET",
          url: `/api/edit-sessions/${body.sessionId}/status`
        }),
      (status) => status.previewStatus === "preview_text_ready" && status.transcriptStatus === "full_transcript_ready"
    );
    const previewResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${body.sessionId}/preview`
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json().storageKey).toBe("uploads/josh/test.mp4");
    expect(statusResponse.json().previewText).toContain("Launch fast");
    expect(statusResponse.json().transcriptStatus).toBe("full_transcript_ready");
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().status).toBe("preview_text_ready");

    await sleep(250);
    await context.app.close();
  });
});
