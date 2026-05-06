import {describe, expect, it} from "vitest";

import {resolveRenderConfigFromEnv} from "../config/render-flags";
import {generateTypographyDecision} from "../typography/typography-decision-engine";
import type {BackendEnv} from "../config";

const renderConfig = resolveRenderConfigFromEnv({
  ENABLE_FONT_GRAPH: true
} as BackendEnv);

describe("TypographyDecisionEngine", () => {
  it("selects custom font when available", () => {
    const decision = generateTypographyDecision({
      text: "Build premium cinematic typography systems now",
      rhetoricalIntent: "authority",
      availableFonts: [
        {family: "Satoshi", source: "custom_ingested"},
        {family: "Canela", source: "custom_ingested"}
      ],
      renderConfig
    });
    expect(decision.primaryFont.family).toBe("Satoshi");
    expect(decision.primaryFont.source).toBe("custom_ingested");
    expect(decision.graphUsed).toBe(true);
  });

  it("marks fallback when no custom font is available", () => {
    const decision = generateTypographyDecision({
      text: "Build premium cinematic typography systems now",
      rhetoricalIntent: "authority",
      availableFonts: [{family: "Arial", source: "system"}],
      renderConfig
    });
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.fallbackReasons.length).toBeGreaterThan(0);
  });

  it("returns core words and respects max lines", () => {
    const decision = generateTypographyDecision({
      text: "Authority and emphasis demand intentional rhythm and premium clarity",
      rhetoricalIntent: "emphasis",
      availableFonts: [{family: "Satoshi", source: "custom_ingested"}],
      renderConfig,
      maxLines: 2,
      maxCharsPerLine: 24
    });
    expect(decision.coreWords.length).toBeGreaterThan(0);
    expect(decision.linePlan.lines.length).toBeLessThanOrEqual(2);
  });
});
