import {spawn} from "node:child_process";
import {createReadStream} from "node:fs";
import {mkdir, open, readFile, rename, rm, stat, writeFile, type FileHandle} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {IngestManifest} from "../src/lib/ingest-manifest";
// @ts-ignore Native Vite config loading needs the explicit extension for this Node-only import path.
import {isIngestManifestReady} from "../src/lib/ingest-manifest.ts";
// @ts-ignore Native config loading needs the explicit extension for this Node-only import path.
import {sha256Text} from "../src/lib/hash.ts";
import {
  buildMasterRenderSettingsFingerprint,
  getMasterRenderStateFromManifest,
  isMasterRenderManifestFresh,
  LONGFORM_MASTER_COMPOSITION_ID,
  LONGFORM_MASTER_MANIFEST_ASSET,
  LONGFORM_MASTER_OUTPUT_ASSET,
  LONGFORM_MASTER_PIPELINE_VERSION,
  type MasterRenderManifest,
  type MasterRenderRequest,
  type MasterRenderStatus
} from "../src/lib/master-render";
// @ts-ignore Native Vite config loading needs the explicit extension for this Node-only import path.
import {getPatternMemoryFingerprint} from "../src/lib/motion-platform/pattern-memory/pattern-memory-snapshot.ts";
import type {
  CaptionStyleProfileId,
  CaptionVerticalBias,
  MotionGradeProfileId,
  MotionMatteMode,
  MotionTier,
  VideoMetadata
} from "../src/lib/types";
import type {MotionCompositionModel} from "../src/lib/motion-platform/scene-engine";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "src", "data");
const LONGFORM_INGEST_MANIFEST_PATH = path.join(DATA_DIR, "ingest.longform.json");
const LONGFORM_VIDEO_METADATA_PATH = path.join(DATA_DIR, "video.longform.metadata.json");
const LONGFORM_MOTION_PLAN_PATH = path.join(DATA_DIR, "motion-plan.longform.json");
const MASTER_RENDER_DIR = path.join(PUBLIC_DIR, "master-renders", "longform");
const MASTER_RENDER_OUTPUT_PATH = path.join(PUBLIC_DIR, ...LONGFORM_MASTER_OUTPUT_ASSET.split("/"));
const MASTER_RENDER_MANIFEST_PATH = path.join(PUBLIC_DIR, ...LONGFORM_MASTER_MANIFEST_ASSET.split("/"));
const MASTER_RENDER_LOCK_PATH = path.join(MASTER_RENDER_DIR, "current.lock");
const MASTER_CACHE_DIR = path.join(ROOT, ".cache", "master-render");
const REMOTION_CLI_ENTRY = path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
const LOCK_STALE_AFTER_MS = 1000 * 60 * 60 * 4;

type MasterCliArgs = Partial<Omit<MasterRenderRequest, "sourceVideoHash">> & {
  force?: boolean;
};

type MasterRenderOptions = {
  request?: Partial<MasterRenderRequest>;
  force?: boolean;
};

type MasterLockHandle = {
  handle: FileHandle;
  lockPath: string;
};

type TemporaryMediaServer = {
  origin: string;
  assetPathname: string;
  close: () => Promise<void>;
};

