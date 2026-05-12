import type { GlobalContextState, SubsystemProposal } from "./types";

export class RenderBudgetGovernor {
  private static readonly COMPLEXITY_THRESHOLD = 0.85;

  govern(proposals: SubsystemProposal[], globalState: GlobalContextState): SubsystemProposal[] {
    const isOverloaded = globalState.renderComplexity > RenderBudgetGovernor.COMPLEXITY_THRESHOLD;

    if (!isOverloaded) return proposals;

    return proposals.map((proposal) => {
      const simplified = { ...proposal };

      // Reduce motion and dominance to save render cost
      if (simplified.intent.motion) simplified.intent.motion *= 0.6;
      if (simplified.intent.dominance) simplified.intent.dominance *= 0.7;
      
      simplified.reasoning += " [Budget Governor: simplified due to high render complexity]";
      
      return simplified;
    });
  }

  calculateNewComplexity(currentComplexity: number, proposals: SubsystemProposal[]): number {
    const proposalImpact = proposals.reduce((acc, p) => {
      let impact = 0;
      if (p.intent.motion && p.intent.motion > 0.7) impact += 0.1;
      if (p.intent.dominance && p.intent.dominance > 0.7) impact += 0.05;
      return acc + impact;
    }, 0);

    return Math.max(0, Math.min(1, currentComplexity * 0.8 + proposalImpact));
  }
}
