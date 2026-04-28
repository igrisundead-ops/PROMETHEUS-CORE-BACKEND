import {writePatternMemorySnapshotToDisk} from "../src/lib/motion-platform/pattern-memory/pattern-store";
import {buildSeedPatternMemorySnapshot} from "../src/lib/motion-platform/pattern-memory/pattern-seeds";

const main = async (): Promise<void> => {
  const snapshot = buildSeedPatternMemorySnapshot(new Date().toISOString());
  const snapshotPath = await writePatternMemorySnapshotToDisk(snapshot);
  console.log(`Pattern memory snapshot written to ${snapshotPath}`);
  console.log(`Fingerprint: ${snapshot.fingerprint}`);
  console.log(`Entries: ${snapshot.entries.length}`);
};

main().catch((error) => {
  console.error("Failed to sync pattern memory snapshot:");
  console.error(error);
  process.exitCode = 1;
});
