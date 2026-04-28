import {describe, expect, it} from "vitest";

import {
  getSchemaAssetScoreBoost,
  resolveSchemaMappings,
  resolveSchemaStageEffectRoute
} from "../motion-platform/schema-mapping-resolver";

describe("schema mapping resolver", () => {
  it("finds the growth chart mapping for result-driven queries", () => {
    const matches = resolveSchemaMappings({
      text: "revenue growth results performance graph"
    });

    expect(matches[0]?.id).toBe("growth_animation");
  });

  it("routes focus-heavy headline language to a focus-friendly treatment", () => {
    const route = resolveSchemaStageEffectRoute({
      text: "Focus on the key decision",
      sceneKind: "feature-highlight"
    });

    expect(["focus-frame", "split-stagger"]).toContain(route.animationPreset);
    expect(route.confidence).toBeGreaterThan(0.5);
  });

  it("adds a schema boost when an asset already aligns with mapped semantics", () => {
    const boost = getSchemaAssetScoreBoost({
      asset: {
        id: "growth-card",
        canonicalLabel: "growth",
        searchTerms: ["growth", "revenue", "results", "graph"],
        semanticTags: ["growth", "metric"],
        functionalTags: ["chart"],
        subjectTags: ["analytics"],
        sourceHtml: "GROWTH animation.html",
        sourceFile: "GROWTH animation.html",
        templateGraphicCategory: "graph-chart"
      },
      text: "revenue growth results performance graph"
    });

    expect(boost).toBeGreaterThan(0);
  });
});
