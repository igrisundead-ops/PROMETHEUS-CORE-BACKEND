import type {
  SoundDesignCapabilityFlags,
  SoundDesignPresetName,
  SoundDesignPresetSettings
} from "./types";

export type SoundDesignPresetCompileContext = {
  cueId: string;
  cueDurationSeconds: number;
  phase: "in" | "out" | "bed";
  transition?: {
    durationSeconds: number;
  };
  settings: SoundDesignPresetSettings;
  capabilities: SoundDesignCapabilityFlags;
};

export type SoundDesignPresetCompilation = {
  filters: string[];
  notes: string[];
};

const toFixedSeconds = (value: number): string => {
  return Number(value.toFixed(3)).toString();
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const DEFAULT_PRESET_SETTINGS: Record<SoundDesignPresetName, SoundDesignPresetSettings> = {
  tail_wash_out: {
    fadeOutSeconds: 1.2,
    echoMix: 0.34,
    echoDelayMs: 122,
    echoDecay: 0.28,
    lowpassHz: 7600,
    highpassHz: 90,
    tailGainDb: -1.25
  },
  reverb_throw: {
    fadeOutSeconds: 1,
    echoMix: 0.42,
    echoDelayMs: 96,
    echoDecay: 0.34,
    lowpassHz: 6400,
    highpassHz: 100,
    tailGainDb: -2
  },
  echo_throw_cut: {
    fadeOutSeconds: 0.18,
    echoMix: 0.38,
    echoDelayMs: 68,
    echoDecay: 0.5,
    lowpassHz: 9000,
    highpassHz: 120,
    tailGainDb: -1
  },
  filter_sink: {
    fadeOutSeconds: 1.35,
    lowpassHz: 1800,
    highpassHz: 70,
    tailGainDb: -4
  },
  soft_overlap_in: {
    fadeInSeconds: 0.8,
    lowpassHz: 16000,
    wetMix: 0.12,
    dryMix: 1,
    tailGainDb: 0
  },
  impact_handoff: {
    fadeOutSeconds: 0.9,
    highpassHz: 140,
    echoMix: 0.24,
    echoDelayMs: 42,
    echoDecay: 0.44,
    tailGainDb: 0.5
  },
  dialogue_safe_bed: {
    fadeInSeconds: 0.6,
    fadeOutSeconds: 0.8,
    lowpassHz: 12000,
    highpassHz: 80,
    duckingGainDb: -8,
    tailGainDb: -8
  }
};

export const mergePresetSettings = (
  preset: SoundDesignPresetName,
  overrides: Partial<SoundDesignPresetSettings> | undefined
): SoundDesignPresetSettings => {
  return {
    ...DEFAULT_PRESET_SETTINGS[preset],
    ...overrides
  };
};

const applyTempoStretch = ({
  settings,
  capabilities,
  notes
}: {
  settings: SoundDesignPresetSettings;
  capabilities: SoundDesignCapabilityFlags;
  notes: string[];
}): string[] => {
  const ratio = settings.tempoStretchRatio;
  if (!ratio || Math.abs(ratio - 1) < 0.001) {
    return [];
  }

  notes.push(capabilities.rubberband ? `Applied tempo stretch with rubberband=${ratio.toFixed(3)}.` : `Applied fallback tempo stretch=${ratio.toFixed(3)}.`);

  if (capabilities.rubberband) {
    return [`rubberband=tempo=${toFixedSeconds(ratio)}`];
  }

  const filters: string[] = [];
  let remaining = ratio;
  while (remaining > 2) {
    filters.push("atempo=2.0");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining *= 2;
  }
  filters.push(`atempo=${toFixedSeconds(clamp(remaining, 0.5, 2))}`);
  return filters;
};

const applyToneFilters = ({
  settings,
  phase,
  cueDurationSeconds,
  transitionDurationSeconds
}: {
  settings: SoundDesignPresetSettings;
  phase: "in" | "out" | "bed";
  cueDurationSeconds: number;
  transitionDurationSeconds?: number;
}): string[] => {
  const filters: string[] = [];
  if (typeof settings.highpassHz === "number") {
    filters.push(`highpass=f=${Math.round(settings.highpassHz)}`);
  }
  if (typeof settings.lowpassHz === "number") {
    filters.push(`lowpass=f=${Math.round(settings.lowpassHz)}`);
  }

  if (phase === "in") {
    const fadeInSeconds = clamp(
      transitionDurationSeconds ?? settings.fadeInSeconds ?? 0.55,
      0.05,
      Math.max(0.1, cueDurationSeconds)
    );
    filters.push(`afade=t=in:d=${toFixedSeconds(fadeInSeconds)}`);
  } else if (phase === "out") {
    const fadeOutSeconds = clamp(
      transitionDurationSeconds ?? settings.fadeOutSeconds ?? 0.9,
      0.05,
      Math.max(0.1, cueDurationSeconds)
    );
    const fadeStart = Math.max(0, cueDurationSeconds - fadeOutSeconds);
    filters.push(`afade=t=out:st=${toFixedSeconds(fadeStart)}:d=${toFixedSeconds(fadeOutSeconds)}`);
  }

  if (typeof settings.tailGainDb === "number" && settings.tailGainDb !== 0) {
    filters.push(`volume=${toFixedSeconds(settings.tailGainDb)}dB`);
  }

  return filters;
};

const buildEchoTail = ({
  settings,
  phase,
  cueDurationSeconds
}: {
  settings: SoundDesignPresetSettings;
  phase: "in" | "out" | "bed";
  cueDurationSeconds: number;
}): string[] => {
  if (phase === "in") {
    return [];
  }

  const echoMix = clamp(settings.echoMix ?? 0.32, 0, 1);
  const echoDelayMs = Math.max(24, Math.round(settings.echoDelayMs ?? 120));
  const echoDecay = clamp(settings.echoDecay ?? 0.28, 0, 1);
  const echoDelayAlt = Math.max(echoDelayMs + 36, Math.round(echoDelayMs * 1.52));
  const echoDecayAlt = clamp(echoDecay * 0.72, 0, 1);
  const inGain = clamp(1 - echoMix * 0.55, 0.1, 1);
  const outGain = clamp(0.2 + echoMix * 0.4, 0.1, 1);

  return [
    `aecho=in_gain=${toFixedSeconds(inGain)}:out_gain=${toFixedSeconds(outGain)}:delays=${echoDelayMs}|${echoDelayAlt}:decays=${toFixedSeconds(echoDecay)}|${toFixedSeconds(echoDecayAlt)}`
  ];
};

const buildPresetsForPhase = (
  preset: SoundDesignPresetName,
  context: SoundDesignPresetCompileContext
): SoundDesignPresetCompilation => {
  const notes: string[] = [];
  const filters: string[] = [];
  const {settings, phase, cueDurationSeconds} = context;

  filters.push(...applyTempoStretch({settings, capabilities: context.capabilities, notes}));

  switch (preset) {
    case "tail_wash_out": {
      filters.push(...applyToneFilters({
        settings,
        phase,
        cueDurationSeconds,
        transitionDurationSeconds: context.transition?.durationSeconds
      }));
      if (!(phase === "out" && settings.impulseResponse && context.capabilities.afir)) {
        filters.push(...buildEchoTail({settings, phase, cueDurationSeconds}));
      } else {
        notes.push("Impulse-response tail is delegated to afir so the wash-out stays clean.");
      }
      notes.push("Tail wash out keeps the exit open with a gentle reverberant release.");
      break;
    }
    case "reverb_throw": {
      filters.push(...applyToneFilters({
        settings,
        phase,
        cueDurationSeconds,
        transitionDurationSeconds: context.transition?.durationSeconds
      }));
      if (!(phase === "out" && settings.impulseResponse && context.capabilities.afir)) {
        filters.push(...buildEchoTail({settings, phase, cueDurationSeconds}));
      } else {
        notes.push("Impulse-response tail is delegated to afir so the throw remains focused.");
      }
      notes.push("Reverb throw adds a wider tail without collapsing the dry punch.");
      break;
    }
    case "echo_throw_cut": {
      filters.push(...applyToneFilters({
        settings,
        phase,
        cueDurationSeconds,
        transitionDurationSeconds: context.transition?.durationSeconds
      }));
      filters.push(...buildEchoTail({settings, phase, cueDurationSeconds}));
      if (phase === "out") {
        const fadeOutSeconds = clamp(settings.fadeOutSeconds ?? 0.16, 0.03, Math.max(0.05, cueDurationSeconds));
        const fadeStart = Math.max(0, cueDurationSeconds - fadeOutSeconds);
        filters.push(`afade=t=out:st=${toFixedSeconds(fadeStart)}:d=${toFixedSeconds(fadeOutSeconds)}`);
      }
      notes.push("Echo throw cut trims hard after the throw so the next cue can land cleanly.");
      break;
    }
    case "filter_sink": {
      filters.push(...applyToneFilters({
        settings,
        phase,
        cueDurationSeconds,
        transitionDurationSeconds: context.transition?.durationSeconds
      }));
      if (phase === "out") {
        filters.push("atrim=start=0");
      }
      notes.push("Filter sink narrows bandwidth and lowers the cue into the next editorial beat.");
      break;
    }
    case "soft_overlap_in": {
      filters.push(...applyToneFilters({
        settings,
        phase,
        cueDurationSeconds,
        transitionDurationSeconds: context.transition?.durationSeconds
      }));
      if (phase === "in" && typeof settings.wetMix === "number") {
        const wetMix = clamp(settings.wetMix, 0, 1);
        const dryMix = clamp(settings.dryMix ?? 1, 0, 1);
        filters.push(`volume=${toFixedSeconds(Math.max(0.12, dryMix - wetMix * 0.08))}dB`);
      }
      notes.push("Soft overlap in keeps the next cue arriving without a hard reset.");
      break;
    }
    case "impact_handoff": {
      filters.push(...applyToneFilters({
        settings,
        phase,
        cueDurationSeconds,
        transitionDurationSeconds: context.transition?.durationSeconds
      }));
      if (!(phase === "out" && settings.impulseResponse && context.capabilities.afir)) {
        filters.push(...buildEchoTail({settings, phase, cueDurationSeconds}));
      } else {
        notes.push("Impulse-response tail is delegated to afir so the handoff stays crisp.");
      }
      if (phase === "out") {
        filters.push("compand=attacks=0.005:decays=0.08:points=-80/-900|-20/-9|0/0");
      }
      notes.push("Impact handoff preserves attack while handing the cue off with editorial authority.");
      break;
    }
    case "dialogue_safe_bed": {
      filters.push(...applyToneFilters({
        settings,
        phase,
        cueDurationSeconds,
        transitionDurationSeconds: context.transition?.durationSeconds
      }));
      if (typeof settings.duckingGainDb === "number") {
        filters.push(`volume=${toFixedSeconds(settings.duckingGainDb)}dB`);
      }
      notes.push("Dialogue-safe bed keeps the cue subdued under speech and broadens the midrange safety margin.");
      break;
    }
  }

  return {
    filters: filters.filter(Boolean),
    notes
  };
};

export const compilePresetFilters = (
  preset: SoundDesignPresetName,
  context: SoundDesignPresetCompileContext
): SoundDesignPresetCompilation => {
  const mergedSettings = mergePresetSettings(preset, context.settings);
  return buildPresetsForPhase(preset, {
    ...context,
    settings: mergedSettings
  });
};
