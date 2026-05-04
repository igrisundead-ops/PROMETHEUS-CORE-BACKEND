import {buildFontEmbeddings, buildGraphArtifacts, ingestFonts, loadFontPipelineConfig, readJsonlIfExists, runFontPipelineAll, summarizeWorkspace, upsertFontsToMilvus, type FontEmbeddingRecord} from "../src/lib/font-intelligence";

export const runFontIntelligenceCommand = async (command: string, args: string[] = process.argv.slice(3)): Promise<void> => {
  const config = loadFontPipelineConfig();
  const resetMilvus = args.includes("--reset");
  const dryRun = args.includes("--dry-run");

  if (command === "help") {
    console.log("Commands: ingest-fonts | embed-fonts | build-font-graph | font-pipeline-all | ingest-fonts-to-milvus");
    return;
  }

  if (command === "ingest-fonts") {
    const workspace = await summarizeWorkspace(config);
    console.log(`[font-intelligence] scanning ${workspace.zipCount} zip files from ${config.paths.sourceZipDir}`);
    const result = await ingestFonts(config);
    console.log(`[font-intelligence] canonical fonts: ${result.manifest.length}`);
    console.log(`[font-intelligence] descriptors: ${result.descriptors.length}`);
    console.log(`[font-intelligence] report: ${config.paths.fontIngestionReportPath}`);
    return;
  }

  if (command === "embed-fonts") {
    const embeddings = await buildFontEmbeddings(config);
    console.log(`[font-intelligence] embeddings ready: ${embeddings.length}`);
    console.log(`[font-intelligence] output: ${config.paths.fontEmbeddingsPath}`);
    return;
  }

  if (command === "build-font-graph") {
    const graph = await buildGraphArtifacts(config);
    console.log(`[font-intelligence] graph nodes: ${graph.nodes.length}`);
    console.log(`[font-intelligence] graph edges: ${graph.edges.length}`);
    console.log(`[font-intelligence] output: ${config.paths.fontCompatibilityGraphPath}`);
    return;
  }

  if (command === "font-pipeline-all") {
    const result = await runFontPipelineAll(config);
    console.log(`[font-intelligence] manifest: ${result.manifest.length}`);
    console.log(`[font-intelligence] embeddings: ${result.embeddings.length}`);
    console.log(`[font-intelligence] graph edges: ${result.graph.edges.length}`);
    return;
  }

  if (command === "ingest-fonts-to-milvus") {
    const embeddings = await readJsonlIfExists<FontEmbeddingRecord>(config.paths.fontEmbeddingsPath);
    if (embeddings.length === 0) {
      throw new Error(`No font embeddings found at ${config.paths.fontEmbeddingsPath}. Run embed-fonts first.`);
    }
    if (dryRun) {
      console.log(`[font-intelligence] dry-run: would upsert ${embeddings.length} font embeddings to ${config.FONT_INTELLIGENCE_MILVUS_COLLECTION}`);
      return;
    }
    const result = await upsertFontsToMilvus({
      config,
      embeddings,
      reset: resetMilvus
    });
    console.log(`[font-intelligence] upserted ${result.insertedCount} fonts into ${result.collectionName}`);
    return;
  }

  throw new Error(`Unknown font-intelligence command: ${command}`);
};

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("/font-intelligence-cli.ts");

if (isDirectRun) {
  const command = process.argv[2] ?? "help";
  runFontIntelligenceCommand(command).catch((error) => {
    console.error(`[font-intelligence] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
