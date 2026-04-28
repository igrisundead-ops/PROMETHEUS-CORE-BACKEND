import {describe, expect, it} from "vitest";

import {buildCreativeOrchestrationPlan} from "../../creative-orchestration";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-001",
  text: partial.text ?? "The biggest mistake creators make is this.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1600,
  words:
    partial.words ??
    [
      {text: "The", startMs: 0, endMs: 120},
      {text: "biggest", startMs: 120, endMs: 340},
      {text: "mistake", startMs: 340, endMs: 620},
      {text: "creators", startMs: 620, endMs: 980},
      {text: "make", startMs: 980, endMs: 1200},
      {text: "is", startMs: 1200, endMs: 1320},
      {text: "this", startMs: 1320, endMs: 1600}
    ],
  styleKey: partial.styleKey ?? "tall_generic_default",
  motionKey: partial.motionKey ?? "generic_single_word",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [1, 2, 6],
  profileId: partial.profileId ?? "slcp",
  semantic:
    partial.semantic ?? {
      intent: "punch-emphasis",
      nameSpans: [],
      isVariation: false,
      suppressDefault: false
    },
  suppressDefault: partial.suppressDefault ?? false
});

describe("creative orchestration engine", () => {
  it("builds a creative timeline with proposals and decisions", async () => {
    const result = await buildCreativeOrchestrationPlan({
      jobId: "job-test",
      captionChunks: [makeChunk({id: "chunk-001"}), makeChunk({id: "chunk-002", text: "We need better systems.", startMs: 1700, endMs: 2500})],
      captionProfileId: "slcp",
      renderMode: "overlay-preview",
      featureFlags: {creativeOrchestrationV1: true}
    });

    expect(result.enabled).toBe(true);
    expect(result.moments.length).toBeGreaterThan(0);
    expect(result.allProposals.length).toBeGreaterThan(0);
    expect(result.directorDecisions.length).toBe(result.moments.length);
    expect(result.finalCreativeTimeline.tracks.length).toBeGreaterThan(0);
    expect(result.criticReview.score).toBeGreaterThan(0);
  });
});

