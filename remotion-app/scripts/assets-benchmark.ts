import {execFile} from "node:child_process";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";

import {
  createEmbeddingProvider,
  type EmbeddingProviderKind,
  type LocalEmbeddingWorkerEvent
} from "../src/lib/embeddings/provider";
import {loadAssetPipelineConfig} from "../src/lib/assets/config";
import {buildCompactAssetEmbeddingText, estimateTextTokens} from "../src/lib/assets/embedding-text";
import {createMilvusAssetClient, ensureMilvusAssetCollection, searchMilvusAssetDocuments, upsertMilvusAssetDocuments} from "../src/lib/assets/milvus";
import type {AssetEmbeddingTextMode, NormalizedAssetDocument} from "../src/lib/assets/types";

const execFileAsync = promisify(execFile);

type BenchmarkBatchSummary = {
  batchNumber: number;
  assetCount: number;
  wallMs: number;
  encodeMs: number | null;
  workerMemoryMb: number | null;
};

type QuerySummary = {
  query: string;
  topIds: string[];
  topCaption: string;
  topDescription: string;
};

type BenchmarkSummary = {
  label: string;
  provider: EmbeddingProviderKind;
  model: string;
  dimensions: number;
  textMode: AssetEmbeddingTextMode;
  batchSize: number;
  assetCount: number;
  collection: string;
  averageChars: number;
  averageTokenEstimate: number;
  workerLaunchCount: number;
  workerReadyCount: number;
  workerProcessId: number | null;
  workerRuntime: string | null;
  workerMemoryPeakMb: number | null;
  startupMs: number | null;
  modelLoadMs: number | null;
  totalWallMs: number;
  embedWallMs: number;
  milvusPrepareMs: number;
  milvusInsertMs: number;
  averageEncodeMsPerAsset: number | null;
  averageWallMsPerAsset: number | null;
  perBatch: BenchmarkBatchSummary[];
  querySummaries: QuerySummary[];
  events: LocalEmbeddingWorkerEvent[];
};

const DEFAULT_QUERIES = [
  "premium editorial motion card for finance growth scene",
  "underlay halo accent for reflective quote opening",
  "clean background support for authority talking head",
  "headline text reveal typography for hook sentence",
  "timeline or step by step process animation"
];

const parseFlag = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
};

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

const sanitizeLabel = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const readCount = (flag: string, fallback: number): number => {
  const value = parseFlag(flag);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveScenario = (): {
  label: string;
  provider: EmbeddingProviderKind;
  model: string;
  dimensions: number;
  pythonBin: string;
  batchSize: number;
  assetCount: number;
  cleanup: boolean;
  collectionName: string;
  outputPath: string | null;
  skipMilvus: boolean;
  skipQueries: boolean;
  textMode: AssetEmbeddingTextMode;
} => {
  const providerFlag = (parseFlag("--provider") ?? "local-hf") as EmbeddingProviderKind;
  const batchSize = readCount("--batch-size", 16);
  const assetCount = readCount("--count", 25);
  const label = parseFlag("--label") ?? `${providerFlag}-${assetCount}-${batchSize}`;
  const collectionName = parseFlag("--collection") ?? `tmp_assets_bench_${sanitizeLabel(label)}`;
  const outputPath = parseFlag("--json-out");
  const config = loadAssetPipelineConfig();
  const textMode = (parseFlag("--text-mode") ?? config.ASSET_EMBEDDING_TEXT_MODE) as AssetEmbeddingTextMode;

  if (providerFlag === "bge-m3-local") {
    return {
      label,
      provider: providerFlag,
      model: parseFlag("--model") ?? config.BGE_M3_LOCAL_MODEL_NAME,
      dimensions: 1024,
      pythonBin: config.BGE_M3_LOCAL_PYTHON_BIN,
      batchSize,
      assetCount,
      cleanup: hasFlag("--cleanup"),
      collectionName,
      outputPath,
      skipMilvus: hasFlag("--skip-milvus"),
      skipQueries: hasFlag("--skip-queries"),
      textMode
    };
  }

  return {
    label,
    provider: providerFlag,
    model: parseFlag("--model") ?? config.LOCAL_EMBEDDING_MODEL_NAME,
    dimensions: Number.parseInt(parseFlag("--dimensions") ?? String(config.LOCAL_EMBEDDING_DIMENSIONS), 10) || 384,
    pythonBin: config.LOCAL_EMBEDDING_PYTHON_BIN,
    batchSize,
    assetCount,
    cleanup: hasFlag("--cleanup"),
    collectionName,
    outputPath,
    skipMilvus: hasFlag("--skip-milvus"),
    skipQueries: hasFlag("--skip-queries"),
    textMode
  };
};

const getProcessMemoryMb = async (pid: number | null): Promise<number | null> => {
  if (!pid) {
    return null;
  }

  try {
    const {stdout} = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      `(Get-Process -Id ${pid} | Select-Object -ExpandProperty WorkingSet64)`
    ]);
    const bytes = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(bytes) ? Number((bytes / (1024 * 1024)).toFixed(2)) : null;
  } catch {
    return null;
  }
};

