import path from "node:path";
import {access, mkdir, writeFile} from "node:fs/promises";
import {constants as fsConstants} from "node:fs";

import {soundDesignManifestSchema, type SoundDesignManifest, type SoundDesignPlan, type SoundDesignPresetName, type SoundDesignPresetSettings, type SoundDesignRenderOptions, type SoundDesignRenderResult, type SoundDesignResolvedCue, type SoundDesignResolvedInput, type SoundDesignResolvedTransition, type SoundDesignDialogueSpanPlan} from "./types";
import {compileFilterGraph} from "./filtergraph";
import {formatFfmpegCommand, probeFfmpegCapabilities, probeMediaDurationSeconds, runFfmpegBufferCommand, runFfmpegCommand} from "./ffmpeg";
import {mergePresetSettings} from "./presets";

type ValidateManifestOptions = {
  baseDir?: string;
  checkFiles?: boolean;
};

type RenderOutputSpec = {
  path: string;
  label: string;
  codecArgs: string[];
};

const EPSILON = 0.05;

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const resolveBaseDir = (baseDir?: string): string => path.resolve(baseDir ?? process.cwd());

const resolveManifestPath = (baseDir: string, value: string): string => {
  if (path.isAbsolute(value)) {
    return path.normalize(value);
  }
  return path.normalize(path.resolve(baseDir, value));
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const normalizeCueTransition = (
  transition:
    | SoundDesignManifest["musicCues"][number]["transitionIn"]
    | SoundDesignManifest["musicCues"][number]["transitionOut"]
    | SoundDesignManifest["sfx"][number]["transitionIn"]
    | SoundDesignManifest["sfx"][number]["transitionOut"]
    | undefined,
  cueId: string,
  cueStartSeconds: number,
  cueEndSeconds: number,
  phase: "in" | "out",
  presetOverrides: SoundDesignManifest["presetOverrides"]
): SoundDesignResolvedTransition | undefined => {
  if (!transition) {
    return undefined;
  }

  const presetName = transition.preset as SoundDesignPresetName;
  const overrideSettings = (presetOverrides[presetName] ?? {}) as Partial<SoundDesignPresetSettings>;
  const transitionSettings = transition.settings as Partial<SoundDesignPresetSettings>;
  const mergedSettings = mergePresetSettings(presetName, {
    ...overrideSettings,
    ...transitionSettings
  });

  const startSeconds = transition.start;
  const durationSeconds = transition.duration;
  if (phase === "in" && Math.abs(startSeconds - cueStartSeconds) > EPSILON) {
    throw new Error(`Cue ${cueId} transitionIn must start at the cue start.`);
  }
  if (phase === "out" && Math.abs(startSeconds + durationSeconds - cueEndSeconds) > EPSILON) {
    throw new Error(`Cue ${cueId} transitionOut must end at the cue end.`);
  }

  return {
    preset: transition.preset,
    startSeconds,
    durationSeconds,
    settings: mergedSettings,
    phase
  };
};

const addResolvedInput = (
  inputs: SoundDesignResolvedInput[],
  byPath: Map<string, number>,
  {
    id,
    role,
    path: inputPath
  }: {
    id: string;
    role: SoundDesignResolvedInput["role"];
    path: string;
  }
): number => {
  const existing = byPath.get(inputPath);
  if (typeof existing === "number") {
    return existing;
  }

  const index = inputs.length;
  inputs.push({
    index,
    id,
    role,
    path: inputPath
  });
  byPath.set(inputPath, index);
  return index;
};

const extractImpulseResponsePaths = (
  manifest: SoundDesignManifest
): Array<{preset: SoundDesignPresetName; path: string}> => {
  const paths: Array<{preset: SoundDesignPresetName; path: string}> = [];
  for (const cue of [...manifest.musicCues, ...manifest.sfx]) {
    const inPath = cue.transitionIn?.settings.impulseResponse;
    const outPath = cue.transitionOut?.settings.impulseResponse;
    if (typeof inPath === "string" && inPath.trim()) {
      paths.push({preset: cue.transitionIn!.preset, path: inPath});
    }
    if (typeof outPath === "string" && outPath.trim()) {
      paths.push({preset: cue.transitionOut!.preset, path: outPath});
    }
  }
  return paths;
};

const probeUniqueDurations = async (
  paths: string[]
): Promise<Map<string, number | null>> => {
  const result = new Map<string, number | null>();
  for (const filePath of paths) {
    if (!result.has(filePath)) {
      result.set(filePath, await probeMediaDurationSeconds(filePath));
    }
  }
  return result;
};

export const validateManifest = async (
  manifest: unknown,
  options: ValidateManifestOptions = {}
): Promise<SoundDesignManifest> => {
  const parsed = soundDesignManifestSchema.parse(manifest);
  const baseDir = resolveBaseDir(options.baseDir);
  if (options.checkFiles === false) {
    return parsed;
  }

  const filesToCheck = new Set<string>();
  if (parsed.dialogueSource) {
    filesToCheck.add(resolveManifestPath(baseDir, parsed.dialogueSource));
  }
  parsed.musicCues.forEach((cue) => filesToCheck.add(resolveManifestPath(baseDir, cue.file)));
  parsed.sfx.forEach((cue) => filesToCheck.add(resolveManifestPath(baseDir, cue.file)));
  extractImpulseResponsePaths(parsed).forEach((entry) => filesToCheck.add(resolveManifestPath(baseDir, entry.path)));

  const missingFiles: string[] = [];
  for (const filePath of filesToCheck) {
    if (!(await fileExists(filePath))) {
      missingFiles.push(filePath);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`Sound design manifest references missing files: ${missingFiles.join(", ")}`);
  }

  return parsed;
};

const buildResolvedCue = async ({
  cue,
  baseDir,
  cueIndex,
  role,
  durations,
  timelineDurationSeconds,
  presetOverrides
  }: {
  cue: SoundDesignManifest["musicCues"][number] | SoundDesignManifest["sfx"][number];
  baseDir: string;
  cueIndex: number;
  role: "music" | "sfx";
  durations: Map<string, number | null>;
  timelineDurationSeconds: number;
  presetOverrides: SoundDesignManifest["presetOverrides"];
}): Promise<{
  cue: SoundDesignResolvedCue;
  inputPath: string;
  warnings: string[];
  notes: string[];
}> => {
  const warnings: string[] = [];
  const notes: string[] = [];
  const inputPath = resolveManifestPath(baseDir, cue.file);
  const availableDurationSeconds = durations.get(inputPath) ?? null;
  if (availableDurationSeconds === null) {
    throw new Error(`Unable to probe duration for ${inputPath}.`);
  }

  const sourceStartSeconds = cue.sourceStart ?? 0;
  const sourceEndSeconds = cue.sourceEnd ?? availableDurationSeconds;
  if (sourceStartSeconds < 0 || sourceEndSeconds <= sourceStartSeconds) {
    throw new Error(`Cue ${cue.id} has an invalid source window.`);
  }
  if (sourceEndSeconds > availableDurationSeconds + EPSILON) {
    throw new Error(`Cue ${cue.id} sourceEnd exceeds the available media duration.`);
  }
  if (cue.end > timelineDurationSeconds + EPSILON) {
    throw new Error(`Cue ${cue.id} end exceeds the manifest duration.`);
  }

  const resolvedTransitions: Partial<Record<"transitionIn" | "transitionOut", SoundDesignResolvedTransition>> = {};
  const presetSettings: Partial<Record<SoundDesignPresetName, SoundDesignPresetSettings>> = {};
  if (cue.transitionIn) {
    const transition = normalizeCueTransition(
      cue.transitionIn,
      cue.id,
      cue.start,
      cue.end,
      "in",
      presetOverrides
    );
    if (transition) {
      resolvedTransitions.transitionIn = transition;
      presetSettings[transition.preset] = transition.settings;
    }
  }
  if (cue.transitionOut) {
    const transition = normalizeCueTransition(
      cue.transitionOut,
      cue.id,
      cue.start,
      cue.end,
      "out",
      presetOverrides
    );
    if (transition) {
      resolvedTransitions.transitionOut = transition;
      presetSettings[transition.preset] = transition.settings;
    }
  }

  const cueDurationSeconds = cue.end - cue.start;
  notes.push(`Resolved ${cue.id} (${role}) to ${cueDurationSeconds.toFixed(3)} seconds.`);

  return {
    cue: {
      index: cueIndex,
      id: cue.id,
      role,
      inputIndex: 0,
      sourcePath: inputPath,
      startSeconds: cue.start,
      endSeconds: cue.end,
      durationSeconds: cueDurationSeconds,
      gainDb: cue.gainDb,
      sourceStartSeconds,
      sourceEndSeconds,
      tempoStretchRatio: cue.tempoStretchRatio,
      transitionIn: resolvedTransitions.transitionIn,
      transitionOut: resolvedTransitions.transitionOut,
      presetSettings,
      tags: cue.tags ?? []
    },
    inputPath,
    warnings,
    notes
  };
};

const buildDialoguePlan = async ({
  manifest,
  baseDir,
  durations
}: {
  manifest: SoundDesignManifest;
  baseDir: string;
  durations: Map<string, number | null>;
}): Promise<{
  spans: SoundDesignDialogueSpanPlan[];
  inputPath: string | null;
}> => {
  if (!manifest.dialogueSource || manifest.dialogue.length === 0) {
    return {
      spans: [],
      inputPath: null
    };
  }

  const inputPath = resolveManifestPath(baseDir, manifest.dialogueSource);
  const availableDurationSeconds = durations.get(inputPath) ?? null;
  if (availableDurationSeconds === null) {
    throw new Error(`Unable to probe duration for dialogue source ${inputPath}.`);
  }

  const spans = manifest.dialogue.map((span, index) => {
    if (span.start < 0 || span.end <= span.start) {
      throw new Error(`Dialogue span ${index + 1} is invalid.`);
    }
    if (span.end > manifest.duration + EPSILON) {
      throw new Error(`Dialogue span ${index + 1} exceeds the manifest duration.`);
    }
    if (span.end > availableDurationSeconds + EPSILON) {
      throw new Error(`Dialogue span ${index + 1} exceeds the available dialogue source duration.`);
    }
    return {
      index,
      label: span.label ?? `dialogue_span_${index + 1}`,
      startSeconds: span.start,
      endSeconds: span.end,
      gainDb: span.gainDb ?? 0
    };
  });

  return {
    spans,
    inputPath
  };
};

export const buildSoundDesignPlan = async (
  manifest: unknown,
  options: ValidateManifestOptions = {}
): Promise<SoundDesignPlan> => {
  const parsed = await validateManifest(manifest, {
    ...options,
    checkFiles: options.checkFiles ?? true
  });
  const baseDir = resolveBaseDir(options.baseDir);
  const durations = await probeUniqueDurations(
    [
      ...(parsed.dialogueSource ? [resolveManifestPath(baseDir, parsed.dialogueSource)] : []),
      ...parsed.musicCues.map((cue) => resolveManifestPath(baseDir, cue.file)),
      ...parsed.sfx.map((cue) => resolveManifestPath(baseDir, cue.file)),
      ...extractImpulseResponsePaths(parsed).map((entry) => resolveManifestPath(baseDir, entry.path))
    ].filter((value, index, array) => array.indexOf(value) === index)
  );

  const resolvedInputs: SoundDesignResolvedInput[] = [];
  const byPath = new Map<string, number>();
  const warnings: string[] = [];
  const notes: string[] = [];

  if (parsed.dialogueSource) {
    addResolvedInput(resolvedInputs, byPath, {
      id: "dialogue_source",
      role: "dialogue",
      path: resolveManifestPath(baseDir, parsed.dialogueSource)
    });
  }

  const resolvedMusic: SoundDesignResolvedCue[] = [];
  for (const [index, cue] of parsed.musicCues.entries()) {
    const resolved = await buildResolvedCue({
      cue,
      baseDir,
      cueIndex: index,
      role: "music",
      durations,
      timelineDurationSeconds: parsed.duration,
      presetOverrides: parsed.presetOverrides
    });
    const inputIndex = addResolvedInput(resolvedInputs, byPath, {
      id: cue.id,
      role: "music",
      path: resolved.inputPath
    });
    resolved.cue.inputIndex = inputIndex;
    resolvedMusic.push(resolved.cue);
    warnings.push(...resolved.warnings);
    notes.push(...resolved.notes);
  }

  const resolvedSfx: SoundDesignResolvedCue[] = [];
  for (const [index, cue] of parsed.sfx.entries()) {
    const resolved = await buildResolvedCue({
      cue,
      baseDir,
      cueIndex: index,
      role: "sfx",
      durations,
      timelineDurationSeconds: parsed.duration,
      presetOverrides: parsed.presetOverrides
    });
    const inputIndex = addResolvedInput(resolvedInputs, byPath, {
      id: cue.id,
      role: "sfx",
      path: resolved.inputPath
    });
    resolved.cue.inputIndex = inputIndex;
    resolvedSfx.push(resolved.cue);
    warnings.push(...resolved.warnings);
    notes.push(...resolved.notes);
  }

  for (const entry of extractImpulseResponsePaths(parsed)) {
    addResolvedInput(resolvedInputs, byPath, {
      id: `${entry.preset}_impulse_response`,
      role: "impulse-response",
      path: resolveManifestPath(baseDir, entry.path)
    });
  }

  const dialoguePlan = await buildDialoguePlan({
    manifest: parsed,
    baseDir,
    durations
  });
  if (dialoguePlan.inputPath) {
    addResolvedInput(resolvedInputs, byPath, {
      id: "dialogue_source",
      role: "dialogue",
      path: dialoguePlan.inputPath
    });
  }

  const capabilityFlags = await probeFfmpegCapabilities();

  return {
    manifest: parsed,
    baseDir,
    resolvedInputs,
    dialogueSpans: dialoguePlan.spans,
    musicCues: resolvedMusic,
    sfxCues: resolvedSfx,
    capabilities: capabilityFlags,
    warnings,
    notes
  };
};

const buildOutputCommandArgs = ({
  filterScript,
  inputs,
  outputs
}: {
  filterScript: string;
  inputs: string[];
  outputs: RenderOutputSpec[];
}): string[] => {
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  inputs.forEach((inputPath) => {
    args.push("-i", inputPath);
  });
  args.push("-filter_complex", filterScript);
  outputs.forEach((output) => {
    args.push("-map", `[${output.label}]`, ...output.codecArgs, output.path);
  });
  return args;
};

const buildPreviewWaveformCommandArgs = (sourcePath: string, outputPath: string): string[] => {
  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-filter_complex",
    "showwavespic=s=1920x320:split_channels=1",
    "-frames:v",
    "1",
    outputPath
  ];
};

