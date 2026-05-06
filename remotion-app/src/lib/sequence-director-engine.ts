import type {CaptionChunk} from "./types";
import {extractMeaning} from "./semantic-emphasis-engine";

export type MomentType = "hook" | "expansion" | "reinforcement" | "pause" | "cta";

export type TypographySequenceMode =
  | "hook-aggressive"
  | "expansion-breathing"
  | "reinforcement-tight"
  | "pause-minimal"
  | "cta-impact";

export type SequenceMoment = {
  chunkId: string;
  text: string;
  momentType: MomentType;
  intensity: number;
  durationMs: number;
  typographyMode: TypographySequenceMode;
  fontFamilyRole: "impact" | "reading";
  motionStyle: "snap" | "breathing" | "tight-cadence" | "fade" | "burst";
  restraintApplied: boolean;
  semanticReductionAllowed: boolean;
  isSilenced: boolean;
};

export type FontRoleQuery = {
  bucket: "hero_impact" | "editorial_authority" | "neutral_reading" | "accent_script_or_italic" | "kinetic_display";
  requiredWeight?: number;
  traits?: string[];
  optional?: boolean;
  maxWords?: number;
};

export type SequenceDirectorPlan = {
  moments: SequenceMoment[];
  intensityTimeline: number[];
  typographyModes: TypographySequenceMode[];
  fontPlan: {
    impactFontQuery: FontRoleQuery;
    readingFontQuery: FontRoleQuery;
    accentFontQuery?: FontRoleQuery;
  };
  motionPlan: Array<SequenceMoment["motionStyle"]>;
  restraintDecisions: string[];
  pacingPlan: {
    averageDurationMs: number;
    fastestMomentId: string;
    slowestMomentId: string;
  };
};

const determineMomentType = (
  chunk: CaptionChunk,
  index: number,
  totalChunks: number,
  emotionalWeight: number
): MomentType => {
  const isFirst = index === 0;
  const isLast = index === totalChunks - 1;
  const wordCount = chunk.words.length;
  const durationMs = Math.max(1, chunk.endMs - chunk.startMs);
  const wordsPerSecond = wordCount / (durationMs / 1000);

  if (isFirst || emotionalWeight > 0.85) {
    return "hook";
  }

  if (isLast || emotionalWeight > 0.75) {
    // If it has strong call to action semantics or is the end
    const textLower = chunk.text.toLowerCase();
    if (textLower.includes("now") || textLower.includes("today") || textLower.includes("click") || textLower.includes("go") || isLast) {
      return "cta";
    }
  }

  if (wordCount <= 2 || wordsPerSecond < 1.0) {
    return "pause";
  }

  if (wordCount > 6 || durationMs > 3000) {
    return "expansion";
  }

  return "reinforcement";
};

const mapMode = (type: MomentType): TypographySequenceMode => {
  switch (type) {
    case "hook": return "hook-aggressive";
    case "expansion": return "expansion-breathing";
    case "reinforcement": return "reinforcement-tight";
    case "pause": return "pause-minimal";
    case "cta": return "cta-impact";
  }
};

const mapMotion = (type: MomentType, restraintApplied: boolean): SequenceMoment["motionStyle"] => {
  if (restraintApplied) {
    return type === "pause" ? "fade" : "breathing";
  }
  switch (type) {
    case "hook": return "snap";
    case "expansion": return "breathing";
    case "reinforcement": return "tight-cadence";
    case "pause": return "fade";
    case "cta": return "burst";
  }
};

export type StyleMapKey = "iman_like_business_authority" | "codie_like_editorial_authority" | "dean_like_direct_response";

const STYLE_MAPS: Record<StyleMapKey, SequenceDirectorPlan["fontPlan"]> = {
  iman_like_business_authority: {
    impactFontQuery: {bucket: "hero_impact", requiredWeight: 800, traits: ["high-contrast", "premium"]},
    readingFontQuery: {bucket: "neutral_reading", requiredWeight: 400, traits: ["clean", "stable"]},
    accentFontQuery: {bucket: "accent_script_or_italic", optional: true, maxWords: 3}
  },
  codie_like_editorial_authority: {
    impactFontQuery: {bucket: "editorial_authority", requiredWeight: 700, traits: ["serif", "confident"]},
    readingFontQuery: {bucket: "neutral_reading", requiredWeight: 400, traits: ["caption-safe"]},
  },
  dean_like_direct_response: {
    impactFontQuery: {bucket: "hero_impact", requiredWeight: 900, traits: ["bold", "persuasive"]},
    readingFontQuery: {bucket: "neutral_reading", requiredWeight: 500, traits: ["clear", "readable"]},
  }
};

