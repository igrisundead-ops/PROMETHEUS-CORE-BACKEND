export type SilenceOrchestration = {
  isSilenced: boolean;
  rationale: string[];
  tensionScore: number; // 0 to 1
  transitionHoldMs: number;
};

export type SilenceInput = {
  pauseDurationMs: number;
  emotionalVulnerability: number;
  isDramaticHook: boolean;
  visualOverwhelmScore: number;
  audioLoudnessPeak: number; // 0 to 1
  sequencePosition: "intro" | "middle" | "outro";
};

export const evaluateSilence = (input: SilenceInput): SilenceOrchestration => {
  const {
    pauseDurationMs,
    emotionalVulnerability,
    isDramaticHook,
    visualOverwhelmScore,
    audioLoudnessPeak,
    sequencePosition
  } = input;

  const rationale: string[] = [];
  let isSilenced = false;
  let tensionScore = 0;

  // Emotional Silence: If vulnerability is high, we silence to let the face speak.
  if (emotionalVulnerability > 0.8 && pauseDurationMs > 400) {
    isSilenced = true;
    rationale.push("high-emotional-vulnerability-enforces-silence");
    tensionScore = 0.9;
  }

  // Visual Overwhelm: If the scene is too busy, silence the text to avoid fatigue.
  if (visualOverwhelmScore > 0.85) {
    isSilenced = true;
    rationale.push("visual-complexity-restraint");
  }

  // Tension Silence: Long pauses in dramatic hooks should remain empty.
  if (isDramaticHook && pauseDurationMs > 800) {
    isSilenced = true;
    rationale.push("dramatic-pause-tension");
    tensionScore = 0.7;
  }

  // Anticipation: Silence right before a loud peak (e.g. beat drop).
  if (audioLoudnessPeak < 0.1 && pauseDurationMs > 200) {
    tensionScore = Math.max(tensionScore, 0.5);
  }

  return {
    isSilenced,
    rationale,
    tensionScore,
    transitionHoldMs: isSilenced ? Math.min(pauseDurationMs, 500) : 0
  };
};