const extractWavePeaks = async (filePath: string): Promise<{
  sampleRate: number;
  bucketCount: number;
  peaks: Array<{index: number; min: number; max: number; rms: number}>;
}> => {
  const sampleRate = 22050;
  const {stdout} = await runFfmpegBufferCommand([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    filePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(sampleRate),
    "-f",
    "f32le",
    "pipe:1"
  ]);

  const sampleCount = Math.floor(stdout.byteLength / 4);
  const bucketCount = Math.min(256, Math.max(64, Math.ceil(sampleCount / 4096)));
  const bucketSize = Math.max(1, Math.ceil(sampleCount / bucketCount));
  const peaks: Array<{index: number; min: number; max: number; rms: number}> = [];

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = bucketIndex * bucketSize;
    const end = Math.min(sampleCount, start + bucketSize);
    let min = 1;
    let max = -1;
    let sumSquares = 0;
    let count = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      const value = stdout.readFloatLE(sampleIndex * 4);
      min = Math.min(min, value);
      max = Math.max(max, value);
      sumSquares += value * value;
      count += 1;
    }

    if (count === 0) {
      peaks.push({index: bucketIndex, min: 0, max: 0, rms: 0});
      continue;
    }

    peaks.push({
      index: bucketIndex,
      min: round(min, 6),
      max: round(max, 6),
      rms: round(Math.sqrt(sumSquares / count), 6)
    });
  }

  return {
    sampleRate,
    bucketCount,
    peaks
  };
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

