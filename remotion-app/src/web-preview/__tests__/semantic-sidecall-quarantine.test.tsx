import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {LongformSemanticSidecallOverlay} from "../../components/LongformSemanticSidecallOverlay";
import {SemanticSidecallCueVisual} from "../../components/SemanticSidecallCueVisual";
import {
  sanitizeRenderableOverlayText,
  shouldRenderOverlayText
} from "../../lib/motion-platform/render-text-safety";
import type {CaptionChunk, MotionShowcaseCue} from "../../lib/types";

const makeChunk = (partial: Partial<CaptionChunk> = {}): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Give it a label.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1200,
  words: partial.words ?? [
    {text: "Give", startMs: 0, endMs: 180},
    {text: "it", startMs: 200, endMs: 260},
    {text: "a", startMs: 280, endMs: 320},
    {text: "label.", startMs: 340, endMs: 620}
  ],
  styleKey: partial.styleKey ?? "style",
  motionKey: partial.motionKey ?? "motion",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  }
});

const makeCue = (): MotionShowcaseCue => ({
  id: "cue-1",
  assetId: "virtual-cue-asset",
  asset: {
    id: "virtual-cue-asset",
    family: "panel",
    tier: "minimal",
    src: "showcase-assets/placeholder.png",
    alphaMode: "straight",
    placementZone: "side-panels",
    durationPolicy: "scene-span",
    themeTags: ["neutral"],
    safeArea: "edge-safe",
    loopable: false,
    blendMode: "normal",
    opacity: 1
  },
  matchedText: "retrieval-assets/missing/clock.tsx does not exist",
  canonicalLabel: "LOOKING",
  cueSource: "typography-only",
  matchedWordIndex: 0,
  matchedStartMs: 0,
  matchedEndMs: 800,
  governorAction: "text-only-accent",
  startMs: 0,
  peakStartMs: 120,
  peakEndMs: 900,
  endMs: 1200,
  leadMs: 120,
  holdMs: 780,
  exitMs: 300,
  placement: "landscape-right",
  showLabelPlate: false,
  score: 0.92,
  matchKind: "typography",
  templateGraphicCategory: null
});

describe("semantic sidecall quarantine", () => {
  it("renders no longform semantic sidecall overlay markup by default", () => {
    const markup = renderToStaticMarkup(
      <LongformSemanticSidecallOverlay chunks={[makeChunk()]} />
    );

    expect(markup).toBe("");
  });

  it("renders no semantic cue visual markup by default", () => {
    const markup = renderToStaticMarkup(
      <SemanticSidecallCueVisual
        cue={makeCue()}
        visibility={1}
        translateY={0}
        scale={1}
        rotation={0}
      />
    );

    expect(markup).toBe("");
  });

  it("suppresses retrieval diagnostics but keeps clean caption copy renderable", () => {
    expect(sanitizeRenderableOverlayText("C:\\\\Users\\\\HomePC\\\\Downloads\\\\HELP, VIDEO MATTING\\\\remotion-app\\\\public\\\\retrieval-assets\\\\demo.html does not exist")).toBe("");
    expect(sanitizeRenderableOverlayText("canonicalLabel")).toBe("");
    expect(shouldRenderOverlayText("This changes retention.")).toBe(true);
  });
});
