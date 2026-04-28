export type MotionUsageGovernorPrimitiveId = "blur-underline" | "circle-reveal";

export type MotionUsageGovernorCandidate = {
  wordKey: string;
  primitiveId: MotionUsageGovernorPrimitiveId;
  startMs: number;
  importance: number;
};

type MotionUsageGovernorOptions = {
  currentTimeMs: number;
  candidates: MotionUsageGovernorCandidate[];
  windowMs?: number;
  cooldownMs?: number;
  maxUsesPerPrimitive?: number | Partial<Record<MotionUsageGovernorPrimitiveId, number>>;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_COOLDOWN_MS = 780;
const DEFAULT_MAX_USES_PER_PRIMITIVE = 2;

const getMinimumImportanceForUse = (useCount: number): number => {
  if (useCount <= 0) {
    return 0.34;
  }
  if (useCount === 1) {
    return 0.54;
  }
  return 0.72;
};

const resolvePrimitiveCap = (
  primitiveId: MotionUsageGovernorPrimitiveId,
  maxUsesPerPrimitive: MotionUsageGovernorOptions["maxUsesPerPrimitive"]
): number => {
  if (typeof maxUsesPerPrimitive === "number") {
    return maxUsesPerPrimitive;
  }
  return maxUsesPerPrimitive?.[primitiveId] ?? DEFAULT_MAX_USES_PER_PRIMITIVE;
};

export const buildMotionUsageGovernorBudgetMap = ({
  currentTimeMs,
  candidates,
  windowMs = DEFAULT_WINDOW_MS,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  maxUsesPerPrimitive = DEFAULT_MAX_USES_PER_PRIMITIVE
}: MotionUsageGovernorOptions): Map<string, MotionUsageGovernorPrimitiveId> => {
  const windowStartMs = currentTimeMs - windowMs;
  const budgetMap = new Map<string, MotionUsageGovernorPrimitiveId>();
  const usageCountByPrimitive = new Map<MotionUsageGovernorPrimitiveId, number>();
  const lastUseAtByPrimitive = new Map<MotionUsageGovernorPrimitiveId, number>();

  const sortedCandidates = [...candidates]
    .filter((candidate) => candidate.startMs >= windowStartMs && candidate.startMs <= currentTimeMs)
    .sort((left, right) => {
      return left.startMs - right.startMs ||
        right.importance - left.importance ||
        left.wordKey.localeCompare(right.wordKey);
    });

  sortedCandidates.forEach((candidate) => {
    const useCount = usageCountByPrimitive.get(candidate.primitiveId) ?? 0;
    if (useCount >= resolvePrimitiveCap(candidate.primitiveId, maxUsesPerPrimitive)) {
      return;
    }

    const lastUsedAt = lastUseAtByPrimitive.get(candidate.primitiveId);
    if (typeof lastUsedAt === "number" && candidate.startMs - lastUsedAt < cooldownMs) {
      return;
    }

    const minimumImportance = getMinimumImportanceForUse(useCount);
    if (clamp01(candidate.importance) < minimumImportance) {
      return;
    }

    budgetMap.set(candidate.wordKey, candidate.primitiveId);
    usageCountByPrimitive.set(candidate.primitiveId, useCount + 1);
    lastUseAtByPrimitive.set(candidate.primitiveId, candidate.startMs);
  });

  return budgetMap;
};
