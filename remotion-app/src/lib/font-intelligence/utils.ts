import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

export const toIsoTimestamp = (): string => new Date().toISOString();

export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
};

export const readJsonIfExists = async <T,>(filePath: string): Promise<T | null> => {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

export const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const unique = <T,>(values: Iterable<T>): T[] => [...new Set(values)];