export type SequenceAttentionState = {
  consecutiveAggression: number;
  timeSinceLastSilenceMs: number;
  runningIntensitySum: number;
};

export const orchestrateSequence = (
  chunks: CaptionChunk[],
  styleKey: StyleMapKey = "iman_like_business_authority"
): SequenceDirectorPlan => {
  const moments: SequenceMoment[] = [];
  const restraintDecisions: string[] = [];
  const systemFontPlan = STYLE_MAPS[styleKey];

  const state: SequenceAttentionState = {
    consecutiveAggression: 0,
    timeSinceLastSilenceMs: 0,
    runningIntensitySum: 0
  };

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const {emotionalWeight} = extractMeaning(chunk.words);
    const durationMs = Math.max(1, chunk.endMs - chunk.startMs);
    
    let momentType = determineMomentType(chunk, index, chunks.length, emotionalWeight);
    let intensity = momentType === "hook" ? 0.9 : momentType === "cta" ? 0.95 : momentType === "expansion" ? 0.6 : momentType === "reinforcement" ? 0.7 : 0.2;
    
    // Attention Choreography & Restraint
    let applyRestraint = false;
    let isSilenced = false;

    if (momentType === "hook" || momentType === "cta") {
      state.consecutiveAggression++;
    } else {
      state.consecutiveAggression = 0;
    }

    if (state.consecutiveAggression > 2) {
      applyRestraint = true;
      momentType = "reinforcement"; // Downgrade
      intensity = 0.65;
      restraintDecisions.push(`Downgraded chunk ${chunk.id} due to consecutive aggression limit.`);
      state.consecutiveAggression = 0;
    }

    if (momentType === "expansion" && chunk.words.length > 10) {
      applyRestraint = true;
      intensity = 0.5;
      restraintDecisions.push(`Applied restraint to chunk ${chunk.id} due to long text density.`);
    }

    // Silence Intelligence
    if (state.timeSinceLastSilenceMs > 10000 && (momentType === "pause" || (momentType === "expansion" && intensity <= 0.5))) {
      isSilenced = true;
      intensity = 0;
      restraintDecisions.push(`Applied SILENCE WINDOW to chunk ${chunk.id} to reset visual fatigue.`);
      state.timeSinceLastSilenceMs = 0;
    } else {
      state.timeSinceLastSilenceMs += durationMs;
    }

    state.runningIntensitySum += intensity;

    const semanticReductionAllowed = momentType === "hook" || momentType === "cta" || (momentType === "reinforcement" && emotionalWeight > 0.7 && durationMs < 2000);

    moments.push({
      chunkId: chunk.id,
      text: chunk.text,
      momentType,
      intensity,
      durationMs,
      typographyMode: mapMode(momentType),
      fontFamilyRole: momentType === "hook" || momentType === "cta" ? "impact" : "reading",
      motionStyle: mapMotion(momentType, applyRestraint),
      restraintApplied: applyRestraint,
      semanticReductionAllowed,
      isSilenced
    });
  }

  // Force at least one breathing moment if sequence > 3 chunks
  if (chunks.length > 3 && !moments.some(m => m.motionStyle === "breathing")) {
    const longestChunkIdx = moments.findIndex(m => m.durationMs === Math.max(...moments.map(x => x.durationMs)));
    if (longestChunkIdx >= 0) {
      moments[longestChunkIdx].motionStyle = "breathing";
      moments[longestChunkIdx].typographyMode = "expansion-breathing";
      restraintDecisions.push(`Forced breathing moment on chunk ${moments[longestChunkIdx].chunkId} for pacing constraint.`);
    }
  }

  const intensityTimeline = moments.map(m => m.intensity);
  const typographyModes = moments.map(m => m.typographyMode);
  const motionPlan = moments.map(m => m.motionStyle);
  
  const totalDuration = moments.reduce((sum, m) => sum + m.durationMs, 0);
  const averageDurationMs = chunks.length > 0 ? totalDuration / chunks.length : 0;
  
  const sortedByDuration = [...moments].sort((a, b) => a.durationMs - b.durationMs);
  const fastestMomentId = sortedByDuration[0]?.chunkId ?? "";
  const slowestMomentId = sortedByDuration[sortedByDuration.length - 1]?.chunkId ?? "";

  return {
    moments,
    intensityTimeline,
    typographyModes,
    fontPlan: systemFontPlan,
    motionPlan,
    restraintDecisions,
    pacingPlan: {
      averageDurationMs,
      fastestMomentId,
      slowestMomentId
    }
  };
};
