import {writeFile} from "node:fs/promises";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTempFile, createTestApp, makeTempDir} from "./test-utils";

describe("local preview audio preview routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("extracts a cached audio-only preview asset and serves byte ranges", async () => {
    const sourcePath = await createTempFile({
      dir: tempDir,
      fileName: "speaker.mp4",
      contents: "fake-video-container"
    });

    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        extractAudioPreviewFile: async ({sourcePath: inputPath, outputPath}) => {
          expect(inputPath).toBe(sourcePath);
          await writeFile(outputPath, Buffer.from("preview-audio-track"));
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/local-preview/audio-preview",
      payload: {
        sourcePath
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      assetId: string;
      audioUrl: string;
      contentType: string;
      fileSizeBytes: number;
      sourceDisplayName: string;
    };
    expect(body.assetId).toMatch(/^[a-f0-9]{20}$/);
    expect(body.audioUrl).toBe(`/api/local-preview/audio-preview/${body.assetId}`);
    expect(body.contentType).toBe("audio/mp4");
    expect(body.fileSizeBytes).toBe(Buffer.byteLength("preview-audio-track"));
    expect(body.sourceDisplayName).toBe("speaker.mp4");

    const streamResponse = await context.app.inject({
      method: "GET",
      url: body.audioUrl,
      headers: {
        range: "bytes=0-6"
      }
    });

    expect(streamResponse.statusCode).toBe(206);
    expect(streamResponse.body).toBe("preview");
    expect(streamResponse.headers["accept-ranges"]).toBe("bytes");
    expect(streamResponse.headers["content-range"]).toBe(`bytes 0-6/${Buffer.byteLength("preview-audio-track")}`);
    expect(String(streamResponse.headers["content-type"])).toContain("audio/mp4");

    await context.app.close();
  });
});
