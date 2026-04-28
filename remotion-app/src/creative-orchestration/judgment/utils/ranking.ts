export const rankByScore = <T extends {score: number}>(items: T[]): T[] => {
  return [...items].sort((left, right) => right.score - left.score);
};

export const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

export const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};
