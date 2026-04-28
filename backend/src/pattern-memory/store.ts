import {appendFile, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {sha256Text} from "../utils/hash";
import type {
  PatternContext,
  PatternMemoryEntry,
  PatternMemoryLedgerEvent,
  PatternMemorySnapshot,
  PatternMemoryStorePaths,
  PatternOutcome,
  PatternRecommendation,
  PatternUpdatePayload
} from "./pattern-types";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const REMOTION_DATA_DIR = path.join(WORKSPACE_ROOT, "remotion-app", "src", "data");
const SHARED_PATTERN_MEMORY_PATH = process.env.PATTERN_MEMORY_SNAPSHOT_PATH?.trim() || path.join(REMOTION_DATA_DIR, "pattern-memory.generated.json");
const ROOT_DIR = process.env.PATTERN_MEMORY_ROOT_DIR?.trim() || path.join(process.cwd(), "data", "pattern-memory");
const SNAPSHOT_MIRROR_PATH = process.env.PATTERN_MEMORY_MIRROR_PATH?.trim() || path.join(ROOT_DIR, "pattern-memory.snapshot.json");
const LEDGER_PATH = process.env.PATTERN_MEMORY_LEDGER_PATH?.trim() || path.join(ROOT_DIR, "pattern-memory.ledger.ndjson");
const INDEX_PATH = process.env.PATTERN_MEMORY_INDEX_PATH?.trim() || path.join(ROOT_DIR, "pattern-memory.index.json");

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const normalizeEntry = (entry: PatternMemoryEntry): PatternMemoryEntry => ({
  ...entry,
  tagSet: unique(entry.tagSet),
  effectStack: unique(entry.effectStack),
  compatibleWith: unique(entry.compatibleWith),
  sourceVideoId: entry.sourceVideoId ?? null,
  lastUsedAt: entry.lastUsedAt ?? null
});

const emptyIndex = (): PatternMemorySnapshot["index"] => ({
  byId: {},
  bySemanticIntent: {},
  bySceneType: {},
  byEffectId: {},
  byAssetId: {},
  byTag: {},
  bySourceVideoId: {}
});

const buildIndex = (entries: PatternMemoryEntry[]): PatternMemorySnapshot["index"] => {
  const index = emptyIndex();
  entries.forEach((entry, position) => {
    index.byId[entry.id] = position;
    const add = (bucket: Record<string, string[]>, key: string, value: string): void => {
      const normalizedKey = key.trim().toLowerCase();
      if (!normalizedKey) {
        return;
      }
      const current = bucket[normalizedKey] ?? [];
      if (!current.includes(value)) {
        bucket[normalizedKey] = [...current, value];
      }
    };

    add(index.bySemanticIntent, entry.semanticIntent, entry.id);
    add(index.bySceneType, entry.sceneType, entry.id);
    entry.effectStack.forEach((effectId) => add(index.byEffectId, effectId, entry.id));
    entry.compatibleWith.forEach((assetId) => add(index.byAssetId, assetId, entry.id));
    entry.tagSet.forEach((tag) => add(index.byTag, tag, entry.id));
    if (entry.sourceVideoId) {
      add(index.bySourceVideoId, entry.sourceVideoId, entry.id);
    }
  });
  return index;
};

const computeFingerprint = (snapshot: Omit<PatternMemorySnapshot, "fingerprint">): string => {
  const material = JSON.stringify({
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    rulesVersion: snapshot.rulesVersion,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      lastUsedAt: entry.lastUsedAt ?? null,
      sourceVideoId: entry.sourceVideoId ?? null
    })),
    index: snapshot.index,
    notes: snapshot.notes
  });
  return `pm-${sha256Text(material).slice(0, 12)}`;
};

const normalizeSnapshot = (snapshot: Partial<PatternMemorySnapshot> | null | undefined): PatternMemorySnapshot => {
  const entries = (snapshot?.entries ?? []).map(normalizeEntry);
  const base = {
    version: snapshot?.version ?? "2026-04-15-pattern-memory-v1",
    generatedAt: snapshot?.generatedAt ?? new Date().toISOString(),
    rulesVersion: snapshot?.rulesVersion ?? "2026-04-15-pattern-rules-v1",
    entries,
    index: snapshot?.index ?? buildIndex(entries),
    notes: unique(snapshot?.notes ?? [])
  };

  return {
    ...base,
    fingerprint: snapshot?.fingerprint?.trim() || computeFingerprint(base)
  };
};

const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const buildEmptySnapshot = (): PatternMemorySnapshot => normalizeSnapshot({
  version: "2026-04-15-pattern-memory-v1",
  generatedAt: new Date().toISOString(),
  rulesVersion: "2026-04-15-pattern-rules-v1",
  entries: [],
  index: emptyIndex(),
  notes: [
    "Backend mirror will use the shared Remotion pattern-memory snapshot when available."
  ]
});

