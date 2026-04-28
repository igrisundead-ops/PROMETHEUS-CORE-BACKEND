import type {CreativeOrchestrationResult} from "../types";

export const logCreativeOrchestrationResult = (result: CreativeOrchestrationResult): void => {
  const summary = [
    `job=${result.jobId}`,
    `moments=${result.moments.length}`,
    `proposals=${result.allProposals.length}`,
    `decision=${result.directorDecisions.length}`,
    `score=${result.criticReview.score}`,
    `renderCost=${result.finalCreativeTimeline.diagnostics.renderCost}`
  ].join(" ");

  console.info(`[creative-orchestration] ${summary}`);
};

