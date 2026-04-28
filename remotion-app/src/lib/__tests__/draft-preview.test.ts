import {describe, expect, it} from "vitest";

import {
  buildDraftPreviewSettingsFingerprint,
  getDraftPreviewStateFromManifest,
  getLongformDraftVideoMetadata,
  isDraftPreviewManifestFresh,
  LONGFORM_DRAFT_COMPOSITION_ID,
  LONGFORM_DRAFT_PIPELINE_VERSION,
  type DraftPreviewManifest,
  type DraftPreviewRequest
} from "../draft-preview";

const sampleRequest: DraftPreviewRequest = {
  sourceVideoHash: "abc123def4567890fedcba0987654321",
  captionProfileId: "longform_svg_typography_v1",
  motionTier: "premium",
  gradeProfileId: "warm-cinematic",
  transitionPresetId: "auto",
  matteMode: "auto",
  captionBias: "middle",
  motionPlanFingerprint: "motion-plan-v1",
  patternMemoryFingerprint: "pattern-memory-v1"
};

describe("draft preview helpers", () => {
  it("scales long-form metadata into the draft render cap", () => {
    expect(getLongformDraftVideoMetadata({
      width: 3840,
      height: 2160,
      durationSeconds: 79.7
    })).toEqual({
      width: 854,
      height: 480,
      fps: 15,
      durationSeconds: 79.7,
      durationInFrames: Math.ceil(79.7 * 15)
    });
  });

  it("builds a stable settings fingerprint for freshness checks", () => {
    expect(buildDraftPreviewSettingsFingerprint(sampleRequest)).toBe(
      "2026-04-17-audio-first-creative-preview-v1__abc123def4567890__longform-svg-typography-v1__premium__warm-cinematic__auto__auto__middle__motion-plan-v1__pattern-memory-v1"
    );
  });

  it("reports manifest freshness only when source and settings match", () => {
    const manifest: DraftPreviewManifest = {
      status: "success",
      compositionId: LONGFORM_DRAFT_COMPOSITION_ID,
      sourceVideoHash: sampleRequest.sourceVideoHash,
      pipelineVersion: LONGFORM_DRAFT_PIPELINE_VERSION,
      settingsFingerprint: buildDraftPreviewSettingsFingerprint(sampleRequest),
      request: sampleRequest,
      startedAt: "2026-04-06T10:00:00.000Z",
      finishedAt: "2026-04-06T10:00:10.000Z",
      generatedAt: "2026-04-06T10:00:10.000Z",
      outputPath: "C:\\repo\\public\\draft-previews\\longform\\current.mp4",
      outputUrl: "/draft-previews/longform/current.mp4?v=test",
      draftSourceProxyPath: "C:\\repo\\public\\input-video-landscape.draft.m4a",
      draftSourceProxyPublicPath: "/input-video-landscape.draft.m4a",
      draftSourceProxyCacheHit: true,
      stageTimingsMs: {
        draftSourceProxyGeneration: 0,
        render: 10000,
        total: 10000
      },
      errorMessage: null
    };

    expect(isDraftPreviewManifestFresh(manifest, sampleRequest)).toBe(true);
    expect(isDraftPreviewManifestFresh(manifest, {
      ...sampleRequest,
      motionTier: "hero"
    })).toBe(false);
    expect(isDraftPreviewManifestFresh({
      ...manifest,
      pipelineVersion: "legacy"
    }, sampleRequest)).toBe(false);
    expect(getDraftPreviewStateFromManifest(manifest)).toBe("success");
    expect(getDraftPreviewStateFromManifest(null)).toBe("idle");
  });
});
