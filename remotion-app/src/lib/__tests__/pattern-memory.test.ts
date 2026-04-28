import {mkdtemp, readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {PatternMemoryService} from "../motion-platform/pattern-memory/pattern-memory-service";
import {buildSeedPatternMemorySnapshot} from "../motion-platform/pattern-memory/pattern-seeds";
import {evaluatePatternMemoryConstraints, selectPatternMemory} from "../motion-platform/pattern-memory/pattern-memory-hooks";
import {retrievePatternMatches} from "../motion-platform/pattern-memory/pattern-retrieval";
import {buildPatternMemoryContext} from "../motion-platform/pattern-memory/pattern-memory-hooks";
import type {PatternMemoryEntry} from "../motion-platform/pattern-memory/pattern-types";

const buildCounterHistory = (): PatternMemoryEntry[] => [
  {
    ...buildSeedPatternMemorySnapshot().entries.find((entry) => entry.semanticIntent === "numeric-emphasis" || entry.semanticIntent === "counter")!,
    id: "pattern:counter-history",
    sourceVideoId: "video-history",
    lastUsedAt: new Date().toISOString()
  }
];

describe("Pattern Memory Engine", () => {
  it("retrieves comparison and restraint patterns from scene context", () => {
    const snapshot = buildSeedPatternMemorySnapshot();

    const comparisonContext = buildPatternMemoryContext({
      prompt: "this versus that decision",
      chunkText: "This versus that decision",
      semanticIntent: "comparison",
      secondaryIntents: [],
      sceneType: "comparison",
      detectedMomentType: "contrast",
      semanticRole: "primary",
      visualDensity: 0.34,
      captionDensity: 0.28,
      speakerDominance: 0.6,
      motionTier: "editorial",
      activeEffectIds: [],
      activeAssetIds: [],
      activeTagIds: [],
      assetTags: [],
      momentTags: [],
      semanticSignals: ["comparison", "contrast"],
      minuteBucket: 0,
      timelinePositionMs: 4200,
      timelineWindowMs: 1200,
      importance: 0.82,
      hasPause: true,
      isDenseScene: false,
      isLongForm: true
    });
    const comparisonMatches = retrievePatternMatches(snapshot, comparisonContext, {limit: 10, includeBlocked: true});

    const restraintContext = buildPatternMemoryContext({
      prompt: "the scene is busy and should be restrained",
      chunkText: "too many overlays already",
      semanticIntent: "highlight",
      secondaryIntents: [],
      sceneType: "feature-highlight",
      detectedMomentType: "highlight",
      semanticRole: "primary",
      visualDensity: 0.86,
      captionDensity: 0.83,
      speakerDominance: 0.42,
      motionTier: "editorial",
      activeEffectIds: ["primitive:highlight-word", "primitive:circle-reveal"],
      activeAssetIds: ["asset:busy-overlay"],
      activeTagIds: ["busy", "overlay"],
      assetTags: ["busy", "overlay"],
      momentTags: ["dense"],
      semanticSignals: ["density", "restraint"],
      minuteBucket: 4,
      timelinePositionMs: 240000,
      timelineWindowMs: 1800,
      importance: 0.92,
      hasPause: false,
      isDenseScene: true,
      isLongForm: true
    });
    const restraintSelection = selectPatternMemory(restraintContext, snapshot);

    expect(comparisonMatches.some((match) => match.entry.semanticIntent === "comparison")).toBe(true);
    expect(restraintSelection.bestMatch?.entry.semanticIntent).toBe("restraint-needed");
    expect(restraintSelection.bestMatch?.constraint.allowed).toBe(true);
  });

  it("blocks redundant numeric emphasis when the pattern budget is already used", () => {
    const snapshot = buildSeedPatternMemorySnapshot();
    const numericEntry = snapshot.entries.find((entry) => entry.semanticIntent === "numeric-emphasis" || entry.semanticIntent === "counter");
    expect(numericEntry).toBeTruthy();
    const context = buildPatternMemoryContext({
      prompt: "over the last 12 months",
      chunkText: "over the last 12 months",
      semanticIntent: "numeric-emphasis",
      secondaryIntents: [],
      sceneType: "stat",
      detectedMomentType: "counter",
      semanticRole: "primary",
      visualDensity: 0.32,
      captionDensity: 0.28,
      speakerDominance: 0.52,
      motionTier: "editorial",
      activeEffectIds: ["primitive:blur-underline"],
      activeAssetIds: ["asset:number-counter"],
      activeTagIds: ["counter", "numeric"],
      assetTags: ["counter", "numeric"],
      momentTags: ["numeric"],
      semanticSignals: ["numeric-emphasis"],
      minuteBucket: 2,
      timelinePositionMs: 64000,
      timelineWindowMs: 1400,
      importance: 0.88,
      hasPause: true,
      isDenseScene: false,
      isLongForm: true
    });
    const decision = evaluatePatternMemoryConstraints(numericEntry!, context, buildCounterHistory());

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toEqual(expect.arrayContaining(["duplicate-semantic-emphasis", "redundancy"]));
  });

  it("reinforces successful outcomes and appends a ledger event", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "pattern-memory-service-"));
    const snapshotPath = path.join(tempDir, "snapshot.json");
    const mirrorSnapshotPath = path.join(tempDir, "mirror.json");
    const ledgerPath = path.join(tempDir, "ledger.ndjson");
    const indexPath = path.join(tempDir, "index.json");
    const service = new PatternMemoryService({
      snapshotPath,
      ledgerPath
    });

    await service.saveSnapshot(buildSeedPatternMemorySnapshot("2026-04-15T00:00:00.000Z"));
    const before = await service.loadSnapshot();
    const result = await service.recordOutcome({
      patternId: "pattern:comparison-side-by-side",
        context: {
          jobId: "job-test",
          videoId: "video-test",
          sourceVideoId: "source-video",
          semanticIntent: "comparison",
          secondaryIntents: [],
          sceneType: "comparison",
        detectedMomentType: "contrast",
        semanticRole: "primary",
        visualDensity: 0.34,
        captionDensity: 0.28,
        speakerDominance: 0.6,
        motionTier: "editorial",
        activeEffectIds: ["primitive:highlight-word"],
        activeAssetIds: ["asset:comparison-card"],
        activeTagIds: ["comparison"],
        assetTags: ["comparison"],
        momentTags: ["comparison"],
        semanticSignals: ["comparison"],
        minuteBucket: 0,
        timelinePositionMs: 0,
        timelineWindowMs: 1200,
        importance: 0.82,
        hasPause: true,
        isDenseScene: false,
        isLongForm: true
      },
      outcome: "success",
      humanApproved: true,
      notes: "Approved comparison beat"
    });
    const after = await service.loadSnapshot();
    const ledger = await readFile(ledgerPath, "utf-8");

    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(result.entries.length).toBe(after.entries.length);
    expect(after.entries.find((entry) => entry.id === "pattern:comparison-side-by-side")?.successScore).toBeGreaterThan(
      before.entries.find((entry) => entry.id === "pattern:comparison-side-by-side")?.successScore ?? 0
    );
    expect(ledger).toContain("pattern:comparison-side-by-side");
    expect(await service.saveSnapshot(after)).toBe(snapshotPath);
    void mirrorSnapshotPath;
    void indexPath;
  });
});
