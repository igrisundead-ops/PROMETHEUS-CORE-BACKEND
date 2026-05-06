import type { CreativeMoment, CreativeIntensity } from "../types";

export type CinematicStateKind =
  | "restrained"
  | "observational"
  | "vulnerable"
  | "inspirational"
  | "confrontational"
  | "explosive"
  | "recovery"
  | "meditative"
  | "transitional"
  | "silence-dominant";

export type CinematicState = {
  kind: CinematicStateKind;
  intensity: number; // 0.0 to 1.0
  startTimeMs: number;
  durationMs: number;
  rationale: string;
};

export type SubsystemProposal = {
  subsystemId: string;
  momentId: string;
  intent: {
    aggression?: number; // 0.0 to 1.0
    pacing?: number; // 0.0 to 1.0
    silence?: number; // 0.0 to 1.0
    dominance?: number; // 0.0 to 1.0
    motion?: number; // 0.0 to 1.0
    opacity?: number; // 0.0 to 1.0
    emphasis?: number; // 0.0 to 1.0
    scale?: number; // 0.0 to 1.0
    restraint?: number; // 0.0 to 1.0
    timing?: number; // milliseconds offset
  };
  priority: number; // Raw priority from the hierarchy
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  metadata?: Record<string, unknown>;
};

export type DeviationType =
  | "dominance-reversal"
  | "silence-interruption"
  | "asymmetry-reversal"
  | "rhythm-snap"
  | "motion-collapse"
  | "typography-fragility";

export type DeviationResult = {
  type: DeviationType;
  score: number;
  permitted: boolean;
  rationale: string;
};

export type CinematicExpectations = {
  recentAggressionAverage: number;
  recentMotionAverage: number;
  recentSilenceAverage: number;
  recentDominanceAverage: number;
  recentScaleAverage: number;
  recentAsymmetryDirection: "left" | "right" | "center";
  asymmetryPersistenceCount: number;
  restraintPersistenceCount: number;
  pacingPredictability: number;
};

export type GovernorResolution = {
  momentId: string;
  finalAggression: number;
  finalPacing: number;
  finalSilence: number;
  finalDominance: number;
  finalMotion: number;
  finalOpacity: number;
  finalEmphasis: number;
  finalScale: number;
  finalRestraint: number;
  finalTiming: number;
  state: CinematicState;
  deviation: DeviationResult | null;
  explainability: string[];
};

export type GlobalContextState = {
  activeState: CinematicState;
  unresolvedTension: number;
  escalationMomentum: number;
  emotionalExhaustion: number;
  vulnerabilityPersistence: number;
  pacingSaturation: number;
  renderComplexity: number;
  recentTreatments: string[];
  surpriseBudget: number;
  expectations: CinematicExpectations;
};
