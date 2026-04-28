import {loadAssetPipelineConfig} from "../src/lib/assets/config";
import {scanUnifiedAssets} from "../src/lib/assets/indexing";

const run = async (): Promise<void> => {
  const config = loadAssetPipelineConfig();
  const result = await scanUnifiedAssets(config);

  console.log(`Discovered assets: ${result.stats.discoveredCount}`);
  console.log(`Static assets: ${result.stats.staticCount}`);
  console.log(`Motion assets: ${result.stats.motionCount}`);
  console.log(`Metadata-backed assets: ${result.stats.mappingBackedCount}`);
  console.log(`Filesystem-only assets: ${result.stats.orphanedCount}`);
  console.log(`Duplicate asset ids resolved: ${result.stats.duplicateIdCount}`);
  console.log(`Snapshot written to: ${config.ASSET_SCAN_SNAPSHOT_PATH}`);
  console.log(`Runtime catalog written to: ${config.ASSET_RUNTIME_CATALOG_PATH}`);
  result.warnings.forEach((warning) => {
    console.log(`Warning: ${warning}`);
  });
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
