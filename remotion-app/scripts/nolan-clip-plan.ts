import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import path from "node:path";

import type {IngestManifest} from "../src/lib/ingest-manifest";
import {
  buildNolanClipPlan,
  DEFAULT_NOLAN_CLIP_ENGINE_SETTINGS,
  type NolanClipEngineSettings,
  type NolanClipPlan
} from "../src/lib/nolan-clip-engine";
import type {CaptionChunk, VideoMetadata} from "../src/lib/types";

type PlanCliArgs = {
  captionsPath: string;
  videoMetadataPath: string;
  ingestManifestPath: string | null;
  sourceVideoPath: string | null;
  referenceScriptPath: string | null;
  outputPath: string;
  settings: Partial<NolanClipEngineSettings>;
};

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "data");

const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const readTextIfExists = async (filePath: string | null): Promise<string | null> => {
  if (!filePath) {
    return null;
  }

  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const parseNumberArg = (value: string | undefined, flag: string): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number.`);
  }
  return parsed;
};

const parseArgs = (): PlanCliArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  return {
    captionsPath: path.resolve(readArgValue("--captions") ?? path.join(DATA_DIR, "captions.longform.json")),
    videoMetadataPath: path.resolve(readArgValue("--video-metadata") ?? path.join(DATA_DIR, "video.longform.metadata.json")),
    ingestManifestPath: readArgValue("--ingest-manifest")
      ? path.resolve(readArgValue("--ingest-manifest") as string)
      : path.join(DATA_DIR, "ingest.longform.json"),
    sourceVideoPath: readArgValue("--video")
      ? path.resolve(readArgValue("--video") as string)
      : null,
    referenceScriptPath: readArgValue("--reference-script")
      ? path.resolve(readArgValue("--reference-script") as string)
      : path.join(DATA_DIR, "nolan.reference-script.txt"),
    outputPath: path.resolve(readArgValue("--out") ?? path.join(DATA_DIR, "nolan-clips.longform.json")),
    settings: {
      minClipSeconds: parseNumberArg(readArgValue("--min-seconds"), "--min-seconds"),
      maxClipSeconds: parseNumberArg(readArgValue("--max-seconds"), "--max-seconds"),
      targetClipSeconds: parseNumberArg(readArgValue("--target-seconds"), "--target-seconds"),
      maxCandidates: parseNumberArg(readArgValue("--max-candidates"), "--max-candidates"),
      pageSize: parseNumberArg(readArgValue("--page-size"), "--page-size")
    }
  };
};

const main = async (): Promise<void> => {
  const cliArgs = parseArgs();
  await stat(cliArgs.captionsPath);
  await stat(cliArgs.videoMetadataPath);

  const [captions, videoMetadata, referenceScriptText] = await Promise.all([
    readJsonFile<CaptionChunk[]>(cliArgs.captionsPath),
    readJsonFile<VideoMetadata>(cliArgs.videoMetadataPath),
    readTextIfExists(cliArgs.referenceScriptPath)
  ]);
  const ingestManifest = cliArgs.ingestManifestPath
    ? await readJsonFile<IngestManifest>(cliArgs.ingestManifestPath).catch(() => null)
    : null;
  const resolvedSourceVideoPath = cliArgs.sourceVideoPath
    ?? ingestManifest?.sourceVideoPath
    ?? null;
  const plan: NolanClipPlan = buildNolanClipPlan({
    chunks: captions,
    videoMetadata,
    sourceVideoPath: resolvedSourceVideoPath,
    sourceVideoHash: ingestManifest?.sourceVideoHash ?? null,
    sourceCaptionPath: cliArgs.captionsPath,
    referenceScriptText,
    referenceScriptPath: referenceScriptText ? cliArgs.referenceScriptPath : null,
    settings: cliArgs.settings
  });

  await writeJson(cliArgs.outputPath, plan);

  console.log(`Nolan engine: ${plan.engineId} v${plan.version}`);
  console.log(`Source captions: ${cliArgs.captionsPath}`);
  console.log(`Clip range: ${plan.settings.minClipSeconds}-${plan.settings.maxClipSeconds}s (target ${plan.settings.targetClipSeconds}s)`);
  console.log(`Candidates: ${plan.summary.candidateCount}`);
  console.log(`Pages: ${plan.summary.pageCount} @ ${plan.settings.pageSize} per page`);
  console.log(`Recommended: ${JSON.stringify(plan.summary.recommendedClipIds)}`);
  console.log(
    `Reference script: ${plan.referenceScript.provided
      ? `${plan.referenceScript.sourcePath} (${plan.referenceScript.sectionCount} sections)`
      : "none"}`
  );
  console.log(`Wrote: ${cliArgs.outputPath}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
