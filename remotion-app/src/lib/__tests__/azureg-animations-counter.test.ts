import {describe, expect, it} from "vitest";

import {resolveAzureGCounterSpec} from "../motion-platform/azureg-animations";

describe("AzureG counter catalog", () => {
  it("resolves a year marker into a year chronicle preset", () => {
    const spec = resolveAzureGCounterSpec({
      canonicalLabel: "2021",
      matchedText: "growth in 2021",
      templateGraphicCategory: "number-counter-kpi"
    });

    expect(spec.tone).toBe("year");
    expect(spec.targetValue).toBe(2021);
    expect(spec.startValue).toBe(2000);
    expect(spec.displayValue).toBe("2021");
  });

  it("resolves a currency phrase into a currency rise preset", () => {
    const spec = resolveAzureGCounterSpec({
      canonicalLabel: "$1 million",
      matchedText: "We cleared $1 million",
      templateGraphicCategory: "number-counter-kpi"
    });

    expect(spec.tone).toBe("currency");
    expect(spec.targetValue).toBe(1_000_000);
    expect(spec.prefix).toBe("$");
    expect(spec.displayValue).toBe("$1,000,000");
  });

  it("resolves a magnitude phrase into a quantity lift preset", () => {
    const spec = resolveAzureGCounterSpec({
      canonicalLabel: "one million",
      matchedText: "one million people",
      templateGraphicCategory: "number-counter-kpi"
    });

    expect(spec.tone).toBe("quantity");
    expect(spec.targetValue).toBe(1_000_000);
    expect(spec.displayValue).toBe("1,000,000");
  });
});

