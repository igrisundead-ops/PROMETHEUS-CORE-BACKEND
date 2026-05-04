import {describe, expect, it} from "vitest";

import {FONT_COMPATIBILITY_EDGES, ROLE_COMPATIBILITY_PROFILES, DOCTRINE_FONT_COMPATIBILITY_EDGES} from "../cinematic-typography/font-compatibility-graph";

describe("font compatibility graph runtime separation", () => {
  it("keeps doctrine-only benchmark edges out of the operational runtime edge set", () => {
    expect(DOCTRINE_FONT_COMPATIBILITY_EDGES.some((edge) => edge.from === "jugendreisen" || edge.to === "jugendreisen")).toBe(true);
    expect(FONT_COMPATIBILITY_EDGES.some((edge) => edge.from === "jugendreisen" || edge.to === "jugendreisen")).toBe(false);
  });

  it("uses a runtime-backed benchmark for the hero alternate lane", () => {
    const heroAlternate = ROLE_COMPATIBILITY_PROFILES.find((profile) => profile.roleId === "hero_serif_alternate");
    expect(heroAlternate?.doctrineBenchmarkNodeId).toBe("louize");
    expect(heroAlternate?.runtimeBenchmarkNodeId).toBe("noto-serif-display");
  });
});
