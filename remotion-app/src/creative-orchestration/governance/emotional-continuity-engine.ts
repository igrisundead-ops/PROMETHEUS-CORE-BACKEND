import type { GlobalContextState, SubsystemProposal } from "./types";
import type { CreativeMoment } from "../types";

export class EmotionalContinuityEngine {
  update(
    currentMoment: CreativeMoment,
    proposals: SubsystemProposal[],
    globalState: GlobalContextState
  ): Partial<GlobalContextState> {
    const energy = currentMoment.energy;
    
    // 1. Unresolved Tension
    // If the moment is intense but the subsystems don't resolve it (low aggression proposal), tension builds.
    const avgProposedAggression = proposals.reduce((acc, p) => acc + (p.intent.aggression ?? 0.5), 0) / Math.max(1, proposals.length);
    const tensionDelta = energy > 0.7 && avgProposedAggression < 0.5 ? 0.15 : -0.1;

    // 2. Escalation Momentum
    // Consecutive high-energy moments build momentum.
    const momentumDelta = energy > 0.6 ? 0.1 : -0.2;

    // 3. Emotional Exhaustion
    // Sustained high momentum or aggression leads to exhaustion.
    const exhaustionDelta = globalState.escalationMomentum > 0.7 || energy > 0.8 ? 0.08 : -0.05;

    return {
      unresolvedTension: Math.max(0, Math.min(1, globalState.unresolvedTension + tensionDelta)),
      escalationMomentum: Math.max(0, Math.min(1, globalState.escalationMomentum + momentumDelta)),
      emotionalExhaustion: Math.max(0, Math.min(1, globalState.emotionalExhaustion + exhaustionDelta)),
      vulnerabilityPersistence: energy < 0.4 && currentMoment.importance > 0.7 ? 1.0 : globalState.vulnerabilityPersistence * 0.8,
    };
  }
}
