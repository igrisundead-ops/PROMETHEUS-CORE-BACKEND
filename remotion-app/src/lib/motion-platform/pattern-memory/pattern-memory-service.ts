import type {PatternContext, PatternMemoryLedgerEvent, PatternMemorySnapshot, PatternUpdatePayload} from "./pattern-types";
import {appendPatternMemoryLedgerEvent, compactPatternMemorySnapshot, defaultPatternMemoryStorePaths, readPatternMemorySnapshotFromDisk, writePatternMemorySnapshotToDisk} from "./pattern-store";
import {buildPatternMemoryContext, getPatternMemoryFingerprintValue, getPatternMemorySnapshot, recordPatternMemoryOutcome, selectPatternMemory} from "./pattern-memory-hooks";

export type PatternMemoryServiceConfig = {
  snapshotPath?: string;
  ledgerPath?: string;
};

export class PatternMemoryService {
  private readonly snapshotPath: string;

  private readonly ledgerPath: string;

  constructor(config: PatternMemoryServiceConfig = {}) {
    const paths = defaultPatternMemoryStorePaths();
    this.snapshotPath = config.snapshotPath ?? paths.snapshotPath;
    this.ledgerPath = config.ledgerPath ?? paths.ledgerPath;
  }

  async loadSnapshot(): Promise<PatternMemorySnapshot> {
    return readPatternMemorySnapshotFromDisk(this.snapshotPath);
  }

  getDefaultSnapshot(): PatternMemorySnapshot {
    return getPatternMemorySnapshot();
  }

  getFingerprint(): string {
    return getPatternMemoryFingerprintValue();
  }

  async saveSnapshot(snapshot: PatternMemorySnapshot): Promise<string> {
    return writePatternMemorySnapshotToDisk(compactPatternMemorySnapshot(snapshot), this.snapshotPath);
  }

  async recordEvent(event: PatternMemoryLedgerEvent): Promise<string> {
    return appendPatternMemoryLedgerEvent(event, this.ledgerPath);
  }

  select(context: PatternContext, snapshot?: PatternMemorySnapshot) {
    return selectPatternMemory(context, snapshot ?? this.getDefaultSnapshot());
  }

  buildContext(input: Parameters<typeof buildPatternMemoryContext>[0]): PatternContext {
    return buildPatternMemoryContext(input);
  }

  async recordOutcome(payload: PatternUpdatePayload): Promise<PatternMemorySnapshot> {
    const snapshot = await this.loadSnapshot();
    const result = recordPatternMemoryOutcome(snapshot, payload);
    await this.saveSnapshot(result.snapshot);
    await this.recordEvent(result.ledgerEvent);
    return result.snapshot;
  }
}

export const createPatternMemoryService = (config?: PatternMemoryServiceConfig): PatternMemoryService => new PatternMemoryService(config);

export const getPatternMemoryServiceFingerprint = (): string => getPatternMemoryFingerprintValue();