export const renderMasterTrack = async (
  manifest: unknown,
  outputPath: string,
  options: SoundDesignRenderOptions = {}
): Promise<SoundDesignRenderResult> => {
  const baseDir = resolveBaseDir(options.baseDir);
  const parsedManifest = await validateManifest(manifest, {baseDir, checkFiles: true});
  const plan = await buildSoundDesignPlan(parsedManifest, {baseDir, checkFiles: false});
  const masterCompilation = compileFilterGraph(plan, {mode: "master"});
  const previewCompilation = options.previewMixPath ? compileFilterGraph(plan, {mode: "preview"}) : masterCompilation;
  const stemsCompilation = options.stemsDir ? compileFilterGraph(plan, {mode: "stems"}) : null;

  const masterPath = path.resolve(outputPath);
  await mkdir(path.dirname(masterPath), {recursive: true});

  const aacPath = options.aacPath ? path.resolve(options.aacPath) : null;
  const previewMixPath = options.previewMixPath ? path.resolve(options.previewMixPath) : null;
  const waveformPngPath = options.waveformPngPath ? path.resolve(options.waveformPngPath) : null;
  const peaksJsonPath = options.peaksJsonPath ? path.resolve(options.peaksJsonPath) : null;
  const stemsDir = options.stemsDir ? path.resolve(options.stemsDir) : null;
  const debugPlanPath = options.debugPlanPath ? path.resolve(options.debugPlanPath) : null;

  if (debugPlanPath) {
    await writeJson(debugPlanPath, {
      manifest: parsedManifest,
      plan,
      compilation: masterCompilation
    });
  }

  const masterCommandArgs = buildOutputCommandArgs({
    filterScript: masterCompilation.filterComplexScript,
    inputs: masterCompilation.inputFiles,
    outputs: [
      {
        path: masterPath,
        label: masterCompilation.masterLabel,
        codecArgs: ["-c:a", "pcm_s16le"]
      }
    ]
  });
  const masterCommand = formatFfmpegCommand(masterCommandArgs);
  options.logCommand?.(masterCommand);
  await runFfmpegCommand(masterCommandArgs);

  let aacCommand: string | null = null;
  if (aacPath) {
    await mkdir(path.dirname(aacPath), {recursive: true});
    const aacArgs = buildOutputCommandArgs({
      filterScript: masterCompilation.filterComplexScript,
      inputs: masterCompilation.inputFiles,
      outputs: [
        {
          path: aacPath,
          label: masterCompilation.masterLabel,
          codecArgs: ["-c:a", "aac", "-b:a", "320k"]
        }
      ]
    });
    aacCommand = formatFfmpegCommand(aacArgs);
    options.logCommand?.(aacCommand);
    await runFfmpegCommand(aacArgs);
  }

  let previewCommand: string | null = null;
  if (previewMixPath) {
    await mkdir(path.dirname(previewMixPath), {recursive: true});
    const previewArgs = buildOutputCommandArgs({
      filterScript: previewCompilation.previewFilterComplexScript,
      inputs: previewCompilation.inputFiles,
      outputs: [
        {
          path: previewMixPath,
          label: previewCompilation.previewLabel,
          codecArgs: ["-c:a", "pcm_s16le"]
        }
      ]
    });
    previewCommand = formatFfmpegCommand(previewArgs);
    options.logCommand?.(previewCommand);
    await runFfmpegCommand(previewArgs);
  }

  if (stemsDir && stemsCompilation) {
    await mkdir(stemsDir, {recursive: true});
    const stemOutputs: RenderOutputSpec[] = [];
    if (stemsCompilation.stemLabels.dialogue) {
      stemOutputs.push({
        path: path.join(stemsDir, "dialogue.wav"),
        label: stemsCompilation.stemLabels.dialogue,
        codecArgs: ["-c:a", "pcm_s16le"]
      });
    }
    if (stemsCompilation.stemLabels.music) {
      stemOutputs.push({
        path: path.join(stemsDir, "music.wav"),
        label: stemsCompilation.stemLabels.music,
        codecArgs: ["-c:a", "pcm_s16le"]
      });
    }
    if (stemsCompilation.stemLabels.sfx) {
      stemOutputs.push({
        path: path.join(stemsDir, "sfx.wav"),
        label: stemsCompilation.stemLabels.sfx,
        codecArgs: ["-c:a", "pcm_s16le"]
      });
    }
    if (stemOutputs.length > 0) {
      const stemArgs = buildOutputCommandArgs({
        filterScript: stemsCompilation.filterComplexScript,
        inputs: stemsCompilation.inputFiles,
        outputs: stemOutputs
      });
      const stemCommand = formatFfmpegCommand(stemArgs);
      options.logCommand?.(stemCommand);
      await runFfmpegCommand(stemArgs);
    }
  }

  if (waveformPngPath) {
    const waveformSource = previewMixPath ?? masterPath;
    await mkdir(path.dirname(waveformPngPath), {recursive: true});
    const waveformArgs = buildPreviewWaveformCommandArgs(waveformSource, waveformPngPath);
    options.logCommand?.(formatFfmpegCommand(waveformArgs));
    await runFfmpegCommand(waveformArgs);
  }

  if (peaksJsonPath) {
    const waveformSource = previewMixPath ?? masterPath;
    const peaks = await extractWavePeaks(waveformSource);
    await writeJson(peaksJsonPath, {
      source: waveformSource,
      ...peaks
    });
  }

  return {
    manifest: parsedManifest,
    plan,
    compilation: masterCompilation,
    masterPath,
    aacPath,
    previewMixPath,
    waveformPngPath,
    peaksJsonPath,
    stemPaths: {
      dialogue: stemsDir && stemsCompilation?.stemLabels.dialogue ? path.join(stemsDir, "dialogue.wav") : null,
      music: stemsDir && stemsCompilation?.stemLabels.music ? path.join(stemsDir, "music.wav") : null,
      sfx: stemsDir && stemsCompilation?.stemLabels.sfx ? path.join(stemsDir, "sfx.wav") : null
    },
    ffmpegCommand: masterCommand,
    previewFfmpegCommand: previewCommand,
    warnings: plan.warnings,
    debug: {
      capabilityFlags: plan.capabilities,
      notes: plan.notes,
      inputFiles: masterCompilation.inputFiles,
      appliedPresets: masterCompilation.appliedPresets,
      previewEnabled: Boolean(previewMixPath),
      stemsEnabled: Boolean(stemsDir),
      waveformEnabled: Boolean(waveformPngPath),
      peaksEnabled: Boolean(peaksJsonPath),
      aacCommand
    }
  };
};
