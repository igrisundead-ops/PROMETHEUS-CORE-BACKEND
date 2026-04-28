export type MediaTrimWindow = {
  trimBeforeFrames: number;
  trimAfterFrames: number;
  playFrames: number;
  totalFrames: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const hasValidMediaTrimWindow = ({
  trimBeforeFrames,
  trimAfterFrames
}: {
  trimBeforeFrames: number;
  trimAfterFrames: number;
}): boolean => {
  return Number.isFinite(trimBeforeFrames) &&
    Number.isFinite(trimAfterFrames) &&
    trimBeforeFrames >= 0 &&
    trimAfterFrames > trimBeforeFrames;
};

export const buildDeterministicMediaTrimWindow = ({
  totalFrames,
  desiredFrames,
  seed
}: {
  totalFrames: number;
  desiredFrames: number;
  seed: string;
}): MediaTrimWindow => {
  const normalizedTotalFrames = Math.max(1, Math.floor(totalFrames));
  const playFrames = clamp(Math.round(desiredFrames), 1, normalizedTotalFrames);
  const maxTrimBefore = Math.max(0, normalizedTotalFrames - playFrames);
  const trimBeforeFrames = maxTrimBefore === 0 ? 0 : hashString(seed) % (maxTrimBefore + 1);
  const trimAfterFrames = Math.min(normalizedTotalFrames, trimBeforeFrames + playFrames);

  return {
    trimBeforeFrames,
    trimAfterFrames,
    playFrames: Math.max(1, trimAfterFrames - trimBeforeFrames),
    totalFrames: normalizedTotalFrames
  };
};
