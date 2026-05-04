import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

export const readJsonlIfExists = async <T,>(filePath: string): Promise<T[]> => {
  try {
    const content = await readFile(filePath, "utf-8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
};

export const writeJsonl = async (filePath: string, rows: unknown[]): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  const payload = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(filePath, payload ? `${payload}\n` : "", "utf-8");
};
