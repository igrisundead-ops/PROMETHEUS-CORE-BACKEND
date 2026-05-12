import type { SubsystemProposal } from "./types";
import type { CreativeMoment } from "../types";

export class CinematicGroundingEngine {
  enforceProportionality(
    moment: CreativeMoment,
    proposals: SubsystemProposal[]
  ): SubsystemProposal[] {
    const baselineEnergy = moment.energy;
    const baselineImportance = moment.importance;

    return proposals.map((proposal) => {
      const grounded = { ...proposal };

      // 1. Cap Aggression relative to energy
      if (grounded.intent.aggression !== undefined) {
        const maxAllowedAggression = Math.max(0.3, baselineEnergy * 1.2);
        if (grounded.intent.aggression > maxAllowedAggression) {
          grounded.intent.aggression = maxAllowedAggression;
          grounded.reasoning += ` [Grounding: capped aggression at ${maxAllowedAggression.toFixed(2)} to match moment energy]`;
        }
      }

      // 2. Cap Scale/Motion relative to importance
      if (grounded.intent.scale !== undefined) {
        const maxAllowedScale = Math.max(0.4, baselineImportance * 1.1);
        if (grounded.intent.scale > maxAllowedScale) {
          grounded.intent.scale = maxAllowedScale;
          grounded.reasoning += ` [Grounding: capped scale at ${maxAllowedScale.toFixed(2)} to match moment importance]`;
        }
      }

      return grounded;
    });
  }
}
