import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTempFile, createTestApp, makeTempDir, buildMultipartBody} from "./test-utils";

describe("backend app contract", () => {
  let tempDir: string;

  const buildTranscript = (text: string): Array<{text: string; start_ms: number; end_ms: number; confidence: number}> => {
    return text.split(/\s+/).map((word, index) => ({
      text: word,
      start_ms: index * 450,
      end_ms: index * 450 + 380,
      confidence: 0.95
    }));
  };

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("accepts JSON intake and exposes job artifacts through polling routes", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Make this cinematic and premium for shorts."
      }
    });

    expect(createResponse.statusCode).toBe(202);
    const createBody = createResponse.json();
    expect(createBody.job_id).toMatch(/^job_/);

    await context.queue.onIdle();

    const jobResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}`
    });
    const metadataResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/metadata`
    });
    const clipsResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/clips`
    });
    const planResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/plan`
    });
    const motionPlanResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/motion-plan`
    });
    const executionResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/execution`
    });

    expect(jobResponse.statusCode).toBe(200);
    expect(jobResponse.json().status).toBe("completed");
    expect(metadataResponse.statusCode).toBe(200);
    expect(clipsResponse.statusCode).toBe(200);
    expect(planResponse.statusCode).toBe(200);
    expect(motionPlanResponse.statusCode).toBe(200);
    expect(executionResponse.statusCode).toBe(200);
    expect(jobResponse.json().artifact_availability.clip_selection).toBe(true);
    expect(jobResponse.json().artifact_availability.result).toBe(true);
    expect(jobResponse.json().artifact_availability.motion_plan).toBe(true);

    await context.app.close();
  });

  it("accepts the dedicated viral clip endpoint and returns a result payload", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/generate-viral-clips",
      payload: {
        projectId: "proj_1",
        videoId: "vid_1",
        targetPlatform: "shorts",
        clipCountMin: 2,
        clipCountMax: 4,
        prompt: "Find the strongest creator-focused shorts clips.",
        creatorNiche: "creator",
        providedTranscript: buildTranscript(
          [
            "Most creators make one mistake that kills retention.",
            "They start with background instead of tension, and viewers scroll before the payoff arrives.",
            "Here's the thing: when you open with the conflict first, people stay long enough to hear the lesson.",
            "I was wrong about that for years, and fixing it doubled the comments on my videos.",
            "The reason is simple.",
            "Curiosity buys you a few more seconds, and those seconds give your payoff room to land.",
            "Nobody talks about this, but the hook is not the headline.",
            "The hook is the unresolved tension that makes the next sentence feel necessary."
          ].join(" ")
        )
      }
    });

    expect(createResponse.statusCode).toBe(202);
    const createBody = createResponse.json();
    expect(createBody.jobId).toMatch(/^job_/);
    expect(createBody.stage).toBe("queued");

    await context.queue.onIdle();

    const jobResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.jobId}`
    });
    const resultResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.jobId}/result`
    });

    expect(jobResponse.statusCode).toBe(200);
    expect(jobResponse.json().stage).toBe("completed");
    expect(resultResponse.statusCode).toBe(200);
    expect(resultResponse.json().selected_clips.length).toBeGreaterThan(0);

    await context.app.close();
  });

  it("accepts multipart intake with source and asset files", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const multipart = buildMultipartBody([
      {
        name: "request_json",
        value: JSON.stringify({
          prompt: "Use the uploaded asset and keep the style cinematic."
        })
      },
      {
        name: "source_video",
        filename: "input.mp4",
        contentType: "video/mp4",
        value: Buffer.from("fake-video-data")
      },
      {
        name: "assets[]",
        filename: "hero.png",
        contentType: "image/png",
        value: Buffer.from("fake-image-data")
      }
    ]);

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: {
        "content-type": multipart.contentType
      },
      payload: multipart.body
    });

    expect(createResponse.statusCode).toBe(202);
    const createBody = createResponse.json();
    await context.queue.onIdle();

    const jobResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}`
    });

    expect(jobResponse.statusCode).toBe(200);
    expect(jobResponse.json().request_summary.has_source_video).toBe(true);
    expect(jobResponse.json().request_summary.asset_count).toBe(1);

    await context.app.close();
  });

  it("accepts larger multipart viral clip uploads without tripping file limits", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const multipart = buildMultipartBody([
      {
        name: "request_json",
        value: JSON.stringify({
          projectId: "proj_large",
          videoId: "vid_large",
          targetPlatform: "shorts",
          clipCountMin: 2,
          clipCountMax: 4,
          prompt: "Process the larger sample video without rejecting the upload."
        })
      },
      {
        name: "source_video",
        filename: "large-sample.mp4",
        contentType: "video/mp4",
        value: Buffer.alloc(2 * 1024 * 1024, 7)
      }
    ]);

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/generate-viral-clips",
      headers: {
        "content-type": multipart.contentType
      },
      payload: multipart.body
    });

    expect(createResponse.statusCode).toBe(202);
    const createBody = createResponse.json();

    await context.queue.onIdle();

    const jobResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.jobId}`
    });

    expect(jobResponse.statusCode).toBe(200);
    expect(jobResponse.json().request_summary.has_source_video).toBe(true);

    await context.app.close();
  }, 20000);

  it("rejects invalid empty requests", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const response = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Request must include");

    await context.app.close();
  });

  it("exposes the metadata catalog endpoint", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const response = await context.app.inject({
      method: "GET",
      url: "/api/metadata/catalog"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().count).toBeGreaterThan(70);

    await context.app.close();
  });
});
