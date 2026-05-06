export type CourageInput = {
  importance: number;
  tensionScore: number;
  fatigueScore: number;
};

export type CourageOutput = {
  restraintScore: number;
  shouldUnderplay: boolean;
  rationale: string[];
};

export const exerciseEditorialCourage = (input: CourageInput): CourageOutput => {
  const { importance, tensionScore, fatigueScore } = input;
  
  // High fatigue or low importance leads to restraint
  const restraintScore = Math.max(0, (fatigueScore * 0.6) + ((1 - importance) * 0.4));
  
  const shouldUnderplay = restraintScore > 0.7 && tensionScore < 0.4;

  return {
    restraintScore,
    shouldUnderplay,
    rationale: [
      restraintScore > 0.6 ? "EDITORIAL RESTRAINT: SUPPRESSING UNNECESSARY EMPHASIS" : "EDITORIAL COMMITMENT: DRIVING RHYTHM",
      shouldUnderplay ? "INTENTIONAL UNDERPLAY - PRESERVING SILENCE" : "MAINTAINING PRESENCE"
    ]
  };
};
