import type { DeviationScoreInput } from "./deviation-types";

export class DeviationScoringEngine {
  private readonly THRESHOLD = 0.75;

  score(input: DeviationScoreInput): { score: number; permitted: boolean } {
    const {
      emotionalNecessity,
      tensionSaturation,
      audienceAdaptation,
      pacingPredictability,
      visualFatigue,
      climaxProximity,
      isVulnerable,
    } = input;

    // Deviation is more likely when:
    // - Pacing is too predictable (audience is bored)
    // - Audience has adapted to the current style (need to refresh)
    // - High tension saturation (need a snap or release)
    // - Emotional necessity is high (vulnerable moment needs fragility)
    
    const baseScore =
      (pacingPredictability * 0.3) +
      (audienceAdaptation * 0.2) +
      (tensionSaturation * 0.2) +
      (emotionalNecessity * 0.3);

    const finalScore = baseScore * (1 + climaxProximity * 0.2);

    return {
      score: finalScore,
      permitted: finalScore >= this.THRESHOLD || isVulnerable,
    };
  }
}
