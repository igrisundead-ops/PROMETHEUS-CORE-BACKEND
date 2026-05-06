import path from "node:path";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import os from "node:os";

import {describe, expect, it} from "vitest";

import {generateHyperFramesComposition} from "../composition/hyperframes-composition-generator";
import type {CreativeDecisionManifest} from "../contracts/creative-decision-manifest";

const buildManifest = (): CreativeDecisionManifest => ({
  manifestVersion: "1.0.0",
  jobId: "job_hf_1",
  sceneId: "scene_1",
  source: {
    videoUrl: "/api/edit-sessions/job_hf_1/source",
    transcriptSegment: {
      text: "Build cinematic output now.",
      startMs: 0,
      endMs: 8000
    }
  },
  scene: {
    durationMs: 8000,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    fps: 30
  },
  intent: {
    rhetoricalIntent: "premium_explain",
    emotionalTone: "cinematic",
    intensity: 0.6
  },
  typography: {
    mode: "svg_longform_typography_v1",
    primaryFont: {family: "Satoshi", source: "custom_ingested", role: "headline"},
    fontPairing: {graphUsed: true, reason: "test"},
    coreWords: [],
    linePlan: {lines: ["Build cinematic", "output now."], maxLines: 3, maxCharsPerLine: 28, allowWidows: false}
  },
  animation: {
    engine: "gsap",
    family: "svg_longform_typography_v1",
    retrievedFromMilvus: true,
    easing: "power3.out",
    staggerMs: 50,
    entryMs: 300,
    holdMs: 700,
    exitMs: 250,
    motionIntensity: 0.5,
    avoid: []
  },
  layout: {
    region: "center",
    safeArea: {top: 72, right: 96, bottom: 84, left: 96},
    maxWidthPercent: 72,
    alignment: "center",
    preventOverlap: true,
    zIndexPlan: [{layer: "video", zIndex: 1}, {layer: "typography", zIndex: 20}]
  },
  renderBudget: {
    previewResolution: "720p",
    previewFps: 30,
    finalResolution: "1080p",
    allowHeavyEffectsInPreview: false,
    finalOnlyEffects: []
  },
  diagnostics: {
    manifestCreatedAt: new Date().toISOString(),
    milvusUsed: true,
    fontGraphUsed: true,
    customFontsUsed: true,
    fallbackUsed: false,
    fallbackReasons: [],
    legacyOverlayUsed: false,
    remotionUsed: false,
    hyperframesUsed: true,
    warnings: []
  }
});

describe("HyperFramesCompositionGenerator", () => {
  it("generates composition files from manifest", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hf-comp-"));
    try {
      const output = await generateHyperFramesComposition({
        manifest: buildManifest(),
        outputRootDir: root
      });
      const indexHtml = await readFile(output.indexHtmlPath, "utf8");
      expect(indexHtml).toContain("typography-layer");
      expect(indexHtml).toContain("id=\"viewport\"");
      expect(indexHtml).toContain("window.innerWidth");
      expect(indexHtml).toContain("copy-block");
      expect(output.renderCommand).toContain("hyperframes render");
      expect(output.compositionGenerationTimeMs).toBeGreaterThanOrEqual(0);
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });
});
