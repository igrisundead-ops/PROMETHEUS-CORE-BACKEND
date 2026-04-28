import {describe, expect, it} from "vitest";

import {
  buildMotionBackgroundOverlayPlan
} from "../motion-platform/background-overlay-planner";
import type {CaptionChunk, MotionBackgroundOverlayAsset} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "Reset the story.",
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

const overlayCatalog: MotionBackgroundOverlayAsset[] = [
  {
    id: "portrait-overlay",
    label: "Portrait Overlay",
    src: "background-overlays/test/portrait.mp4",
    originalFileName: "portrait.mp4",
    width: 720,
    height: 1280,
    fps: 30,
    durationSeconds: 24,
    themeTags: ["cool", "calm"]
  },
  {
    id: "long-overlay",
    label: "Long Overlay",
    src: "background-overlays/test/long.mp4",
    originalFileName: "long.mp4",
    width: 720,
    height: 1280,
    fps: 30,
    durationSeconds: 60,
    themeTags: ["warm", "authority"]
  },
  {
    id: "small-portrait-overlay",
    label: "Small Portrait Overlay",
    src: "background-overlays/test/small-portrait.mp4",
    originalFileName: "small-portrait.mp4",
    width: 486,
    height: 864,
    fps: 30,
    durationSeconds: 24,
    themeTags: ["warm", "calm"]
  }
];

