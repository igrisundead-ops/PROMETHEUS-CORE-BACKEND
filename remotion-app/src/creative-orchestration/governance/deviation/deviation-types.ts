import type { 
  GovernorResolution, 
  DeviationType, 
  CinematicExpectations, 
  DeviationResult 
} from "../types";

export type DeviationScoreInput = {
  emotionalNecessity: number;
  tensionSaturation: number;
  audienceAdaptation: number;
  pacingPredictability: number;
  visualFatigue: number;
  climaxProximity: number;
  isVulnerable: boolean;
};
