import {spawn} from "node:child_process";
import {createReadStream} from "node:fs";
import {mkdir, open, readFile, rename, rm, stat, writeFile, type FileHandle} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {IngestManifest} from "../src/lib/ingest-manifest";
// @ts-ignore Native Vite config loading needs the explicit extension for this Node-only import path.
import {isIngestManifestReady} from "../src/lib/ingest-manifest.ts";
// @ts-ignore Native Vite config loading needs the explicit extension for this Node-only import path.
import {sha256Text} from "../src/lib/hash.ts";
// @ts-ignore Native Vite config loading needs the explicit extension for this Node-only import path.
import {buildDraftPreviewSettingsFingerprint, getDraftPreviewStateFromManifest, getLongformDraftVideoMetadata, isDraftPreviewManifestFresh, LONGFORM_DRAFT_COMPOSITION_ID, LONGFORM_DRAFT_FPS, LONGFORM_DRAFT_MANIFEST_ASSET, LONGFORM_DRAFT_MAX_HEIGHT, LONGFORM_DRAFT_MAX_WIDTH, LONGFORM_DRAFT_OUTPUT_ASSET, LONGFORM_DRAFT_PIPELINE_VERSION, LONGFORM_DRAFT_PROXY_GOP, LONGFORM_DRAFT_SOURCE_PROXY_MANIFEST_ASSET, LONGFORM_DRAFT_VIDEO_ASSET, type DraftPreviewManifest, type DraftPreviewRequest, type DraftPreviewSourceProxyManifest, type DraftPreviewStatus} from "../src/lib/draft-preview.ts";
// @ts-ignore Native Vite config loading needs the explicit extension for this Node-only import path.
import {getPatternMemoryFingerprint} from "../src/lib/motion-platform/pattern-memory/pattern-memory-snapshot.ts";
import {deterministicChunkWords, mapWordChunksToCaptionChunks} from "../src/lib/caption-chunker";
import {getPreviewTranscriptWords} from "../src/lib/preview-caption-data";
import {normalizeCaptionStyleProfileId} from "../src/lib/stylebooks/caption-style-profiles";
import {buildCreativeOrchestrationPlan} from "../src/creative-orchestration";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  MotionGradeProfileId,
  MotionMatteMode,
  Motion3DMode,
  MotionTier,
  PreviewPerformanceMode,
  VideoMetadata
} from "../src/lib/types";
import type {MotionCompositionModel} from "../src/lib/motion-platform/scene-engine";
import type {CreativeOrchestrationDebugReport} from "../src/creative-orchestration/types";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "src", "data");
const LONGFORM_INGEST_MANIFEST_PATH = path.join(DATA_DIR, "ingest.longform.json");
const LONGFORM_VIDEO_METADATA_PATH = path.join(DATA_DIR, "video.longform.metadata.json");
const LONGFORM_MOTION_PLAN_PATH = path.join(DATA_DIR, "motion-plan.longform.json");
const DRAFT_PREVIEW_DIR = path.join(PUBLIC_DIR, "draft-previews", "longform");
const DRAFT_PREVIEW_OUTPUT_PATH = path.join(PUBLIC_DIR, ...LONGFORM_DRAFT_OUTPUT_ASSET.split("/"));
const DRAFT_PREVIEW_MANIFEST_PATH = path.join(PUBLIC_DIR, ...LONGFORM_DRAFT_MANIFEST_ASSET.split("/"));
const DRAFT_PREVIEW_LOCK_PATH = path.join(DRAFT_PREVIEW_DIR, "current.lock");
const DRAFT_SOURCE_PROXY_PATH = path.join(PUBLIC_DIR, LONGFORM_DRAFT_VIDEO_ASSET);
const DRAFT_SOURCE_PROXY_MANIFEST_PATH = path.join(PUBLIC_DIR, ...LONGFORM_DRAFT_SOURCE_PROXY_MANIFEST_ASSET.split("/"));
const DRAFT_CACHE_DIR = path.join(ROOT, ".cache", "draft-preview");
const REMOTION_CLI_ENTRY = path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
const LOCK_STALE_AFTER_MS = 1000 * 60 * 60 * 4;
const DRAFT_RENDER_PREVIEW_PERFORMANCE_MODE: PreviewPerformanceMode = "balanced";
const DRAFT_RENDER_RESPECTS_PERFORMANCE_MODE = true;
const DRAFT_RENDER_CONCURRENCY = 4;
const DRAFT_RENDER_CODEC = "h264";
const DRAFT_RENDER_AUDIO_CODEC = "aac";
const DRAFT_RENDER_PIXEL_FORMAT = "yuv420p";
const DRAFT_RENDER_X264_PRESET = "superfast";
const DRAFT_RENDER_CRF = 24;
const DRAFT_RENDER_MOTION_3D_MODE: Motion3DMode = "editorial";

