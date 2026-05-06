export type AttentionDominance = {
  speakerDominance: number; // 0 to 1
  typographyDominance: number; // 0 to 1
  compositionDominance: number; // 0 to 1
  silenceDominance: number; // 0 to 1
  activeFocus: "speaker" | "typography" | "composition" | "silence";
};

export type AttentionInput = {
  transcriptSemantics: {
    intent: string;
    isPunchy: boolean;
    isVulnerable: boolean;
  };
  emotionalIntensity: number;
  speakerEmotion: "neutral" | "happy" | "sad" | "angry" | "vulnerable" | "authoritative";
  frameComplexity: number;
  faceProminence: number; // Size of face in frame
  motionEnergy: number;
  isSilenced: boolean;
  pacingContext: "fast" | "medium" | "slow";
};

export const calculateAttentionPriority = (input: AttentionInput): AttentionDominance => {
  const {
    transcriptSemantics,
    emotionalIntensity,
    speakerEmotion,
    frameComplexity,
    faceProminence,
    motionEnergy,
    isSilenced,
    pacingContext
  } = input;

  let speakerDominance = 0.5;
  let typographyDominance = 0.4;
  let compositionDominance = 0.1;
  let silenceDominance = 0.0;

  if (isSilenced) {
    return {
      speakerDominance: 0.1,
      typographyDominance: 0.0,
      compositionDominance: 0.4,
      silenceDominance: 0.9,
      activeFocus: "silence"
    };
  }

  // Vulnerability reduces typography dominance to allow the speaker's face/emotion to lead.
  if (speakerEmotion === "vulnerable" || transcriptSemantics.isVulnerable) {
    speakerDominance += 0.3;
    typographyDominance -= 0.2;
  }

  // Authority or Punchy hooks increase typography dominance.
  if (speakerEmotion === "authoritative" || transcriptSemantics.isPunchy) {
    typographyDominance += 0.3;
    speakerDominance -= 0.1;
  }

  // Large faces demand attention.
  if (faceProminence > 0.4) {
    speakerDominance += 0.2;
    typographyDominance -= 0.1;
  }

  // Busy frames reduce typography dominance to prevent overwhelm.
  if (frameComplexity > 0.8) {
    typographyDominance -= 0.15;
    compositionDominance += 0.2;
  }

  // Normalize
  const total = speakerDominance + typographyDominance + compositionDominance + silenceDominance;
  speakerDominance = Math.max(0.1, speakerDominance / total);
  typographyDominance = Math.max(0.05, typographyDominance / total);
  compositionDominance = Math.max(0.05, compositionDominance / total);
  silenceDominance = silenceDominance / total;

  let activeFocus: AttentionDominance["activeFocus"] = "speaker";
  const max = Math.max(speakerDominance, typographyDominance, compositionDominance, silenceDominance);
  if (max === typographyDominance) activeFocus = "typography";
  else if (max === compositionDominance) activeFocus = "composition";
  else if (max === silenceDominance) activeFocus = "silence";

  return {
    speakerDominance,
    typographyDominance,
    compositionDominance,
    silenceDominance,
    activeFocus
  };
};
