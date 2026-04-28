import type {
  CaptionChunk,
  MotionBackgroundOverlayPlan,
  MotionCameraCue,
  MotionShowcasePlan,
  MotionSoundAsset,
  MotionSoundCue,
  MotionSoundCueCategory,
  MotionSoundCueTrigger,
  MotionSoundDesignPlan,
  MotionSoundLibrarySection,
  MotionTier,
  VideoMetadata
} from "../types";
import {getMotionSoundFxCatalog} from "./sound-fx-catalog";
import {getMotionMusicCatalog} from "./music-catalog";
import {buildTransitionBrainPlan} from "./transition-brain";
import {buildDeterministicMediaTrimWindow} from "./media-trim";

type SoundBrainConfig = {
  cueDensityPerMinute: number;
  minGapMs: number;
  textCueMinGapMs: number;
  cameraCueMinGapMs: number;
  transitionCueMinGapMs: number;
  timeCueMinGapMs: number;
  droneCueMinGapMs: number;
};

type SoundCueSeed = {
  id: string;
  section: MotionSoundLibrarySection;
  category: MotionSoundCueCategory;
  trigger: MotionSoundCueTrigger;
  startMs: number;
  targetDurationMs: number;
  baseVolume: number;
  maxVolume: number;
  priority: number;
  preferredTags: string[];
  preferredDurationMs?: number;
  sourceRefId?: string;
  sourceText?: string;
  reasoning: string;
};

const CONFIG_BY_TIER: Record<MotionTier, SoundBrainConfig> = {
  minimal: {
    cueDensityPerMinute: 6,
    minGapMs: 320,
    textCueMinGapMs: 1600,
    cameraCueMinGapMs: 520,
    transitionCueMinGapMs: 3600,
    timeCueMinGapMs: 9000,
    droneCueMinGapMs: 20000
  },
  editorial: {
    cueDensityPerMinute: 8,
    minGapMs: 260,
    textCueMinGapMs: 1400,
    cameraCueMinGapMs: 480,
    transitionCueMinGapMs: 3200,
    timeCueMinGapMs: 8000,
    droneCueMinGapMs: 18000
  },
  premium: {
    cueDensityPerMinute: 10,
    minGapMs: 220,
    textCueMinGapMs: 1200,
    cameraCueMinGapMs: 420,
    transitionCueMinGapMs: 2800,
    timeCueMinGapMs: 7200,
    droneCueMinGapMs: 16000
  },
  hero: {
    cueDensityPerMinute: 12,
    minGapMs: 180,
    textCueMinGapMs: 1000,
    cameraCueMinGapMs: 360,
    transitionCueMinGapMs: 2400,
    timeCueMinGapMs: 6800,
    droneCueMinGapMs: 14000
  }
};

const MIX_TARGETS = {
  sourceVideoVolume: 1,
  musicBedVolume: 0.09,
  soundEffectBaseVolume: 0.1,
  soundEffectCeilingVolume: 0.22
} as const;

const CLOCK_TERMS = new Set([
  "calendar",
  "clock",
  "countdown",
  "deadline",
  "hourglass",
  "minute",
  "minutes",
  "month",
  "months",
  "time",
  "year",
  "years"
]);

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const msToFrames = (valueMs: number, fps: number): number => Math.max(1, Math.round((valueMs / 1000) * fps));

const normalizeText = (value: string): string[] => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

const uniqueById = <T extends {id: string}>(records: T[]): T[] => {
  return records.reduce<T[]>((accumulator, record) => {
    if (accumulator.some((entry) => entry.id === record.id)) {
      return accumulator;
    }
    accumulator.push(record);
    return accumulator;
  }, []);
};

const getAverageChunkGapMs = (chunks: CaptionChunk[]): number => {
  if (chunks.length <= 1) {
    return 0;
  }

  const totalGapMs = chunks.slice(1).reduce((sum, chunk, index) => {
    return sum + Math.max(0, chunk.startMs - chunks[index].endMs);
  }, 0);

  return totalGapMs / Math.max(1, chunks.length - 1);
};

const isContinuousSpeechLongform = ({
  chunks,
  durationSeconds
}: {
  chunks: CaptionChunk[];
  durationSeconds: number;
}): boolean => {
  if (durationSeconds < 90) {
    return false;
  }

  return getAverageChunkGapMs(chunks) < 220;
};

