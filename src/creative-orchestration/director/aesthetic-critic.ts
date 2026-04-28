import type {CreativeContext, CreativeTimeline, CriticReview} from "../types";

const scoreFromIssues = (issueCount: number): number => Math.max(0, 100 - issueCount * 12);

export class AestheticCritic {
  review(timeline: CreativeTimeline, context: CreativeContext): CriticReview {
    void context;
    const issues: CriticReview["issues"] = [];
    const treatmentCounts = timeline.decisions.reduce<Record<string, number>>((counts, decision) => {
      counts[decision.finalTreatment] = (counts[decision.finalTreatment] ?? 0) + 1;
      return counts;
    }, {});
    const repeatedTreatment = Object.entries(treatmentCounts).find(([, count]) => count >= Math.max(4, Math.ceil(timeline.decisions.length * 0.6)));

    if (repeatedTreatment) {
      issues.push({
        severity: "high",
        issue: `Repeated ${repeatedTreatment[0]} treatment dominates too many moments.`,
        suggestedFix: "Allow more variation by promoting asset-led or no-text moments where they fit."
      });
    }

    timeline.tracks.forEach((track) => {
      if (track.type === "sound" && timeline.tracks.filter((candidate) => candidate.type === "sound").length > timeline.moments.length) {
        issues.push({
          severity: "medium",
          trackId: track.id,
          issue: "Sound design is too dense for the current timeline.",
          suggestedFix: "Remove lower-priority clicks and keep only one accent per strong moment."
        });
      }
      if (track.type === "matting" && timeline.diagnostics.mattingWindows.length > 2) {
        issues.push({
          severity: "medium",
          trackId: track.id,
          issue: "Matting is being requested too often for V1.",
          suggestedFix: "Confine matting to the single most important behind-subject window."
        });
      }
      if (track.type === "motion" && String(track.payload["useThreeJs"]) === "true") {
        issues.push({
          severity: "medium",
          trackId: track.id,
          issue: "Three.js is being used where simpler motion would likely suffice.",
          suggestedFix: "Swap the moment to CSS/Remotion interpolation unless the depth cue is truly essential."
        });
      }
    });

    if (timeline.diagnostics.warnings.length > 0) {
      issues.push({
        severity: "low",
        issue: timeline.diagnostics.warnings[0] ?? "Diagnostic warning present.",
        suggestedFix: "Tighten the director pass and recheck the highest priority moments."
      });
    }

    const score = scoreFromIssues(issues.length);
    return {
      status: score >= 76 ? "approved" : "needs-revision",
      score,
      issues
    };
  }
}

