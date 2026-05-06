import { TimelineRhythmState } from "./timeline-rhythm-engine";

export const applyHumanImperfection = (state: TimelineRhythmState): TimelineRhythmState => {
  // Use text hashing or something deterministic for "human" drift
  const seed = state.rationale.join("");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  
  const drift = (hash % 5); // -2 to 2 frames
  
  return {
    ...state,
    impactDelayFrames: state.impactDelayFrames + drift,
    rationale: [...state.rationale, "HUMAN RHYTHM DRIFT APPLIED"]
  };
};
