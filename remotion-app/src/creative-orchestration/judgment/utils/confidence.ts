import {clamp01} from "../../utils";

export const deriveConfidence = (input: {
  selectedScore: number;
  runnerUpScore?: number;
  blockingViolationCount: number;
  traceCount: number;
  proposalConfidence: number;
}): number => {
  const scoreGap = Math.max(0, input.selectedScore - (input.runnerUpScore ?? 0));
  const violationPenalty = Math.min(0.35, input.blockingViolationCount * 0.12);
  const traceLift = Math.min(0.08, input.traceCount * 0.008);
  return clamp01(0.45 + input.selectedScore * 0.32 + scoreGap * 0.18 + input.proposalConfidence * 0.12 + traceLift - violationPenalty);
};
