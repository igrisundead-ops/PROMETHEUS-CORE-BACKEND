import {describe, expect, it} from "vitest";

import {rerankAssetDocument} from "../assets/reranking";
import type {NormalizedAssetDocument} from "../assets/types";

const makeDocument = (overrides: Partial<NormalizedAssetDocument>): NormalizedAssetDocument => ({
  asset_id: "ring-focus-accent",
  asset_type: "accent",
  source_library: "structured-animation-root",
  absolute_path: "C:/ring.html",
  relative_path: "ring.html",
  public_path: "/retrieval-assets/ring.html",
  folder_name: "RING",
  filename: "ring glow accent.html",
  file_extension: ".html",
  tags: ["ring", "halo", "glow", "thoughtful", "headline support"],
  labels: ["ring accent"],
  retrieval_caption: "Circular glow ring underlay for headline emphasis.",
  semantic_description: "Glass HUD ring accent for reflective moments.",
  animation_family: "accent",
  motion_intensity: "premium",
  mood: ["cool", "calm"],
  subject: "ring",
  category: "accent",
  contexts: ["reflective moment", "headline support"],
  anti_contexts: ["explosion", "aggressive burst"],
  constraints: ["centered headline"],
  duration_class: "short",
  aspect_ratio: "",
  dominant_visual_role: "underlay-accent",
  confidence: 0.91,
  source_mapping_reference: ["schema:ring-focus"],
  embedding_text: "Circular halo ring accent with cinematic blur for thoughtful emphasis and centered headline support.",
  embedding_text_mode: "compact",
  content_hash: "abc",
  metadata_version: "v1",
  file_size_bytes: 100,
  modified_time_ms: 1,
  width: null,
  height: null,
  duration_seconds: null,
  extension_is_animated: true,
  ...overrides
});

describe("asset reranking", () => {
  it("boosts circular reflective underlays for matching queries", () => {
    const result = rerankAssetDocument({
      document: makeDocument({}),
      request: {
        queryText: "premium circular underlay behind centered headline for reflective moment",
        desiredAssetTypes: ["accent", "animated_overlay"],
        positionRole: "underlay-accent",
        requireAnimated: true
      },
      vectorScore: 0.42
    });

    expect(result.score).toBeGreaterThan(90);
    expect(result.reasons.join(" ")).toContain("circular");
  });

  it("penalizes aggressive assets for subtle reflective requests", () => {
    const result = rerankAssetDocument({
      document: makeDocument({
        asset_id: "burst-overlay",
        tags: ["burst", "fast", "aggressive"],
        semantic_description: "Fast aggressive burst overlay.",
        embedding_text: "Aggressive fast burst overlay for impact spikes.",
        dominant_visual_role: "transition-accent"
      }),
      request: {
        queryText: "thoughtful cinematic blur accent",
        desiredAssetTypes: ["accent"],
        requireAnimated: true
      },
      vectorScore: 0.4
    });

    expect(result.score).toBeLessThan(70);
    expect(result.reasons.join(" ")).toContain("aggressive");
  });
});
