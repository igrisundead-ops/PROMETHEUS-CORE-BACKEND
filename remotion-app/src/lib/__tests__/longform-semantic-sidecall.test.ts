import {describe, expect, it} from "vitest";

import {
  buildLongformSemanticSidecallPresentation,
  getLongformSemanticSidecallKeywords
} from "../longform-semantic-sidecall";
import type {CaptionChunk} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1000,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "style",
  motionKey: partial.motionKey ?? "motion",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  semantic:
    partial.semantic ?? {
      intent: "default",
      nameSpans: [],
      isVariation: false,
      suppressDefault: false
    }
});

describe("longform semantic sidecall presentation", () => {
  it("builds a named-person entity card when a name callout is present", () => {
    const chunk = makeChunk({
      text: "Gary Vee is the reference everyone is talking about.",
      words: [
        {text: "Gary", startMs: 0, endMs: 240},
        {text: "Vee", startMs: 260, endMs: 520},
        {text: "is", startMs: 560, endMs: 700},
        {text: "the", startMs: 720, endMs: 800},
        {text: "reference", startMs: 820, endMs: 1260},
        {text: "everyone", startMs: 1280, endMs: 1640},
        {text: "is", startMs: 1660, endMs: 1760},
        {text: "talking", startMs: 1780, endMs: 2140},
        {text: "about.", startMs: 2160, endMs: 2480}
      ],
      semantic: {
        intent: "name-callout",
        nameSpans: [{startWord: 0, endWord: 1, text: "Gary Vee"}],
        isVariation: true,
        suppressDefault: true
      }
    });

    const presentation = buildLongformSemanticSidecallPresentation({chunk});

    expect(presentation.variant).toBe("entity-card");
    expect(presentation.leadLabel).toBe("Gary Vee");
    expect(getLongformSemanticSidecallKeywords({chunk})[0]).toBe("Gary Vee");
  });

  it("attaches graphic assets for thought and capsule cues", () => {
    const thinkingChunk = makeChunk({
      text: "I need to think about the choice.",
      words: [
        {text: "I", startMs: 0, endMs: 90},
        {text: "need", startMs: 100, endMs: 240},
        {text: "to", startMs: 250, endMs: 300},
        {text: "think", startMs: 310, endMs: 520},
        {text: "about", startMs: 530, endMs: 700},
        {text: "the", startMs: 710, endMs: 770},
        {text: "choice.", startMs: 780, endMs: 980}
      ]
    });

    const capsuleChunk = makeChunk({
      text: "Give it a name, give it a label.",
      words: [
        {text: "Give", startMs: 0, endMs: 120},
        {text: "it", startMs: 130, endMs: 200},
        {text: "a", startMs: 210, endMs: 240},
        {text: "name,", startMs: 250, endMs: 400},
        {text: "give", startMs: 410, endMs: 520},
        {text: "it", startMs: 530, endMs: 590},
        {text: "a", startMs: 600, endMs: 630},
        {text: "label.", startMs: 640, endMs: 820}
      ]
    });

    expect(buildLongformSemanticSidecallPresentation({chunk: thinkingChunk}).graphicAsset?.assetId).toBe(
      "thinking-concrete-choice"
    );
    expect(buildLongformSemanticSidecallPresentation({chunk: capsuleChunk}).graphicAsset?.assetId).toBe(
      "send-messagea"
    );
  });

  it("builds a step sequence layout when the transcript mentions ordered steps", () => {
    const chunk = makeChunk({
      text: "Three steps: plan, build, ship.",
      words: [
        {text: "Three", startMs: 0, endMs: 180},
        {text: "steps:", startMs: 200, endMs: 360},
        {text: "plan,", startMs: 380, endMs: 520},
        {text: "build,", startMs: 540, endMs: 700},
        {text: "ship.", startMs: 720, endMs: 920}
      ]
    });

    const presentation = buildLongformSemanticSidecallPresentation({chunk});

    expect(presentation.variant).toBe("step-row");
    expect(presentation.stepItems).toHaveLength(3);
    expect(presentation.stepItems[0].label).toBe("Step 1");
    expect(presentation.stepItems[0].detail).toContain("Plan");
  });

  it("falls back to a compact keyword card for general emphasis cues", () => {
    const chunk = makeChunk({
      text: "This changes retention.",
      words: [
        {text: "This", startMs: 0, endMs: 150},
        {text: "changes", startMs: 170, endMs: 440},
        {text: "retention.", startMs: 460, endMs: 820}
      ],
      semantic: {
        intent: "punch-emphasis",
        nameSpans: [],
        isVariation: false,
        suppressDefault: false
      }
    });

    const presentation = buildLongformSemanticSidecallPresentation({chunk});

    expect(presentation.variant).toBe("keyword-card");
    expect(presentation.keywords.length).toBeGreaterThan(0);
  });
});
