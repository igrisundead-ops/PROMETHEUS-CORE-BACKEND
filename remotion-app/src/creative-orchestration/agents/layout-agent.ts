import type {AgentProposal, CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

export class LayoutAgent implements CreativeAgent<CreativeContext> {
  id = "layout-agent";
  label = "Layout / Contrast";

  async propose(context: CreativeContext, moment: CreativeMoment): Promise<AgentProposal[]> {
    void context;
    const crowded = moment.density >= 5 || moment.words.length >= 10;
    const status = moment.momentType === "ambient"
      ? "approved"
      : crowded && moment.importance < 0.7
        ? "warning"
        : "approved";

    return [
      {
        id: `proposal-layout-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "layout",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100),
        confidence: clamp01(status === "approved" ? 0.82 : 0.63),
        renderCost: "low",
        payload: {
          status,
          issue: crowded ? "visual-density-high" : "readability-ok",
          suggestedFix: crowded ? "break the moment into a smaller text or asset-led treatment." : "keep the current layout and hold hierarchy.",
          affectedProposalIds: [] as string[]
        },
        reasoning: crowded
          ? "The moment is dense enough to trigger a readability warning."
          : "The moment is visually safe and keeps a clean layout envelope."
      } satisfies AgentProposal
    ];
  }
}
