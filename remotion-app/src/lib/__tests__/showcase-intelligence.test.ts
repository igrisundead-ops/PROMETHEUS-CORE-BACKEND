import {describe, expect, it} from "vitest";

import {buildMotionShowcaseIntelligencePlan} from "../motion-platform/showcase-intelligence";
import type {CaptionChunk, MotionAssetManifest} from "../types";

const makeChunk = (partial: Partial<CaptionChunk>): CaptionChunk => ({
  id: partial.id ?? "chunk-1",
  text: partial.text ?? "default text",
  startMs: partial.startMs ?? 0,
  endMs: partial.endMs ?? 1000,
  words: partial.words ?? [],
  styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
  motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
  layoutVariant: partial.layoutVariant ?? "inline",
  emphasisWordIndices: partial.emphasisWordIndices ?? [],
  profileId: partial.profileId ?? "longform_svg_typography_v1",
  semantic: partial.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: partial.suppressDefault ?? false
});

const makeShowcaseAsset = (partial: Partial<MotionAssetManifest>): MotionAssetManifest => ({
  id: partial.id ?? "asset-1",
  assetRole: "showcase",
  canonicalLabel: partial.canonicalLabel ?? "coin",
  showcasePlacementHint: partial.showcasePlacementHint ?? "auto",
  family: partial.family ?? "foreground-element",
  tier: partial.tier ?? "premium",
  src: partial.src ?? "showcase-assets/coin.svg",
  alphaMode: partial.alphaMode ?? "straight",
  placementZone: partial.placementZone ?? "foreground-cross",
  durationPolicy: partial.durationPolicy ?? "scene-span",
  themeTags: partial.themeTags ?? ["neutral"],
  searchTerms: partial.searchTerms ?? ["coin", "money", "profit"],
  safeArea: partial.safeArea ?? "full-frame",
  loopable: partial.loopable ?? false,
  blendMode: partial.blendMode ?? "normal",
  opacity: partial.opacity ?? 1,
  source: partial.source ?? "local",
  sourceId: partial.sourceId ?? partial.id ?? "asset-1",
  remoteUrl: partial.remoteUrl ?? partial.src ?? "showcase-assets/coin.svg",
  score: partial.score ?? 80
});