const isSpecialTypographyMoment = (chunk: CaptionChunk): boolean => {
  return (
    chunk.semantic?.intent === "punch-emphasis" ||
    chunk.semantic?.intent === "name-callout" ||
    chunk.semantic?.isVariation === true ||
    (chunk.emphasisWordIndices?.length ?? 0) >= 2 ||
    /[!?]$/.test(chunk.text)
  );
};

const isNearMotionBurst = ({
  chunk,
  motionBursts
}: {
  chunk: CaptionChunk;
  motionBursts: Array<{startMs: number; endMs: number}>;
}): boolean => {
  return motionBursts.some((burst) => {
    return chunk.endMs >= burst.startMs - 220 && chunk.startMs <= burst.endMs + 220;
  });
};

const getCueWindowGap = (category: MotionSoundCueCategory, config: SoundBrainConfig): number => {
  if (category === "text-typing") {
    return config.textCueMinGapMs;
  }
  if (category === "camera-whoosh") {
    return config.cameraCueMinGapMs;
  }
  if (category === "overlay-transition" || category === "showcase-sweep" || category === "impact-hit" || category === "ui-accent" || category === "riser") {
    return config.transitionCueMinGapMs;
  }
  if (category === "time-tick") {
    return config.timeCueMinGapMs;
  }
  if (category === "drone-bed") {
    return config.droneCueMinGapMs;
  }
  return config.minGapMs;
};

const scoreAsset = ({
  asset,
  section,
  preferredTags,
  preferredDurationMs
}: {
  asset: MotionSoundAsset;
  section: MotionSoundLibrarySection;
  preferredTags: string[];
  preferredDurationMs?: number;
}): number => {
  if (asset.librarySection !== section) {
    return 0;
  }
  let score = 40;
  preferredTags.forEach((tag) => {
    if (asset.tags.includes(tag)) {
      score += 10;
    }
  });
  if (asset.intensity === "medium") {
    score += 3;
  }
  if (asset.intensity === "hard" && (section === "impact-hit" || section === "riser")) {
    score += 8;
  }
  if (preferredDurationMs && preferredDurationMs > 0) {
    const assetDurationMs = Math.max(1, Math.round(asset.durationSeconds * 1000));
    const durationGapMs = Math.abs(assetDurationMs - preferredDurationMs);
    const durationFit = clamp(18 - durationGapMs / Math.max(120, preferredDurationMs * 0.16), 0, 18);
    score += durationFit;
    if (assetDurationMs >= preferredDurationMs) {
      score += 2;
    }
  }
  return score;
};

