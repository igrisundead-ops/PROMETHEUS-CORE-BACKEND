import { resolveTimelineRhythm, TimelineRhythmState, TimelineRhythmInput } from "./timeline-rhythm-engine";
import { runTimelineCriticV3 } from "./timeline-critic-v3";

export type { TimelineRhythmState, TimelineRhythmInput };

export const orchestrateTimelineRhythm = (input: TimelineRhythmInput): TimelineRhythmState => {
  const baseState = resolveTimelineRhythm(input);
  
  const critic = runTimelineCriticV3(baseState);
  
  return {
    ...baseState,
    ...critic.suggestedRevisions,
    rationale: [...baseState.rationale, ...critic.slopFlags.map(f => `CRITIC: ${f}`)]
  };
};

export * from "./timeline-rhythm-engine";
export * from "./temporal-tension-engine";
export * from "./cadence-intelligence-engine";
export * from "./music-synchronization-engine";
export * from "./timeline-rhythm-memory";
export * from "./viewer-fatigue-engine";
export * from "./cinematic-empathy-engine";
export * from "./editorial-courage-engine";
export * from "./human-rhythm-imperfection";
export * from "./timeline-critic-v3";
