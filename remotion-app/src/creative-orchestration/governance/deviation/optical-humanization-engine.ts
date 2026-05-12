import type { GovernorResolution } from "../types";

export class OpticalHumanizationEngine {
  apply(resolution: GovernorResolution): GovernorResolution {
    const updated = { ...resolution };

    // Deterministic seed based on momentId to ensure imperfections are consistent
    const seed = this.hashString(resolution.momentId);
    
    // 1. Tiny Timing Drift (±15ms)
    const timingDrift = (seed % 31) - 15;
    updated.finalTiming += timingDrift;

    // 2. Subtle Easing/Aggression Irregularity (±3%)
    const aggressionDrift = ((seed % 7) - 3) / 100;
    updated.finalAggression = Math.max(0, Math.min(1, updated.finalAggression + aggressionDrift));

    // 3. Emotional Offset Weighting (Scale ±2%)
    const scaleDrift = ((seed % 5) - 2) / 100;
    updated.finalScale = Math.max(0, updated.finalScale + scaleDrift);

    return updated;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
