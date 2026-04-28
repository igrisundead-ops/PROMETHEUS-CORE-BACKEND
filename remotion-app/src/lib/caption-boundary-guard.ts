const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

type CaptionWidthBreakpoint = {
  maxWidth: number;
  baseWidthPercent: number;
  widthGrowth: number;
  minWidthPercent: number;
  maxWidthPercent: number;
};

export type CaptionBoundaryGuard = {
  minFontSizePx: number;
  maxFontSizePx: number;
  densityBaselineUnits: number;
  densityRangeUnits: number;
  densityGuardPenalty: number;
  lineGuardPenalty: number;
  minGuardScale: number;
  breakpoints: CaptionWidthBreakpoint[];
};

export const longformLandscapeCaptionBoundaryGuard: CaptionBoundaryGuard = {
  minFontSizePx: 28,
  maxFontSizePx: 66,
  densityBaselineUnits: 22,
  densityRangeUnits: 14,
  densityGuardPenalty: 0.18,
  lineGuardPenalty: 0.08,
  minGuardScale: 0.72,
  breakpoints: [
    {
      maxWidth: 720,
      baseWidthPercent: 72,
      widthGrowth: 4,
      minWidthPercent: 70,
      maxWidthPercent: 76
    },
    {
      maxWidth: 1024,
      baseWidthPercent: 75,
      widthGrowth: 3,
      minWidthPercent: 74,
      maxWidthPercent: 78
    },
    {
      maxWidth: Number.POSITIVE_INFINITY,
      baseWidthPercent: 78,
      widthGrowth: 2,
      minWidthPercent: 77,
      maxWidthPercent: 80
    }
  ]
};

export type GuardedCaptionSizing = {
  fontSizePx: number;
  maxWidthPercent: number;
  guardScale: number;
};

export const getGuardedLongformCaptionSizing = ({
  width,
  height,
  maxLineUnits,
  lineCount,
  guard = longformLandscapeCaptionBoundaryGuard
}: {
  width: number;
  height: number;
  maxLineUnits?: number;
  lineCount?: number;
  guard?: CaptionBoundaryGuard;
}): GuardedCaptionSizing => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const shorterEdge = Math.min(safeWidth, safeHeight);
  const baseFontSize = Math.round(clamp(Math.min(safeWidth * 0.05, shorterEdge * 0.15), 32, guard.maxFontSizePx));
  const densityPressure = maxLineUnits && maxLineUnits > 0
    ? clamp((maxLineUnits - guard.densityBaselineUnits) / guard.densityRangeUnits, 0, 1)
    : 0;
  const linePressure = lineCount && lineCount > 1
    ? clamp((lineCount - 1) * guard.lineGuardPenalty, 0, guard.lineGuardPenalty * 2)
    : 0;
  const guardScale = Number(
    clamp(
      1 - densityPressure * guard.densityGuardPenalty - linePressure,
      guard.minGuardScale,
      1
    ).toFixed(3)
  );
  const guardedFontSize = Math.round(clamp(baseFontSize * guardScale, guard.minFontSizePx, guard.maxFontSizePx));
  const breakpoint = guard.breakpoints.find((entry) => safeWidth <= entry.maxWidth)
    ?? guard.breakpoints[guard.breakpoints.length - 1];

  return {
    fontSizePx: guardedFontSize,
    maxWidthPercent: Math.round(
      clamp(
        breakpoint.baseWidthPercent + densityPressure * breakpoint.widthGrowth,
        breakpoint.minWidthPercent,
        breakpoint.maxWidthPercent
      )
    ),
    guardScale
  };
};
