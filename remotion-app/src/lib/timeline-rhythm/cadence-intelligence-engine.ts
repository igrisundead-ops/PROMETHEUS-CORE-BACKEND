export type CadenceInput = {
  deliverySpeed: number;
  emotionalIntensity: number;
};

export type CadenceOutput = {
  cadenceScore: number;
  isInterrupted: boolean;
  rationale: string[];
};

export const analyzeCadence = (input: CadenceInput): CadenceOutput => {
  const { deliverySpeed, emotionalIntensity } = input;
  
  // Normal delivery speed is around 3-4 words per second
  const normalizedSpeed = Math.min(1, deliverySpeed / 6);
  const cadenceScore = (normalizedSpeed * 0.5) + (emotionalIntensity * 0.5);
  
  const isInterrupted = normalizedSpeed > 0.8 && emotionalIntensity < 0.3; // Rapid but low emotion suggests technical interruption

  return {
    cadenceScore,
    isInterrupted,
    rationale: [
      normalizedSpeed > 0.7 ? "FAST DELIVERY CADENCE" : "MEASURED CADENCE",
      isInterrupted ? "RHYTHMIC INTERRUPTION DETECTED" : "FLOW MAINTAINED"
    ]
  };
};
