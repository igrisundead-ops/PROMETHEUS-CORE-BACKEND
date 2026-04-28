import type {CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

export class MattingDepthAgent implements CreativeAgent<CreativeContext> {
  id = "matting-depth-agent";
  label = "Matting / Depth";

  async propose(context: CreativeContext, moment: CreativeMoment) {
    void context;
    const requiresMatting =
      moment.momentType === "hook" ||
      moment.momentType === "title" ||
      moment.momentType === "payoff" ||
      moment.importance >= 0.9;

    if (!requiresMatting) {
      return [{
        id: `proposal-matting-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "matting",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: 8,
        confidence: 0.55,
        renderCost: "low",
        payload: {
          mattingMode: "none",
          reason: "No depth separation is required for this moment.",
          fallbackIfUnavailable: "none"
        },
        reasoning: "This moment does not need depth compositing."
      }];
    }

    return [
      {
        id: `proposal-matting-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "matting",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + 10,
        confidence: clamp01(0.72 + moment.importance * 0.18),
        renderCost: "medium",
        requiresMatting: true,
        payload: {
          mattingMode: "required",
          reason: "The moment wants depth separation or behind-subject text.",
          timeWindow: {
            startMs: moment.startMs,
            endMs: moment.endMs
          },
          estimatedCost: "medium",
          fallbackIfUnavailable: "move-text-to-side-glass-card"
        },
        reasoning: "High-impact moments are allowed to request short-window matting with a safe fallback."
      }
    ];
  }
}

