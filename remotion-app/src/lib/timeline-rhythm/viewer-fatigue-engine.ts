export type FatigueInput = {
  pacingFatigue: number;
  attentionFatigue: number;
  visualComplexity: number;
};

export type FatigueOutput = {
  fatigueScore: number;
  rationale: string[];
};

export const evaluateViewerFatigue = (input: FatigueInput): FatigueOutput => {
  const { pacingFatigue, attentionFatigue, visualComplexity } = input;
  
  const fatigueScore = (pacingFatigue * 0.4) + (attentionFatigue * 0.4) + (visualComplexity * 0.2);

  return {
    fatigueScore,
    rationale: [
      fatigueScore > 0.7 ? "VIEWER SATURATION HIGH - PULLING BACK" : "ATTENTION CAPACITY OPTIMAL",
      visualComplexity > 0.8 ? "VISUAL CHAOS LIMITING RHYTHM AGGRESSION" : "COMPLEXITY HEADROOM AVAILABLE"
    ]
  };
};