type DraftCliArgs = Partial<Omit<DraftPreviewRequest, "sourceVideoHash">> & {
  force?: boolean;
};

type DraftRenderOptions = {
  request?: Partial<DraftPreviewRequest>;
  force?: boolean;
};

type CommandStreamName = "stdout" | "stderr";

type RunCommandCaptureOptions = {
  label?: string;
  onOutput?: (stream: CommandStreamName, line: string) => void;
  onClose?: (code: number | null, elapsedMs: number) => void;
};

type PreviewProxyEncoderPlan = {
  label: string;
  args: string[];
};

type DraftLockHandle = {
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

const STRIP_ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

const sanitizeCommandOutputLines = (value: string): string[] => {
  return value
    .replace(STRIP_ANSI_PATTERN, "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const logDraftProfile = (
  event: string,
  details: Record<string, unknown> = {}
): void => {
  console.log(`[draft-profile] ${event}: ${JSON.stringify(details)}`);
};

const buildExpectedFeatureSwitches = (
  previewPerformanceMode: PreviewPerformanceMode
): Record<string, boolean> => ({
  sourceVideoBackdrop: false,
  typography: true,
  motionAssetOverlay: previewPerformanceMode !== "turbo",
  showcaseOverlay: previewPerformanceMode !== "turbo",
  backgroundOverlay: previewPerformanceMode !== "turbo",
  matteForeground: false,
  soundDesign: true
});

const buildBasePreviewCaptionChunks = (
  captionProfileId: CaptionStyleProfileId,
  presentationMode: "reel" | "long-form"
): CaptionChunk[] => {
  const transcriptWords = getPreviewTranscriptWords(presentationMode);
  const chunkWords = deterministicChunkWords(transcriptWords, {profileId: captionProfileId});
  return mapWordChunksToCaptionChunks(chunkWords, undefined, {profileId: captionProfileId});
};

const runCommandCapture = async (
  command: string,
  args: string[],
  options: RunCommandCaptureOptions = {}
): Promise<{stdout: string; stderr: string}> => {
  return new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout = trimCommandLog(`${stdout}${text}`);
      sanitizeCommandOutputLines(text).forEach((line) => options.onOutput?.("stdout", line));
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr = trimCommandLog(`${stderr}${text}`);
      sanitizeCommandOutputLines(text).forEach((line) => options.onOutput?.("stderr", line));
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      options.onClose?.(code, Date.now() - startedAt);
      if (code === 0) {
        resolve({stdout, stderr});
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}: ${stderr || stdout}`));
    });
  });
};

let ffmpegEncoderSetPromise: Promise<Set<string>> | null = null;

const readAvailableFfmpegEncoders = async (): Promise<Set<string>> => {
  if (ffmpegEncoderSetPromise) {
    return ffmpegEncoderSetPromise;
  }

  ffmpegEncoderSetPromise = runCommandCapture("ffmpeg", ["-hide_banner", "-encoders"])
    .then(({stdout, stderr}) => {
      const output = `${stdout}\n${stderr}`;
      return new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.match(/^\s*[A-Z\.]{6}\s+([A-Za-z0-9_]+)/)?.[1] ?? null)
          .filter((value): value is string => value !== null)
      );
    })
    .catch(() => new Set<string>());

  return ffmpegEncoderSetPromise;
};

const buildDraftAudioProxyEncoderPlans = async (): Promise<PreviewProxyEncoderPlan[]> => {
  const availableEncoders = await readAvailableFfmpegEncoders();
  const plans: PreviewProxyEncoderPlan[] = [];

  if (availableEncoders.has("libfdk_aac")) {
    plans.push({
      label: "libfdk_aac",
      args: [
        "-c:a", "libfdk_aac",
        "-profile:a", "aac_low",
        "-b:a", "160k"
      ]
    });
  }

  if (availableEncoders.has("aac")) {
    plans.push({
      label: "aac",
      args: [
        "-c:a", "aac",
        "-b:a", "160k"
      ]
    });
  }

  plans.push({
    label: "copy",
    args: [
      "-c:a", "copy"
    ]
  });

  return plans;
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
    throw new Error("Long-form ingest is not ready yet. Refresh the ingest before generating a draft preview.");
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

const readDraftPreviewManifest = async (): Promise<DraftPreviewManifest | null> => {
  return readJsonIfExists<DraftPreviewManifest>(DRAFT_PREVIEW_MANIFEST_PATH);
};

const readDraftSourceProxyManifest = async (): Promise<DraftPreviewSourceProxyManifest | null> => {
  return readJsonIfExists<DraftPreviewSourceProxyManifest>(DRAFT_SOURCE_PROXY_MANIFEST_PATH);
};

const ensureDraftDirectories = async (): Promise<void> => {
  await mkdir(PUBLIC_DIR, {recursive: true});
  await mkdir(DRAFT_PREVIEW_DIR, {recursive: true});
  await mkdir(DRAFT_CACHE_DIR, {recursive: true});
};

const acquireDraftLock = async (): Promise<DraftLockHandle | null> => {
  await ensureDraftDirectories();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(DRAFT_PREVIEW_LOCK_PATH, "wx");
      await handle.writeFile(JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString()
      }, null, 2), "utf-8");
      return {
        handle,
        lockPath: DRAFT_PREVIEW_LOCK_PATH
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") {
        throw error;
      }

      try {
        const lockStats = await stat(DRAFT_PREVIEW_LOCK_PATH);
        if ((Date.now() - lockStats.mtimeMs) > LOCK_STALE_AFTER_MS) {
          await rm(DRAFT_PREVIEW_LOCK_PATH, {force: true});
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

const releaseDraftLock = async (lockHandle: DraftLockHandle | null): Promise<void> => {
  if (!lockHandle) {
    return;
  }

  try {
    await lockHandle.handle.close();
  } finally {
    await rm(lockHandle.lockPath, {force: true});
  }
};

const buildDraftRequest = (
  ingestManifest: IngestManifest,
  request: Partial<DraftPreviewRequest> | undefined,
  motionPlanFingerprint: string,
  patternMemoryFingerprint: string
): DraftPreviewRequest => {
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

const ensureDraftAudioProxy = async ({
  ingestManifest,
  draftVideoMetadata
}: {
  ingestManifest: IngestManifest;
  draftVideoMetadata: VideoMetadata;
}): Promise<{cacheHit: boolean; outputPath: string; publicPath: string; elapsedMs: number}> => {
  const currentProxyManifest = await readDraftSourceProxyManifest();
  const hasCurrentProxy =
    currentProxyManifest?.sourceVideoHash === ingestManifest.sourceVideoHash &&
    await fileExists(DRAFT_SOURCE_PROXY_PATH);

  if (hasCurrentProxy) {
    logDraftProfile("audio-proxy.cache-hit", {
      outputPath: DRAFT_SOURCE_PROXY_PATH,
      width: currentProxyManifest?.width,
      height: currentProxyManifest?.height,
      fps: currentProxyManifest?.fps
    });
    return {
      cacheHit: true,
      outputPath: DRAFT_SOURCE_PROXY_PATH,
      publicPath: `/${LONGFORM_DRAFT_VIDEO_ASSET}`,
      elapsedMs: 0
    };
  }

  const sourceVideoPath = ingestManifest.outputs?.videoPublicPath?.trim() || ingestManifest.sourceVideoPath;
  if (!sourceVideoPath) {
    throw new Error("Unable to resolve the active long-form source video for audio preview generation.");
  }

  const encoderPlans = await buildDraftAudioProxyEncoderPlans();
  const tempPath = createAtomicTempPath(DRAFT_SOURCE_PROXY_PATH, true);
  const startedAt = Date.now();
  let lastError: unknown = null;

  logDraftProfile("audio-proxy.start", {
    sourceVideoPath,
    targetWidth: draftVideoMetadata.width,
    targetHeight: draftVideoMetadata.height,
    targetFps: draftVideoMetadata.fps,
    targetDurationSeconds: draftVideoMetadata.durationSeconds,
    targetDurationFrames: draftVideoMetadata.durationInFrames,
    encoderPlanOrder: encoderPlans.map((plan) => plan.label)
  });

  for (const encoderPlan of encoderPlans) {
    const attemptStartedAt = Date.now();
    try {
      logDraftProfile("audio-proxy.encoder-attempt", {
        encoder: encoderPlan.label,
        args: encoderPlan.args
      });
      await rm(tempPath, {force: true});
      await runCommandCapture("ffmpeg", [
        "-y",
        "-i", sourceVideoPath,
        "-vn",
        "-map", "0:a:0?",
        "-sn",
        "-dn",
        ...encoderPlan.args,
        "-ac", "2",
        "-ar", "44100",
        "-movflags", "+faststart",
        tempPath
      ], {
        label: `audio-proxy:${encoderPlan.label}`,
        onOutput: (stream, line) => {
          if (/(frame=|fps=|speed=|error|failed|cannot|conversion|encoder|qavg)/i.test(line)) {
            logDraftProfile("audio-proxy.ffmpeg", {
              encoder: encoderPlan.label,
              stream,
              line
            });
          }
        },
        onClose: (code, elapsedMs) => {
          logDraftProfile("audio-proxy.encoder-close", {
            encoder: encoderPlan.label,
            code,
            elapsedMs
          });
        }
      });

      await replaceFileAtomically({
        sourcePath: tempPath,
        targetPath: DRAFT_SOURCE_PROXY_PATH
      });

      await writeJsonAtomic(DRAFT_SOURCE_PROXY_MANIFEST_PATH, {
        sourceVideoHash: ingestManifest.sourceVideoHash,
        generatedAt: new Date().toISOString(),
        outputPath: DRAFT_SOURCE_PROXY_PATH,
        outputPublicPath: `/${LONGFORM_DRAFT_VIDEO_ASSET}`,
        width: draftVideoMetadata.width,
        height: draftVideoMetadata.height,
        fps: draftVideoMetadata.fps
      } satisfies DraftPreviewSourceProxyManifest);

      logDraftProfile("audio-proxy.success", {
        encoder: encoderPlan.label,
        elapsedMs: Date.now() - startedAt,
        attemptElapsedMs: Date.now() - attemptStartedAt,
        outputPath: DRAFT_SOURCE_PROXY_PATH
      });

      return {
        cacheHit: false,
        outputPath: DRAFT_SOURCE_PROXY_PATH,
        publicPath: `/${LONGFORM_DRAFT_VIDEO_ASSET}`,
        elapsedMs: Date.now() - startedAt
      };
    } catch (error) {
      lastError = error;
      logDraftProfile("audio-proxy.encoder-failed", {
        encoder: encoderPlan.label,
        attemptElapsedMs: Date.now() - attemptStartedAt,
        error: describeError(error)
      });
      await rm(tempPath, {force: true});
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to generate the long-form draft audio proxy.");
};

const renderDraftComposition = async ({
  request,
  draftVideoMetadata,
  sourceAudioSrc,
  outputPath,
  motionModelOverride,
  captionChunksOverride,
  creativeOrchestrationDebugReport
}: {
  request: DraftPreviewRequest;
  draftVideoMetadata: VideoMetadata;
  sourceAudioSrc: string;
  outputPath: string;
  motionModelOverride: MotionCompositionModel | null;
  captionChunksOverride: CaptionChunk[];
  creativeOrchestrationDebugReport: CreativeOrchestrationDebugReport;
}): Promise<{outputPath: string; outputUrl: string; elapsedMs: number; diagnostics: Record<string, unknown>}> => {
  const tempOutputPath = createAtomicTempPath(outputPath, true);
  const propsPath = path.join(DRAFT_CACHE_DIR, `props.${process.pid}.${Date.now()}.json`);
  const startedAt = Date.now();
  const renderSettings = {
    compositionId: LONGFORM_DRAFT_COMPOSITION_ID,
    sourceAudioSrc,
    outputPath,
    tempOutputPath,
    propsPath,
    width: draftVideoMetadata.width,
    height: draftVideoMetadata.height,
    fps: draftVideoMetadata.fps,
    durationSeconds: draftVideoMetadata.durationSeconds,
    durationInFrames: draftVideoMetadata.durationInFrames,
    codec: DRAFT_RENDER_CODEC,
    audioCodec: DRAFT_RENDER_AUDIO_CODEC,
    pixelFormat: DRAFT_RENDER_PIXEL_FORMAT,
    x264Preset: DRAFT_RENDER_X264_PRESET,
    crf: DRAFT_RENDER_CRF,
    concurrency: DRAFT_RENDER_CONCURRENCY,
    bundleCache: false,
    previewPerformanceMode: DRAFT_RENDER_PREVIEW_PERFORMANCE_MODE,
    respectPreviewPerformanceModeDuringRender: DRAFT_RENDER_RESPECTS_PERFORMANCE_MODE,
    expectedFeatureSwitches: buildExpectedFeatureSwitches(DRAFT_RENDER_PREVIEW_PERFORMANCE_MODE),
    motion3DMode: DRAFT_RENDER_MOTION_3D_MODE,
    request: {
      captionProfileId: request.captionProfileId,
      motionTier: request.motionTier,
      gradeProfileId: request.gradeProfileId,
      transitionPresetId: request.transitionPresetId,
      matteMode: request.matteMode,
      captionBias: request.captionBias,
      motionPlanFingerprint: request.motionPlanFingerprint
    }
  };

  logDraftProfile("remotion-render.settings", renderSettings);

  await writeJson(propsPath, {
    sourceAudioSrc,
    videoMetadata: draftVideoMetadata,
    captionChunksOverride,
    captionProfileId: request.captionProfileId,
    motionTier: request.motionTier,
    gradeProfileId: request.gradeProfileId,
    transitionPresetId: request.transitionPresetId,
    matteMode: request.matteMode,
    captionBias: request.captionBias,
    motionPlanFingerprint: request.motionPlanFingerprint,
    motion3DMode: DRAFT_RENDER_MOTION_3D_MODE,
    previewPerformanceMode: DRAFT_RENDER_PREVIEW_PERFORMANCE_MODE,
    respectPreviewPerformanceModeDuringRender: DRAFT_RENDER_RESPECTS_PERFORMANCE_MODE,
    stabilizePreviewTimeline: false,
    motionModelOverride,
    creativeOrchestrationDebugReport
  });

  try {
    const remotionArgs = [
      REMOTION_CLI_ENTRY,
      "render",
      "src/index.ts",
      LONGFORM_DRAFT_COMPOSITION_ID,
      tempOutputPath,
      `--codec=${DRAFT_RENDER_CODEC}`,
      `--audio-codec=${DRAFT_RENDER_AUDIO_CODEC}`,
      `--pixel-format=${DRAFT_RENDER_PIXEL_FORMAT}`,
      `--x264-preset=${DRAFT_RENDER_X264_PRESET}`,
      `--crf=${DRAFT_RENDER_CRF}`,
      `--concurrency=${DRAFT_RENDER_CONCURRENCY}`,
      "--overwrite",
      "--bundle-cache=false",
      `--props=${propsPath}`
    ];
    const commandStartedAt = Date.now();

    logDraftProfile("remotion-render.command-start", {
      command: process.execPath,
      args: remotionArgs,
      estimatedFrames: draftVideoMetadata.durationInFrames
    });

    await runCommandCapture(process.execPath, remotionArgs, {
      label: "remotion-render",
      onOutput: (stream, line) => {
        logDraftProfile("remotion-cli.output", {
          stream,
          line
        });
      },
      onClose: (code, elapsedMs) => {
        logDraftProfile("remotion-render.command-close", {
          code,
          elapsedMs,
          secondsPerFrame: draftVideoMetadata.durationInFrames > 0
            ? elapsedMs / 1000 / draftVideoMetadata.durationInFrames
            : null
        });
      }
    });

    const commandElapsedMs = Date.now() - commandStartedAt;
    const tempStats = await stat(tempOutputPath).catch(() => null);
    const replaceStartedAt = Date.now();

    await replaceFileAtomically({
      sourcePath: tempOutputPath,
      targetPath: outputPath
    });
    const replaceElapsedMs = Date.now() - replaceStartedAt;
    const outputStats = await stat(outputPath).catch(() => null);
    const elapsedMs = Date.now() - startedAt;

    logDraftProfile("remotion-render.output-ready", {
      elapsedMs,
      commandElapsedMs,
      replaceElapsedMs,
      tempOutputBytes: tempStats?.size ?? null,
      outputBytes: outputStats?.size ?? null,
      outputPath
    });

    return {
      outputPath,
      outputUrl: toPublicUrlFromPath(outputPath),
      elapsedMs,
      diagnostics: {
        ...renderSettings,
        timingsMs: {
          total: elapsedMs,
          remotionCommand: commandElapsedMs,
          atomicReplace: replaceElapsedMs
        },
        outputBytes: outputStats?.size ?? null,
        secondsPerFrame: draftVideoMetadata.durationInFrames > 0
          ? commandElapsedMs / 1000 / draftVideoMetadata.durationInFrames
          : null
      }
    };
  } catch (error) {
    logDraftProfile("remotion-render.failed", {
      elapsedMs: Date.now() - startedAt,
      error: describeError(error)
    });
    throw error;
  } finally {
    await rm(tempOutputPath, {force: true});
    await rm(propsPath, {force: true});
  }
};

export const getLongformDraftPreviewStatus = async (): Promise<DraftPreviewStatus> => {
  const manifest = await readDraftPreviewManifest();
  const lockExists = await fileExists(DRAFT_PREVIEW_LOCK_PATH);

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

  const resolvedOutputPath = manifest.outputPath?.trim() || DRAFT_PREVIEW_OUTPUT_PATH;
  if (manifest.status === "success" && !await fileExists(resolvedOutputPath)) {
    return {
      state: "error",
      manifest: {
        ...manifest,
        status: "error",
        errorMessage: "The draft manifest exists, but the draft video output is missing."
      }
    };
  }

  return {
    state: getDraftPreviewStateFromManifest(manifest),
    manifest
  };
};

export const renderLongformDraftPreview = async (
  options: DraftRenderOptions = {}
): Promise<DraftPreviewManifest> => {
  await ensureDraftDirectories();
  const ingestManifest = await readLongformIngestManifest();
  const motionPlanArtifact = await readMotionPlanArtifact();
  const motionPlanFingerprint = await readMotionPlanFingerprint();
  const patternMemoryFingerprint = getPatternMemoryFingerprint();
  const draftRequest = buildDraftRequest(ingestManifest, options.request, motionPlanFingerprint, patternMemoryFingerprint);
  const currentManifest = await readDraftPreviewManifest();

  if (
    !options.force &&
    currentManifest &&
    isDraftPreviewManifestFresh(currentManifest, draftRequest) &&
    currentManifest.status === "success" &&
    await fileExists(currentManifest.outputPath?.trim() || DRAFT_PREVIEW_OUTPUT_PATH)
  ) {
    return currentManifest;
  }

  const lockHandle = await acquireDraftLock();
  if (!lockHandle) {
    const status = await getLongformDraftPreviewStatus();
    if (status.manifest) {
      return status.manifest;
    }

    throw new Error("A draft preview render is already running.");
  }

  const settingsFingerprint = buildDraftPreviewSettingsFingerprint(draftRequest);
  const outputFileName = `render-${settingsFingerprint.slice(0, 32)}-${Date.now().toString(36)}.mp4`;
  const outputPath = path.join(DRAFT_PREVIEW_DIR, outputFileName);
  const outputUrl = `${toPublicUrlFromPath(outputPath)}?v=${encodeURIComponent(settingsFingerprint.slice(0, 24))}`;
  const startedAtIso = new Date().toISOString();
  const startedAt = Date.now();
  const initialManifest: DraftPreviewManifest = {
    status: "running",
    compositionId: LONGFORM_DRAFT_COMPOSITION_ID,
    sourceVideoHash: draftRequest.sourceVideoHash,
    pipelineVersion: LONGFORM_DRAFT_PIPELINE_VERSION,
    settingsFingerprint,
    request: draftRequest,
    startedAt: startedAtIso,
    finishedAt: null,
    generatedAt: null,
    outputPath,
    outputUrl: null,
    draftSourceProxyPath: DRAFT_SOURCE_PROXY_PATH,
    draftSourceProxyPublicPath: `/${LONGFORM_DRAFT_VIDEO_ASSET}`,
    draftSourceProxyCacheHit: false,
    stageTimingsMs: {
      draftSourceProxyGeneration: 0,
      render: 0,
      total: 0
    },
    renderDiagnostics: null,
    errorMessage: null
  };

  await writeJsonAtomic(DRAFT_PREVIEW_MANIFEST_PATH, initialManifest);

  try {
    const longformVideoMetadata = await readLongformVideoMetadata();
    const draftVideoMetadata = getLongformDraftVideoMetadata(longformVideoMetadata);
    const normalizedCaptionProfileId = normalizeCaptionStyleProfileId(draftRequest.captionProfileId);
    const creativeMotionTier = draftRequest.motionTier === "auto" ? null : draftRequest.motionTier;
    const baseCaptionChunks = buildBasePreviewCaptionChunks(
      normalizedCaptionProfileId,
      "long-form"
    );
    const creativePreview = await buildCreativeOrchestrationPlan({
      jobId: `draft-preview-${draftRequest.sourceVideoHash}`,
      sourceJobId: draftRequest.sourceVideoHash,
      captionChunks: baseCaptionChunks,
      captionProfileId: normalizedCaptionProfileId,
      motionTier: creativeMotionTier,
      renderMode: "audio-preview",
      videoMetadata: draftVideoMetadata
    });
    const draftSourceProxy = await ensureDraftAudioProxy({
      ingestManifest,
      draftVideoMetadata
    });

    let renderResult: Awaited<ReturnType<typeof renderDraftComposition>>;
    renderResult = await renderDraftComposition({
      request: draftRequest,
      draftVideoMetadata,
      sourceAudioSrc: draftSourceProxy.publicPath,
      outputPath,
      motionModelOverride: motionPlanArtifact?.motion_model ?? null,
      captionChunksOverride: creativePreview.captionChunks,
      creativeOrchestrationDebugReport: creativePreview.debugReport
    });

    const completedAt = new Date().toISOString();
    const completedManifest: DraftPreviewManifest = {
      ...initialManifest,
      status: "success",
      finishedAt: completedAt,
      generatedAt: completedAt,
      outputPath: renderResult.outputPath,
      outputUrl: `${renderResult.outputUrl}?v=${encodeURIComponent(settingsFingerprint.slice(0, 24))}`,
      draftSourceProxyPath: draftSourceProxy.outputPath,
      draftSourceProxyPublicPath: draftSourceProxy.publicPath,
      draftSourceProxyCacheHit: draftSourceProxy.cacheHit,
      stageTimingsMs: {
        draftSourceProxyGeneration: draftSourceProxy.elapsedMs,
        render: renderResult.elapsedMs,
        total: Date.now() - startedAt
      },
      renderDiagnostics: {
        sourceVideoMetadata: longformVideoMetadata,
        draftSourceProxy: {
          cacheHit: draftSourceProxy.cacheHit,
          elapsedMs: draftSourceProxy.elapsedMs,
          outputPath: draftSourceProxy.outputPath,
          publicPath: draftSourceProxy.publicPath
        },
        creativeOrchestration: creativePreview.debugReport,
        remotionRender: renderResult.diagnostics
      }
    };

    await writeJsonAtomic(DRAFT_PREVIEW_MANIFEST_PATH, completedManifest);
    return completedManifest;
  } catch (error) {
    const failedManifest: DraftPreviewManifest = {
      ...initialManifest,
      status: "error",
      finishedAt: new Date().toISOString(),
      errorMessage: describeError(error),
      stageTimingsMs: {
        ...initialManifest.stageTimingsMs,
        total: Date.now() - startedAt
      }
    };
    await writeJsonAtomic(DRAFT_PREVIEW_MANIFEST_PATH, failedManifest);
    throw error;
  } finally {
    await releaseDraftLock(lockHandle);
  }
};

const parseCliArgs = (argv: string[]): DraftCliArgs => {
  const args: DraftCliArgs = {};

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
  const manifest = await renderLongformDraftPreview({
    request: cliArgs,
    force: cliArgs.force
  });

  const sourceProxyStatus = manifest.draftSourceProxyCacheHit ? "cache hit" : "regenerated";
  console.log(
    `Audio-first creative preview ready at ${manifest.outputUrl ?? manifest.outputPath} ` +
    `(${(manifest.stageTimingsMs.total / 1000).toFixed(1)}s total, audio proxy ${sourceProxyStatus}).`
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
