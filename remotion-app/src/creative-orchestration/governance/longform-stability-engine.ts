import type { GlobalContextState, SubsystemProposal } from "./types";
import type { CreativeMoment } from "../types";

export class LongformStabilityEngine {
  stabilize(
    moment: CreativeMoment,
    proposals: SubsystemProposal[],
    globalState: GlobalContextState
  ): SubsystemProposal[] {
    // 1. Prevent "Perpetual Hook Mode"
    // If we've had too many high-aggression moments recently, cap the aggression.
    const isSaturated = globalState.pacingSaturation > 0.7;
    
    return proposals.map((proposal) => {
      const sanitized = { ...proposal };
      
      if (isSaturated && sanitized.intent.aggression && sanitized.intent.aggression > 0.5) {
        sanitized.intent.aggression *= 0.7;
        sanitized.reasoning += " [Long-form stability: capping aggression due to pacing saturation]";
      }

      // 2. Prevent Climax Exhaustion
      if (globalState.emotionalExhaustion > 0.8 && sanitized.intent.intensity && sanitized.intent.intensity > 0.4) {
        sanitized.intent.aggression = (sanitized.intent.aggression ?? 0.5) * 0.5;
        sanitized.intent.motion = (sanitized.intent.motion ?? 0.5) * 0.5;
        sanitized.reasoning += " [Long-form stability: reducing intensity due to emotional exhaustion]";
      }

      return sanitized;
    });
  }

  updateGlobalPacing(moment: CreativeMoment, globalState: GlobalContextState): number {
    const pacingImpact = (moment.energy * 0.6) + (moment.density * 0.4);
    return Math.max(0, Math.min(1, globalState.pacingSaturation * 0.9 + pacingImpact * 0.1));
  }
}
