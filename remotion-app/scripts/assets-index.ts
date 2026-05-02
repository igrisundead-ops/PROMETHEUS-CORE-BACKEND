import {loadAssetPipelineConfig} from "../src/lib/assets/config";
import {indexUnifiedAssets} from "../src/lib/assets/indexing";

const run = async (): Promise<void> => {
  const config = loadAssetPipelineConfig();
  const result = await indexUnifiedAssets({
    config,
    forceFull: process.argv.includes("--full")
  });

  console.log(`Documents indexed: ${result.documentCount}`);
  console.log(`Runtime catalog assets: ${result.runtimeCatalogCount}`);
  console.log(`Embeddings generated: ${result.embeddedCount}`);
  console.log(`Milvus upserts: ${result.insertedCount}`);
  console.log(`Skipped unchanged: ${result.skippedCount}`);
  result.warnings.forEach((warning) => {
    console.log(`Warning: ${warning}`);
  });
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
