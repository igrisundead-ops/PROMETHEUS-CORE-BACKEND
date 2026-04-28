import "dotenv/config";

import {cp, mkdir, opendir, writeFile} from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";

import type {
  MotionSoundAsset,
  MotionSoundIntensity
} from "../src/lib/types.ts";

type MusicSyncArgs = {
  inputDir: string;
  outputDir: string;
  manifestPath: string;
};

type MusicSourceFile = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
};

const ROOT = process.cwd();
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "public", "audio", "music");
const DEFAULT_MANIFEST_PATH = path.join(ROOT, "src", "data", "music.local.json");
const SUPPORTED_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac"]);
const GENERIC_TAGS = new Set([
  "aplmate",
  "com",
  "feat",
  "featuring",
  "ft",
  "official",
  "audio",
  "mixed",
  "mix",
  "slowed",
  "remix"
]);

const parseArgs = (): MusicSyncArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  const inputDir = readArgValue("--input-dir") ?? process.env.MUSIC_LIBRARY_PATH;
  if (!inputDir) {
    throw new Error("Missing music library path. Pass --input-dir or set MUSIC_LIBRARY_PATH in .env.");
  }

  return {
    inputDir: path.resolve(inputDir),
    outputDir: path.resolve(readArgValue("--output-dir") ?? DEFAULT_OUTPUT_DIR),
    manifestPath: path.resolve(readArgValue("--manifest") ?? DEFAULT_MANIFEST_PATH)
  };
};

const toSlug = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const toTitle = (value: string): string => {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const runCommand = async (command: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}: ${stderr}`));
    });
  });
};

const probeDurationSeconds = async (filePath: string): Promise<number> => {
  const stdout = await runCommand("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const durationSeconds = Number(stdout.trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Unable to probe duration for ${filePath}.`);
  }
  return durationSeconds;
};

const listAudioFiles = async (inputDir: string): Promise<MusicSourceFile[]> => {
  const discovered: MusicSourceFile[] = [];

  const walk = async (directoryPath: string): Promise<void> => {
    const directory = await opendir(directoryPath);
    for await (const entry of directory) {
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        continue;
      }
      discovered.push({
        absolutePath,
        relativePath: path.relative(inputDir, absolutePath),
        fileName: entry.name
      });
    }
  };

  await walk(inputDir);
  return discovered.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
};

const inferTags = (fileName: string): string[] => {
  const normalized = path.parse(fileName).name
    .replace(/[_()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = toSlug(normalized)
    .split("-")
    .filter((token) => token.length > 1 && !/^\d+$/.test(token))
    .filter((token) => !GENERIC_TAGS.has(token));
  const tags = new Set<string>(tokens);

  tags.add("music");
  tags.add("song");

  if (tokens.some((token) => ["slow", "slowed", "breathe", "close", "eyes", "see"].includes(token))) {
    tags.add("calm");
  }
  if (tokens.some((token) => ["trap", "sub", "zero", "checklist", "stocked", "rollin", "marked"].includes(token))) {
    tags.add("drive");
  }
  if (tokens.some((token) => ["wish", "wishes", "win", "firestone", "archangel", "lioness"].includes(token))) {
    tags.add("uplift");
  }

  return [...tags];
};

const inferIntensity = (tags: string[], durationSeconds: number): MotionSoundIntensity => {
  const joined = tags.join(" ");
  if (/trap|zero|stocked|checklist|rollin|marked|archangel/.test(joined)) {
    return "hard";
  }
  if (/calm|breathe|close|see/.test(joined) || durationSeconds > 180) {
    return "soft";
  }
  return "medium";
};

const buildAssetId = ({
  fileName,
  existingIds
}: {
  fileName: string;
  existingIds: Set<string>;
}): string => {
  const baseId = `music-${toSlug(path.parse(fileName).name)}`;
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${String(index).padStart(2, "0")}`;
    index += 1;
  }

  existingIds.add(candidate);
  return candidate;
};

const syncMusic = async (): Promise<void> => {
  const args = parseArgs();
  const sourceFiles = await listAudioFiles(args.inputDir);
  const existingIds = new Set<string>();

  await mkdir(args.outputDir, {recursive: true});
  await mkdir(path.dirname(args.manifestPath), {recursive: true});

  const manifests: MotionSoundAsset[] = [];

  for (const sourceFile of sourceFiles) {
    const extension = path.extname(sourceFile.fileName).toLowerCase();
    const fileSlug = toSlug(path.parse(sourceFile.fileName).name);
    const targetFileName = `${fileSlug}${extension}`;
    const targetPath = path.join(args.outputDir, targetFileName);
    const targetSrc = path.relative(path.join(ROOT, "public"), targetPath).replace(/\\/g, "/");

    await cp(sourceFile.absolutePath, targetPath, {force: true});

    const durationSeconds = await probeDurationSeconds(targetPath);
    const tags = inferTags(sourceFile.fileName);
    const id = buildAssetId({
      fileName: sourceFile.fileName,
      existingIds
    });

    manifests.push({
      id,
      label: toTitle(fileSlug),
      src: targetSrc,
      sourceFileName: sourceFile.fileName,
      librarySection: "music",
      durationSeconds,
      tags,
      intensity: inferIntensity(tags, durationSeconds)
    });
  }

  await writeJson(args.manifestPath, manifests);

  console.log(`Music synced: ${manifests.length} files`);
  console.log(`Manifest: ${args.manifestPath}`);
  console.log(`Public dir: ${args.outputDir}`);
}

syncMusic().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
