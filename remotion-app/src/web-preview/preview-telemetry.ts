export type PreviewPlaybackHealth = "booting" | "buffering" | "ready" | "stalled" | "error";

export type PreviewTelemetry = {
  currentFrame: number;
  highestFrame: number;
  backwardJumpCount: number;
  maxBackwardJumpFrames: number;
  forwardJumpCount: number;
  maxForwardJumpFrames: number;
  seekCount: number;
  stallCount: number;
  totalBufferMs: number;
  lastBufferMs: number;
};

export const createPreviewTelemetry = (): PreviewTelemetry => ({
  currentFrame: 0,
  highestFrame: 0,
  backwardJumpCount: 0,
  maxBackwardJumpFrames: 0,
  forwardJumpCount: 0,
  maxForwardJumpFrames: 0,
  seekCount: 0,
  stallCount: 0,
  totalBufferMs: 0,
  lastBufferMs: 0
});
