import {mkdtemp, readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {
  buildPatternMemorySignalTerms,
  buildPatternMemorySummary,
  readPatternMemorySnapshot,
  readPatternMemorySnapshotFromDisk,
  recordPatternMemoryOutcome,
  writePatternMemorySnapshotToDisk
} from "../pattern-memory";

const makeStorePaths = async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "backend-pattern-memory-"));
  return {
    rootDir: tempDir,
    snapshotPath: path.join(tempDir, "shared.json"),
    mirrorSnapshotPath: path.join(tempDir, "mirror.json"),
    ledgerPath: path.join(tempDir, "ledger.ndjson"),
    indexPath: path.join(tempDir, "index.json")
  };
};

describe("backend pattern memory", () => {
  it("writes a snapshot, appends ledger history, and refreshes summary signals", async () => {
    const paths = await makeStorePaths();
    const initialSnapshot = {
      version: "2026-04-15-pattern-memory-v1",
      generatedAt: "2026-04-15T00:00:00.000Z",
      fingerprint: "pm-test",
      rulesVersion: "2026-04-15-pattern-rules-v1",
      entries: [
        {
          id: "pattern:comparison-side-by-side",
          semanticIntent: "comparison",
          sceneType: "comparison",
          tagSet: ["comparison", "contrast", "dual-concept"],
          effectStack: ["primitive:highlight-word"],
          compatibleWith: ["primitive:highlight-word"],
          successScore: 0.84,
          confidenceScore: 0.9,
          reuseCount: 1,
          failureCount: 0,
          active: true,
          notes: "seed"
        }
      ],
      index: {
        byId: { "pattern:comparison-side-by-side": 0 },
        bySemanticIntent: { comparison: ["pattern:comparison-side-by-side"] },
        bySceneType: { comparison: ["pattern:comparison-side-by-side"] },
        byEffectId: { "primitive:highlight-word": ["pattern:comparison-side-by-side"] },
        byAssetId: {},
        byTag: { comparison: ["pattern:comparison-side-by-side"] },
        bySourceVideoId: {}
      },
      notes: ["seed snapshot"]
    };

    await writePatternMemorySnapshotToDisk(initialSnapshot, paths.snapshotPath, paths.mirrorSnapshotPath, paths.indexPath);
    const before = await readPatternMemorySnapshotFromDisk(paths.snapshotPath, paths.mirrorSnapshotPath);

    const result = await recordPatternMemoryOutcome(
      {
        patternId: "pattern:comparison-side-by-side",
        context: {
          jobId: "job-1",
          videoId: "video-1",
          sourceVideoId: "source-1",
          semanticIntent: "comparison",
          sceneType: "comparison",
          detectedMomentType: "contrast",
          semanticRole: "primary",
          visualDensity: 0.36,
          captionDensity: 0.28,
          speakerDominance: 0.62,
          motionTier: "editorial",
          activeEffectIds: ["primitive:highlight-word"],
          activeAssetIds: ["asset-1"],
          activeTagIds: ["comparison"],
          assetTags: ["comparison"],
          momentTags: ["contrast"],
          semanticSignals: ["comparison"],
          minuteBucket: 0,
          timelinePositionMs: 0,
          timelineWindowMs: 1200,
          importance: 0.84,
          hasPause: true,
          isDenseScene: false,
          isLongForm: true
        },
        outcome: "success",
        humanApproved: true,
        notes: "backend approved"
      },
      paths
    );
    const after = await readPatternMemorySnapshot(paths.snapshotPath, paths.mirrorSnapshotPath);
    const ledger = await readFile(paths.ledgerPath, "utf-8");

    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(result.ledgerEvent.patternId).toBe("pattern:comparison-side-by-side");
    expect(result.snapshot.entries[0].successScore).toBeGreaterThan(before.entries[0].successScore);
    expect(ledger).toContain("backend approved");
    expect(buildPatternMemorySummary(after).active_entries).toBe(1);
    expect(buildPatternMemorySignalTerms(after)).toEqual(expect.arrayContaining(["comparison", "contrast", "dual-concept"]));
  });
});
