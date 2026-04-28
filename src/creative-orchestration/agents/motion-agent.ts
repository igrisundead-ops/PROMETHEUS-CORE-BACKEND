import type {CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

const pickChoreography = (moment: CreativeMoment): string => {
  if (moment.momentType === "transition") {
    return "zoom-through-layer";
  }
  if (moment.momentType === "list") {
    return "staggered-keyword-entrance";
  }
  if (moment.momentType === "title" || moment.momentType === "hook") {
    return "depth-card-float";
  }
  if (moment.momentType === "payoff") {
    return "light-sweep-reveal";
  }
  if (moment.momentType === "question") {
    return "blur-slide-up";
  }
  return "gentle-drift";
};

export class MotionAgent implements CreativeAgent<CreativeContext> {
  id = "motion-agent";
  label = "Motion / Apple Movement";

  async propose(context: CreativeContext, moment: CreativeMoment) {
    void context;
    const heroMoment = moment.suggestedIntensity === "hero" || moment.importance >= 0.9;
    const useThreeJs = heroMoment && (moment.momentType === "title" || moment.momentType === "payoff");
    const choreography = pickChoreography(moment);
    const enterDurationMs = heroMoment ? 540 : moment.energy >= 0.7 ? 460 : 340;
    const exitDurationMs = heroMoment ? 320 : 260;

    return [
      {
        id: `proposal-motion-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "motion",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + (heroMoment ? 12 : 4),
        confidence: clamp01(0.6 + moment.energy * 0.22 + moment.importance * 0.15),
        renderCost: useThreeJs ? "high" : moment.energy >= 0.8 ? "medium" : "low",
        requiresMatting: moment.momentType === "hook" || moment.momentType === "title",
        requiresVideoFrames: useThreeJs,
        compatibleWith: ["text", "background", "sound", "asset"],
        payload: {
          choreography,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          cameraIntent: useThreeJs ? "slow-push-in" : moment.momentType === "transition" ? "zoom-through-layer" : "none",
          enter: {
            from: {opacity: 0, y: 24, blur: 14, scale: 0.96},
            to: {opacity: 1, y: 0, blur: 0, scale: 1},
            durationMs: enterDurationMs
          },
          exit: {
            to: {opacity: 0, y: -12, blur: 8, scale: 0.98},
            durationMs: exitDurationMs
          },
          layerDepth: heroMoment ? 3 : 2,
          useThreeJs,
          useGSAP: false
        },
        reasoning: `Moment type ${moment.momentType} prefers ${choreography} with Apple's minimal easing language.`
      }
    ];
  }
}

