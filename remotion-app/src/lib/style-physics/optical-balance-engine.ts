export type OpticalImperfection = {
  offsetX: number; // Pixels
  offsetY: number; // Pixels
  rotation: number; // Degrees
  scaleJitter: number; // Multiplier
  timingOffsetMs: number;
};

export type OpticalBalanceInput = {
  text: string;
  isEmphasized: boolean;
  dominance: number;
  emotionalWeight: number;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export const calculateOpticalBalance = (input: OpticalBalanceInput): OpticalImperfection => {
  const { text, isEmphasized, dominance, emotionalWeight } = input;
  
  // Deterministic seed based on text to ensure consistent "imperfect" placement for the same words
  const seed = hashString(text);
  const getPseudoRandom = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // Subconscious Optical Correction: 
  // Text often feels "low" if perfectly centered. We apply a slight "lift".
  const opticalLift = -2.0 - (dominance * 4.0);
  
  // Emotional Asymmetry: High emotion introduces subtle "instability"
  const offsetX = emotionalWeight > 0.7 ? (getPseudoRandom(1) - 0.5) * 8.0 : (getPseudoRandom(1) - 0.5) * 2.0;
  const offsetY = opticalLift + (emotionalWeight > 0.7 ? (getPseudoRandom(2) - 0.5) * 6.0 : 0);
  
  const rotation = isEmphasized ? (getPseudoRandom(3) - 0.5) * 1.5 : (getPseudoRandom(3) - 0.5) * 0.4;
  
  // Scale Jitter: Subtle size variation to avoid "mathematical grid" feel
  const scaleJitter = 1.0 + (getPseudoRandom(4) - 0.5) * 0.015;

  return {
    offsetX,
    offsetY,
    rotation,
    scaleJitter,
    timingOffsetMs: Math.round((getPseudoRandom(5) - 0.5) * 40)
  };
};
