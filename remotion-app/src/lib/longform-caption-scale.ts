import {getGuardedLongformCaptionSizing} from "./caption-boundary-guard";

export type LongformCaptionSizing = {
  fontSizePx: number;
  maxWidthPercent: number;
  guardScale: number;
};

export const getLongformCaptionSizing = ({
  width,
  height,
  maxLineUnits,
  lineCount
}: {
  width: number;
  height: number;
  maxLineUnits?: number;
  lineCount?: number;
}): LongformCaptionSizing => {
  return getGuardedLongformCaptionSizing({
    width,
    height,
    maxLineUnits,
    lineCount
  });
};
