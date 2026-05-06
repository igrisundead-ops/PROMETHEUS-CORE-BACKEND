import type { GovernorResolution, CinematicExpectations } from "../types";

export class ExpectationMemoryEngine {
  private history: GovernorResolution[] = [];
  private readonly WINDOW_SIZE = 10;

  update(resolution: GovernorResolution): CinematicExpectations {
    this.history.push(resolution);
    if (this.history.length > this.WINDOW_SIZE) {
      this.history.shift();
    }

    const recent = this.history;
    const count = recent.length;

    const avg = (field: keyof GovernorResolution) =>
      recent.reduce((sum, r) => sum + (r[field] as number), 0) / count;

    // Asymmetry is not directly in GovernorResolution yet, but we'll assume it's part of layout/dominance
    // For now, let's track dominance persistence as a proxy for asymmetry/restraint patterns
    const recentDominance = avg("finalDominance");
    
    let restraintPersistence = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].finalRestraint > 0.7) {
        restraintPersistence++;
      } else {
        break;
      }
    }

    // Pacing predictability: how similar is the pacing across recent moments
    const pacingStdDev = count < 2 ? 0 : Math.sqrt(
      recent.reduce((sum, r) => sum + Math.pow(r.finalPacing - avg("finalPacing"), 2), 0) / count
    );

    return {
      recentAggressionAverage: avg("finalAggression"),
      recentMotionAverage: avg("finalMotion"),
      recentSilenceAverage: avg("finalSilence"),
      recentDominanceAverage: recentDominance,
      recentScaleAverage: avg("finalScale"),
      recentAsymmetryDirection: "center", // Placeholder
      asymmetryPersistenceCount: 0, // Placeholder
      restraintPersistenceCount: restraintPersistence,
      pacingPredictability: Math.max(0, 1 - pacingStdDev * 5), // High if stddev is low
    };
  }
}