describe("showcase intelligence", () => {
  it("falls back to typography-only and queues missing marketplace coverage for semantic sidecall", () => {
    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          profileId: "longform_semantic_sidecall_v1",
          text: "I built my eBay marketplace from scratch.",
          startMs: 0,
          endMs: 2100,
          words: [
            {text: "I", startMs: 0, endMs: 120},
            {text: "built", startMs: 120, endMs: 480},
            {text: "my", startMs: 480, endMs: 640},
            {text: "eBay", startMs: 640, endMs: 1120},
            {text: "marketplace", startMs: 1120, endMs: 1640},
            {text: "from", startMs: 1640, endMs: 1840},
            {text: "scratch.", startMs: 1840, endMs: 2100}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 2.1,
        durationInFrames: 63
      },
      captionProfileId: "longform_semantic_sidecall_v1",
      catalog: []
    });

    const marketplaceIntent = plan.selectedIntents.find((intent) => intent.conceptId === "marketplace-platform");

    expect(marketplaceIntent).toBeTruthy();
    expect(marketplaceIntent?.governorDecision?.action).toBe("text-only-accent");
    expect(marketplaceIntent?.governorDecision?.cueSource).toBe("typography-only");
    expect(plan.selectedTypographyCueCount).toBeGreaterThan(0);
    expect(plan.missingAssetCategories.some((record) => record.categoryId === "marketplace-platform")).toBe(true);
  });

  it("routes growth language to the graph template for semantic sidecall", () => {
    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          profileId: "longform_semantic_sidecall_v1",
          text: "Our growth hit 300 percent year over year.",
          startMs: 0,
          endMs: 2100,
          words: [
            {text: "Our", startMs: 0, endMs: 180},
            {text: "growth", startMs: 180, endMs: 660},
            {text: "hit", startMs: 660, endMs: 860},
            {text: "300", startMs: 860, endMs: 1140},
            {text: "percent", startMs: 1140, endMs: 1420},
            {text: "year", startMs: 1420, endMs: 1660},
            {text: "over", startMs: 1660, endMs: 1840},
            {text: "year.", startMs: 1840, endMs: 2100}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 2.1,
        durationInFrames: 63
      },
      captionProfileId: "longform_semantic_sidecall_v1",
      catalog: []
    });

    const growthIntent = plan.selectedIntents.find((intent) => intent.conceptId === "growth-graph");

    expect(growthIntent).toBeTruthy();
    expect(growthIntent?.governorDecision?.action).toBe("template-graphic-cue");
    expect(growthIntent?.governorDecision?.cueSource).toBe("template-graphic");
    expect(growthIntent?.governorDecision?.templateGraphicCategory).toBe("graph-chart");
    expect(plan.selectedTemplateCueCount).toBeGreaterThan(0);
  });

  it("routes process language to the blueprint workflow template for semantic sidecall", () => {
    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          profileId: "longform_semantic_sidecall_v1",
          text: "I built a workflow system people could follow.",
          startMs: 0,
          endMs: 2000,
          words: [
            {text: "I", startMs: 0, endMs: 100},
            {text: "built", startMs: 100, endMs: 420},
            {text: "a", startMs: 420, endMs: 520},
            {text: "workflow", startMs: 520, endMs: 980},
            {text: "system", startMs: 980, endMs: 1320},
            {text: "people", startMs: 1320, endMs: 1560},
            {text: "could", startMs: 1560, endMs: 1750},
            {text: "follow.", startMs: 1750, endMs: 2000}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 2,
        durationInFrames: 60
      },
      captionProfileId: "longform_semantic_sidecall_v1",
      catalog: []
    });

    const processIntent = plan.selectedIntents.find((intent) => intent.conceptId === "process-blueprint");

    expect(processIntent).toBeTruthy();
    expect(processIntent?.governorDecision?.templateGraphicCategory).toBe("blueprint-workflow");
    expect(processIntent?.governorDecision?.cueSource).toBe("template-graphic");
  });

  it("suppresses repeated nearby sidecall cues once cooldown is active", () => {
    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          id: "cooldown-a",
          profileId: "longform_semantic_sidecall_v1",
          text: "My eBay store was taking off.",
          startMs: 0,
          endMs: 1700,
          words: [
            {text: "My", startMs: 0, endMs: 120},
            {text: "eBay", startMs: 120, endMs: 620},
            {text: "store", startMs: 620, endMs: 980},
            {text: "was", startMs: 980, endMs: 1180},
            {text: "taking", startMs: 1180, endMs: 1460},
            {text: "off.", startMs: 1460, endMs: 1700}
          ]
        }),
        makeChunk({
          id: "cooldown-b",
          profileId: "longform_semantic_sidecall_v1",
          text: "Then my Amazon marketplace followed right after.",
          startMs: 2600,
          endMs: 4700,
          words: [
            {text: "Then", startMs: 2600, endMs: 2840},
            {text: "my", startMs: 2840, endMs: 3000},
            {text: "Amazon", startMs: 3000, endMs: 3500},
            {text: "marketplace", startMs: 3500, endMs: 4040},
            {text: "followed", startMs: 4040, endMs: 4340},
            {text: "right", startMs: 4340, endMs: 4520},
            {text: "after.", startMs: 4520, endMs: 4700}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 4.7,
        durationInFrames: 141
      },
      captionProfileId: "longform_semantic_sidecall_v1",
      catalog: []
    });

    expect(plan.selectedIntents.filter((intent) => intent.conceptId === "marketplace-platform")).toHaveLength(1);
    expect(plan.suppressedIntents.some((intent) => {
      return intent.conceptId === "marketplace-platform" &&
        intent.governorDecision?.reasonCodes.includes("cooldown-active");
    })).toBe(true);
  });

  it("maps finance language to money-oriented asset choices", () => {
    const catalog = [
      makeShowcaseAsset({
        id: "coin-hand",
        canonicalLabel: "coin",
        searchTerms: ["coin", "money", "profit", "currency"]
      }),
      makeShowcaseAsset({
        id: "bill-stack",
        canonicalLabel: "bill",
        searchTerms: ["bill", "money", "cash", "purchase"]
      })
    ];

    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          text: "I've purchased more than six figures in pure profit.",
          startMs: 0,
          endMs: 2200,
          words: [
            {text: "I've", startMs: 0, endMs: 180},
            {text: "purchased", startMs: 180, endMs: 540},
            {text: "more", startMs: 540, endMs: 720},
            {text: "than", startMs: 720, endMs: 860},
            {text: "six", startMs: 860, endMs: 1020},
            {text: "figures", startMs: 1020, endMs: 1320},
            {text: "in", startMs: 1320, endMs: 1440},
            {text: "pure", startMs: 1440, endMs: 1680},
            {text: "profit.", startMs: 1680, endMs: 2200}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 2.2,
        durationInFrames: 66
      },
      catalog
    });

    const allIntents = [
      ...plan.selectedIntents,
      ...plan.flaggedIntents,
      ...plan.suppressedIntents
    ];
    const financeIntent = allIntents.find((intent) => intent.conceptId === "money-profit" || intent.conceptId === "commerce-purchase");

    expect(financeIntent).toBeTruthy();
    expect(financeIntent?.assetOptions.some((option) => option.assetId === "coin-hand" || option.assetId === "bill-stack")).toBe(true);
    expect(plan.selectedIntents.length).toBeGreaterThan(0);
  });

  it("uses context to map tracking language to note-taking assets", () => {
    const catalog = [
      makeShowcaseAsset({
        id: "notes-pad",
        canonicalLabel: "notepad",
        searchTerms: ["notepad", "pen", "track", "budget", "notes"]
      })
    ];

    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          text: "I had no system to track my expenses.",
          startMs: 0,
          endMs: 1800,
          words: [
            {text: "I", startMs: 0, endMs: 80},
            {text: "had", startMs: 80, endMs: 220},
            {text: "no", startMs: 220, endMs: 360},
            {text: "system", startMs: 360, endMs: 640},
            {text: "to", startMs: 640, endMs: 760},
            {text: "track", startMs: 760, endMs: 1040},
            {text: "my", startMs: 1040, endMs: 1180},
            {text: "expenses.", startMs: 1180, endMs: 1800}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 1.8,
        durationInFrames: 54
      },
      catalog
    });

    const trackingIntent = [...plan.selectedIntents, ...plan.flaggedIntents, ...plan.suppressedIntents]
      .find((intent) => intent.conceptId === "planning-track-expenses");

    expect(trackingIntent).toBeTruthy();
    expect(trackingIntent?.matchedText.toLowerCase()).toContain("track");
    expect(trackingIntent?.matchedAsset?.id).toBe("notes-pad");
  });

  it("holds abstract decision cues back on minimalist tiers", () => {
    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          text: "The choice was mine.",
          startMs: 0,
          endMs: 1200,
          words: [
            {text: "The", startMs: 0, endMs: 150},
            {text: "choice", startMs: 150, endMs: 560},
            {text: "was", startMs: 560, endMs: 760},
            {text: "mine.", startMs: 760, endMs: 1200}
          ]
        })
      ],
      tier: "minimal",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 1.2,
        durationInFrames: 36
      },
      catalog: []
    });

    expect(plan.selectedIntents.some((intent) => intent.conceptId === "decision-thinking")).toBe(false);
    expect(plan.flaggedIntents.some((intent) => intent.conceptId === "decision-thinking")).toBe(true);
    expect(plan.flaggedIntents.find((intent) => intent.conceptId === "decision-thinking")?.unresolvedReason).toContain("concrete visuals");
  });

  it("does not map marketplace language to an unrelated phone asset", () => {
    const catalog = [
      makeShowcaseAsset({
        id: "phone-rotary",
        canonicalLabel: "phone",
        searchTerms: ["phone", "telephone", "communication"]
      })
    ];

    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          text: "I grew my eBay to Amazon business.",
          startMs: 0,
          endMs: 1800,
          words: [
            {text: "I", startMs: 0, endMs: 100},
            {text: "grew", startMs: 100, endMs: 340},
            {text: "my", startMs: 340, endMs: 480},
            {text: "eBay", startMs: 480, endMs: 860},
            {text: "to", startMs: 860, endMs: 980},
            {text: "Amazon", startMs: 980, endMs: 1400},
            {text: "business.", startMs: 1400, endMs: 1800}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 1.8,
        durationInFrames: 54
      },
      catalog
    });

    expect(plan.selectedIntents.some((intent) => intent.conceptId === "marketplace-platform")).toBe(false);
    expect(plan.flaggedIntents.some((intent) => intent.conceptId === "marketplace-platform")).toBe(true);
  });

  it("does not reuse the exact same asset twice when only one variant exists", () => {
    const catalog = [
      makeShowcaseAsset({
        id: "money-roll",
        canonicalLabel: "money",
        searchTerms: ["money", "purchase", "profit", "cash"]
      })
    ];

    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          id: "chunk-1",
          text: "I purchased products yesterday.",
          startMs: 0,
          endMs: 1600,
          words: [
            {text: "I", startMs: 0, endMs: 80},
            {text: "purchased", startMs: 80, endMs: 540},
            {text: "products", startMs: 540, endMs: 1020},
            {text: "yesterday.", startMs: 1020, endMs: 1600}
          ]
        }),
        makeChunk({
          id: "chunk-2",
          text: "That turned into profit fast.",
          startMs: 8200,
          endMs: 10000,
          words: [
            {text: "That", startMs: 8200, endMs: 8440},
            {text: "turned", startMs: 8440, endMs: 8720},
            {text: "into", startMs: 8720, endMs: 8940},
            {text: "profit", startMs: 8940, endMs: 9460},
            {text: "fast.", startMs: 9460, endMs: 10000}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 10,
        durationInFrames: 300
      },
      catalog
    });

    expect(plan.selectedIntents.filter((intent) => intent.matchedAsset?.id === "money-roll")).toHaveLength(1);
    expect(
      [...plan.flaggedIntents, ...plan.suppressedIntents].some((intent) => {
        return (
          intent.conceptId === "money-profit" &&
          (intent.unresolvedReason ?? "").includes("already used earlier")
        );
      })
    ).toBe(true);
  });

  it("prefers sunshine without creating a rainbow cue", () => {
    const plan = buildMotionShowcaseIntelligencePlan({
      chunks: [
        makeChunk({
          text: "It wasn't all sunshine and rainbows.",
          startMs: 0,
          endMs: 1600,
          words: [
            {text: "It", startMs: 0, endMs: 120},
            {text: "wasn't", startMs: 120, endMs: 340},
            {text: "all", startMs: 340, endMs: 500},
            {text: "sunshine", startMs: 500, endMs: 1020},
            {text: "and", startMs: 1020, endMs: 1160},
            {text: "rainbows.", startMs: 1160, endMs: 1600}
          ]
        })
      ],
      tier: "premium",
      videoMetadata: {
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 1.6,
        durationInFrames: 48
      },
      catalog: []
    });

    const allConcepts = [...plan.selectedIntents, ...plan.flaggedIntents, ...plan.suppressedIntents].map((intent) => intent.conceptId);

    expect(allConcepts).toContain("ambience-sunshine");
    expect(allConcepts.some((id) => id.includes("rainbow"))).toBe(false);
  });
});
