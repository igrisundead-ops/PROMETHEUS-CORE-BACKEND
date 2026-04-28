import type {CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {clamp01} from "../utils";

const pickStyle = (moment: CreativeMoment): string => {
  if (moment.momentType === "question") {
    return "glass-gradient";
  }
  if (moment.momentType === "title" || moment.momentType === "hook") {
    return "radial-spotlight";
  }
  if (moment.momentType === "payoff") {
    return "blue-depth-glow";
  }
  if (moment.momentType === "transition") {
    return "depth-fog";
  }
  if (moment.momentType === "ambient") {
    return "subtle-animated-background-grid";
  }
  return moment.energy >= 0.7 ? "dark-vignette" : "none";
};

export class BackgroundOverlayAgent implements CreativeAgent<CreativeContext> {
  id = "background-overlay-agent";
  label = "Background Overlay";

  async propose(context: CreativeContext, moment: CreativeMoment) {
    void context;
    const backgroundStyle = pickStyle(moment);
    const isDark = backgroundStyle !== "none" && backgroundStyle !== "glass-gradient";
    const intensity = clamp01(moment.importance * 0.72 + moment.energy * 0.28);

    return [
      {
        id: `proposal-background-${moment.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "background",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + (backgroundStyle === "none" ? -10 : 12),
        confidence: clamp01(0.52 + moment.importance * 0.2),
        renderCost: backgroundStyle === "none" ? "low" : moment.momentType === "title" || moment.momentType === "hook" ? "medium" : "low",
        payload: {
          backgroundStyle,
          dominantColor: isDark ? "#0B1220" : "#F8FAFC",
          contrastIntent: "make-text-readable",
          intensity,
          animation: backgroundStyle === "none" ? "none" : "slow-drift",
          safeTextColors: isDark ? ["#FFFFFF", "#B9D8FF"] : ["#111827", "#1F2937"],
          unsafeTextColors: isDark ? ["#0B1220"] : ["#FFFFFF"]
        },
        reasoning: `Moment energy ${moment.energy.toFixed(2)} supports ${backgroundStyle} to strengthen readability and mood.`
      }
    ];
  }
}

