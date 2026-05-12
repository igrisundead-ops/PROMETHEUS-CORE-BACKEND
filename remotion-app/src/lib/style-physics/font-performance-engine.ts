export type FontPerformanceScore = {
  readabilityScore: number; // 0 to 1
  motionResilience: number; // 0 to 1
  cinematicElegance: number; // 0 to 1
  authorityScore: number; // 0 to 1
  hypeScore: number; // 0 to 1
  isRecommended: boolean;
  limitations: string[];
};

export type FontPerformanceInput = {
  fontFamily: string;
  expectedMotionVelocity: number;
  expectedScale: number;
  backgroundComplexity: number;
  surfaceTone: "light" | "dark" | "neutral";
};

export const scoreFontPerformance = (input: FontPerformanceInput): FontPerformanceScore => {
  const { fontFamily, expectedMotionVelocity, expectedScale, backgroundComplexity, surfaceTone } = input;

  let readabilityScore = 0.8;
  let motionResilience = 0.8;
  let cinematicElegance = 0.5;
  let authorityScore = 0.5;
  let hypeScore = 0.5;
  const limitations: string[] = [];

  const familyLower = fontFamily.toLowerCase();

  // HEURISTIC SCORING FOR KEY FONTS
  if (familyLower.includes("dm sans")) {
    readabilityScore = 0.95;
    motionResilience = 0.9;
    cinematicElegance = 0.4;
    hypeScore = 0.7;
  } else if (familyLower.includes("playfair") || familyLower.includes("serif")) {
    readabilityScore = 0.8;
    motionResilience = 0.6; // Serifs often fail under heavy blur/motion
    cinematicElegance = 0.9;
    authorityScore = 0.8;
    limitations.push("serif-motion-blur-risk");
  } else if (familyLower.includes("fraunces") || familyLower.includes("cormorant")) {
    readabilityScore = 0.75;
    motionResilience = 0.55;
    cinematicElegance = 0.95;
    limitations.push("high-contrast-stroke-flicker-risk");
  }

  // Runtime context modifiers
  if (expectedMotionVelocity > 1.2) {
    readabilityScore -= 0.15;
    if (motionResilience < 0.7) {
      limitations.push("excessive-motion-velocity-for-typeface");
    }
  }

  if (expectedScale < 0.5) {
    readabilityScore -= 0.2;
    limitations.push("small-scale-legibility-risk");
  }

  if (backgroundComplexity > 0.8) {
    readabilityScore -= 0.1;
    limitations.push("background-noise-interference");
  }

  return {
    readabilityScore,
    motionResilience,
    cinematicElegance,
    authorityScore,
    hypeScore,
    isRecommended: readabilityScore > 0.6,
    limitations
  };
};
