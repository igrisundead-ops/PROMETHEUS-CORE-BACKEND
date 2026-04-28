import {describe, expect, it} from "vitest";

import {buildMotionGraphicsAgentQuery} from "../motion-graphics-agent/query";
import {buildMotionCompositionModel} from "../motion-platform/scene-engine";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Because you're actually thinking about the decision.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1400,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [2],
  profileId: partial.profileId ?? "svg_typography_v1",
  semantic: partial.semantic ?? {
    intent: "punch-emphasis",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

describe("motion graphics agent", () => {
  it("builds a landscape-safe query contract with center protection", () => {
    const chunk = makeChunk({});
    const query = buildMotionGraphicsAgentQuery({
      sceneId: "scene-1",
      chunk,
      headlineText: "WHATEVER THAT DECISION IS",
      subtextText: "Keep the frame premium and readable.",
      tier: "premium",
      sceneKind: "quote",
      aspectRatio: 16 / 9,
      safeZones: [
        {
          id: "text",
          kind: "text",
          label: "Text",
          leftPercent: 22,
          topPercent: 30,
          widthPercent: 56,
          heightPercent: 22
        },
        {
          id: "face",
          kind: "face",
          label: "Face",
          leftPercent: 32,
          topPercent: 12,
          widthPercent: 36,
          heightPercent: 44
        }
      ]
    });

    expect(query.placementConstraints.centerReserved).toBe(true);
    expect(query.avoidList).toContain("vertical beam");
    expect(query.request.antiContexts).toContain("glass pillar");
    expect(query.assetCandidates.length).toBeGreaterThan(0);
  });

  it("disables the legacy landscape background overlay and keeps real motion assets selected", () => {
    const chunks = [
      makeChunk({
        id: "chunk-a",
        text: "Because you're actually thinking about the decision.",
        startMs: 0,
        endMs: 1600
      }),
      makeChunk({
        id: "chunk-b",
        text: "The next move should feel intentional and premium.",
        startMs: 1700,
        endMs: 3400,
        emphasisWordIndices: [4],
        semantic: {
          intent: "default",
          nameSpans: [],
          isVariation: false,
          suppressDefault: false
        }
      })
    ];

    const model = buildMotionCompositionModel({
      chunks,
      tier: "premium",
      fps: 30,
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 4,
        durationInFrames: 120
      }
    });

    expect(model.motionGraphicsPlan.enabled).toBe(true);
    expect(model.motionGraphicsPlan.disableLegacyBackgroundOverlay).toBe(true);
    expect(model.backgroundOverlayPlan.enabled).toBe(false);
    expect(model.motionGraphicsPlan.sceneDecisions[0]?.selectedAssets.length ?? 0).toBeGreaterThan(0);
    expect(model.motionGraphicsPlan.sceneDecisions.flatMap((decision) => decision.selectedAssets).some((asset) => /beam|pillar|column|slab/i.test(asset.assetId))).toBe(false);
  }, 20000);
});
