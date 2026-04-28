import {mkdir, readdir, rename, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";

type ChunkCliArgs = {
  videoPath: string;
  outDir: string;
  chunkSeconds: number;
  prefix: string;
  dropRemainder: boolean;
};

type ChunkManifestEntry = {
  index: number;
  fileName: string;
  absolutePath: string;
  relativePublicPath: string | null;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  sizeBytes: number;
};

type ChunkManifest = {
  sourcePath: string;
  sourceDurationSeconds: number;
  chunkSeconds: number;
  chunkCount: number;
  droppedTailSeconds: number;
  createdAt: string;
  items: ChunkManifestEntry[];
};

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

const parseArgs = (): ChunkCliArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  const videoPath = readArgValue("--video");
  if (!videoPath) {
    throw new Error("Missing required --video argument.");
  }

  const outDir = readArgValue("--out-dir") ?? path.join(PUBLIC_DIR, "video-chunks");
  const chunkSecondsValue = Number(readArgValue("--chunk-seconds") ?? "300");
  if (!Number.isFinite(chunkSecondsValue) || chunkSecondsValue <= 0) {
    throw new Error("--chunk-seconds must be a positive number.");
  }

  const prefix = readArgValue("--prefix") ?? toSlug(path.parse(videoPath).name);
  return {
    videoPath: path.resolve(videoPath),
    outDir: path.resolve(outDir),
    chunkSeconds: chunkSecondsValue,
    prefix,
    dropRemainder: args.includes("--drop-remainder")
  };
};

const toSlug = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const runCommand = async (command: string, args: string[]): Promise<{stdout: string; stderr: string}> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({stdout, stderr});
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
    });
  });
};

const probeDurationSeconds = async (videoPath: string): Promise<number> => {
  const {stdout} = await runCommand("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath
  ]);
  const durationSeconds = Number(stdout.trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Unable to probe a valid duration for ${videoPath}.`);
  }
  return durationSeconds;
};

const toRelativePublicPath = (filePath: string): string | null => {
  const normalizedPublicDir = path.resolve(PUBLIC_DIR);
  const normalizedFilePath = path.resolve(filePath);
  if (!normalizedFilePath.startsWith(normalizedPublicDir)) {
    return null;
  }
  return normalizedFilePath.slice(normalizedPublicDir.length + 1).replace(/\\/g, "/");
};

const padChunkIndex = (index: number): string => String(index).padStart(2, "0");

const readGeneratedChunkPaths = async (outDir: string, prefix: string): Promise<string[]> => {
  const entries = await readdir(outDir, {withFileTypes: true});
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(`${prefix}-part-`) && name.endsWith(".mp4"))
    .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
    .map((name) => path.join(outDir, name));
};

const renameChunksToStableNames = async (outDir: string, prefix: string): Promise<string[]> => {
  const generated = await readGeneratedChunkPaths(outDir, prefix);
  const renamed: string[] = [];

  for (let index = 0; index < generated.length; index += 1) {
    const stableName = `${prefix}-part-${padChunkIndex(index + 1)}.mp4`;
    const stablePath = path.join(outDir, stableName);
    if (generated[index] !== stablePath) {
      await rename(generated[index], stablePath);
    }
    renamed.push(stablePath);
  }

  return renamed;
};

const writeManifest = async (manifestPath: string, manifest: ChunkManifest): Promise<void> => {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  await mkdir(args.outDir, {recursive: true});

  const sourceDurationSeconds = await probeDurationSeconds(args.videoPath);
  const fullChunkCount = Math.floor(sourceDurationSeconds / args.chunkSeconds);
  if (fullChunkCount === 0) {
    throw new Error(
      `Source duration ${sourceDurationSeconds.toFixed(3)}s is shorter than one ${args.chunkSeconds}s chunk.`
    );
  }

  const chunkCount = args.dropRemainder
    ? fullChunkCount
    : Math.ceil(sourceDurationSeconds / args.chunkSeconds);
  const targetDurationSeconds = Math.min(sourceDurationSeconds, chunkCount * args.chunkSeconds);
  const droppedTailSeconds = Math.max(0, sourceDurationSeconds - fullChunkCount * args.chunkSeconds);

  console.log(`Chunking ${path.basename(args.videoPath)} into ${chunkCount} file(s) of ${args.chunkSeconds}s each.`);
  if (args.dropRemainder && droppedTailSeconds > 0) {
    console.log(`Dropping trailing ${droppedTailSeconds.toFixed(3)}s because --drop-remainder was supplied.`);
  }

  const outputPattern = path.join(args.outDir, `${args.prefix}-part-%02d.mp4`);
  const ffmpegArgs = [
    "-y",
    "-v", "error",
    "-stats",
    "-i", args.videoPath,
    "-t", targetDurationSeconds.toFixed(3),
    "-map", "0:v:0",
    "-map", "0:a?",
    "-sn",
    "-dn",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-force_key_frames", `expr:gte(t,n_forced*${args.chunkSeconds})`,
    "-f", "segment",
    "-segment_time", String(args.chunkSeconds),
    "-segment_start_number", "1",
    "-reset_timestamps", "1",
    outputPattern
  ];

  await runCommand("ffmpeg", ffmpegArgs);

  const chunkPaths = await renameChunksToStableNames(args.outDir, args.prefix);
  const manifestEntries: ChunkManifestEntry[] = [];

  for (let index = 0; index < chunkPaths.length; index += 1) {
    const chunkPath = chunkPaths[index];
    const durationSeconds = await probeDurationSeconds(chunkPath);
    const fileStats = await stat(chunkPath);
    manifestEntries.push({
      index: index + 1,
      fileName: path.basename(chunkPath),
      absolutePath: chunkPath,
      relativePublicPath: toRelativePublicPath(chunkPath),
      startSeconds: index * args.chunkSeconds,
      endSeconds: Math.min((index + 1) * args.chunkSeconds, sourceDurationSeconds),
      durationSeconds,
      sizeBytes: fileStats.size
    });
  }

  const manifest: ChunkManifest = {
    sourcePath: args.videoPath,
    sourceDurationSeconds,
    chunkSeconds: args.chunkSeconds,
    chunkCount: manifestEntries.length,
    droppedTailSeconds: args.dropRemainder ? droppedTailSeconds : Math.max(0, sourceDurationSeconds - targetDurationSeconds),
    createdAt: new Date().toISOString(),
    items: manifestEntries
  };

  const manifestPath = path.join(args.outDir, `${args.prefix}.manifest.json`);
  await writeManifest(manifestPath, manifest);

  console.log(`Wrote ${manifestEntries.length} chunk(s) to ${args.outDir}`);
  console.log(`Manifest: ${manifestPath}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
