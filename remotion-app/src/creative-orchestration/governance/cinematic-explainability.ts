import type { GovernorResolution, SubsystemProposal } from "./types";

export class CinematicExplainability {
  static generateReport(resolution: GovernorResolution, sourceProposals: SubsystemProposal[]): string[] {
    const report: string[] = [];
    
    report.push(`Moment ID: ${resolution.momentId}`);
    report.push(`Active Cinematic State: ${resolution.state.kind} (Intensity: ${resolution.state.intensity.toFixed(2)})`);
    report.push(`State Rationale: ${resolution.state.rationale}`);
    
    report.push("Final Decisions:");
    report.push(`- Aggression: ${resolution.finalAggression.toFixed(2)}`);
    report.push(`- Pacing: ${resolution.finalPacing.toFixed(2)}`);
    report.push(`- Silence: ${resolution.finalSilence.toFixed(2)}`);
    report.push(`- Dominance: ${resolution.finalDominance.toFixed(2)}`);
    report.push(`- Restraint: ${resolution.finalRestraint.toFixed(2)}`);

    report.push("Subsystem Proposals & Conflict Resolution:");
    sourceProposals.forEach((p) => {
      report.push(`[${p.subsystemId}] Priority: ${p.priority}, Confidence: ${p.confidence.toFixed(2)}`);
      report.push(`  Intent: ${JSON.stringify(p.intent)}`);
      report.push(`  Reasoning: ${p.reasoning}`);
    });

    return report;
  }
}