const pickAsset = ({
  catalog,
  seed,
  section,
  preferredTags,
  preferredDurationMs
}: {
  catalog: MotionSoundAsset[];
  seed: string;
  section: MotionSoundLibrarySection;
  preferredTags: string[];
  preferredDurationMs?: number;
}): MotionSoundAsset | null => {
  const ranked = catalog
    .map((asset) => ({
      asset,
      score: scoreAsset({
        asset,
        section,
        preferredTags,
        preferredDurationMs
      })
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));

  if (ranked.length === 0) {
    return null;
  }

  const topScore = ranked[0].score;
  const finalists = ranked.filter((entry) => entry.score >= topScore - 8).map((entry) => entry.asset);
  if (preferredDurationMs && preferredDurationMs > 0) {
    return finalists
      .slice()
      .sort((a, b) => {
        const aGap = Math.abs(Math.round(a.durationSeconds * 1000) - preferredDurationMs);
        const bGap = Math.abs(Math.round(b.durationSeconds * 1000) - preferredDurationMs);
        return aGap - bGap || a.id.localeCompare(b.id);
      })[0] ?? ranked[0].asset;
  }

  return finalists[hashString(seed) % finalists.length] ?? ranked[0].asset;
};

const buildCueFromSeed = ({
  seed,
  asset,
  fps
}: {
  seed: SoundCueSeed;
  asset: MotionSoundAsset;
  fps: number;
}): MotionSoundCue => {
  const sourceFrames = Math.max(2, Math.round(asset.durationSeconds * fps));
  const desiredFrames = clamp(msToFrames(seed.targetDurationMs, fps), 2, sourceFrames);
  const trimWindow = buildDeterministicMediaTrimWindow({
    totalFrames: sourceFrames,
    desiredFrames,
    seed: `${seed.id}|trim`
  });
  const trimBeforeFrames = trimWindow.trimBeforeFrames;
  const trimAfterFrames = trimWindow.trimAfterFrames;
  const playFrames = trimWindow.playFrames;
  const playMs = (playFrames / fps) * 1000;
  const peakStartMs = seed.startMs + Math.min(playMs * 0.2, 110);
  const peakEndMs = seed.startMs + Math.max(playMs * 0.55, playMs - 120);

  return {
    id: seed.id,
    assetId: asset.id,
    asset,
    category: seed.category,
    trigger: seed.trigger,
    startMs: seed.startMs,
    peakStartMs,
    peakEndMs,
    endMs: seed.startMs + playMs,
    trimBeforeFrames,
    trimAfterFrames,
    playFrames,
    fadeInFrames: Math.max(1, Math.min(4, Math.round(playFrames * 0.12))),
    fadeOutFrames: Math.max(2, Math.min(7, Math.round(playFrames * 0.22))),
    baseVolume: seed.baseVolume,
    maxVolume: seed.maxVolume,
    priority: seed.priority,
    sourceRefId: seed.sourceRefId,
    sourceText: seed.sourceText,
    reasoning: seed.reasoning
  };
};

const buildMusicCue = ({
  id,
  asset,
  startMs,
  playDurationMs,
  fps,
  fadeInMs,
  fadeOutMs,
  baseVolume,
  maxVolume,
  reasoning
}: {
  id: string;
  asset: MotionSoundAsset;
  startMs: number;
  playDurationMs: number;
  fps: number;
  fadeInMs: number;
  fadeOutMs: number;
  baseVolume: number;
  maxVolume: number;
  reasoning: string;
}): MotionSoundCue => {
  const sourceFrames = Math.max(2, Math.round(asset.durationSeconds * fps));
  const playFrames = clamp(msToFrames(playDurationMs, fps), 2, sourceFrames);
  const playMs = (playFrames / fps) * 1000;
  const fadeInFrames = clamp(msToFrames(fadeInMs, fps), 8, Math.max(8, Math.round(playFrames * 0.45)));
  const fadeOutFrames = clamp(msToFrames(fadeOutMs, fps), 12, Math.max(12, Math.round(playFrames * 0.45)));
  const peakStartMs = startMs + Math.min(playMs * 0.2, Math.max(420, fadeInMs));
  const peakEndMs = startMs + Math.max(
    peakStartMs + 80,
    playMs - Math.max(680, fadeOutMs * 0.8)
  );

  return {
    id,
    assetId: asset.id,
    asset,
    category: "music-bed",
    trigger: "soundtrack-bed",
    startMs,
    peakStartMs,
    peakEndMs,
    endMs: startMs + playMs,
    trimBeforeFrames: 0,
    trimAfterFrames: playFrames,
    playFrames,
    fadeInFrames,
    fadeOutFrames,
    baseVolume,
    maxVolume,
    priority: 96,
    reasoning
  };
};

const selectCues = ({
  seeds,
  catalog,
  fps,
  config,
  maxCueCount
}: {
  seeds: SoundCueSeed[];
  catalog: MotionSoundAsset[];
  fps: number;
  config: SoundBrainConfig;
  maxCueCount: number;
}): MotionSoundCue[] => {
  const selected: MotionSoundCue[] = [];
  const orderedSeeds = [...seeds]
    .sort((a, b) => b.priority - a.priority || a.startMs - b.startMs || a.id.localeCompare(b.id));

  for (const seed of orderedSeeds) {
    if (selected.length >= maxCueCount) {
      break;
    }

    const cueGap = getCueWindowGap(seed.category, config);
    const blockedBySpacing = selected.some((existing) => {
      const absoluteGap = Math.abs(existing.startMs - seed.startMs);
      if (absoluteGap < config.minGapMs) {
        return true;
      }
      const comparableGap = Math.max(
        cueGap,
        getCueWindowGap(existing.category, config)
      );
      return existing.category === seed.category && absoluteGap < comparableGap;
    });

    if (blockedBySpacing) {
      continue;
    }

    const asset = pickAsset({
      catalog,
      seed: seed.id,
      section: seed.section,
      preferredTags: seed.preferredTags,
      preferredDurationMs: seed.preferredDurationMs
    });
    if (!asset) {
      continue;
    }

    selected.push(buildCueFromSeed({
      seed,
      asset,
      fps
    }));
  }

  return selected.sort((a, b) => a.startMs - b.startMs || b.priority - a.priority || a.id.localeCompare(b.id));
};

const buildTextCueSeeds = ({
  chunks,
  config,
  durationSeconds,
  motionBursts
}: {
  chunks: CaptionChunk[];
  config: SoundBrainConfig;
  durationSeconds: number;
  motionBursts: Array<{startMs: number; endMs: number}>;
}): SoundCueSeed[] => {
  let lastTextCueStartMs = Number.NEGATIVE_INFINITY;
  const continuousSpeechLongform = isContinuousSpeechLongform({
    chunks,
    durationSeconds
  });

  return chunks.flatMap((chunk, index) => {
    const previousChunk = index > 0 ? chunks[index - 1] : null;
    const gapMs = previousChunk ? chunk.startMs - previousChunk.endMs : 9999;
    const specialMotionMoment = isNearMotionBurst({
      chunk,
      motionBursts
    });
    const specialTypographyMoment = isSpecialTypographyMoment(chunk);
    const worthTyping =
      continuousSpeechLongform
        ? specialMotionMoment || specialTypographyMoment
        : (
          gapMs >= 180 ||
          chunk.words.length >= 4 ||
          chunk.semantic?.intent === "punch-emphasis" ||
          chunk.semantic?.intent === "name-callout"
        );

    if (
      continuousSpeechLongform &&
      !specialMotionMoment &&
      !specialTypographyMoment
    ) {
      return [];
    }

    if (!worthTyping || chunk.startMs - lastTextCueStartMs < config.textCueMinGapMs) {
      return [];
    }

    lastTextCueStartMs = chunk.startMs;
    const durationMs = clamp(220 + chunk.words.length * 52, 240, 520);
    const intensityBoost = chunk.semantic?.intent === "punch-emphasis" ? 0.02 : 0;
    const baseVolume = continuousSpeechLongform ? 0.05 + intensityBoost * 0.5 : 0.08 + intensityBoost;
    const maxVolume = continuousSpeechLongform ? 0.09 + intensityBoost * 0.6 : 0.13 + intensityBoost;

    return [{
      id: `sfx-text-${chunk.id}`,
      section: "text",
      category: "text-typing",
      trigger: "caption-chunk",
      startMs: Math.max(0, chunk.startMs - 30),
      targetDurationMs: durationMs,
      baseVolume,
      maxVolume,
      priority: (continuousSpeechLongform ? 56 : 62) + chunk.words.length + (specialMotionMoment ? 8 : 0),
      preferredTags: ["typing", "keyboard", chunk.semantic?.intent === "punch-emphasis" ? "fast" : "text"].filter(Boolean) as string[],
      sourceRefId: chunk.id,
      sourceText: chunk.text,
      reasoning: continuousSpeechLongform
        ? `Typing accent for chunk "${chunk.text}" was only released on a motion-anchored or editorial typography beat.`
        : `Typing accent for chunk "${chunk.text}" with a deliberately short tail.`
    }];
  });
};

const buildTimeCueSeeds = ({
  chunks,
  config
}: {
  chunks: CaptionChunk[];
  config: SoundBrainConfig;
}): SoundCueSeed[] => {
  let lastCueStartMs = Number.NEGATIVE_INFINITY;

  return chunks.flatMap((chunk) => {
    const tokens = normalizeText(chunk.text);
    const matchesTime = tokens.some((token) => CLOCK_TERMS.has(token));
    if (!matchesTime || chunk.startMs - lastCueStartMs < config.timeCueMinGapMs) {
      return [];
    }

    lastCueStartMs = chunk.startMs;
    return [{
      id: `sfx-clock-${chunk.id}`,
      section: "clock",
      category: "time-tick",
      trigger: "semantic-time",
      startMs: chunk.startMs,
      targetDurationMs: 420,
      baseVolume: 0.09,
      maxVolume: 0.14,
      priority: 78,
      preferredTags: ["time", "tick", "clock"],
      sourceRefId: chunk.id,
      sourceText: chunk.text,
      reasoning: `Time-related language in "${chunk.text}" triggered a short clock accent.`
    }];
  });
};

const getShowcaseSoundSeed = ({
  cue
}: {
  cue: MotionShowcasePlan["cues"][number];
}): Omit<SoundCueSeed, "id" | "startMs" | "targetDurationMs" | "baseVolume" | "maxVolume" | "priority"> => {
  const label = cue.canonicalLabel.toLowerCase();

  if (["message", "notification", "phone", "card"].includes(label)) {
    return {
      section: "ui",
      category: "ui-accent",
      trigger: "showcase-cue",
      preferredTags: ["click", "accent", label],
      sourceRefId: cue.id,
      sourceText: cue.matchedText,
      reasoning: `UI-style accent for ${label} cue "${cue.matchedText}".`
    };
  }

  if (["money", "growth", "rocket", "authority", "strength", "star"].includes(label)) {
    return {
      section: "impact-hit",
      category: "impact-hit",
      trigger: "showcase-cue",
      preferredTags: ["impact", "accent", label],
      sourceRefId: cue.id,
      sourceText: cue.matchedText,
      reasoning: `Impact accent for high-emphasis showcase cue "${cue.matchedText}".`
    };
  }

  return {
    section: "whoosh",
    category: "showcase-sweep",
    trigger: "showcase-cue",
    preferredTags: ["transition", "movement", label],
    sourceRefId: cue.id,
    sourceText: cue.matchedText,
    reasoning: `Whoosh accent for showcase cue "${cue.matchedText}".`
  };
};

const buildShowcaseCueSeeds = ({
  showcasePlan
}: {
  showcasePlan: MotionShowcasePlan;
}): SoundCueSeed[] => {
  const singletonShowcase = showcasePlan.cues.length === 1;

  return showcasePlan.cues.map((cue) => {
    const seed = getShowcaseSoundSeed({cue});
    const hardHit = seed.category === "impact-hit";
    const startMs = Math.max(0, (hardHit ? cue.peakStartMs : cue.startMs) - (hardHit ? 35 : 20));
    const showcaseDurationMs = Math.max(340, cue.endMs - cue.startMs);
    const targetDurationMs = hardHit ? 260 : singletonShowcase ? Math.max(1400, showcaseDurationMs) : 340;

    return {
      ...seed,
      id: `sfx-showcase-${cue.id}`,
      startMs,
      targetDurationMs,
      preferredDurationMs: singletonShowcase ? showcaseDurationMs : undefined,
      baseVolume: hardHit ? 0.14 : singletonShowcase ? 0.1 : 0.12,
      maxVolume: hardHit ? 0.22 : singletonShowcase ? 0.16 : 0.18,
      priority: hardHit ? 88 : singletonShowcase ? 86 : 82
    };
  });
};

const buildOverlayCueSeeds = ({
  chunks,
  tier,
  backgroundOverlayPlan
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  backgroundOverlayPlan: MotionBackgroundOverlayPlan;
}): SoundCueSeed[] => {
  const transitionPlan = buildTransitionBrainPlan({
    chunks,
    tier
  });
  const decisionMap = new Map(transitionPlan.decisions.map((decision) => [decision.boundaryId, decision]));
  const seeds: SoundCueSeed[] = [];
  let lastDroneStartMs = Number.NEGATIVE_INFINITY;

  backgroundOverlayPlan.cues.forEach((cue, index) => {
    const decision = decisionMap.get(cue.sourceBoundaryId);
    if (!decision) {
      return;
    }

    if (!decision.majorVisual && cue.boundarySafety === "unsafe") {
      return;
    }

    const profileId = decision.profileId;
    const usesGlitch = profileId === "light-glitch" || profileId === "digital-glitch";
    const usesOrganic = profileId === "film-burn" || profileId === "light-leak";
    const usesRiser = cue.boundarySafety === "clear" && index % 2 === 0;
    const section: MotionSoundLibrarySection = usesGlitch || usesOrganic ? "transition" : "whoosh";
    const preferredTags = usesGlitch
      ? ["glitch", "transition"]
      : usesOrganic
        ? ["flashback", "transition"]
        : ["transition", "movement"];

    seeds.push({
      id: `sfx-overlay-${cue.id}`,
      section,
      category: "overlay-transition",
      trigger: "background-overlay",
      startMs: Math.max(0, cue.startMs - 40),
      targetDurationMs: usesOrganic ? 520 : 340,
      baseVolume: usesOrganic ? 0.12 : 0.14,
      maxVolume: usesOrganic ? 0.18 : 0.2,
      priority: cue.boundarySafety === "clear" ? 92 : 84,
      preferredTags,
      sourceRefId: cue.id,
      sourceText: cue.sourceChunkText,
      reasoning: `Overlay cue "${cue.sourceChunkText}" inherited ${profileId} transition pacing.`
    });

    if (usesRiser) {
      seeds.push({
        id: `sfx-riser-${cue.id}`,
        section: "riser",
        category: "riser",
        trigger: "background-overlay",
        startMs: Math.max(0, cue.startMs - 240),
        targetDurationMs: 620,
        baseVolume: 0.1,
        maxVolume: 0.16,
        priority: 74,
        preferredTags: ["build", "lift", "transition"],
        sourceRefId: cue.id,
        sourceText: cue.sourceChunkText,
        reasoning: `Clear overlay cue "${cue.sourceChunkText}" got a short riser lead-in.`
      });
    }

    const longGapFromPrevious = index === 0 || cue.startMs - backgroundOverlayPlan.cues[index - 1].startMs > 18000;
    if (longGapFromPrevious && cue.startMs - lastDroneStartMs > 16000) {
      lastDroneStartMs = cue.startMs;
      seeds.push({
        id: `sfx-drone-${cue.id}`,
        section: "drone",
        category: "drone-bed",
        trigger: "background-overlay",
        startMs: Math.max(0, cue.startMs - 160),
        targetDurationMs: 2200,
        baseVolume: 0.05,
        maxVolume: 0.08,
        priority: 58,
        preferredTags: ["tension", "ambience"],
        sourceRefId: cue.id,
        sourceText: cue.sourceChunkText,
        reasoning: `Long gap before overlay cue "${cue.sourceChunkText}" justified a subtle drone bed.`
      });
    }
  });

  return seeds;
};

const buildCameraCueSeeds = ({
  cameraCues
}: {
  cameraCues: MotionCameraCue[];
}): SoundCueSeed[] => {
  return cameraCues.flatMap((cue) => {
    const slowWhoosh = cue.timingFamily === "bobby" || cue.timingFamily === "linger";
    const preferredTags = slowWhoosh
      ? ["transition", "movement", "whoosh"]
      : ["transition", "movement"];

    return [
      {
        id: `sfx-camera-in-${cue.id}`,
        section: "whoosh",
        category: "camera-whoosh",
        trigger: "camera-cue",
        startMs: Math.max(0, cue.startMs - 20),
        targetDurationMs: slowWhoosh ? 620 : 420,
        baseVolume: slowWhoosh ? 0.06 : 0.08,
        maxVolume: slowWhoosh ? 0.12 : 0.14,
        priority: 76,
        preferredTags,
        sourceRefId: cue.id,
        sourceText: cue.triggerText,
        reasoning: `Camera cue "${cue.triggerText ?? cue.id}" received a low whoosh on zoom-in.`
      },
      {
        id: `sfx-camera-out-${cue.id}`,
        section: "whoosh",
        category: "camera-whoosh",
        trigger: "camera-cue",
        startMs: Math.max(0, cue.peakEndMs - (slowWhoosh ? 120 : 60)),
        targetDurationMs: slowWhoosh ? 560 : 380,
        baseVolume: slowWhoosh ? 0.05 : 0.07,
        maxVolume: slowWhoosh ? 0.1 : 0.12,
        priority: 72,
        preferredTags,
        sourceRefId: cue.id,
        sourceText: cue.triggerText,
        reasoning: `Camera cue "${cue.triggerText ?? cue.id}" received a matching low whoosh on zoom-out.`
      }
    ];
  });
};

type SoundtrackPreferenceProfile = {
  preferredTags: string[];
  discouragedTags: string[];
  crossfadeMs: number;
  outroFadeMs: number;
  preferLongerBeds: boolean;
};

const buildSoundtrackPreferenceProfile = ({
  chunks,
  tier,
  durationSeconds
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  durationSeconds: number;
}): SoundtrackPreferenceProfile => {
  const continuousSpeechLongform = isContinuousSpeechLongform({
    chunks,
    durationSeconds
  });
  const emphasisMoments = chunks.filter((chunk) => isSpecialTypographyMoment(chunk)).length;
  const preferredTags = new Set<string>(["ambience"]);
  const discouragedTags = new Set<string>();

  if (continuousSpeechLongform) {
    preferredTags.add("pad");
    discouragedTags.add("weird");
  }
  if (tier === "premium" || tier === "hero") {
    preferredTags.add("tension");
  }
  if (emphasisMoments < Math.max(3, Math.round(chunks.length * 0.08))) {
    discouragedTags.add("haunting");
  }

  return {
    preferredTags: [...preferredTags],
    discouragedTags: [...discouragedTags],
    crossfadeMs: continuousSpeechLongform ? 1200 : 900,
    outroFadeMs: continuousSpeechLongform ? 1600 : 1200,
    preferLongerBeds: continuousSpeechLongform
  };
};

const scoreMusicBedAsset = ({
  asset,
  remainingMs,
  previousAssetId,
  preferences
}: {
  asset: MotionSoundAsset;
  remainingMs: number;
  previousAssetId: string;
  preferences: SoundtrackPreferenceProfile;
}): number => {
  const durationMs = Math.max(1000, Math.round(asset.durationSeconds * 1000));
  const targetRemainingMs = Math.min(remainingMs, 22000);
  let score = 48;

  if (durationMs >= remainingMs) {
    score += 14;
  }

  score += Math.min(18, durationMs / 1800);
  score -= Math.min(24, Math.abs(durationMs - targetRemainingMs) / 1600);

  preferences.preferredTags.forEach((tag) => {
    if (asset.tags.includes(tag)) {
      score += 18;
    }
  });
  preferences.discouragedTags.forEach((tag) => {
    if (asset.tags.includes(tag)) {
      score -= 20;
    }
  });

  if (preferences.preferLongerBeds) {
    score += Math.min(16, durationMs / 2200);
  }
  if (asset.id === previousAssetId) {
    score -= 18;
  }

  return score;
};

const pickMusicBedAsset = ({
  assets,
  remainingMs,
  slotIndex,
  previousAssetId,
  preferences
}: {
  assets: MotionSoundAsset[];
  remainingMs: number;
  slotIndex: number;
  previousAssetId: string;
  preferences: SoundtrackPreferenceProfile;
}): MotionSoundAsset | null => {
  const ranked = assets
    .map((asset) => ({
      asset,
      score: scoreMusicBedAsset({
        asset,
        remainingMs,
        previousAssetId,
        preferences
      })
    }))
    .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));

  if (ranked.length === 0) {
    return null;
  }

  const topScore = ranked[0].score;
  const finalists = ranked
    .filter((entry) => entry.score >= topScore - 10)
    .map((entry) => entry.asset);

  return finalists[hashString(`music-bed|${slotIndex}|${previousAssetId}|${remainingMs}`) % finalists.length] ?? ranked[0].asset;
};

