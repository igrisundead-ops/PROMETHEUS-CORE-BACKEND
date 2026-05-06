import type { SubsystemProposal, GovernorResolution, CinematicState } from "./types";

export class CinematicDecisionGraph {
  resolve(
    momentId: string,
    proposals: SubsystemProposal[],
    state: CinematicState
  ): GovernorResolution {
    // 1. Sort by Priority
    const sorted = [...proposals].sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);

    // 2. Weighted Resolution
    const resolution: GovernorResolution = {
      momentId,
      finalAggression: this.resolveWeightedField(sorted, "aggression", state),
      finalPacing: this.resolveWeightedField(sorted, "pacing", state),
      finalSilence: this.resolveWeightedField(sorted, "silence", state),
      finalDominance: this.resolveWeightedField(sorted, "dominance", state),
      finalMotion: this.resolveWeightedField(sorted, "motion", state),
      finalOpacity: this.resolveWeightedField(sorted, "opacity", state),
      finalEmphasis: this.resolveWeightedField(sorted, "emphasis", state),
      finalScale: this.resolveWeightedField(sorted, "scale", state),
      finalRestraint: this.resolveWeightedField(sorted, "restraint", state),
      finalTiming: this.resolveWeightedField(sorted, "timing", state),
      state,
      explainability: [],
    };

    return resolution;
  }

  private resolveWeightedField(
    proposals: SubsystemProposal[],
    field: keyof SubsystemProposal["intent"],
    state: CinematicState
  ): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const p of proposals) {
      const val = p.intent[field];
      if (val !== undefined) {
        // Priority acts as the primary weight
        const weight = p.priority * p.confidence;
        weightedSum += (val as number) * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 0.5; // Default neutral

    let result = weightedSum / totalWeight;

    // Apply State-based Constraints
    if (state.kind === "vulnerable" || state.kind === "meditative") {
      if (field === "aggression" || field === "motion") {
        result *= 0.6; // Soften aggression/motion in vulnerable states
      }
    }

    if (state.kind === "explosive") {
      if (field === "aggression" || field === "dominance") {
        result = Math.min(1.0, result * 1.3); // Amplify in explosive states
      }
    }

    return result;
  }
}
