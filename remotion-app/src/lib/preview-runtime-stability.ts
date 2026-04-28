import {useRef} from "react";
import {useCurrentFrame} from "remotion";

export const PREVIEW_MINOR_REGRESSION_FRAMES = 240;
export const PREVIEW_SEEK_RESET_FRAMES = 480;
export const PREVIEW_CUE_WINDOW_BEHIND_FRAMES = 360;
export const PREVIEW_CUE_WINDOW_AHEAD_FRAMES = 1350;
export const PREVIEW_CUE_WINDOW_MIN_DURATION_SECONDS = 90;
export const PREVIEW_CUE_WINDOW_MIN_CUE_COUNT = 24;
export const PREVIEW_RESET_SENTINEL = "__preview_reset__";

export type PreviewFrameGuardState = {
  rawFrame: number;
  stableFrame: number;
};

export type PreviewFrameGuardDecision = {
  state: PreviewFrameGuardState;
  heldRegression: boolean;
  reset: boolean;
  regressionFrames: number;
};

export const getNextPreviewFrameGuardState = ({
  rawFrame,
  previousState,
  minorRegressionFrames = PREVIEW_MINOR_REGRESSION_FRAMES,
  seekResetFrames = PREVIEW_SEEK_RESET_FRAMES
}: {
  rawFrame: number;
  previousState: PreviewFrameGuardState | null;
  minorRegressionFrames?: number;
  seekResetFrames?: number;
}): PreviewFrameGuardDecision => {
  if (!previousState) {
    return {
      state: {
        rawFrame,
        stableFrame: rawFrame
      },
      heldRegression: false,
      reset: false,
      regressionFrames: 0
    };
  }

  const rawRegressionFrames = Math.max(0, previousState.rawFrame - rawFrame);
  const stableRegressionFrames = Math.max(0, previousState.stableFrame - rawFrame);
  const nextBaseState = {
    rawFrame,
    stableFrame: rawFrame
  };

  if (rawFrame >= previousState.stableFrame) {
    return {
      state: nextBaseState,
      heldRegression: false,
      reset: false,
      regressionFrames: 0
    };
  }

  const likelySeek =
    rawRegressionFrames >= seekResetFrames ||
    stableRegressionFrames >= seekResetFrames ||
    rawFrame <= 2;

  if (likelySeek) {
    return {
      state: nextBaseState,
      heldRegression: false,
      reset: true,
      regressionFrames: stableRegressionFrames
    };
  }

  if (stableRegressionFrames > 0 && stableRegressionFrames <= minorRegressionFrames) {
    return {
      state: {
        rawFrame,
        stableFrame: previousState.stableFrame
      },
      heldRegression: true,
      reset: false,
      regressionFrames: stableRegressionFrames
    };
  }

  return {
    state: nextBaseState,
    heldRegression: false,
    reset: false,
    regressionFrames: stableRegressionFrames
  };
};

export const useStablePreviewFrame = ({
  enabled,
  resetKey = PREVIEW_RESET_SENTINEL,
  minorRegressionFrames = PREVIEW_MINOR_REGRESSION_FRAMES,
  seekResetFrames = PREVIEW_SEEK_RESET_FRAMES
}: {
  enabled: boolean;
  resetKey?: number | string;
  minorRegressionFrames?: number;
  seekResetFrames?: number;
}): PreviewFrameGuardDecision & {rawFrame: number; stableFrame: number} => {
  const rawFrame = useCurrentFrame();
  const guardRef = useRef<PreviewFrameGuardState | null>(null);
  const resetKeyRef = useRef<number | string>(resetKey);

  if (resetKeyRef.current !== resetKey) {
    resetKeyRef.current = resetKey;
    guardRef.current = null;
  }

  if (!enabled) {
    guardRef.current = {
      rawFrame,
      stableFrame: rawFrame
    };
    return {
      rawFrame,
      stableFrame: rawFrame,
      state: guardRef.current,
      heldRegression: false,
      reset: false,
      regressionFrames: 0
    };
  }

  const decision = getNextPreviewFrameGuardState({
    rawFrame,
    previousState: guardRef.current,
    minorRegressionFrames,
    seekResetFrames
  });
  guardRef.current = decision.state;

  return {
    ...decision,
    rawFrame,
    stableFrame: decision.state.stableFrame
  };
};

export const shouldWindowPreviewCues = ({
  durationInFrames,
  fps,
  cueCount
}: {
  durationInFrames: number;
  fps: number;
  cueCount: number;
}): boolean => {
  if (cueCount >= PREVIEW_CUE_WINDOW_MIN_CUE_COUNT) {
    return true;
  }

  return durationInFrames / Math.max(1, fps) >= PREVIEW_CUE_WINDOW_MIN_DURATION_SECONDS;
};

export const isFrameRangeInsidePreviewWindow = ({
  currentFrame,
  startFrame,
  endFrame,
  behindFrames = PREVIEW_CUE_WINDOW_BEHIND_FRAMES,
  aheadFrames = PREVIEW_CUE_WINDOW_AHEAD_FRAMES
}: {
  currentFrame: number;
  startFrame: number;
  endFrame: number;
  behindFrames?: number;
  aheadFrames?: number;
}): boolean => {
  return endFrame >= currentFrame - behindFrames && startFrame <= currentFrame + aheadFrames;
};
