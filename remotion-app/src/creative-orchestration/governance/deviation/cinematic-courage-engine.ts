import type { GovernorResolution, CinematicState } from "../types";

export class CinematicCourageEngine {
  allowRiskyDecision(
    resolution: GovernorResolution,
    state: CinematicState
  ): { courageApplied: boolean; rationale: string; resolution: GovernorResolution } {
    let courageApplied = false;
    let rationale = "";
    const updated = { ...resolution };

    // 1. Hold Silence longer than comfort (vulnerable/meditative states)
    if ((state.kind === "vulnerable" || state.kind === "meditative") && resolution.finalSilence > 0.6) {
      updated.finalSilence = Math.min(1.0, resolution.finalSilence * 1.4);
      updated.finalAggression *= 0.5;
      courageApplied = true;
      rationale = "Courage: holding silence for emotional resonance.";
    }

    // 2. Suppress text entirely during emotional peak (explosive/confrontational)
    if ((state.kind === "explosive" || state.kind === "confrontational") && state.intensity > 0.9) {
      updated.finalDominance = 0.0; // Hide everything, let the footage speak
      updated.finalOpacity = 0.0;
      courageApplied = true;
      rationale = "Courage: suppressing graphics to preserve peak impact.";
    }

    // 3. Intentionally under-design (restrained/observational)
    if (state.kind === "restrained" && resolution.finalMotion > 0.3) {
      updated.finalMotion = 0.0;
      updated.finalScale = 1.0;
      courageApplied = true;
      rationale = "Courage: intentional under-design for authority.";
    }

    return { courageApplied, rationale, resolution: updated };
  }
}
