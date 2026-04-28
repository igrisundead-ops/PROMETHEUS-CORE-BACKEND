import {describe, expect, it} from "vitest";

import {buildSemanticCameraTriggerCandidates, selectSemanticCameraCueMap} from "../motion-platform/semantic-camera-trigger-engine";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "This video is",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 900,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset_2",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset_2",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  profileId: partial.profileId ?? "svg_typography_v1",
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

describe("semantic camera trigger engine", () => {
  it("prioritizes rhetorical statement windows over isolated emphasis chunks", () => {
    const chunks = [
      makeChunk({id: "chunk-0010", text: "listen attentively.", startMs: 9680, endMs: 10600, semantic: {intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false}}),
      makeChunk({id: "chunk-0011", text: "This video is", startMs: 10600, endMs: 11360}),
      makeChunk({id: "chunk-0012", text: "for you.", startMs: 11360, endMs: 11920, semantic: {intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false}}),
      makeChunk({id: "chunk-0038", text: "Those videos are", startMs: 38250, endMs: 39570}),
      makeChunk({id: "chunk-0039", text: "called Talking Head", startMs: 39570, endMs: 40890, semantic: {intent: "name-callout", nameSpans: [{startWord: 1, endWord: 2, text: "Talking Head"}], isVariation: true, suppressDefault: true}}),
      makeChunk({id: "chunk-0040", text: "videos and it's", startMs: 40890, endMs: 42050})
    ];

    const cues = selectSemanticCameraCueMap(chunks);

    expect(cues.has("chunk-0012")).toBe(true);
    expect(cues.has("chunk-0039")).toBe(true);
    expect(cues.has("chunk-0010")).toBe(false);
    expect(cues.get("chunk-0012")?.triggerText).toContain("for you");
    expect(cues.get("chunk-0039")?.triggerPatternIds).toContain("definition-called");
    expect(cues.get("chunk-0012")?.timingFamily).not.toBe(cues.get("chunk-0039")?.timingFamily);
  });

  it("enforces a maximum of two camera cues per minute segment", () => {
    const chunks = [
      makeChunk({id: "chunk-a", text: "This video is", startMs: 0, endMs: 700}),
      makeChunk({id: "chunk-b", text: "for you.", startMs: 700, endMs: 1400, semantic: {intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false}}),
      makeChunk({id: "chunk-c", text: "Those videos are", startMs: 18000, endMs: 18800}),
      makeChunk({id: "chunk-d", text: "called premium", startMs: 18800, endMs: 19700}),
      makeChunk({id: "chunk-e", text: "his name is", startMs: 36000, endMs: 36800}),
      makeChunk({id: "chunk-f", text: "Alex Hormozi", startMs: 36800, endMs: 37700, semantic: {intent: "name-callout", nameSpans: [{startWord: 0, endWord: 1, text: "Alex Hormozi"}], isVariation: true, suppressDefault: true}})
    ];

    const candidates = buildSemanticCameraTriggerCandidates(chunks);
    const selected = selectSemanticCameraCueMap(chunks);

    expect(candidates.length).toBeGreaterThan(2);
    expect(selected.size).toBe(2);
  });

  it("builds deterministic but non-uniform timing envelopes for the same semantic input", () => {
    const chunks = [
      makeChunk({id: "chunk-0011", text: "This video is", startMs: 10600, endMs: 11360}),
      makeChunk({id: "chunk-0012", text: "for you.", startMs: 11360, endMs: 11920, semantic: {intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false}}),
      makeChunk({id: "chunk-0038", text: "Those videos are", startMs: 38250, endMs: 39570}),
      makeChunk({id: "chunk-0039", text: "called Talking Head", startMs: 39570, endMs: 40890, semantic: {intent: "name-callout", nameSpans: [{startWord: 1, endWord: 2, text: "Talking Head"}], isVariation: true, suppressDefault: true}})
    ];

    const firstPass = selectSemanticCameraCueMap(chunks);
    const secondPass = selectSemanticCameraCueMap(chunks);
    const forYouA = firstPass.get("chunk-0012");
    const forYouB = secondPass.get("chunk-0012");
    const calledA = firstPass.get("chunk-0039");

    expect(forYouA).toBeTruthy();
    expect(forYouB).toEqual(forYouA);
    expect(calledA).toBeTruthy();
    expect(forYouA?.timingFamily).not.toBe(calledA?.timingFamily);
    expect(forYouA?.zoomInMs).toBeGreaterThan(0);
    expect(forYouA?.holdMs).toBeGreaterThan(0);
    expect(forYouA?.zoomOutMs).toBeGreaterThan(0);
    expect(forYouA?.zoomInMs).not.toBe(calledA?.zoomInMs);
  });

  it("scales the total camera budget with longer podcast durations while keeping the per-minute cap", () => {
    const chunks = Array.from({length: 12}, (_, index) => {
      const minute = Math.floor(index / 2);
      const offset = minute * 60000 + (index % 2 === 0 ? 1200 : 24000);
      return makeChunk({
        id: `chunk-${index}`,
        text: index % 2 === 0 ? "This video is" : "for you.",
        startMs: offset,
        endMs: offset + 820,
        semantic: index % 2 === 0
          ? {intent: "default", nameSpans: [], isVariation: false, suppressDefault: false}
          : {intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false}
      });
    });

    const selected = selectSemanticCameraCueMap(chunks);

    expect(selected.size).toBeGreaterThanOrEqual(4);
    expect(selected.size).toBeLessThanOrEqual(6);
  });
});
