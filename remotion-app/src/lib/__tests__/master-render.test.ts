import {describe, expect, it} from "vitest";

import {
  buildMasterRenderSettingsFingerprint,
  getMasterRenderStateFromManifest,
  isMasterRenderManifestFresh,
  LONGFORM_MASTER_COMPOSITION_ID,
  LONGFORM_MASTER_PIPELINE_VERSION,
  type MasterRenderManifest,
  type MasterRenderRequest
} from "../master-render";

const sampleRequest: MasterRenderRequest = {
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

describe("master render helpers", () => {
  it("builds a stable settings fingerprint for freshness checks", () => {
    expect(buildMasterRenderSettingsFingerprint(sampleRequest)).toBe(
      "2026-04-09-master-longform-v1__abc123def4567890__longform-svg-typography-v1__premium__warm-cinematic__auto__auto__middle__motion-plan-v1__pattern-memory-v1"
    );
  });

  it("reports manifest freshness only when source and settings match", () => {
    const manifest: MasterRenderManifest = {
      status: "success",
      compositionId: LONGFORM_MASTER_COMPOSITION_ID,
      sourceVideoHash: sampleRequest.sourceVideoHash,
      pipelineVersion: LONGFORM_MASTER_PIPELINE_VERSION,
      settingsFingerprint: buildMasterRenderSettingsFingerprint(sampleRequest),
      request: sampleRequest,
      startedAt: "2026-04-06T10:00:00.000Z",
      finishedAt: "2026-04-06T10:00:10.000Z",
      generatedAt: "2026-04-06T10:00:10.000Z",
      outputPath: "C:\\repo\\public\\master-renders\\longform\\current.mp4",
      outputUrl: "/master-renders/longform/current.mp4?v=test",
      stageTimingsMs: {
        render: 10000,
        total: 10000
      },
      errorMessage: null
    };

    expect(isMasterRenderManifestFresh(manifest, sampleRequest)).toBe(true);
    expect(isMasterRenderManifestFresh(manifest, {
      ...sampleRequest,
      motionTier: "hero"
    })).toBe(false);
    expect(isMasterRenderManifestFresh({
      ...manifest,
      pipelineVersion: "legacy"
    }, sampleRequest)).toBe(false);
    expect(getMasterRenderStateFromManifest(manifest)).toBe("success");
    expect(getMasterRenderStateFromManifest(null)).toBe("idle");
  });
});