describe("background overlay planner", () => {
  it("supports vertical-cover planning for portrait compositions", () => {
    const plan = buildMotionBackgroundOverlayPlan({
      chunks: [
        makeChunk({id: "a", startMs: 0, endMs: 1000}),
        makeChunk({id: "b", startMs: 1600, endMs: 2600})
      ],
      tier: "premium",
      videoMetadata: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 10,
        durationInFrames: 300
      },
      catalog: overlayCatalog
    });

    expect(plan.enabled).toBe(true);
    expect(plan.layoutMode).toBe("vertical-cover");
    expect(plan.cues.length).toBeGreaterThan(0);
  });

  it("rotates portrait overlays when that improves landscape cover", () => {
    const plan = buildMotionBackgroundOverlayPlan({
      chunks: [
        makeChunk({id: "a", text: "Set the frame.", startMs: 0, endMs: 1200}),
        makeChunk({
          id: "b",
          text: "Move with authority.",
          startMs: 2200,
          endMs: 3600,
          semantic: {
            intent: "punch-emphasis",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 12,
        durationInFrames: 360
      },
      catalog: overlayCatalog
    });

    expect(plan.enabled).toBe(true);
    expect(plan.cues.length).toBeGreaterThan(0);
    expect(plan.cues[0].fitStrategy.rotateDeg).toBe(90);
    expect(plan.cues[0].fitStrategy.rationale).toMatch(/Rotated 90deg/);
    expect(plan.cues[0].endMs - plan.cues[0].startMs).toBeGreaterThanOrEqual(4000);
    expect(plan.cues[0].trimAfterFrames).toBeGreaterThan(plan.cues[0].trimBeforeFrames);
  });

  it("prefers the highest fidelity asset when a smaller portrait asset would upscale harder", () => {
    const plan = buildMotionBackgroundOverlayPlan({
      chunks: [
        makeChunk({id: "a", text: "Set the frame.", startMs: 0, endMs: 1200}),
        makeChunk({
          id: "b",
          text: "Move with authority.",
          startMs: 2200,
          endMs: 3600,
          semantic: {
            intent: "punch-emphasis",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 12,
        durationInFrames: 360
      },
      catalog: overlayCatalog
    });

    expect(plan.enabled).toBe(true);
    expect(plan.cues.length).toBeGreaterThan(0);
    expect(plan.cues[0].assetId).not.toBe("small-portrait-overlay");
    expect(plan.cues[0].fitStrategy.baseScale).toBeLessThanOrEqual(1.05);
  });

  it("biases the stock catalog toward mood-matching background tones", () => {
    const plan = buildMotionBackgroundOverlayPlan({
      chunks: [
        makeChunk({
          id: "a",
          text: "The point is,",
          startMs: 0,
          endMs: 960,
          words: [
            {text: "The", startMs: 0, endMs: 160},
            {text: "point", startMs: 160, endMs: 420},
            {text: "is,", startMs: 420, endMs: 960}
          ]
        }),
        makeChunk({
          id: "b",
          text: "choice was mine.",
          startMs: 960,
          endMs: 1880,
          words: [
            {text: "choice", startMs: 960, endMs: 1240},
            {text: "was", startMs: 1240, endMs: 1460},
            {text: "mine.", startMs: 1460, endMs: 1880}
          ],
          emphasisWordIndices: [1, 2],
          semantic: {
            intent: "name-callout",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 8,
        durationInFrames: 240
      },
      catalog: overlayCatalog
    });

    expect(plan.enabled).toBe(true);
    expect(plan.cues.length).toBeGreaterThan(0);
    expect(plan.cues[0].assetId).toBe("long-overlay");
    expect(Math.abs(plan.cues[0].fitStrategy.focusOffsetX)).toBeLessThanOrEqual(0.08);
    expect(Math.abs(plan.cues[0].fitStrategy.focusOffsetY)).toBeLessThanOrEqual(0.08);
    expect(plan.cues[0].reasoning).toContain("Theme-aware selection");
  });

  it("avoids unsafe phrase continuations and prefers clean spoken resets", () => {
    const plan = buildMotionBackgroundOverlayPlan({
      chunks: [
        makeChunk({
          id: "a",
          text: "The Milky",
          startMs: 0,
          endMs: 900,
          words: [{text: "The", startMs: 0, endMs: 300}, {text: "Milky", startMs: 301, endMs: 900}]
        }),
        makeChunk({
          id: "b",
          text: "way is ours",
          startMs: 980,
          endMs: 1900,
          words: [{text: "way", startMs: 980, endMs: 1260}, {text: "is", startMs: 1261, endMs: 1500}, {text: "ours", startMs: 1501, endMs: 1900}]
        }),
        makeChunk({
          id: "c",
          text: "Reset the room.",
          startMs: 4200,
          endMs: 5400
        }),
        makeChunk({
          id: "d",
          text: "Now build the next scene.",
          startMs: 6200,
          endMs: 7800,
          semantic: {
            intent: "name-callout",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        })
      ],
      tier: "editorial",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 16,
        durationInFrames: 480
      },
      catalog: overlayCatalog
    });

    expect(plan.cues.length).toBeGreaterThan(0);
    expect(plan.cues.some((cue) => cue.sourceChunkId === "b")).toBe(false);
    expect(plan.cues.some((cue) => cue.sourceChunkId === "d")).toBe(true);
    expect(plan.cues.every((cue) => cue.trimAfterFrames > cue.trimBeforeFrames)).toBe(true);
  });

  it("allows emphasized ownership phrases to trigger a talking-head overlay without waiting for a big silence gap", () => {
    const plan = buildMotionBackgroundOverlayPlan({
      chunks: [
        makeChunk({
          id: "a",
          text: "The point is,",
          startMs: 0,
          endMs: 960,
          words: [
            {text: "The", startMs: 0, endMs: 160},
            {text: "point", startMs: 160, endMs: 420},
            {text: "is,", startMs: 420, endMs: 960}
          ]
        }),
        makeChunk({
          id: "b",
          text: "choice was mine.",
          startMs: 960,
          endMs: 1880,
          words: [
            {text: "choice", startMs: 960, endMs: 1240},
            {text: "was", startMs: 1240, endMs: 1460},
            {text: "mine.", startMs: 1460, endMs: 1880}
          ],
          emphasisWordIndices: [1, 2]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 8,
        durationInFrames: 240
      },
      catalog: overlayCatalog
    });

    expect(plan.enabled).toBe(true);
    expect(plan.cues.length).toBeGreaterThan(0);
    expect(plan.cues[0]?.sourceChunkId).toBe("b");
    expect(plan.cues[0]?.reasoning).toContain("phrase-anchor overlay");
  });

  it("varies the framing seed when the same overlay asset has to recur", () => {
    const plan = buildMotionBackgroundOverlayPlan({
      chunks: [
        makeChunk({
          id: "a",
          text: "This was the old way.",
          startMs: 0,
          endMs: 1200
        }),
        makeChunk({
          id: "b",
          text: "Now the decision is yours.",
          startMs: 2200,
          endMs: 3600,
          emphasisWordIndices: [3, 4],
          semantic: {
            intent: "name-callout",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        }),
        makeChunk({
          id: "c",
          text: "Reset the room.",
          startMs: 13800,
          endMs: 15000
        }),
        makeChunk({
          id: "d",
          text: "Take control of the next beat.",
          startMs: 16800,
          endMs: 18400,
          emphasisWordIndices: [0, 3],
          semantic: {
            intent: "punch-emphasis",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        }),
        makeChunk({
          id: "e",
          text: "Then breathe.",
          startMs: 26800,
          endMs: 28000
        }),
        makeChunk({
          id: "f",
          text: "Make the final choice.",
          startMs: 29800,
          endMs: 31300,
          emphasisWordIndices: [2],
          semantic: {
            intent: "name-callout",
            nameSpans: [],
            isVariation: false,
            suppressDefault: false
          }
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 36,
        durationInFrames: 1080
      },
      catalog: [overlayCatalog[1]!]
    });

    expect(plan.cues.length).toBeGreaterThan(1);

    const compositionKeys = new Set(
      plan.cues.map((cue) => `${cue.fitStrategy.focusOffsetX}:${cue.fitStrategy.focusOffsetY}:${cue.fitStrategy.rotateDeg}`)
    );
    expect(compositionKeys.size).toBeGreaterThan(1);
  });
});
