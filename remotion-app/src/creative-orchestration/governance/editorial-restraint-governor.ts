import type { SubsystemProposal, GlobalContextState } from "./types";
import type { CreativeMoment } from "../types";

export class EditorialRestraintGovernor {
  applyRestraint(
    moment: CreativeMoment,
    proposals: SubsystemProposal[],
    globalState: GlobalContextState
  ): SubsystemProposal[] {
    const energy = moment.energy;
    
    return proposals.map((proposal) => {
      const restrained = { ...proposal };

      // 1. Enforce Silence/Negative Space
      // If the moment is low energy and we've been very aggressive recently, force restraint.
      if (energy < 0.3 && globalState.pacingSaturation > 0.6) {
        restrained.intent.restraint = 1.0;
        restrained.intent.aggression = 0.0;
        restrained.intent.motion = 0.0;
        restrained.reasoning += " [Restraint Governor: forced silence for negative space]";
      }

      // 2. Prevent Over-Emphasis
      // If we already have high dominance proposals, suppress micro-effects.
      if (restrained.subsystemId === "sound-agent" && globalState.pacingSaturation > 0.8) {
        restrained.confidence *= 0.3;
        restrained.reasoning += " [Restraint Governor: suppressing micro-effects to avoid saturation]";
      }

      return restrained;
    });
  }
}
