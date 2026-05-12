import type { GovernorResolution, CinematicState } from "../types";

export class AntiOverdesignEngine {
  private readonly RECENT_COMPLEXITY_WINDOW = 5;

  detect(
    resolution: GovernorResolution,
    state: CinematicState
  ): { overdesigned: boolean; simplifiedResolution: GovernorResolution } {
    let overdesigned = false;
    const simplified = { ...resolution };

    // 1. Detect "Excessive Perfection": if motion, scale, and dominance are all high but energy is medium
    if (
      resolution.finalMotion > 0.8 &&
      resolution.finalScale > 0.8 &&
      resolution.finalDominance > 0.8 &&
      state.intensity < 0.7
    ) {
      overdesigned = true;
      simplified.finalMotion *= 0.8;
      simplified.finalScale *= 0.9;
      simplified.explainability.push("Anti-Overdesign: reduced sterile precision for natural feel.");
    }

    // 2. Detect "Hyper-Polish": if timing is perfectly zeroed out across many moments
    // (This would need historical tracking, but we'll approximate with a high-intensity check)
    if (state.kind === "observational" && resolution.finalAggression > 0.7) {
      simplified.finalAggression *= 0.9;
      overdesigned = true;
    }

    return { overdesigned, simplifiedResolution: simplified };
  }
}