export const defaultPatternMemoryStorePaths = (): PatternMemoryStorePaths => ({
  rootDir: ROOT_DIR,
  ledgerPath: LEDGER_PATH,
  snapshotPath: SHARED_PATTERN_MEMORY_PATH,
  mirrorSnapshotPath: SNAPSHOT_MIRROR_PATH,
  indexPath: INDEX_PATH
});

const resolveSnapshotCandidates = (paths: PatternMemoryStorePaths): string[] => [
  paths.snapshotPath,
  paths.mirrorSnapshotPath
];

export const readPatternMemorySnapshotFromDisk = async (
  snapshotPath = SHARED_PATTERN_MEMORY_PATH,
  mirrorSnapshotPath = SNAPSHOT_MIRROR_PATH
): Promise<PatternMemorySnapshot> => {
  const candidates = [snapshotPath, mirrorSnapshotPath];
  for (const candidate of candidates) {
    const parsed = await readJson<Partial<PatternMemorySnapshot>>(candidate);
    if (parsed) {
      return normalizeSnapshot(parsed);
    }
  }
  return buildEmptySnapshot();
};

export const writePatternMemorySnapshotToDisk = async (
  snapshot: PatternMemorySnapshot,
  snapshotPath = SHARED_PATTERN_MEMORY_PATH,
  mirrorSnapshotPath = SNAPSHOT_MIRROR_PATH,
  indexPath = INDEX_PATH
): Promise<string> => {
  const normalized = normalizeSnapshot(snapshot);
  await Promise.all([
    writeJson(snapshotPath, normalized),
    writeJson(mirrorSnapshotPath, normalized),
    writeJson(indexPath, normalized.index)
  ]);
  return snapshotPath;
};

export const appendPatternMemoryLedgerEvent = async (
  event: PatternMemoryLedgerEvent,
  ledgerPath = LEDGER_PATH
): Promise<string> => {
  await mkdir(path.dirname(ledgerPath), {recursive: true});
  await appendFile(ledgerPath, `${JSON.stringify(event)}\n`, "utf-8");
  return ledgerPath;
};

export const compactPatternMemorySnapshot = (
  snapshot: PatternMemorySnapshot
): PatternMemorySnapshot => {
  const normalized = normalizeSnapshot(snapshot);
  const compacted = {
    ...normalized,
    index: buildIndex(normalized.entries)
  };
  return {
    ...compacted,
    fingerprint: computeFingerprint(compacted)
  };
};

const determineEventType = (outcome: PatternOutcome, humanApproved: boolean): PatternMemoryLedgerEvent["type"] => {
  if (outcome === "deprecated") {
    return "deprecate";
  }
  if (outcome === "blocked" || outcome === "rejected") {
    return "reject";
  }
  if (humanApproved) {
    return "reinforce";
  }
  if (outcome === "success") {
    return "apply";
  }
  return "update";
};

const applyOutcomeToEntry = (
  entry: PatternMemoryEntry,
  payload: PatternUpdatePayload
): PatternMemoryEntry => {
  const successDelta = payload.outcome === "success"
    ? 0.08
    : payload.outcome === "partial-success"
      ? 0.03
      : payload.outcome === "blocked" || payload.outcome === "rejected"
        ? -0.08
        : payload.outcome === "deprecated"
          ? -0.15
          : -0.02;
  const failureDelta = payload.outcome === "blocked" || payload.outcome === "rejected" ? 1 : payload.outcome === "deprecated" ? 2 : 0;
  const reuseDelta = payload.outcome === "success" || payload.outcome === "partial-success" ? 1 : 0;
  const confidenceBoost = payload.humanApproved ? 0.1 : 0;

  return normalizeEntry({
    ...entry,
    successScore: Math.max(0, Math.min(1, Math.round((entry.successScore + successDelta) * 1000) / 1000)),
    confidenceScore: Math.max(0, Math.min(1, Math.round((entry.confidenceScore + confidenceBoost + (payload.outcome === "blocked" ? -0.06 : 0)) * 1000) / 1000)),
    reuseCount: entry.reuseCount + reuseDelta,
    failureCount: entry.failureCount + failureDelta,
    lastUsedAt: payload.context.sourceVideoHash ?? payload.context.sourceVideoId ?? payload.context.videoId ?? entry.lastUsedAt ?? null,
    sourceVideoId: payload.context.sourceVideoId ?? payload.context.videoId ?? entry.sourceVideoId ?? null,
    active: payload.outcome === "deprecated" ? false : entry.active,
    notes: payload.notes ? `${entry.notes ?? ""} | ${payload.notes}`.trim() : entry.notes
  });
};