const resolveDocumentEmbeddingText = (document: NormalizedAssetDocument, textMode: AssetEmbeddingTextMode): string => {
  if (textMode === "compact") {
    return buildCompactAssetEmbeddingText(document);
  }

  return document.embedding_text;
};

const main = async (): Promise<void> => {
  const scenario = resolveScenario();
  const config = loadAssetPipelineConfig({
    ASSET_MILVUS_ENABLED: "true",
    ASSET_EMBEDDING_PROVIDER: scenario.provider,
    ASSET_EMBEDDING_BATCH_SIZE: String(scenario.batchSize),
    ASSET_EMBEDDING_MODEL: scenario.provider === "openai" ? scenario.model : "",
    LOCAL_EMBEDDING_MODEL_NAME: scenario.provider === "local-hf" ? scenario.model : process.env.LOCAL_EMBEDDING_MODEL_NAME,
    LOCAL_EMBEDDING_DIMENSIONS: scenario.provider === "local-hf" ? String(scenario.dimensions) : process.env.LOCAL_EMBEDDING_DIMENSIONS,
    BGE_M3_LOCAL_MODEL_NAME: scenario.provider === "bge-m3-local" ? scenario.model : process.env.BGE_M3_LOCAL_MODEL_NAME,
    MILVUS_COLLECTION_ASSETS: scenario.collectionName,
    ASSET_EMBEDDING_TEXT_MODE: scenario.textMode
  });
  const useSnapshot = !hasFlag("--rescan");
  const workerEvents: LocalEmbeddingWorkerEvent[] = [];
  const provider = createEmbeddingProvider({
    provider: scenario.provider,
    model: scenario.model,
    dimensions: scenario.dimensions,
    pythonBin: scenario.pythonBin,
    useFp16: false,
    localBatchSize: scenario.batchSize,
    onLocalEvent: (event) => {
      workerEvents.push(event);
    }
  });
  const overallStartedAt = Date.now();
  let documents: NormalizedAssetDocument[];
  if (useSnapshot) {
    documents = JSON.parse(await readFile(config.ASSET_SCAN_SNAPSHOT_PATH, "utf8")) as NormalizedAssetDocument[];
  } else {
    const {scanUnifiedAssets} = await import("../src/lib/assets/indexing");
    const scanResult = await scanUnifiedAssets(config);
    documents = scanResult.documents;
  }
  const subset = documents.slice(0, scenario.assetCount).map((document) => {
    const embeddingText = resolveDocumentEmbeddingText(document, scenario.textMode);
    return {
      ...document,
      embedding_text: embeddingText,
      embedding_text_mode: scenario.textMode
    };
  });
  const embeddings = new Map<string, number[]>();
  const perBatch: BenchmarkBatchSummary[] = [];
  let workerMemoryPeakMb: number | null = null;
  const averageChars = subset.length > 0
    ? Number((subset.reduce((sum, document) => sum + document.embedding_text.length, 0) / subset.length).toFixed(2))
    : 0;
  const averageTokenEstimate = subset.length > 0
    ? Number((subset.reduce((sum, document) => sum + estimateTextTokens(document.embedding_text), 0) / subset.length).toFixed(2))
    : 0;

  console.log(
    `[assets:benchmark] label=${scenario.label} provider=${scenario.provider} model=${scenario.model} dims=${scenario.dimensions} ` +
    `count=${subset.length} batchSize=${scenario.batchSize} textMode=${scenario.textMode} avgChars=${averageChars} ` +
    `collection=${scenario.collectionName} source=${useSnapshot ? "snapshot" : "rescan"} ` +
    `skipMilvus=${scenario.skipMilvus} skipQueries=${scenario.skipQueries}`
  );

  const embedStartedAt = Date.now();
  try {
    for (let index = 0; index < subset.length; index += scenario.batchSize) {
      const batch = subset.slice(index, index + scenario.batchSize);
      const batchNumber = Math.floor(index / scenario.batchSize) + 1;
      const batchStartedAt = Date.now();
      const requestEventStart = workerEvents.length;
      const batchVectors = await provider.embedTexts(batch.map((document) => document.embedding_text));
      batch.forEach((document, offset) => {
        embeddings.set(document.asset_id, batchVectors[offset] ?? []);
      });

      const batchEvent = workerEvents.slice(requestEventStart).find((event) => event.kind === "request-complete") as
        | Extract<LocalEmbeddingWorkerEvent, {kind: "request-complete"}>
        | undefined;
      const readyEvent = workerEvents.find((event) => event.kind === "ready") as Extract<LocalEmbeddingWorkerEvent, {kind: "ready"}> | undefined;
      const workerMemoryMb = await getProcessMemoryMb(readyEvent?.processId ?? null);
      if (workerMemoryMb !== null) {
        workerMemoryPeakMb = workerMemoryPeakMb === null ? workerMemoryMb : Math.max(workerMemoryPeakMb, workerMemoryMb);
      }

      perBatch.push({
        batchNumber,
        assetCount: batch.length,
        wallMs: Date.now() - batchStartedAt,
        encodeMs: batchEvent?.timings.encodeMs ?? null,
        workerMemoryMb
      });
    }

    const embedWallMs = Date.now() - embedStartedAt;
    console.log(`[assets:benchmark] embedding complete in ${embedWallMs}ms.`);
    const client = createMilvusAssetClient(config);
    let milvusPrepareMs = 0;
    let milvusInsertMs = 0;
    if (!scenario.skipMilvus) {
      const milvusPrepareStartedAt = Date.now();
      console.log(`[assets:benchmark] preparing temporary collection ${scenario.collectionName}...`);
      await ensureMilvusAssetCollection({
        client,
        config,
        reset: true
      });
      milvusPrepareMs = Date.now() - milvusPrepareStartedAt;
      console.log(`[assets:benchmark] collection ready in ${milvusPrepareMs}ms.`);
      const milvusInsertStartedAt = Date.now();
      await upsertMilvusAssetDocuments({
        client,
        config,
        documents: subset,
        embeddings: subset.map((document) => embeddings.get(document.asset_id) ?? [])
      });
      milvusInsertMs = Date.now() - milvusInsertStartedAt;
      console.log(`[assets:benchmark] Milvus upsert complete in ${milvusInsertMs}ms.`);
    }

    const querySummaries: QuerySummary[] = [];
    if (!scenario.skipMilvus && !scenario.skipQueries) {
      console.log(`[assets:benchmark] running sample retrieval queries...`);
      for (const query of DEFAULT_QUERIES) {
        const [queryVector] = await provider.embedTexts([query]);
        const hits = await searchMilvusAssetDocuments({
          client,
          config,
          vector: queryVector ?? [],
          limit: 5
        });
        querySummaries.push({
          query,
          topIds: hits.slice(0, 3).map((hit) => String(hit.id)),
          topCaption: String(hits[0]?.retrieval_caption ?? ""),
          topDescription: String(hits[0]?.semantic_description ?? "")
        });
      }
    }

    if (!scenario.skipMilvus && scenario.cleanup) {
      await client.dropCollection({collection_name: scenario.collectionName});
    }

    const readyEvent = workerEvents.find((event) => event.kind === "ready") as Extract<LocalEmbeddingWorkerEvent, {kind: "ready"}> | undefined;
    const indexRequestEvents = workerEvents.filter((event) => event.kind === "request-complete").slice(0, perBatch.length) as Array<
      Extract<LocalEmbeddingWorkerEvent, {kind: "request-complete"}>
    >;
    const totalEncodeMs = indexRequestEvents.reduce((sum, event) => sum + (event.timings.encodeMs ?? 0), 0);
    const summary: BenchmarkSummary = {
      label: scenario.label,
      provider: scenario.provider,
      model: scenario.model,
      dimensions: scenario.dimensions,
      textMode: scenario.textMode,
      batchSize: scenario.batchSize,
      assetCount: subset.length,
      collection: scenario.collectionName,
      averageChars,
      averageTokenEstimate,
      workerLaunchCount: workerEvents.filter((event) => event.kind === "launch").length,
      workerReadyCount: workerEvents.filter((event) => event.kind === "ready").length,
      workerProcessId: readyEvent?.processId ?? null,
      workerRuntime: readyEvent?.runtime ?? null,
      workerMemoryPeakMb,
      startupMs: readyEvent?.timings.startupMs ?? null,
      modelLoadMs: readyEvent?.timings.modelLoadMs ?? null,
      totalWallMs: Date.now() - overallStartedAt,
      embedWallMs,
      milvusPrepareMs,
      milvusInsertMs,
      averageEncodeMsPerAsset: subset.length > 0 ? Number((totalEncodeMs / subset.length).toFixed(2)) : null,
      averageWallMsPerAsset: subset.length > 0 ? Number((embedWallMs / subset.length).toFixed(2)) : null,
      perBatch,
      querySummaries,
      events: workerEvents
    };

    if (scenario.outputPath) {
      const resolvedOutputPath = path.resolve(process.cwd(), scenario.outputPath);
      await mkdir(path.dirname(resolvedOutputPath), {recursive: true});
      await writeFile(resolvedOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
      console.log(`[assets:benchmark] wrote ${resolvedOutputPath}`);
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await provider.dispose?.();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
