import {cp, mkdir, readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";

import type {
  MotionSoundAsset,
  MotionSoundIntensity,
  MotionSoundLibrarySection
} from "../src/lib/types.ts";

type SoundSyncArgs = {
  inputDir: string;
  outputDir: string;
  manifestPath: string;
};

type SoundSourceFile = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  section: MotionSoundLibrarySection;
};

const ROOT = process.cwd();
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "public", "audio", "sfx");
const DEFAULT_MANIFEST_PATH = path.join(ROOT, "src", "data", "sound-fx.local.json");
const SECTION_ALIASES: Record<string, MotionSoundLibrarySection> = {
  clock: "clock",
  clocks: "clock",
  drone: "drone",
  drones: "drone",
  impact: "impact-hit",
  impacts: "impact-hit",
  riser: "riser",
  risers: "riser",
  snap: "snap",
  snaps: "snap",
  text: "text",
  texts: "text",
  transition: "transition",
  transitions: "transition",
  ui: "ui",
  interface: "ui",
  whoosh: "whoosh",
  whooshes: "whoosh"
};
const SUPPORTED_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac"]);
const GENERIC_TAGS = new Set([
  "dragon",
  "studio",
  "sound",
  "effects",
  "effect",
  "community",
  "cinematic",
  "simple",
  "long",
  "deep",
  "dark",
  "fast"
]);

const parseArgs = (): SoundSyncArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  const inputDir = readArgValue("--input-dir");
  if (!inputDir) {
    throw new Error("Missing required --input-dir argument.");
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

const normalizeSection = (directoryName: string): MotionSoundLibrarySection => {
  const normalized = toSlug(directoryName);
  const token = normalized
    .split("-")
    .find((entry) => SECTION_ALIASES[entry]);

  if (!token) {
    throw new Error(`Unsupported sound section: ${directoryName}`);
  }

  return SECTION_ALIASES[token];
};

const listAudioFiles = async (inputDir: string): Promise<SoundSourceFile[]> => {
  const sectionDirs = await readdir(inputDir, {withFileTypes: true});
  const files: SoundSourceFile[] = [];

  for (const entry of sectionDirs) {
    if (!entry.isDirectory()) {
      continue;
    }
    const section = normalizeSection(entry.name);
    const sectionDir = path.join(inputDir, entry.name);
    const sectionFiles = await readdir(sectionDir, {withFileTypes: true});
    sectionFiles.forEach((sectionEntry) => {
      if (!sectionEntry.isFile()) {
        return;
      }
      const extension = path.extname(sectionEntry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        return;
      }
      files.push({
        absolutePath: path.join(sectionDir, sectionEntry.name),
        relativePath: path.join(entry.name, sectionEntry.name),
        fileName: sectionEntry.name,
        section
      });
    });
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
};

const inferTags = (section: MotionSoundLibrarySection, fileName: string): string[] => {
  const tokens = toSlug(path.parse(fileName).name)
    .split("-")
    .filter((token) => token.length > 1 && !/^\d+$/.test(token))
    .filter((token) => !GENERIC_TAGS.has(token));
  const tags = new Set<string>(tokens);

  if (section === "clock") {
    tags.add("time");
    tags.add("tick");
  }
  if (section === "drone") {
    tags.add("tension");
    tags.add("ambience");
  }
  if (section === "impact-hit") {
    tags.add("impact");
    tags.add("hit");
    tags.add("accent");
  }
  if (section === "riser") {
    tags.add("lift");
    tags.add("build");
  }
  if (section === "text") {
    tags.add("typing");
    tags.add("keyboard");
  }
  if (section === "transition" || section === "whoosh") {
    tags.add("transition");
    tags.add("movement");
  }
  if (section === "ui" || section === "snap") {
    tags.add("click");
    tags.add("accent");
  }

  return [...tags];
};

const inferIntensity = (section: MotionSoundLibrarySection, tags: string[]): MotionSoundIntensity => {
  const joined = tags.join(" ");

  if (section === "impact-hit" || section === "riser") {
    return "hard";
  }
  if (section === "drone" || section === "whoosh" || /epic|boom|large|flashback|glitch/.test(joined)) {
    return "medium";
  }
  return "soft";
};

const buildAssetId = ({
  section,
  fileName,
  existingIds
}: {
  section: MotionSoundLibrarySection;
  fileName: string;
  existingIds: Set<string>;
}): string => {
  const baseId = `${section}-${toSlug(path.parse(fileName).name)}`;
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${String(index).padStart(2, "0")}`;
    index += 1;
  }

  existingIds.add(candidate);
  return candidate;
};

const syncSoundFx = async (): Promise<void> => {
  const args = parseArgs();
  const sourceFiles = await listAudioFiles(args.inputDir);
  const existingIds = new Set<string>();

  await mkdir(args.outputDir, {recursive: true});
  await mkdir(path.dirname(args.manifestPath), {recursive: true});

  const manifests: MotionSoundAsset[] = [];

  for (const sourceFile of sourceFiles) {
    const extension = path.extname(sourceFile.fileName).toLowerCase();
    const fileSlug = toSlug(path.parse(sourceFile.fileName).name);
    const targetDir = path.join(args.outputDir, sourceFile.section);
    const targetFileName = `${fileSlug}${extension}`;
    const targetPath = path.join(targetDir, targetFileName);
    const targetSrc = path.relative(path.join(ROOT, "public"), targetPath).replace(/\\/g, "/");

    await mkdir(targetDir, {recursive: true});
    await cp(sourceFile.absolutePath, targetPath, {force: true});

    const tags = inferTags(sourceFile.section, sourceFile.fileName);
    const durationSeconds = await probeDurationSeconds(targetPath);
    const id = buildAssetId({
      section: sourceFile.section,
      fileName: sourceFile.fileName,
      existingIds
    });

    manifests.push({
      id,
      label: toTitle(fileSlug),
      src: targetSrc,
      sourceFileName: sourceFile.fileName,
      librarySection: sourceFile.section,
      durationSeconds,
      tags,
      intensity: inferIntensity(sourceFile.section, tags)
    });
  }

  await writeJson(args.manifestPath, manifests);

  console.log(`Sound FX synced: ${manifests.length} files`);
  console.log(`Manifest: ${args.manifestPath}`);
  console.log(`Public dir: ${args.outputDir}`);
};

syncSoundFx().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
