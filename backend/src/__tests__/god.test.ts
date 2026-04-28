import {readFile} from "node:fs/promises";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";
import {runGodExampleFlow} from "../god";

describe("GOD subsystem", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("assesses, generates, validates, approves, and promotes an asset through the governed flow", async () => {
    const godCollectionDir = path.join(tempDir, "god-collection");
    const godReviewDir = path.join(tempDir, "god-review");
    const godManifestPath = path.join(godCollectionDir, "god-assets.generated.json");

    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        GOD_PROVIDER_KIND: "local-template",
        GOD_PROVIDER_ENDPOINT: "",
        GOD_PROVIDER_API_KEY: "",
        GOD_PROVIDER_MODEL: "",
        GOD_PROVIDER_TIMEOUT_MS: "5000",
        GOD_COLLECTION_DIR: godCollectionDir,
        GOD_COLLECTION_MANIFEST_PATH: godManifestPath,
        GOD_REVIEW_DIR: godReviewDir,
        GOD_MAX_BRIEF_SIMILARITY: "0.95",
        GOD_AUTO_PROMOTE: "false"
      }
    });

    const sceneContext = {
      prompt: "Create a premium transparent glass orb for a cinematic scene transition.",
      sceneLabel: "Premium Glass Orb",
      exactMoment: "transition beat",
      semanticRole: "premium-glass-orb",
      assetRole: "showcase" as const,
      toneTarget: "cinematic-premium-clean",
      visualTone: "Apple-esque glassmorphism",
      motionLanguage: "cinematic flat motion with easing-out",
      compositionNeed: "overlay compositing",
      presentationMode: "long-form" as const,
      width: 1920,
      height: 1080,
      fps: 30,
      durationSeconds: 6,
      isOverlayAsset: true,
      isSceneSpecific: true,
      variationRequested: true,
      manualReviewRequested: false,
      preferredForm: "orb" as const,
      requiredText: "Premium Glass Orb",
      requiredElements: ["transparent background"],
      forbiddenElements: ["watermark"],
      compositionConstraints: ["transparent outside bounds"],
      paletteGuidance: ["soft cool highlight"],
      brandRules: ["premium-editorial-restraint"],
      reusabilityGoal: "Reusable transparent asset for premium overlays.",
      projectId: "god-example-project",
      clientId: "god-example-client",
      templateFamily: "motion-premium",
      sourceJobId: "job_god_example",
      existingAssets: [],
      backgroundAssets: [],
      referenceTags: ["cool", "premium"],
      notes: "Example flow coverage"
    };

    try {
      const result = await runGodExampleFlow({
        service: context.god,
        context: sceneContext,
        approveGeneratedAsset: true
      });

      expect(result.assessmentDecision).not.toBe("use_existing_asset");
      expect(result.generation).not.toBeNull();
      const generation = result.generation;
      if (!generation) {
        throw new Error("Expected GOD to generate a review bundle.");
      }
      expect(generation.record).not.toBeNull();
      expect(generation.validation?.passed).toBe(true);
      const promotedRecord = result.promotedRecord;
      if (!promotedRecord) {
        throw new Error("Expected the generated GOD asset to be promoted.");
      }
      expect(promotedRecord.state).toBe("promoted");
      expect(promotedRecord.benchmark.passed).toBe(true);
      expect(promotedRecord.promotion?.permanentAssetDir).toContain(godCollectionDir);

      const promotedManifestPath = path.join(godCollectionDir, promotedRecord.assetId, "asset.manifest.json");
      const manifest = JSON.parse(await readFile(promotedManifestPath, "utf-8")) as Record<string, unknown>;

      expect(manifest.id).toBe(promotedRecord.assetId);
      expect(manifest.sourceKind).toBe("god-generated");
      expect(manifest.approvalState).toBe("approved");
      expect(String(manifest.originTrace && (manifest.originTrace as Record<string, unknown>).reviewId)).toBe(promotedRecord.reviewId);

      const approvedResponse = await context.app.inject({
        method: "GET",
        url: "/api/god/assets?scope=approved"
      });

      expect(approvedResponse.statusCode).toBe(200);
      const approvedBody = approvedResponse.json() as {approved: Array<{id?: string}>; summary: {approvedCount: number}};
      expect(approvedBody.summary.approvedCount).toBeGreaterThan(0);
      expect(approvedBody.approved.some((asset) => asset.id === promotedRecord.assetId)).toBe(true);
    } finally {
      await context.app.close();
    }
  }, 30000);
});
