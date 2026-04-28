import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";

import type {NolanClipCandidate, NolanClipPlan} from "../src/lib/nolan-clip-engine";

type ExtractCliArgs = {
  planPath: string;
  videoPath: string | null;
  outDir: string | null;
  page: number | null;
  candidateIds: string[];
  limit: number | null;
};

type NolanExtractManifestEntry = {
  candidateId: string;
  rank: number;
  page: number;
  score: number;
  title: string;
  slug: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  fileName: string;
  absolutePath: string;
  relativePublicPath: string | null;
  tags: string[];
  reasoning: string[];
};

type NolanExtractManifest = {
  createdAt: string;
  planPath: string;
  sourceVideoPath: string;
  page: number | null;
  limit: number | null;
  selectedCandidateIds: string[];
  itemCount: number;
  items: NolanExtractManifestEntry[];
};

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const DEFAULT_PLAN_PATH = path.join(ROOT, "src", "data", "nolan-clips.longform.json");

const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const toSlug = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const toRelativePublicPath = (filePath: string): string | null => {
  const normalizedPublicDir = path.resolve(PUBLIC_DIR);
  const normalizedFilePath = path.resolve(filePath);
  if (!normalizedFilePath.startsWith(normalizedPublicDir)) {
    return null;
  }
  return normalizedFilePath.slice(normalizedPublicDir.length + 1).replace(/\\/g, "/");
};

const runCommand = async (command: string, args: string[]): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(String(chunk));
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(String(chunk));
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
    });
  });
};

const parsePositiveInteger = (value: string | undefined, flag: string): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
};

const parseArgs = (): ExtractCliArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  const page = parsePositiveInteger(readArgValue("--page"), "--page");
  const candidateIds = (readArgValue("--candidate-ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    planPath: path.resolve(readArgValue("--plan") ?? DEFAULT_PLAN_PATH),
    videoPath: readArgValue("--video") ? path.resolve(readArgValue("--video") as string) : null,
    outDir: readArgValue("--out-dir") ? path.resolve(readArgValue("--out-dir") as string) : null,
    page,
    candidateIds,
    limit: parsePositiveInteger(readArgValue("--limit"), "--limit")
  };
};

const selectCandidates = ({
  plan,
  page,
  candidateIds,
  limit
}: {
  plan: NolanClipPlan;
  page: number | null;
  candidateIds: string[];
  limit: number | null;
}): NolanClipCandidate[] => {
  let candidates = plan.candidates;

  if (candidateIds.length > 0) {
    const candidateIdSet = new Set(candidateIds);
    candidates = plan.candidates.filter((candidate) => candidateIdSet.has(candidate.id));
  } else if (page) {
    candidates = plan.pages.find((entry) => entry.page === page)?.items ?? [];
  }

  if (limit) {
    candidates = candidates.slice(0, limit);
  }

  return candidates;
};

const resolveOutputDir = ({
  cliArgs,
  sourceVideoPath
}: {
  cliArgs: ExtractCliArgs;
  sourceVideoPath: string;
}): string => {
  if (cliArgs.outDir) {
    return cliArgs.outDir;
  }

  const sourceSlug = toSlug(path.parse(sourceVideoPath).name) || "source-video";
  const selectionLabel = cliArgs.page
    ? `page-${String(cliArgs.page).padStart(2, "0")}`
    : cliArgs.candidateIds.length > 0
      ? "selection"
      : "top-clips";

  return path.join(PUBLIC_DIR, "nolan-clips", sourceSlug, selectionLabel);
};

const extractCandidateClip = async ({
  sourceVideoPath,
  outputPath,
  candidate
}: {
  sourceVideoPath: string;
  outputPath: string;
  candidate: NolanClipCandidate;
}): Promise<void> => {
  const startSeconds = (candidate.startMs / 1000).toFixed(3);
  const durationSeconds = (candidate.durationMs / 1000).toFixed(3);

  await runCommand("ffmpeg", [
    "-y",
    "-v", "error",
    "-stats",
    "-i", sourceVideoPath,
    "-ss", startSeconds,
    "-t", durationSeconds,
    "-map", "0:v:0",
    "-map", "0:a?",
    "-sn",
    "-dn",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    outputPath
  ]);
};

const main = async (): Promise<void> => {
  const cliArgs = parseArgs();
  await stat(cliArgs.planPath);
  const plan = await readJsonFile<NolanClipPlan>(cliArgs.planPath);
  const sourceVideoPath = cliArgs.videoPath ?? plan.sourceVideoPath;

  if (!sourceVideoPath) {
    throw new Error("No source video path was available. Pass --video explicitly or regenerate the plan with a source video path.");
  }

  await stat(sourceVideoPath);
  const selectedCandidates = selectCandidates({
    plan,
    page: cliArgs.page,
    candidateIds: cliArgs.candidateIds,
    limit: cliArgs.limit
  });

  if (selectedCandidates.length === 0) {
    throw new Error("No Nolan candidates matched the requested selection.");
  }

  const outDir = resolveOutputDir({
    cliArgs,
    sourceVideoPath
  });
  await mkdir(outDir, {recursive: true});

  const manifestEntries: NolanExtractManifestEntry[] = [];

  for (const candidate of selectedCandidates) {
    const fileName = `${String(candidate.rank).padStart(2, "0")}-${candidate.slug || candidate.id}.mp4`;
    const outputPath = path.join(outDir, fileName);
    await extractCandidateClip({
      sourceVideoPath,
      outputPath,
      candidate
    });

    manifestEntries.push({
      candidateId: candidate.id,
      rank: candidate.rank,
      page: candidate.page,
      score: candidate.score,
      title: candidate.title,
      slug: candidate.slug,
      startMs: candidate.startMs,
      endMs: candidate.endMs,
      durationMs: candidate.durationMs,
      fileName,
      absolutePath: outputPath,
      relativePublicPath: toRelativePublicPath(outputPath),
      tags: candidate.tags,
      reasoning: candidate.reasoning
    });
  }

  const manifest: NolanExtractManifest = {
    createdAt: new Date().toISOString(),
    planPath: cliArgs.planPath,
    sourceVideoPath,
    page: cliArgs.page,
    limit: cliArgs.limit,
    selectedCandidateIds: manifestEntries.map((entry) => entry.candidateId),
    itemCount: manifestEntries.length,
    items: manifestEntries
  };
  const manifestName = cliArgs.page
    ? `nolan-extract.page-${String(cliArgs.page).padStart(2, "0")}.manifest.json`
    : "nolan-extract.manifest.json";
  const manifestPath = path.join(outDir, manifestName);
  await writeJson(manifestPath, manifest);

  console.log(`Plan: ${cliArgs.planPath}`);
  console.log(`Source video: ${sourceVideoPath}`);
  console.log(`Extracted clips: ${manifestEntries.length}`);
  console.log(`Output directory: ${outDir}`);
  console.log(`Manifest: ${manifestPath}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
