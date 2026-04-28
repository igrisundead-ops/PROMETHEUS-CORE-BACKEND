export const setNestedValue = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = current[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
};

export const getNestedValue = (target: Record<string, unknown>, path: string): unknown => {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = target;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

export const flattenRecord = (
  value: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> => {
  const flattened: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      nestedValue &&
      typeof nestedValue === "object" &&
      !Array.isArray(nestedValue) &&
      !(nestedValue instanceof Date)
    ) {
      Object.assign(flattened, flattenRecord(nestedValue as Record<string, unknown>, path));
      continue;
    }
    flattened[path] = nestedValue;
  }
  return flattened;
};
