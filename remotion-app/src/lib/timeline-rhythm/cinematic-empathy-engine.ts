export type EmpathyInput = {
  speakerEmotion: "neutral" | "vulnerable" | "aggressive";
  subjectEnergy: number;
  visualChaos: number;
};

export type EmpathyOutput = {
  timingOffset: number;
  breathingRoom: number;
  rationale: string[];
};

export const applyCinematicEmpathy = (input: EmpathyInput): EmpathyOutput => {
  const { speakerEmotion, subjectEnergy, visualChaos } = input;
  
  let timingOffset = 0;
  let breathingRoom = 0.5;

  if (speakerEmotion === "vulnerable") {
    timingOffset = 200; // Delay for emotional weight
    breathingRoom = 0.9;
  } else if (speakerEmotion === "aggressive") {
    timingOffset = -50; // Anticipate/Rush
    breathingRoom = 0.2;
  }

  if (visualChaos > 0.8) {
    breathingRoom = Math.max(breathingRoom, 0.7); // Yield to chaos
  }

  return {
    timingOffset,
    breathingRoom,
    rationale: [
      speakerEmotion === "vulnerable" ? "EMOTIONAL VULNERABILITY DETECTED - INCREASING BREATHING ROOM" : "STANDARD SUBJECT ENERGY",
      visualChaos > 0.8 ? "VISUAL CHAOS PRIORITY - TYPOGRAPHY YIELDING" : "CLEAR VISUAL FIELD"
    ]
  };
};
