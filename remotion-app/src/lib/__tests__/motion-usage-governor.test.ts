import {describe, expect, it} from "vitest";

import {buildMotionUsageGovernorBudgetMap} from "../motion-platform/motion-usage-governor";

describe("motion usage governor", () => {
  it("reduces repeated underline and circle emphasis usage inside the cooldown window", () => {
    const budgetMap = buildMotionUsageGovernorBudgetMap({
      currentTimeMs: 4000,
      candidates: [
        {wordKey: "underline-1", primitiveId: "blur-underline", startMs: 1000, importance: 0.92},
        {wordKey: "underline-2", primitiveId: "blur-underline", startMs: 1400, importance: 0.91},
        {wordKey: "underline-3", primitiveId: "blur-underline", startMs: 2025, importance: 0.9},
        {wordKey: "underline-4", primitiveId: "blur-underline", startMs: 3200, importance: 0.88},
        {wordKey: "circle-1", primitiveId: "circle-reveal", startMs: 1100, importance: 0.95},
        {wordKey: "circle-2", primitiveId: "circle-reveal", startMs: 1500, importance: 0.93}
      ]
    });

    expect(budgetMap.get("underline-1")).toBe("blur-underline");
    expect(budgetMap.get("underline-2")).toBeUndefined();
    expect(budgetMap.get("underline-3")).toBe("blur-underline");
    expect(budgetMap.get("underline-4")).toBeUndefined();
    expect(budgetMap.get("circle-1")).toBe("circle-reveal");
    expect(budgetMap.get("circle-2")).toBeUndefined();
  });

  it("rejects low-importance emphasis candidates", () => {
    const budgetMap = buildMotionUsageGovernorBudgetMap({
      currentTimeMs: 4000,
      candidates: [
        {wordKey: "weak-underline", primitiveId: "blur-underline", startMs: 3800, importance: 0.2}
      ]
    });

    expect(budgetMap.has("weak-underline")).toBe(false);
  });
});
