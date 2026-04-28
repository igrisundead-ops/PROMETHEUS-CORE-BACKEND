import type {CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

const pickSound = (moment: CreativeMoment): string => {
  if (moment.momentType === "transition") {
    return "whoosh";
  }
  if (moment.momentType === "title" || moment.momentType === "payoff") {
    return "soft-hit";
  }
  if (moment.momentType === "list") {
    return "mouse-click";
  }
  if (moment.momentType === "hook" || moment.energy >= 0.85) {
    return "riser";
  }
  if (moment.momentType === "ambient") {
    return "none";
  }
  return moment.importance >= 0.65 ? "mouse-click" : "none";
};

export class SoundAgent implements CreativeAgent<CreativeContext> {
  id = "sound-agent";
  label = "Sound";

  async propose(context: CreativeContext, moment: CreativeMoment) {
    void context;
    const soundType = pickSound(moment);
    return [
      {
        id: `proposal-sound-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "sound",
        startMs: Math.max(0, moment.startMs - (soundType === "whoosh" ? 40 : 20)),
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + (soundType === "none" ? -20 : 8),
        confidence: clamp01(0.56 + moment.energy * 0.2),
        renderCost: "low",
        payload: {
          soundType,
          syncTo: moment.momentType === "transition" ? "transition" : moment.momentType === "title" ? "title-reveal" : "keyword-entry",
          volumeDb: soundType === "none" ? -100 : soundType === "riser" ? -10 : -12,
          startOffsetMs: 0,
          reason: `Moment ${moment.momentType} is best supported by ${soundType}.`
        },
        reasoning: `Sound accent adds rhythm without spamming speech.`
      }
    ];
  }
}

