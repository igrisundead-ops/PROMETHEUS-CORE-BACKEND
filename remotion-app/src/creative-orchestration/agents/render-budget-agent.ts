import type {AgentProposal, CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

const estimateCost = (moment: CreativeMoment): "low" | "medium" | "high" => {
  if (moment.suggestedIntensity === "hero" || moment.importance >= 0.92) {
    return "high";
  }
  if (moment.energy >= 0.75 || moment.words.length >= 9) {
    return "medium";
  }
  return "low";
};

export class RenderBudgetAgent implements CreativeAgent<CreativeContext> {
  id = "render-budget-agent";
  label = "Render Budget";

  async propose(context: CreativeContext, moment: CreativeMoment): Promise<AgentProposal[]> {
    void context;
    const totalEstimatedCost = estimateCost(moment);
    const status = totalEstimatedCost === "high" && moment.importance < 0.88 ? "warning" : "approved";

    return [
      {
        id: `proposal-render-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "render",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100),
        confidence: clamp01(totalEstimatedCost === "low" ? 0.9 : totalEstimatedCost === "medium" ? 0.8 : 0.7),
        renderCost: totalEstimatedCost,
        payload: {
          status,
          totalEstimatedCost,
          rejectedProposalIds: [] as string[],
          reason: totalEstimatedCost === "high"
            ? "The moment is expensive enough that the director should prefer cheaper alternatives when possible."
            : "The moment stays within a healthy render budget."
        },
        reasoning: "Render budget keeps expensive effects from stacking by default."
      } satisfies AgentProposal
    ];
  }
}