const buildMusicBedCues = ({
  chunks,
  tier,
  durationSeconds,
  fps,
  musicCatalog
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  durationSeconds: number;
  fps: number;
  musicCatalog: MotionSoundAsset[];
}): MotionSoundCue[] => {
  const musicAssets = musicCatalog
    .filter((asset) => asset.librarySection === "music")
    .sort((a, b) => b.durationSeconds - a.durationSeconds || a.id.localeCompare(b.id));

  if (musicAssets.length === 0) {
    return [];
  }

  const durationMs = Math.max(1000, Math.round(durationSeconds * 1000));
  const preferences = buildSoundtrackPreferenceProfile({
    chunks,
    tier,
    durationSeconds
  });
  const crossfadeMs = preferences.crossfadeMs;
  const cues: MotionSoundCue[] = [];
  let cursorMs = 0;
  let slotIndex = 0;
  let lastAssetId = "";

  while (cursorMs < durationMs - 400) {
    const remainingMs = durationMs - cursorMs;
    const asset = pickMusicBedAsset({
      assets: musicAssets,
      remainingMs,
      slotIndex,
      previousAssetId: lastAssetId,
      preferences
    }) ?? musicAssets[0];
    const assetDurationMs = Math.max(1000, Math.round(asset.durationSeconds * 1000));
    const effectiveCrossfadeMs = Math.min(
      crossfadeMs,
      Math.max(600, Math.round(assetDurationMs * 0.16)),
      Math.max(600, Math.round(remainingMs * 0.24))
    );
    const isFinalCue = remainingMs <= assetDurationMs;
    const playDurationMs = isFinalCue
      ? remainingMs
      : assetDurationMs;
    const cue = buildMusicCue({
      id: `music-bed-${slotIndex + 1}`,
      asset,
      startMs: cursorMs,
      playDurationMs,
      fps,
      fadeInMs: slotIndex === 0 ? Math.min(900, effectiveCrossfadeMs) : effectiveCrossfadeMs,
      fadeOutMs: isFinalCue ? preferences.outroFadeMs : effectiveCrossfadeMs,
      baseVolume: 0.02,
      maxVolume: MIX_TARGETS.musicBedVolume,
      reasoning: isFinalCue
        ? `Music bed selected ${asset.id} from the curated song library, ran it from the head of the track, and faded it out before picture end.`
        : `Music bed selected ${asset.id} from the curated song library and overlapped it into the next song with a soundtrack crossfade.`
    });
    cues.push(cue);

    lastAssetId = asset.id;
    if (isFinalCue || cue.endMs >= durationMs) {
      break;
    }

    cursorMs = Math.max(cursorMs + 400, cue.endMs - effectiveCrossfadeMs);
    slotIndex += 1;
  }

  return cues;
};

