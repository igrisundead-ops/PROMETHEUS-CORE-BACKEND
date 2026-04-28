import {describe, expect, it} from "vitest";

import {buildNolanClipPlan} from "../nolan-clip-engine";
import type {CaptionChunk} from "../types";

const buildChunk = ({
  id,
  text,
  startMs,
  endMs
}: {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}): CaptionChunk => ({
  id,
  text,
  startMs,
  endMs,
  words: [],
  styleKey: "test-style",
  motionKey: "test-motion",
  layoutVariant: "inline",
  emphasisWordIndices: []
});

const sampleChunks: CaptionChunk[] = [
  buildChunk({id: "c1", text: "Here's how I doubled revenue in 30 days.", startMs: 0, endMs: 5000}),
  buildChunk({id: "c2", text: "Most people add more footage, but trimming the warmup is the real leverage.", startMs: 5000, endMs: 10000}),
  buildChunk({id: "c3", text: "I removed every slow intro and retention jumped 42 percent.", startMs: 10000, endMs: 15000}),
  buildChunk({id: "c4", text: "That one decision made the final edit feel faster and more credible.", startMs: 15000, endMs: 20000}),
  buildChunk({id: "c5", text: "Then I wrapped the ending around one clear takeaway for the viewer.", startMs: 20000, endMs: 25000}),
  buildChunk({id: "c6", text: "If you want viral clips, cut exactly where the idea lands.", startMs: 25000, endMs: 30000}),
  buildChunk({id: "c7", text: "Stop after the payoff and let curiosity pull the audience forward.", startMs: 30000, endMs: 35000}),
  buildChunk({id: "c8", text: "This process works for client edits, coaching videos, and product explainers.", startMs: 35000, endMs: 40000}),
  buildChunk({id: "c9", text: "Use numbers, contrast, and one sharp lesson instead of a long recap.", startMs: 40000, endMs: 45000}),
  buildChunk({id: "c10", text: "That is how a long-form take turns into a short with momentum.", startMs: 45000, endMs: 50000}),
  buildChunk({id: "c11", text: "Once the point lands, move on before the energy drops.", startMs: 50000, endMs: 55000}),
  buildChunk({id: "c12", text: "The best clips feel finished, not abruptly cut off.", startMs: 55000, endMs: 60000})
];

const overlapRatio = (left: {startMs: number; endMs: number}, right: {startMs: number; endMs: number}): number => {
  const overlapStart = Math.max(left.startMs, right.startMs);
  const overlapEnd = Math.min(left.endMs, right.endMs);
  const intersection = Math.max(0, overlapEnd - overlapStart);
  if (intersection <= 0) {
    return 0;
  }

  return intersection / Math.min(left.endMs - left.startMs, right.endMs - right.startMs);
};

describe("nolan clip engine", () => {
  it("returns only clip candidates within the requested duration window", () => {
    const plan = buildNolanClipPlan({
      chunks: sampleChunks,
      settings: {
        minClipSeconds: 10,
        maxClipSeconds: 25,
        targetClipSeconds: 17,
        maxCandidates: 12,
        pageSize: 10
      }
    });

    expect(plan.candidates.length).toBeGreaterThan(0);
    plan.candidates.forEach((candidate) => {
      expect(candidate.durationMs).toBeGreaterThanOrEqual(10000);
      expect(candidate.durationMs).toBeLessThanOrEqual(25000);
    });
  });

  it("boosts candidates that align with the reference script", () => {
    const plan = buildNolanClipPlan({
      chunks: sampleChunks,
      referenceScriptText: "Retention jump: retention jumped 42 percent by removing the slow intro",
      referenceScriptPath: "src/data/nolan.reference-script.txt",
      settings: {
        maxCandidates: 8,
        pageSize: 8
      }
    });

    expect(plan.referenceScript.provided).toBe(true);
    expect(plan.candidates[0]?.referenceMatches[0]?.label).toBe("Retention jump");
    expect(plan.candidates[0]?.scoreBreakdown.referenceAlignment).toBeGreaterThan(20);
  });

  it("paginates ranked results and marks the top three as recommended", () => {
    const plan = buildNolanClipPlan({
      chunks: sampleChunks,
      settings: {
        minClipSeconds: 10,
        maxClipSeconds: 25,
        targetClipSeconds: 17,
        maxCandidates: 12,
        pageSize: 5,
        duplicateOverlapRatio: 0.98,
        duplicateStartSeparationMs: 1
      }
    });

    expect(plan.candidates.length).toBeGreaterThan(5);
    expect(plan.pages[0]?.itemCount).toBe(5);
    expect(plan.pages.reduce((total, page) => total + page.itemCount, 0)).toBe(plan.candidates.length);
    expect(plan.candidates.filter((candidate) => candidate.recommended).map((candidate) => candidate.rank)).toEqual([1, 2, 3]);
  });

  it("suppresses near-duplicate overlapping windows", () => {
    const plan = buildNolanClipPlan({
      chunks: sampleChunks,
      settings: {
        maxCandidates: 10,
        duplicateOverlapRatio: 0.82,
        duplicateStartSeparationMs: 3500
      }
    });

    for (let index = 0; index < plan.candidates.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < plan.candidates.length; compareIndex += 1) {
        expect(overlapRatio(plan.candidates[index], plan.candidates[compareIndex])).toBeLessThan(0.82);
      }
    }
  });

  it("keeps default settings when partial overrides contain undefined values", () => {
    const plan = buildNolanClipPlan({
      chunks: sampleChunks,
      settings: {
        pageSize: undefined,
        maxCandidates: undefined
      }
    });

    expect(plan.settings.pageSize).toBe(10);
    expect(plan.settings.maxCandidates).toBe(30);
    expect(plan.pages.length).toBeGreaterThan(0);
  });

  it("never emits nullish scores when a chunk has no meaningful content tokens", () => {
    const sparseChunks: CaptionChunk[] = [
      buildChunk({id: "s1", text: "And then it is what it is.", startMs: 0, endMs: 6000}),
      buildChunk({id: "s2", text: "But you do get the point now.", startMs: 6000, endMs: 12000}),
      buildChunk({id: "s3", text: "Here is the real lesson with one clear outcome.", startMs: 12000, endMs: 18000})
    ];
    const plan = buildNolanClipPlan({
      chunks: sparseChunks,
      settings: {
        minClipSeconds: 10,
        maxClipSeconds: 25,
        maxCandidates: 5
      }
    });

    expect(plan.candidates.length).toBeGreaterThan(0);
    plan.candidates.forEach((candidate) => {
      expect(Number.isFinite(candidate.score)).toBe(true);
      expect(Number.isFinite(candidate.scoreBreakdown.emotionalIntensity)).toBe(true);
    });
  });
});