export const applyPatternMemoryUpdate = (
  snapshot: PatternMemorySnapshot,
  payload: PatternUpdatePayload
): {
  snapshot: PatternMemorySnapshot;
  updatedEntry: PatternMemoryEntry | null;
  event: PatternMemoryLedgerEvent;
} => {
  const currentIndex = snapshot.entries.findIndex((entry) => entry.id === payload.patternId);
  const updatedEntry = currentIndex >= 0 ? applyOutcomeToEntry(snapshot.entries[currentIndex], payload) : null;
  const entries = currentIndex >= 0
    ? snapshot.entries.map((entry, index) => (index === currentIndex ? updatedEntry! : entry))
    : snapshot.entries;
  const nextSnapshot = compactPatternMemorySnapshot({
    ...snapshot,
    generatedAt: new Date().toISOString(),
    entries
  });
  return {
    snapshot: nextSnapshot,
    updatedEntry,
    event: {
      id: `ledger-${payload.patternId}-${Date.now().toString(36)}`,
      type: determineEventType(payload.outcome, Boolean(payload.humanApproved)),
      at: new Date().toISOString(),
      patternId: payload.patternId,
      context: payload.context,
      outcome: payload.outcome,
      reasons: unique([
        payload.rejectedReason,
        payload.notes,
        payload.outcome
      ]),
      recommendation: null,
      constraint: null,
      humanApproved: Boolean(payload.humanApproved),
      beforeFingerprint: snapshot.fingerprint,
      afterFingerprint: nextSnapshot.fingerprint,
      notes: payload.notes
    }
  };
};

export const recordPatternMemoryOutcome = async (
  payload: PatternUpdatePayload,
  paths: PatternMemoryStorePaths = defaultPatternMemoryStorePaths()
): Promise<{
  snapshot: PatternMemorySnapshot;
  ledgerEvent: PatternMemoryLedgerEvent;
  updatedEntry: PatternMemoryEntry | null;
}> => {
  const snapshot = await readPatternMemorySnapshotFromDisk(paths.snapshotPath, paths.mirrorSnapshotPath);
  const result = applyPatternMemoryUpdate(snapshot, payload);
  await writePatternMemorySnapshotToDisk(result.snapshot, paths.snapshotPath, paths.mirrorSnapshotPath, paths.indexPath);
  await appendPatternMemoryLedgerEvent(result.event, paths.ledgerPath);
  return {
    snapshot: result.snapshot,
    ledgerEvent: result.event,
    updatedEntry: result.updatedEntry
  };
};

export const readPatternMemoryState = async (
  paths: PatternMemoryStorePaths = defaultPatternMemoryStorePaths()
): Promise<{
  snapshot: PatternMemorySnapshot;
  ledger: PatternMemoryLedgerEvent[];
  paths: PatternMemoryStorePaths;
}> => {
  const [snapshot, ledgerContents] = await Promise.all([
    readPatternMemorySnapshotFromDisk(paths.snapshotPath, paths.mirrorSnapshotPath),
    readFile(paths.ledgerPath, "utf-8").catch(() => "")
  ]);
  const ledger = ledgerContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as PatternMemoryLedgerEvent;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is PatternMemoryLedgerEvent => Boolean(entry));

  return {
    snapshot,
    ledger,
    paths
  };
};

export const buildPatternMemorySummary = (snapshot: PatternMemorySnapshot): import("./pattern-types").PatternMemorySummary => {
  const topEntries = snapshot.entries
    .filter((entry) => entry.active)
    .sort((left, right) => right.successScore - left.successScore || right.confidenceScore - left.confidenceScore || left.id.localeCompare(right.id))
    .slice(0, 8);

  return {
    fingerprint: snapshot.fingerprint,
    version: snapshot.version,
    rulesVersion: snapshot.rulesVersion,
    active_entries: snapshot.entries.filter((entry) => entry.active).length,
    top_patterns: topEntries.map((entry) => ({
      id: entry.id,
      semantic_intent: entry.semanticIntent,
      scene_type: entry.sceneType,
      success_score: entry.successScore,
      confidence_score: entry.confidenceScore
    }))
  };
};

export const buildPatternMemorySignalTerms = (snapshot: PatternMemorySnapshot): string[] => {
  const topEntries = snapshot.entries
    .filter((entry) => entry.active)
    .sort((left, right) => right.successScore - left.successScore || right.confidenceScore - left.confidenceScore || left.id.localeCompare(right.id))
    .slice(0, 8);

  return unique([
    snapshot.version,
    snapshot.rulesVersion,
    ...topEntries.flatMap((entry) => [
      entry.id,
      entry.semanticIntent,
      entry.sceneType,
      ...entry.tagSet,
      ...entry.effectStack,
      ...entry.compatibleWith
    ])
  ]);
};
