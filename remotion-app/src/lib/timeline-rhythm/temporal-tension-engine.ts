export type TensionInput = {
  emotionalIntensity: number;
  cadenceScore: number;
  history: any[];
};

export type TensionOutput = {
  tensionScore: number;
  escalation: number;
  rationale: string[];
};

export const calculateTemporalTension = (input: TensionInput): TensionOutput => {
  const { emotionalIntensity, cadenceScore, history } = input;
  
  const recentTension = history.slice(-3).reduce((acc, h) => acc + (h.tensionCurve || 0.5), 0) / Math.max(1, history.slice(-3).length);
  
  // Create tension waves: if recent tension was high, we might want to release, or keep building
  const escalation = Math.min(1, emotionalIntensity * 1.2);
  const baseTension = (emotionalIntensity * 0.7) + (cadenceScore * 0.3);
  
  // Avoid flat tension
  const tensionScore = baseTension > 0.8 && recentTension > 0.7 ? 0.6 : baseTension;

  return {
    tensionScore,
    escalation,
    rationale: [
      tensionScore > 0.8 ? "HIGH TEMPORAL TENSION" : "STABLE PACING",
      recentTension > 0.7 ? "RECOVERING FROM PEAK" : "BUILDING ANTICIPATION"
    ]
  };
};