export const buildMotionSoundDesignPlan = ({
  chunks,
  tier,
  fps,
  videoMetadata,
  showcasePlan,
  backgroundOverlayPlan,
  cameraCues = [],
  catalog = getMotionSoundFxCatalog(),
  musicCatalog = getMotionMusicCatalog()
}: {
  chunks: CaptionChunk[];
  tier: MotionTier;
  fps: number;
  videoMetadata?: Pick<VideoMetadata, "durationSeconds">;
  showcasePlan: MotionShowcasePlan;
  backgroundOverlayPlan: MotionBackgroundOverlayPlan;
  cameraCues?: MotionCameraCue[];
  catalog?: MotionSoundAsset[];
  musicCatalog?: MotionSoundAsset[];
}): MotionSoundDesignPlan => {
  const durationSeconds = videoMetadata?.durationSeconds ??
    Math.max(1, chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0) / 1000);
  const config = CONFIG_BY_TIER[tier];
  const motionBursts = [
    ...showcasePlan.cues.map((cue) => ({startMs: cue.startMs, endMs: cue.endMs})),
    ...backgroundOverlayPlan.cues.map((cue) => ({startMs: cue.startMs, endMs: cue.endMs})),
    ...cameraCues.map((cue) => ({startMs: cue.startMs, endMs: cue.endMs}))
  ];
  const soundtrackAssetsAvailable = musicCatalog.some((asset) => asset.librarySection === "music");

  if (catalog.length === 0 && !soundtrackAssetsAvailable) {
    return {
      enabled: false,
      cueDensityPerMinute: config.cueDensityPerMinute,
      minGapMs: config.minGapMs,
      cues: [],
      musicCues: [],
      selectedAssets: [],
      mixTargets: MIX_TARGETS,
      reasons: [
        "Sound FX catalog and music library are both empty, so the sound-design brain stayed dormant."
      ]
    };
  }

  const rawSeeds = [
    ...buildTextCueSeeds({
      chunks,
      config,
      durationSeconds,
      motionBursts
    }),
    ...buildTimeCueSeeds({
      chunks,
      config
    }),
    ...buildShowcaseCueSeeds({
      showcasePlan
    }),
    ...buildOverlayCueSeeds({
      chunks,
      tier,
      backgroundOverlayPlan
    }),
    ...buildCameraCueSeeds({
      cameraCues
    })
  ];
  const maxCueCount = Math.max(4, Math.round((durationSeconds / 60) * config.cueDensityPerMinute));
  const cues = selectCues({
    seeds: rawSeeds,
    catalog,
    fps,
    config,
    maxCueCount
  });
  const musicCues = buildMusicBedCues({
    chunks,
    tier,
    durationSeconds,
    fps,
    musicCatalog
  });
  const selectedAssets = uniqueById([...musicCues, ...cues].map((cue) => cue.asset));

  return {
    enabled: cues.length > 0 || musicCues.length > 0,
    cueDensityPerMinute: config.cueDensityPerMinute,
    minGapMs: config.minGapMs,
    cues,
    musicCues,
    selectedAssets,
    mixTargets: MIX_TARGETS,
    reasons: [
      `tier=${tier}`,
      `catalog=${catalog.length} sound fx`,
      `music-catalog=${musicCatalog.length} songs`,
      `raw-seeds=${rawSeeds.length}`,
      `selected=${cues.length}/${maxCueCount}${catalog.length === 0 ? " (sfx unavailable)" : ""}`,
      `music-bed=${musicCues.length}${soundtrackAssetsAvailable ? "" : " (missing synced music library)"}`,
      `mix=source ${MIX_TARGETS.sourceVideoVolume.toFixed(2)} | music ${MIX_TARGETS.musicBedVolume.toFixed(2)} | sfx ${MIX_TARGETS.soundEffectBaseVolume.toFixed(2)}-${MIX_TARGETS.soundEffectCeilingVolume.toFixed(2)}`
    ]
  };
};