const readJsonIfExists = async <T>(filePath: string): Promise<T | null> => {
  try {
    const contents = await readFile(filePath, "utf-8");
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
};

type MotionPlanArtifactSnapshot = {
  motion_model?: MotionCompositionModel;
  plan_version?: string;
  generated_at?: string;
};

const readMotionPlanArtifact = async (): Promise<MotionPlanArtifactSnapshot | null> => {
  return readJsonIfExists<MotionPlanArtifactSnapshot>(LONGFORM_MOTION_PLAN_PATH);
};

const readMotionPlanFingerprint = async (): Promise<string> => {
  try {
    const contents = await readFile(LONGFORM_MOTION_PLAN_PATH, "utf-8");
    return sha256Text(contents);
  } catch {
    return "missing";
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const describeError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const createAtomicTempPath = (
  targetPath: string,
  preserveExtension = false
): string => {
  const directory = path.dirname(targetPath);
  const extension = path.extname(targetPath);
  const fileName = path.basename(targetPath, extension);
  const suffix = preserveExtension && extension
    ? `.${process.pid}.${Date.now()}.tmp${extension}`
    : `${extension}.${process.pid}.${Date.now()}.tmp`;
  return path.join(directory, `.${fileName}${suffix}`);
};

const replaceFileAtomically = async ({
  sourcePath,
  targetPath
}: {
  sourcePath: string;
  targetPath: string;
}): Promise<void> => {
  await rm(targetPath, {force: true});
  await rename(sourcePath, targetPath);
};

const writeJsonAtomic = async (filePath: string, value: unknown): Promise<void> => {
  const tempPath = createAtomicTempPath(filePath);
  await writeJson(tempPath, value);
  await replaceFileAtomically({
    sourcePath: tempPath,
    targetPath: filePath
  });
};

const toPublicUrlFromPath = (filePath: string): string => {
  const relativePath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, "/");
  if (relativePath.startsWith("..")) {
    throw new Error(`Expected a public asset path inside ${PUBLIC_DIR}, received ${filePath}`);
  }
  return `/${relativePath}`;
};

const startTemporaryMediaServer = async ({
  filePath,
  assetPathname
}: {
  filePath: string;
  assetPathname: string;
}): Promise<TemporaryMediaServer> => {
  const normalizedPathname = assetPathname.startsWith("/") ? assetPathname : `/${assetPathname}`;
  const mediaStats = await stat(filePath);
  const server = createServer((request, response) => {
    if ((request.url ?? "").split("?")[0] !== normalizedPathname) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    const rangeHeader = request.headers.range;
    const isHeadRequest = request.method === "HEAD";
    const commonHeaders = {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store"
    };

    if (!rangeHeader) {
      response.writeHead(200, {
        ...commonHeaders,
        "Content-Length": mediaStats.size
      });
      if (isHeadRequest) {
        response.end();
        return;
      }

      createReadStream(filePath).pipe(response);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      response.writeHead(416, {
        "Content-Range": `bytes */${mediaStats.size}`
      });
      response.end();
      return;
    }

    const requestedStart = match[1] ? Number(match[1]) : 0;
    const requestedEnd = match[2] ? Number(match[2]) : mediaStats.size - 1;
    const start = Math.max(0, Math.min(requestedStart, mediaStats.size - 1));
    const end = Math.max(start, Math.min(requestedEnd, mediaStats.size - 1));
    response.writeHead(206, {
      ...commonHeaders,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${mediaStats.size}`
    });
    if (isHeadRequest) {
      response.end();
      return;
    }

    createReadStream(filePath, {
      start,
      end
    }).pipe(response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const addressInfo = server.address();
  if (!addressInfo || typeof addressInfo === "string") {
    throw new Error("Unable to determine the temporary media server address.");
  }

  return {
    origin: `http://127.0.0.1:${addressInfo.port}`,
    assetPathname: normalizedPathname,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    })
  };
};

const trimCommandLog = (value: string): string => {
  const MAX_CHARS = 16000;
  return value.length > MAX_CHARS ? value.slice(value.length - MAX_CHARS) : value;
};

const runCommandCapture = async (
  command: string,
  args: string[]
): Promise<{stdout: string; stderr: string}> => {
  return new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout = trimCommandLog(`${stdout}${String(chunk)}`);
    });

    child.stderr.on("data", (chunk) => {
      stderr = trimCommandLog(`${stderr}${String(chunk)}`);
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({stdout, stderr});
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}: ${stderr || stdout}`));
    });
  });
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const readLongformIngestManifest = async (): Promise<IngestManifest> => {
  const manifest = await readJsonIfExists<IngestManifest>(LONGFORM_INGEST_MANIFEST_PATH);
  if (!manifest) {
    throw new Error("Long-form ingest manifest is missing. Run captions sync first.");
  }

  if (!isIngestManifestReady(manifest)) {
    throw new Error("Long-form ingest is not ready yet. Refresh the ingest before generating a master render.");
  }

  return manifest;
};

const readLongformVideoMetadata = async (): Promise<VideoMetadata> => {
  const metadata = await readJsonIfExists<VideoMetadata>(LONGFORM_VIDEO_METADATA_PATH);
  if (!metadata) {
    throw new Error("Long-form video metadata is missing. Run captions sync first.");
  }

  return metadata;
};

const readMasterRenderManifest = async (): Promise<MasterRenderManifest | null> => {
  return readJsonIfExists<MasterRenderManifest>(MASTER_RENDER_MANIFEST_PATH);
};

const ensureMasterDirectories = async (): Promise<void> => {
  await mkdir(PUBLIC_DIR, {recursive: true});
  await mkdir(MASTER_RENDER_DIR, {recursive: true});
  await mkdir(MASTER_CACHE_DIR, {recursive: true});
};

const acquireMasterLock = async (): Promise<MasterLockHandle | null> => {
  await ensureMasterDirectories();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(MASTER_RENDER_LOCK_PATH, "wx");
      await handle.writeFile(JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString()
      }, null, 2), "utf-8");
      return {
        handle,
        lockPath: MASTER_RENDER_LOCK_PATH
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") {
        throw error;
      }

      try {
        const lockStats = await stat(MASTER_RENDER_LOCK_PATH);
        if ((Date.now() - lockStats.mtimeMs) > LOCK_STALE_AFTER_MS) {
          await rm(MASTER_RENDER_LOCK_PATH, {force: true});
          continue;
        }
      } catch {
        continue;
      }

      return null;
    }
  }

  return null;
};

const releaseMasterLock = async (lockHandle: MasterLockHandle | null): Promise<void> => {
  if (!lockHandle) {
    return;
  }

  try {
    await lockHandle.handle.close();
  } finally {
    await rm(lockHandle.lockPath, {force: true});
  }
};

const buildMasterRequest = (
  ingestManifest: IngestManifest,
  request: Partial<MasterRenderRequest> | undefined,
  motionPlanFingerprint: string,
  patternMemoryFingerprint: string
): MasterRenderRequest => {
  return {
    sourceVideoHash: ingestManifest.sourceVideoHash,
    captionProfileId: (request?.captionProfileId ?? ingestManifest.captionProfileId) as CaptionStyleProfileId,
    motionTier: (request?.motionTier ?? "auto") as MotionTier | "auto",
    gradeProfileId: (request?.gradeProfileId ?? "auto") as MotionGradeProfileId | "auto",
    transitionPresetId: request?.transitionPresetId?.trim() || "auto",
    matteMode: (request?.matteMode ?? "auto") as MotionMatteMode | "auto",
    captionBias: (request?.captionBias ?? "auto") as CaptionVerticalBias | "auto",
    motionPlanFingerprint,
    patternMemoryFingerprint
  };
};

const renderMasterComposition = async ({
  request,
  masterVideoMetadata,
  renderVideoSrc,
  outputPath,
  motionModelOverride
}: {
  request: MasterRenderRequest;
  masterVideoMetadata: VideoMetadata;
  renderVideoSrc: string;
  outputPath: string;
  motionModelOverride: MotionCompositionModel | null;
}): Promise<{outputPath: string; outputUrl: string; elapsedMs: number}> => {
  const tempOutputPath = createAtomicTempPath(outputPath, true);
  const propsPath = path.join(MASTER_CACHE_DIR, `props.${process.pid}.${Date.now()}.json`);
  const startedAt = Date.now();

  await writeJson(propsPath, {
    videoSrc: renderVideoSrc,
    videoMetadata: masterVideoMetadata,
    captionProfileId: request.captionProfileId,
    motionTier: request.motionTier,
    gradeProfileId: request.gradeProfileId,
    transitionPresetId: request.transitionPresetId,
    matteMode: request.matteMode,
    captionBias: request.captionBias,
    motionPlanFingerprint: request.motionPlanFingerprint,
    previewPerformanceMode: "full",
    stabilizePreviewTimeline: false,
    motionModelOverride
  });

  try {
    await runCommandCapture(process.execPath, [
      REMOTION_CLI_ENTRY,
      "render",
      "src/index.ts",
      LONGFORM_MASTER_COMPOSITION_ID,
      tempOutputPath,
      "--codec=h264",
      "--audio-codec=aac",
      "--pixel-format=yuv420p",
      "--x264-preset=veryfast",
      "--crf=22",
      "--concurrency=4",
      "--overwrite",
      "--bundle-cache=false",
      `--props=${propsPath}`
    ]);

    await replaceFileAtomically({
      sourcePath: tempOutputPath,
      targetPath: outputPath
    });

    return {
      outputPath,
      outputUrl: toPublicUrlFromPath(outputPath),
      elapsedMs: Date.now() - startedAt
    };
  } finally {
    await rm(tempOutputPath, {force: true});
    await rm(propsPath, {force: true});
  }
};

export const getLongformMasterRenderStatus = async (): Promise<MasterRenderStatus> => {
  const manifest = await readMasterRenderManifest();
  const lockExists = await fileExists(MASTER_RENDER_LOCK_PATH);

  if (!manifest) {
    return {
      state: lockExists ? "running" : "idle",
      manifest: null
    };
  }

  if (lockExists) {
    return {
      state: "running",
      manifest: {
        ...manifest,
        status: "running"
      }
    };
  }

  const resolvedOutputPath = manifest.outputPath?.trim() || MASTER_RENDER_OUTPUT_PATH;
  if (manifest.status === "success" && !await fileExists(resolvedOutputPath)) {
    return {
      state: "error",
      manifest: {
        ...manifest,
        status: "error",
        errorMessage: "The master render manifest exists, but the master video output is missing."
      }
    };
  }

  return {
    state: getMasterRenderStateFromManifest(manifest),
    manifest
  };
};

export const renderLongformMasterRender = async (
  options: MasterRenderOptions = {}
): Promise<MasterRenderManifest> => {
  await ensureMasterDirectories();
  const ingestManifest = await readLongformIngestManifest();
  const motionPlanArtifact = await readMotionPlanArtifact();
  const motionPlanFingerprint = await readMotionPlanFingerprint();
  const patternMemoryFingerprint = getPatternMemoryFingerprint();
  const masterRequest = buildMasterRequest(ingestManifest, options.request, motionPlanFingerprint, patternMemoryFingerprint);
  const currentManifest = await readMasterRenderManifest();

  if (
    !options.force &&
    currentManifest &&
    isMasterRenderManifestFresh(currentManifest, masterRequest) &&
    currentManifest.status === "success" &&
    await fileExists(currentManifest.outputPath?.trim() || MASTER_RENDER_OUTPUT_PATH)
  ) {
    return currentManifest;
  }

  const lockHandle = await acquireMasterLock();
  if (!lockHandle) {
    const status = await getLongformMasterRenderStatus();
    if (status.manifest) {
      return status.manifest;
    }

    throw new Error("A master render is already running.");
  }

  const settingsFingerprint = buildMasterRenderSettingsFingerprint(masterRequest);
  const outputFileName = `render-${settingsFingerprint.slice(0, 32)}-${Date.now().toString(36)}.mp4`;
  const outputPath = path.join(MASTER_RENDER_DIR, outputFileName);
  const startedAtIso = new Date().toISOString();
  const startedAt = Date.now();
  const initialManifest: MasterRenderManifest = {
    status: "running",
    compositionId: LONGFORM_MASTER_COMPOSITION_ID,
    sourceVideoHash: masterRequest.sourceVideoHash,
    pipelineVersion: LONGFORM_MASTER_PIPELINE_VERSION,
    settingsFingerprint,
    request: masterRequest,
    startedAt: startedAtIso,
    finishedAt: null,
    generatedAt: null,
    outputPath,
    outputUrl: null,
    stageTimingsMs: {
      render: 0,
      total: 0
    },
    errorMessage: null
  };

  await writeJsonAtomic(MASTER_RENDER_MANIFEST_PATH, initialManifest);

  try {
    const longformVideoMetadata = await readLongformVideoMetadata();
    const sourceVideoPath = ingestManifest.outputs?.videoPublicPath?.trim() || ingestManifest.sourceVideoPath;
    if (!sourceVideoPath) {
      throw new Error("Unable to resolve the active long-form source video for the master render.");
    }

    const masterSourceServer = await startTemporaryMediaServer({
      filePath: sourceVideoPath,
      assetPathname: "/master-source.mp4"
    });

    let renderResult: Awaited<ReturnType<typeof renderMasterComposition>>;
    try {
      renderResult = await renderMasterComposition({
        request: masterRequest,
        masterVideoMetadata: longformVideoMetadata,
        renderVideoSrc: `${masterSourceServer.origin}${masterSourceServer.assetPathname}`,
        outputPath,
        motionModelOverride: motionPlanArtifact?.motion_model ?? null
      });
    } finally {
      await masterSourceServer.close();
    }

    const completedAt = new Date().toISOString();
    const completedManifest: MasterRenderManifest = {
      ...initialManifest,
      status: "success",
      finishedAt: completedAt,
      generatedAt: completedAt,
      outputPath: renderResult.outputPath,
      outputUrl: `${renderResult.outputUrl}?v=${encodeURIComponent(settingsFingerprint.slice(0, 24))}`,
      stageTimingsMs: {
        render: renderResult.elapsedMs,
        total: Date.now() - startedAt
      }
    };

    await writeJsonAtomic(MASTER_RENDER_MANIFEST_PATH, completedManifest);
    return completedManifest;
  } catch (error) {
    const failedManifest: MasterRenderManifest = {
      ...initialManifest,
      status: "error",
      finishedAt: new Date().toISOString(),
      errorMessage: describeError(error),
      stageTimingsMs: {
        ...initialManifest.stageTimingsMs,
        total: Date.now() - startedAt
      }
    };
    await writeJsonAtomic(MASTER_RENDER_MANIFEST_PATH, failedManifest);
    throw error;
  } finally {
    await releaseMasterLock(lockHandle);
  }
};

const parseCliArgs = (argv: string[]): MasterCliArgs => {
  const args: MasterCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const nextValue = argv[index + 1];

    switch (token) {
      case "--caption-profile":
        args.captionProfileId = nextValue as CaptionStyleProfileId;
        index += 1;
        break;
      case "--motion-tier":
        args.motionTier = nextValue as MotionTier | "auto";
        index += 1;
        break;
      case "--grade":
        args.gradeProfileId = nextValue as MotionGradeProfileId | "auto";
        index += 1;
        break;
      case "--transition":
        args.transitionPresetId = nextValue;
        index += 1;
        break;
      case "--matte":
        args.matteMode = nextValue as MotionMatteMode | "auto";
        index += 1;
        break;
      case "--caption-bias":
        args.captionBias = nextValue as CaptionVerticalBias | "auto";
        index += 1;
        break;
      case "--force":
        args.force = true;
        break;
      default:
        break;
    }
  }

  return args;
};

const runFromCli = async (): Promise<void> => {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const manifest = await renderLongformMasterRender({
    request: cliArgs,
    force: cliArgs.force
  });

  console.log(
    `Master render ready at ${manifest.outputUrl ?? manifest.outputPath} ` +
    `(${(manifest.stageTimingsMs.total / 1000).toFixed(1)}s total).`
  );
};

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false;

if (isDirectExecution) {
  runFromCli().catch((error) => {
    console.error(describeError(error));
    process.exitCode = 1;
  });
}
