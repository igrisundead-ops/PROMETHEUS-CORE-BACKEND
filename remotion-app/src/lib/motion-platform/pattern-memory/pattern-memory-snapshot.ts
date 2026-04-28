import importedPatternMemorySnapshot from "../../../data/pattern-memory.generated.json" with {type: "json"};

import {
  buildPatternMemoryFingerprint,
  buildPatternMemoryIndex,
  buildSeedPatternMemorySnapshot,
  DEFAULT_PATTERN_MEMORY_RULES_VERSION,
  DEFAULT_PATTERN_MEMORY_VERSION
} from "./pattern-seeds";
import type {PatternMemoryEntry, PatternMemorySnapshot} from "./pattern-types";

type ImportedPatternMemorySnapshot = Partial<PatternMemorySnapshot> & {
  entries?: PatternMemoryEntry[];
};

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const normalizeEntry = (entry: PatternMemoryEntry): PatternMemoryEntry => ({
  ...entry,
  triggerContext: unique(entry.triggerContext),
  effectStack: unique(entry.effectStack),
  animationStyle: unique(entry.animationStyle),
  compatibilityRules: unique(entry.compatibilityRules),
  antiPatterns: unique(entry.antiPatterns),
  compatibleWith: unique(entry.compatibleWith),
  assetRefs: unique(entry.assetRefs),
  tagSet: unique(entry.tagSet)
});

export const normalizePatternMemorySnapshot = (
  snapshot: Partial<PatternMemorySnapshot> | null | undefined
): PatternMemorySnapshot => {
  const normalizedEntries = (snapshot?.entries ?? []).map(normalizeEntry);
  const shouldSeed = normalizedEntries.length === 0;
  const seededSnapshot = shouldSeed ? buildSeedPatternMemorySnapshot(snapshot?.generatedAt ?? new Date().toISOString()) : null;
  const entries = shouldSeed ? seededSnapshot?.entries ?? [] : normalizedEntries;
  const index = snapshot?.index ?? buildPatternMemoryIndex(entries);
  const base = {
    version: snapshot?.version ?? DEFAULT_PATTERN_MEMORY_VERSION,
    generatedAt: snapshot?.generatedAt ?? new Date().toISOString(),
    rulesVersion: snapshot?.rulesVersion ?? DEFAULT_PATTERN_MEMORY_RULES_VERSION,
    entries,
    index,
    notes: unique([
      ...(snapshot?.notes ?? []),
      ...(seededSnapshot?.notes ?? [])
    ])
  };

  return {
    ...base,
    fingerprint: snapshot?.fingerprint?.trim() || buildPatternMemoryFingerprint(base)
  };
};

export const defaultPatternMemorySnapshot = normalizePatternMemorySnapshot(
  importedPatternMemorySnapshot as ImportedPatternMemorySnapshot
);

export const getPatternMemoryFingerprint = (): string => defaultPatternMemorySnapshot.fingerprint;
export const getPatternMemoryEntries = (): PatternMemoryEntry[] => [...defaultPatternMemorySnapshot.entries];
export const getPatternMemoryIndex = (): PatternMemorySnapshot["index"] => defaultPatternMemorySnapshot.index;
