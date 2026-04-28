import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {buildPatternMemoryFingerprint, buildSeedPatternMemorySnapshot} from "./pattern-seeds";
import {normalizePatternMemorySnapshot} from "./pattern-memory-snapshot";
import type {PatternMemoryLedgerEvent, PatternMemorySnapshot, PatternMemoryStorePaths} from "./pattern-types";

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
};

const ROOT_DIR = path.resolve(process.cwd(), ".cache", "pattern-memory");
const SNAPSHOT_PATH = path.resolve(process.cwd(), "src", "data", "pattern-memory.generated.json");

export const defaultPatternMemoryStorePaths = (): PatternMemoryStorePaths => ({
  rootDir: ROOT_DIR,
  ledgerPath: path.join(ROOT_DIR, "ledger.ndjson"),
  snapshotPath: SNAPSHOT_PATH,
  indexPath: path.join(ROOT_DIR, "index.json")
});

export const readPatternMemorySnapshotFromDisk = async (
  snapshotPath = SNAPSHOT_PATH
): Promise<PatternMemorySnapshot> => {
  const parsed = await readJson<PatternMemorySnapshot>(snapshotPath);
  return normalizePatternMemorySnapshot(parsed ?? buildSeedPatternMemorySnapshot());
};

export const writePatternMemorySnapshotToDisk = async (
  snapshot: PatternMemorySnapshot,
  snapshotPath = SNAPSHOT_PATH
): Promise<string> => {
  const normalized = normalizePatternMemorySnapshot(snapshot);
  await writeJson(snapshotPath, normalized);
  return snapshotPath;
};

export const appendPatternMemoryLedgerEvent = async (
  event: PatternMemoryLedgerEvent,
  ledgerPath = path.join(ROOT_DIR, "ledger.ndjson")
): Promise<string> => {
  await mkdir(path.dirname(ledgerPath), {recursive: true});
  await writeFile(ledgerPath, `${JSON.stringify(event)}\n`, {encoding: "utf-8", flag: "a"});
  return ledgerPath;
};

export const compactPatternMemorySnapshot = (
  snapshot: PatternMemorySnapshot
): PatternMemorySnapshot => {
  const normalized = normalizePatternMemorySnapshot(snapshot);
  const index = normalized.index;
  const compacted = {
    ...normalized,
    index
  };
  return {
    ...compacted,
    fingerprint: buildPatternMemoryFingerprint({
      version: compacted.version,
      generatedAt: compacted.generatedAt,
      rulesVersion: compacted.rulesVersion,
      entries: compacted.entries,
      index: compacted.index,
      notes: compacted.notes
    })
  };
};
