export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const normalizeKeyword = (value: string): string => {
  return normalizeText(value).replace(/^'+|'+$/g, "").trim();
};

export const uniqueById = <T extends {id: string}>(items: T[]): T[] => {
  return items.reduce<T[]>((accumulator, item) => {
    if (!accumulator.some((candidate) => candidate.id === item.id)) {
      accumulator.push(item);
    }
    return accumulator;
  }, []);
};

export const pickByHash = <T,>(items: T[], seed: string): T | null => {
  if (items.length === 0) {
    return null;
  }
  return items[hashString(seed) % items.length] ?? items[0] ?? null;
};

