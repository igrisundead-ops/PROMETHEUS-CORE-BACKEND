import {describe, expect, it} from "vitest";

import {
  animationRegistry,
  animationRegistryIssues,
  getAnimationNeighbors,
  getAnimationNode,
  resolveAnimationChain,
  resolveAnimationLayerStack
} from "../motion-platform/animation-registry";
import {svgTypographyVariantsV1} from "../stylebooks/svg-typography-v1";

describe("animation registry", () => {
  it("indexes primitives, svg variants, assets, and prototypes into one graph", () => {
    expect(animationRegistryIssues.some((issue) => issue.severity === "error")).toBe(false);
    expect(getAnimationNode("core-replaceable-word")?.id).toBe("composite:core-replaceable-word");
    expect(getAnimationNode("target-focus-zoom")?.id).toBe("focus-effect:target-focus-zoom");
    expect(getAnimationNode("target-focus-runtime")?.id).toBe("host:target-focus-runtime");
    expect(getAnimationNode("highlight-word")?.id).toBe("primitive:highlight-word");
    expect(getAnimationNode(svgTypographyVariantsV1[0].id)?.id).toBe(`svg:${svgTypographyVariantsV1[0].id}`);
    expect(getAnimationNode("premium-lens-beam")?.id).toBe("asset:premium-lens-beam");
    expect(getAnimationNode("graph-widget")?.id).toBe("prototype:graph-widget");
    expect(getAnimationNode("template-family:graph-chart")?.id).toBe("template-family:graph-chart");
  });

  it("resolves the CORE replaceable word pathway across highlight, circle, and underline", () => {
    const chain = resolveAnimationChain("core-replaceable-word");
    const neighborIds = getAnimationNeighbors("core-replaceable-word").map((node) => node.id);

    expect(chain.map((node) => node.id)).toEqual(expect.arrayContaining([
      "composite:core-replaceable-word",
      "primitive:highlight-word",
      "primitive:circle-reveal",
      "primitive:blur-underline",
      "primitive:typewriter"
    ]));
    expect(neighborIds).toEqual(expect.arrayContaining([
      "primitive:highlight-word",
      "primitive:circle-reveal",
      "primitive:blur-underline",
      "primitive:typewriter"
    ]));

    const layerStack = resolveAnimationLayerStack([
      getAnimationNode("blur-underline")!,
      getAnimationNode("circle-reveal")!,
      getAnimationNode("highlight-word")!
    ]);

    expect(layerStack.map((node) => node.id)).toEqual([
      "primitive:blur-underline",
      "primitive:highlight-word",
      "primitive:circle-reveal"
    ]);
  });

  it("routes the target focus runtime through the existing emphasis hosts and primitives", () => {
    const chain = resolveAnimationChain("target-focus-zoom");
    const neighborIds = getAnimationNeighbors("target-focus-zoom").map((node) => node.id);

    expect(chain.map((node) => node.id)).toEqual(expect.arrayContaining([
      "focus-effect:target-focus-zoom",
      "host:target-focus-runtime",
      "host:motion-showcase-overlay",
      "primitive:highlight-word",
      "primitive:circle-reveal",
      "primitive:blur-underline"
    ]));
    expect(neighborIds).toEqual(expect.arrayContaining([
      "host:target-focus-runtime",
      "host:motion-showcase-overlay",
      "primitive:highlight-word",
      "primitive:circle-reveal",
      "primitive:blur-underline"
    ]));
  });

  it("routes the svg caption host through svg variants into effect primitives", () => {
    const neighbors = getAnimationNeighbors("svg-caption-overlay");
    const chain = resolveAnimationChain("svg-caption-overlay");

    expect(neighbors.some((node) => node.kind === "svg-variant")).toBe(true);
    expect(chain.some((node) => node.id === "primitive:typewriter" || node.id === "primitive:highlight-word" || node.id === "primitive:blur-reveal")).toBe(true);
  });

  it("routes semantic template families to matching prototype nodes", () => {
    expect(getAnimationNeighbors("template-family:graph-chart").some((node) => node.id === "prototype:graph-widget")).toBe(true);
    expect(getAnimationNeighbors("template-family:number-counter-kpi").some((node) => node.id === "prototype:number-counter")).toBe(true);
    expect(getAnimationNeighbors("template-family:timeline-calendar").some((node) => node.id === "prototype:date-movement-animation")).toBe(true);
    expect(getAnimationNeighbors("template-family:blueprint-workflow").some((node) => node.id === "prototype:number-for-steps-counting-animation")).toBe(true);
  });
});
