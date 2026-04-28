import {describe, expect, it} from "vitest";

import {
  buildTransitionBrainPlan,
  getTransitionBrainProfiles,
  type TransitionBrainProfileId
} from "../motion-platform/transition-brain";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Allow people.",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 900,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
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

describe("transition brain", () => {
  it("defines the requested transition bones and keeps them dormant", () => {
    const profileIds = getTransitionBrainProfiles().map((profile) => profile.id);
    const expected: TransitionBrainProfileId[] = [
      "light-glitch",
      "digital-glitch",
      "film-burn",
      "light-leak",
      "seamless-zoom",
      "point-mask",
      "texture-reveal",
      "relief-wipe",
      "directional-wipe",
      "l-cut",
      "j-cut"
    ];

    expect(profileIds).toEqual(expected);
    getTransitionBrainProfiles().forEach((profile) => {
      expect(profile.activationStatus).toBe("dormant");
      expect(profile.overlayFirst).toBe(true);
    });
  });

  it("downgrades fragile phrase handoffs to audio bridges instead of flashy cuts", () => {
    const plan = buildTransitionBrainPlan({
      tier: "premium",
      chunks: [
        makeChunk({
          id: "chunk-a",
          text: "The Milky",
          startMs: 0,
          endMs: 1000,
          words: [{text: "The", startMs: 0, endMs: 400}, {text: "Milky", startMs: 401, endMs: 1000}]
        }),
        makeChunk({
          id: "chunk-b",
          text: "way is ours",
          startMs: 1080,
          endMs: 1800,
          words: [{text: "way", startMs: 1080, endMs: 1320}, {text: "is", startMs: 1321, endMs: 1500}, {text: "ours", startMs: 1501, endMs: 1800}]
        })
      ]
    });

    expect(plan.decisions).toHaveLength(1);
    expect(plan.decisions[0].majorVisual).toBe(false);
    expect(["l-cut", "j-cut"]).toContain(plan.decisions[0].profileId);
  });

  it("keeps punchy visual transitions available on safe emphasized boundaries", () => {
    const plan = buildTransitionBrainPlan({
      tier: "premium",
      chunks: [
        makeChunk({
          id: "chunk-a",
          text: "Listen up.",
          startMs: 0,
          endMs: 950,
          words: [{text: "Listen", startMs: 0, endMs: 420}, {text: "up.", startMs: 421, endMs: 950}]
        }),
        makeChunk({
          id: "chunk-b",
          text: "Right now!",
          startMs: 1650,
          endMs: 2400,
          words: [{text: "Right", startMs: 1650, endMs: 1980}, {text: "now!", startMs: 1981, endMs: 2400}],
          semantic: {
            intent: "punch-emphasis",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        })
      ]
    });

    expect(plan.decisions).toHaveLength(1);
    expect(plan.decisions[0].majorVisual).toBe(true);
    expect([
      "light-glitch",
      "digital-glitch",
      "seamless-zoom",
      "point-mask",
      "directional-wipe"
    ]).toContain(plan.decisions[0].profileId);
  });

  it("throttles major visual density so the future system does not over-transition", () => {
    const chunks: CaptionChunk[] = [];
    for (let index = 0; index < 8; index += 1) {
      const startMs = index * 8000;
      chunks.push(
        makeChunk({
          id: `chunk-${index}`,
          text: index % 2 === 0 ? "Reset." : "Go now!",
          startMs,
          endMs: startMs + 2200,
          words: [{text: "Reset", startMs, endMs: startMs + 900}, {text: "now", startMs: startMs + 901, endMs: startMs + 2200}],
          semantic: {
            intent: index % 2 === 0 ? "default" : "punch-emphasis",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        })
      );
    }

    const plan = buildTransitionBrainPlan({
      chunks,
      tier: "minimal"
    });

    expect(plan.majorVisualCount).toBeLessThanOrEqual(plan.majorVisualBudget);
    expect(plan.decisions.some((decision) => decision.downgradedFromProfileId)).toBe(true);
  });
});
