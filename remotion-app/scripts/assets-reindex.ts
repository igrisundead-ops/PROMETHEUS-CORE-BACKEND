import {loadAssetPipelineConfig} from "../src/lib/assets/config";
import {indexUnifiedAssets} from "../src/lib/assets/indexing";

const run = async (): Promise<void> => {
  const config = loadAssetPipelineConfig({
    ASSET_REINDEX_MODE: "full"
  });
  const result = await indexUnifiedAssets({
    config,
    forceFull: true
  });

  console.log(`Full reindex complete for ${result.documentCount} documents.`);
  console.log(`Embeddings regenerated: ${result.embeddedCount}`);
  console.log(`Milvus upserts: ${result.insertedCount}`);
  result.warnings.forEach((warning) => {
    console.log(`Warning: ${warning}`);
  });
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
