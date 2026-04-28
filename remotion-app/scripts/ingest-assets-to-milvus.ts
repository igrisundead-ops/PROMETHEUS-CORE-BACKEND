import {ingestAssetsToMilvus, loadVectorConfig} from "../src/lib/vector";

const main = async (): Promise<void> => {
  const dryRun = process.argv.includes("--dry-run");
  const config = loadVectorConfig();
  const report = await ingestAssetsToMilvus({
    config,
    dryRun
  });

  process.stdout.write(
    [
      `Indexed static assets: ${report.totalStaticAssets}`,
      `Indexed motion graphics: ${report.totalMotionGraphics}`,
      `Indexed GSAP modules: ${report.totalGsapModules}`,
      `Indexed typography assets: ${report.totalTypographyAssets}`,
      `Indexed reference assets: ${report.totalReferenceAssets}`,
      `Report: ${config.VECTOR_REPORT_PATH}`,
      dryRun ? "Mode: dry-run" : "Mode: Milvus write"
    ].join("\n") + "\n"
  );
};

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
