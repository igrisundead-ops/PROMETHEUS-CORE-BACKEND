import { TimelineRhythmState } from "./timeline-rhythm-engine";

export type CriticV3Result = {
  suggestedRevisions: Partial<TimelineRhythmState>;
  slopFlags: string[];
};

export const runTimelineCriticV3 = (state: TimelineRhythmState): CriticV3Result => {
  const slopFlags: string[] = [];
  const suggestedRevisions: Partial<TimelineRhythmState> = {};

  if (state.rhythmAggression > 0.9 && state.viewerBreathingWindow < 200) {
    slopFlags.push("AGGRESSION_SATURATION");
    suggestedRevisions.rhythmAggression = 0.7;
    suggestedRevisions.viewerBreathingWindow = 400;
  }

  if (state.impactDelayFrames === 0 && state.tensionCurve > 0.8) {
    slopFlags.push("PREDICTABLE_IMPACT");
    suggestedRevisions.impactDelayFrames = 4; // Add a tiny bit of cinematic delay
  }

  return {
    suggestedRevisions,
    slopFlags
  };
};
