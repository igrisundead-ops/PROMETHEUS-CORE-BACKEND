import natural from "natural";

import type {CaptionChunk, VideoMetadata} from "./types";

const {
  DiceCoefficient,
  JaroWinklerDistance,
  PorterStemmer,
  SentimentAnalyzer,
  TfIdf,
  WordTokenizer
} = natural;

type TfIdfInstance = InstanceType<typeof TfIdf>;

export type NolanClipReferenceSection = {
  id: string;
  label: string;
  text: string;
};

export type NolanClipReferenceMatch = {
  sectionId: string;
  label: string;
  similarity: number;
};

export type NolanClipScoreBreakdown = {
  hookStrength: number;
  viralitySignals: number;
  coherence: number;
  boundaryClarity: number;
  endingStrength: number;
  referenceAlignment: number;
  emotionalIntensity: number;
  durationFit: number;
  contentDensity: number;
  fillerPenalty: number;
};

export type NolanClipCandidate = {
  id: string;
  rank: number;
  page: number;
  pageIndex: number;
  title: string;
  slug: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  startTimecode: string;
  endTimecode: string;
  openingHook: string;
  closingBeat: string;
  transcript: string;
  chunkIds: string[];
  chunkCount: number;
  score: number;
  grade: "hero" | "strong" | "explore";
  recommended: boolean;
  tags: string[];
  reasoning: string[];
  scoreBreakdown: NolanClipScoreBreakdown;
  referenceMatches: NolanClipReferenceMatch[];
};

export type NolanClipReviewPage = {
  page: number;
  pageSize: number;
  itemCount: number;
  items: NolanClipCandidate[];
};

export type NolanClipEngineSettings = {
  minClipSeconds: number;
  maxClipSeconds: number;
  targetClipSeconds: number;
  maxCandidates: number;
  pageSize: number;
  duplicateOverlapRatio: number;
  duplicateStartSeparationMs: number;
};

export type NolanClipPlan = {
  engineId: string;
  version: string;
  generatedAt: string;
  sourceVideoPath: string | null;
  sourceVideoHash?: string | null;
  durationSeconds: number;
  chunkCount: number;
  sourceCaptionPath?: string | null;
  settings: NolanClipEngineSettings;
  referenceScript: {
    provided: boolean;
    sourcePath: string | null;
    sectionCount: number;
    sections: NolanClipReferenceSection[];
  };
  summary: {
    candidateCount: number;
    pageCount: number;
    recommendedClipIds: string[];
    averageScore: number;
    strongestTags: string[];
  };
  pages: NolanClipReviewPage[];
  candidates: NolanClipCandidate[];
};

type PreparedChunk = {
  chunk: CaptionChunk;
  normalizedText: string;
  rawTokens: string[];
  contentTokens: string[];
  stems: string[];
  signalTags: string[];
  hookStrength: number;
  sentimentMagnitude: number;
  contentDensity: number;
  fillerPenalty: number;
  endsSentence: boolean;
};

type PreparedReferenceSection = NolanClipReferenceSection & {
  normalizedText: string;
  contentTokens: string[];
  stems: string[];
};

type NolanClipCandidateDraft = Omit<NolanClipCandidate, "rank" | "page" | "pageIndex" | "recommended">;

const ENGINE_ID = "nolan-clip-cutting-engine";
const ENGINE_VERSION = "1.0.0";
const tokenizer = new WordTokenizer();
const sentimentAnalyzer = new SentimentAnalyzer("English", PorterStemmer, "afinn");

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "like",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "out",
  "so",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "up",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "why",
  "with",
  "would",
  "you",
  "your"
]);

const FILLER_PATTERNS = [
  /\byou know\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bi mean\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\blike\b/gi,
  /\bum\b/gi,
  /\buh\b/gi
];

const SIGNAL_GROUPS: Array<{
  tag: string;
  weight: number;
  patterns: RegExp[];
}> = [
  {
    tag: "curiosity",
    weight: 0.18,
    patterns: [/\bhow\b/i, /\bwhy\b/i, /\bhere'?s\b/i, /\bwatch\b/i, /\bimagine\b/i]
  },
  {
    tag: "transformation",
    weight: 0.18,
    patterns: [/\bmade me\b/i, /\bchanged\b/i, /\bbetter\b/i, /\bgrow(?:th|ing)?\b/i, /\bimprove\b/i]
  },
  {
    tag: "specificity",
    weight: 0.16,
    patterns: [/\b\d+\b/, /\bpercent\b/i, /\bmonths?\b/i, /\byears?\b/i, /\bfigures?\b/i]
  },
  {
    tag: "authority",
    weight: 0.14,
    patterns: [/\bclients?\b/i, /\bprofessional\b/i, /\bexpert\b/i, /\bresults?\b/i, /\bproof\b/i]
  },
  {
    tag: "money",
    weight: 0.14,
    patterns: [/\bmoney\b/i, /\bprofit\b/i, /\brevenue\b/i, /\bsales?\b/i, /\bcash\b/i]
  },
  {
    tag: "pain",
    weight: 0.12,
    patterns: [/\bmistake\b/i, /\bwrong\b/i, /\bproblem\b/i, /\bstruggle\b/i, /\bchallenge\b/i]
  },
  {
    tag: "tension",
    weight: 0.12,
    patterns: [/\bbut\b/i, /\binstead\b/i, /\bnever\b/i, /\bnobody\b/i, /\bwithout\b/i]
  },
  {
    tag: "direct-address",
    weight: 0.08,
    patterns: [/\byou\b/i, /\byour\b/i]
  },
  {
    tag: "steps",
    weight: 0.08,
    patterns: [/\bfirst\b/i, /\bsecond\b/i, /\bthird\b/i, /\bstep\b/i, /\bprocess\b/i]
  },
  {
    tag: "time",
    weight: 0.08,
    patterns: [/\btoday\b/i, /\bnow\b/i, /\blater\b/i, /\bminutes?\b/i, /\bseconds?\b/i]
  }
];

export const DEFAULT_NOLAN_CLIP_ENGINE_SETTINGS: NolanClipEngineSettings = {
  minClipSeconds: 10,
  maxClipSeconds: 25,
  targetClipSeconds: 17,
  maxCandidates: 30,
  pageSize: 10,
  duplicateOverlapRatio: 0.82,
  duplicateStartSeparationMs: 3500
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const round = (value: number): number => Math.round(value * 100) / 100;

const withDefinedOverrides = <T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T => {
  const sanitizedOverride = Object.fromEntries(
    Object.entries(override).filter(([, value]) => value !== undefined)
  ) as Partial<T>;

  return {
    ...base,
    ...sanitizedOverride
  };
};

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const tokenize = (value: string): string[] => {
  return tokenizer
    .tokenize(normalizeText(value))
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const toContentTokens = (tokens: string[]): string[] => {
  return tokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
};

const toStems = (tokens: string[]): string[] => {
  return toContentTokens(tokens).map((token) => PorterStemmer.stem(token));
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const formatTimecode = (valueMs: number): string => {
  const totalSeconds = Math.max(0, valueMs) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
};

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 72);
};

const countFillerHits = (value: string): number => {
  return FILLER_PATTERNS.reduce((total, pattern) => {
    const matches = value.match(pattern);
    return total + (matches?.length ?? 0);
  }, 0);
};

const collectSignalTags = (value: string): string[] => {
  return SIGNAL_GROUPS
    .filter((group) => group.patterns.some((pattern) => pattern.test(value)))
    .map((group) => group.tag);
};

const computeSignalStrength = (tags: string[]): number => {
  const tagSet = new Set(tags);
  const weightTotal = SIGNAL_GROUPS.reduce((total, group) => {
    return total + (tagSet.has(group.tag) ? group.weight : 0);
  }, 0);
  return clamp01(weightTotal);
};

const computeHookStrength = (text: string, tags: string[]): number => {
  let score = computeSignalStrength(tags) * 0.7;
  if (/^[A-Z0-9]/.test(text)) {
    score += 0.08;
  }
  if (/[!?]/.test(text)) {
    score += 0.08;
  }
  if (/\b(how|why|here's|watch|imagine|this)\b/i.test(text)) {
    score += 0.14;
  }
  if (/\b\d+\b/.test(text)) {
    score += 0.1;
  }
  return clamp01(score);
};

const prepareChunk = (chunk: CaptionChunk): PreparedChunk => {
  const normalizedText = normalizeText(chunk.text);
  const rawTokens = tokenize(chunk.text);
  const contentTokens = toContentTokens(rawTokens);
  const stems = unique(toStems(rawTokens));
  const signalTags = collectSignalTags(chunk.text);
  const fillerHits = countFillerHits(chunk.text);
  const contentDensity = rawTokens.length === 0 ? 0 : contentTokens.length / rawTokens.length;
  const rawSentimentMagnitude = contentTokens.length === 0
    ? 0
    : Math.abs(sentimentAnalyzer.getSentiment(contentTokens));
  const sentimentMagnitude = Number.isFinite(rawSentimentMagnitude) ? rawSentimentMagnitude : 0;

  return {
    chunk,
    normalizedText,
    rawTokens,
    contentTokens,
    stems,
    signalTags,
    hookStrength: computeHookStrength(chunk.text, signalTags),
    sentimentMagnitude,
    contentDensity,
    fillerPenalty: clamp01(fillerHits / Math.max(1, rawTokens.length / 2)),
    endsSentence: /[.!?]["']?$/.test(chunk.text.trim())
  };
};

const overlapRatio = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  leftSet.forEach((term) => {
    if (rightSet.has(term)) {
      intersection += 1;
    }
  });

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const adjacentChunkSimilarity = (left: PreparedChunk, right: PreparedChunk): number => {
  const stemOverlap = overlapRatio(left.stems, right.stems);
  const dice = DiceCoefficient(left.normalizedText, right.normalizedText);
  return clamp01(stemOverlap * 0.65 + dice * 0.35);
};

const parseReferenceSectionLine = (value: string, index: number): NolanClipReferenceSection => {
  const colonIndex = value.indexOf(":");
  if (colonIndex > 0) {
    const label = value.slice(0, colonIndex).trim();
    const text = value.slice(colonIndex + 1).trim();
    return {
      id: `reference-${index + 1}`,
      label: label || `Reference ${index + 1}`,
      text: text || label
    };
  }

  return {
    id: `reference-${index + 1}`,
    label: `Reference ${index + 1}`,
    text: value
  };
};

export const parseNolanReferenceScript = ({
  text,
  sourcePath = null
}: {
  text: string;
  sourcePath?: string | null;
}): {
  sourcePath: string | null;
  sections: NolanClipReferenceSection[];
} => {
  const blocks = text
    .split(/\r?\n\r?\n/)
    .flatMap((block) => block.split(/\r?\n/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return {
    sourcePath,
    sections: blocks.map(parseReferenceSectionLine)
  };
};

const prepareReferenceSections = (sections: NolanClipReferenceSection[]): PreparedReferenceSection[] => {
  return sections.map((section) => ({
    ...section,
    normalizedText: normalizeText(section.text),
    contentTokens: toContentTokens(tokenize(section.text)),
    stems: unique(toStems(tokenize(section.text)))
  }));
};

const buildReferenceTfIdf = (sections: PreparedReferenceSection[]): TfIdfInstance | null => {
  if (sections.length === 0) {
    return null;
  }

  const tfidf = new TfIdf();
  sections.forEach((section) => {
    tfidf.addDocument(section.stems, {id: section.id});
  });
  return tfidf;
};

const resolveReferenceMatches = ({
  candidateText,
  candidateStems,
  sections,
  tfidf
}: {
  candidateText: string;
  candidateStems: string[];
  sections: PreparedReferenceSection[];
  tfidf: TfIdfInstance | null;
}): NolanClipReferenceMatch[] => {
  if (sections.length === 0 || candidateStems.length === 0) {
    return [];
  }

  return sections
    .map((section, index) => {
      const stemOverlap = overlapRatio(candidateStems, section.stems);
      const tfidfScore = tfidf
        ? clamp01(tfidf.tfidf(candidateStems, index) / Math.max(2.5, candidateStems.length * 1.8))
        : 0;
      const phrasingScore = clamp01(
        Math.max(
          DiceCoefficient(candidateText, section.normalizedText),
          JaroWinklerDistance(candidateText, section.normalizedText, {ignoreCase: true})
        )
      );
      const similarity = clamp01(stemOverlap * 0.45 + tfidfScore * 0.35 + phrasingScore * 0.2);

      return {
        sectionId: section.id,
        label: section.label,
        similarity: round(similarity)
      };
    })
    .sort((left, right) => right.similarity - left.similarity || left.label.localeCompare(right.label))
    .slice(0, 3)
    .filter((match) => match.similarity > 0);
};

const clipDurationFit = (durationSeconds: number, settings: NolanClipEngineSettings): number => {
  if (durationSeconds < settings.minClipSeconds || durationSeconds > settings.maxClipSeconds) {
    return 0;
  }

  const halfRange = Math.max(
    settings.targetClipSeconds - settings.minClipSeconds,
    settings.maxClipSeconds - settings.targetClipSeconds
  );
  const distance = Math.abs(durationSeconds - settings.targetClipSeconds);
  return clamp01(1 - distance / Math.max(1, halfRange));
};

const boundaryScore = ({
  previousChunk,
  firstChunk,
  lastChunk,
  nextChunk
}: {
  previousChunk: PreparedChunk | null;
  firstChunk: PreparedChunk;
  lastChunk: PreparedChunk;
  nextChunk: PreparedChunk | null;
}): number => {
  const startPause = previousChunk ? clamp01((firstChunk.chunk.startMs - previousChunk.chunk.endMs) / 420) : 1;
  const endPause = nextChunk ? clamp01((nextChunk.chunk.startMs - lastChunk.chunk.endMs) / 420) : 1;
  const startTopicBreak = previousChunk ? 1 - adjacentChunkSimilarity(previousChunk, firstChunk) : 1;
  const endTopicBreak = nextChunk ? 1 - adjacentChunkSimilarity(lastChunk, nextChunk) : 1;
  const sentenceBonus = (firstChunk.endsSentence ? 0.08 : 0) + (lastChunk.endsSentence ? 0.12 : 0);
  return clamp01(((startPause + endPause + startTopicBreak + endTopicBreak) / 4) + sentenceBonus);
};

const windowCoherence = (windowChunks: PreparedChunk[]): number => {
  if (windowChunks.length === 1) {
    return clamp01(windowChunks[0].contentDensity * 0.7 + windowChunks[0].hookStrength * 0.3);
  }

  let adjacentSimilarityTotal = 0;
  let pairCount = 0;
  for (let index = 0; index < windowChunks.length - 1; index += 1) {
    adjacentSimilarityTotal += adjacentChunkSimilarity(windowChunks[index], windowChunks[index + 1]);
    pairCount += 1;
  }

  const averageAdjacentSimilarity = pairCount === 0 ? 0 : adjacentSimilarityTotal / pairCount;
  const allStems = windowChunks.flatMap((chunk) => chunk.stems);
  const repeatedStemCount = allStems.filter((stem, index) => allStems.indexOf(stem) !== index).length;
  const recurrence = clamp01(repeatedStemCount / Math.max(2, allStems.length * 0.35));
  const density = windowChunks.reduce((total, chunk) => total + chunk.contentDensity, 0) / windowChunks.length;

  return clamp01(averageAdjacentSimilarity * 0.46 + recurrence * 0.22 + density * 0.32);
};

const endingStrength = ({
  windowChunks,
  nextChunk
}: {
  windowChunks: PreparedChunk[];
  nextChunk: PreparedChunk | null;
}): number => {
  const lastChunk = windowChunks[windowChunks.length - 1];
  const finalSentenceBonus = lastChunk.endsSentence ? 0.28 : 0;
  const transitionStrength = nextChunk ? 1 - adjacentChunkSimilarity(lastChunk, nextChunk) : 1;
  const lastChunkSignal = computeSignalStrength(lastChunk.signalTags);
  const lastChunkDensity = lastChunk.contentDensity;

  return clamp01(finalSentenceBonus + transitionStrength * 0.38 + lastChunkSignal * 0.2 + lastChunkDensity * 0.14);
};

const emotionalIntensity = (windowChunks: PreparedChunk[]): number => {
  const averageSentiment = windowChunks.reduce((total, chunk) => total + chunk.sentimentMagnitude, 0) / windowChunks.length;
  const punctuationCharge = clamp01(
    windowChunks.reduce((total, chunk) => total + (/!|\?/.test(chunk.chunk.text) ? 0.18 : 0), 0)
  );
  return clamp01(averageSentiment / 3 + punctuationCharge);
};

const buildCandidateTitle = ({
  openingHook,
  closingBeat
}: {
  openingHook: string;
  closingBeat: string;
}): string => {
  const openingWords = openingHook.split(/\s+/).filter(Boolean);
  if (openingWords.length <= 7) {
    return openingHook.trim();
  }

  const clippedOpening = openingWords.slice(0, 7).join(" ");
  const closingWords = closingBeat.split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
  return `${clippedOpening} / ${closingWords}`.trim();
};

const strongestTags = (candidates: NolanClipCandidate[]): string[] => {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    candidate.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([tag]) => tag);
};

const buildReasoning = ({
  hookStrength,
  viralitySignals,
  coherence,
  boundaryClarity,
  endingStrengthValue,
  referenceMatches,
  fillerPenalty
}: {
  hookStrength: number;
  viralitySignals: number;
  coherence: number;
  boundaryClarity: number;
  endingStrengthValue: number;
  referenceMatches: NolanClipReferenceMatch[];
  fillerPenalty: number;
}): string[] => {
  const notes: string[] = [];

  if (hookStrength >= 70) {
    notes.push("Opens with a strong hook instead of warmup filler.");
  }
  if (viralitySignals >= 64) {
    notes.push("Carries specificity, contrast, or transformation signals that fit short-form cuts.");
  }
  if (coherence >= 62) {
    notes.push("Stays on one idea without drifting off-topic.");
  }
  if (boundaryClarity >= 62) {
    notes.push("Has clean cut boundaries on both sides for extraction.");
  }
  if (endingStrengthValue >= 62) {
    notes.push("Ends on a payoff beat instead of trailing away.");
  }
  if (referenceMatches[0] && referenceMatches[0].similarity >= 0.32) {
    notes.push(`Aligns with the reference script on ${referenceMatches[0].label.toLowerCase()}.`);
  }
  if (fillerPenalty >= 10) {
    notes.push("Some filler language lowered the rank.");
  }

  return notes.slice(0, 4);
};

const computeWindowScore = ({
  windowChunks,
  previousChunk,
  nextChunk,
  durationSeconds,
  referenceMatches,
  settings
}: {
  windowChunks: PreparedChunk[];
  previousChunk: PreparedChunk | null;
  nextChunk: PreparedChunk | null;
  durationSeconds: number;
  referenceMatches: NolanClipReferenceMatch[];
  settings: NolanClipEngineSettings;
}): {
  total: number;
  breakdown: NolanClipScoreBreakdown;
} => {
  const firstChunk = windowChunks[0];
  const viralitySignals = computeSignalStrength(unique(windowChunks.flatMap((chunk) => chunk.signalTags))) * 100;
  const hookStrength = Math.max(
    firstChunk.hookStrength,
    clamp01((windowChunks.slice(0, 2).reduce((total, chunk) => total + chunk.hookStrength, 0) / Math.min(2, windowChunks.length)) + 0.04)
  ) * 100;
  const coherence = windowCoherence(windowChunks) * 100;
  const boundaryClarity = boundaryScore({
    previousChunk,
    firstChunk,
    lastChunk: windowChunks[windowChunks.length - 1],
    nextChunk
  }) * 100;
  const endingStrengthValue = endingStrength({windowChunks, nextChunk}) * 100;
  const referenceAlignment = (referenceMatches[0]?.similarity ?? 0) * 100;
  const emotionalIntensityValue = emotionalIntensity(windowChunks) * 100;
  const durationFit = clipDurationFit(durationSeconds, settings) * 100;
  const contentDensity = (
    windowChunks.reduce((total, chunk) => total + chunk.contentDensity, 0) / windowChunks.length
  ) * 100;
  const fillerPenalty = (
    windowChunks.reduce((total, chunk) => total + chunk.fillerPenalty, 0) / windowChunks.length
  ) * 18;

  const total = clamp01(
    (
      hookStrength * 0.18 +
      viralitySignals * 0.18 +
      coherence * 0.16 +
      boundaryClarity * 0.12 +
      endingStrengthValue * 0.14 +
      referenceAlignment * 0.08 +
      emotionalIntensityValue * 0.06 +
      durationFit * 0.05 +
      contentDensity * 0.03 -
      fillerPenalty
    ) / 100
  ) * 100;

  return {
    total: round(total),
    breakdown: {
      hookStrength: round(hookStrength),
      viralitySignals: round(viralitySignals),
      coherence: round(coherence),
      boundaryClarity: round(boundaryClarity),
      endingStrength: round(endingStrengthValue),
      referenceAlignment: round(referenceAlignment),
      emotionalIntensity: round(emotionalIntensityValue),
      durationFit: round(durationFit),
      contentDensity: round(contentDensity),
      fillerPenalty: round(fillerPenalty)
    }
  };
};

const computeCandidateOverlap = (left: NolanClipCandidateDraft, right: NolanClipCandidateDraft): number => {
  const overlapStart = Math.max(left.startMs, right.startMs);
  const overlapEnd = Math.min(left.endMs, right.endMs);
  const intersection = Math.max(0, overlapEnd - overlapStart);
  if (intersection <= 0) {
    return 0;
  }

  const shorter = Math.min(left.durationMs, right.durationMs);
  return shorter <= 0 ? 0 : intersection / shorter;
};

const buildDraftCandidate = ({
  windowChunks,
  previousChunk,
  nextChunk,
  referenceSections,
  referenceTfIdf,
  settings
}: {
  windowChunks: PreparedChunk[];
  previousChunk: PreparedChunk | null;
  nextChunk: PreparedChunk | null;
  referenceSections: PreparedReferenceSection[];
  referenceTfIdf: TfIdfInstance | null;
  settings: NolanClipEngineSettings;
}): NolanClipCandidateDraft => {
  const startMs = windowChunks[0].chunk.startMs;
  const endMs = windowChunks[windowChunks.length - 1].chunk.endMs;
  const durationMs = endMs - startMs;
  const durationSeconds = durationMs / 1000;
  const transcript = windowChunks.map((chunk) => chunk.chunk.text.trim()).join(" ").replace(/\s+/g, " ").trim();
  const openingHook = windowChunks.slice(0, Math.min(2, windowChunks.length)).map((chunk) => chunk.chunk.text.trim()).join(" ");
  const closingBeat = windowChunks.slice(-2).map((chunk) => chunk.chunk.text.trim()).join(" ");
  const candidateStems = unique(windowChunks.flatMap((chunk) => chunk.stems));
  const referenceMatches = resolveReferenceMatches({
    candidateText: normalizeText(transcript),
    candidateStems,
    sections: referenceSections,
    tfidf: referenceTfIdf
  });
  const {total, breakdown} = computeWindowScore({
    windowChunks,
    previousChunk,
    nextChunk,
    durationSeconds,
    referenceMatches,
    settings
  });
  const title = buildCandidateTitle({openingHook, closingBeat});
  const tags = unique(windowChunks.flatMap((chunk) => chunk.signalTags)).slice(0, 8);

  return {
    id: `nolan-${String(startMs).padStart(7, "0")}-${String(endMs).padStart(7, "0")}`,
    title,
    slug: slugify(title || transcript || `clip-${startMs}`),
    startMs,
    endMs,
    durationMs,
    startTimecode: formatTimecode(startMs),
    endTimecode: formatTimecode(endMs),
    openingHook,
    closingBeat,
    transcript,
    chunkIds: windowChunks.map((chunk) => chunk.chunk.id),
    chunkCount: windowChunks.length,
    score: total,
    grade: total >= 78 ? "hero" : total >= 62 ? "strong" : "explore",
    tags,
    reasoning: buildReasoning({
      hookStrength: breakdown.hookStrength,
      viralitySignals: breakdown.viralitySignals,
      coherence: breakdown.coherence,
      boundaryClarity: breakdown.boundaryClarity,
      endingStrengthValue: breakdown.endingStrength,
      referenceMatches,
      fillerPenalty: breakdown.fillerPenalty
    }),
    scoreBreakdown: breakdown,
    referenceMatches
  };
};

const enumerateDraftCandidates = ({
  chunks,
  referenceSections,
  settings
}: {
  chunks: CaptionChunk[];
  referenceSections: PreparedReferenceSection[];
  settings: NolanClipEngineSettings;
}): NolanClipCandidateDraft[] => {
  const preparedChunks = chunks.map(prepareChunk);
  const referenceTfIdf = buildReferenceTfIdf(referenceSections);
  const drafts: NolanClipCandidateDraft[] = [];

  for (let startIndex = 0; startIndex < preparedChunks.length; startIndex += 1) {
    for (let endIndex = startIndex; endIndex < preparedChunks.length; endIndex += 1) {
      const startMs = preparedChunks[startIndex].chunk.startMs;
      const endMs = preparedChunks[endIndex].chunk.endMs;
      const durationSeconds = (endMs - startMs) / 1000;

      if (durationSeconds > settings.maxClipSeconds) {
        break;
      }
      if (durationSeconds < settings.minClipSeconds) {
        continue;
      }

      drafts.push(buildDraftCandidate({
        windowChunks: preparedChunks.slice(startIndex, endIndex + 1),
        previousChunk: startIndex > 0 ? preparedChunks[startIndex - 1] : null,
        nextChunk: endIndex < preparedChunks.length - 1 ? preparedChunks[endIndex + 1] : null,
        referenceSections,
        referenceTfIdf,
        settings
      }));
    }
  }

  return drafts;
};

const selectDistinctCandidates = ({
  drafts,
  settings
}: {
  drafts: NolanClipCandidateDraft[];
  settings: NolanClipEngineSettings;
}): NolanClipCandidateDraft[] => {
  const sortedDrafts = [...drafts].sort((left, right) => {
    return right.score - left.score ||
      right.scoreBreakdown.referenceAlignment - left.scoreBreakdown.referenceAlignment ||
      right.scoreBreakdown.hookStrength - left.scoreBreakdown.hookStrength ||
      left.startMs - right.startMs;
  });
  const selected: NolanClipCandidateDraft[] = [];

  for (const draft of sortedDrafts) {
    if (selected.length >= settings.maxCandidates) {
      break;
    }

    const isDuplicate = selected.some((existing) => {
      const overlap = computeCandidateOverlap(existing, draft);
      const startSeparation = Math.abs(existing.startMs - draft.startMs);
      return overlap >= settings.duplicateOverlapRatio || (
        overlap >= 0.6 &&
        startSeparation < settings.duplicateStartSeparationMs
      );
    });
    if (isDuplicate) {
      continue;
    }

    selected.push(draft);
  }

  return selected.sort((left, right) => right.score - left.score || left.startMs - right.startMs);
};

export const buildNolanClipPlan = ({
  chunks,
  videoMetadata,
  sourceVideoPath = null,
  sourceVideoHash = null,
  sourceCaptionPath = null,
  referenceScriptText = null,
  referenceScriptPath = null,
  settings: settingsOverride = {}
}: {
  chunks: CaptionChunk[];
  videoMetadata?: Pick<VideoMetadata, "durationSeconds">;
  sourceVideoPath?: string | null;
  sourceVideoHash?: string | null;
  sourceCaptionPath?: string | null;
  referenceScriptText?: string | null;
  referenceScriptPath?: string | null;
  settings?: Partial<NolanClipEngineSettings>;
}): NolanClipPlan => {
  const settings = withDefinedOverrides(DEFAULT_NOLAN_CLIP_ENGINE_SETTINGS, settingsOverride);
  const durationSeconds = videoMetadata?.durationSeconds
    ?? Math.max(1, chunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0) / 1000);
  const parsedReference = referenceScriptText
    ? parseNolanReferenceScript({
      text: referenceScriptText,
      sourcePath: referenceScriptPath
    })
    : {
      sourcePath: referenceScriptPath ?? null,
      sections: [] as NolanClipReferenceSection[]
    };
  const preparedReferenceSections = prepareReferenceSections(parsedReference.sections);
  const drafts = enumerateDraftCandidates({
    chunks,
    referenceSections: preparedReferenceSections,
    settings
  });
  const selectedDrafts = selectDistinctCandidates({
    drafts,
    settings
  });
  const candidates = selectedDrafts.map((draft, index) => ({
    ...draft,
    rank: index + 1,
    page: Math.floor(index / settings.pageSize) + 1,
    pageIndex: (index % settings.pageSize) + 1,
    recommended: index < 3
  }));
  const pages: NolanClipReviewPage[] = Array.from({
    length: Math.ceil(candidates.length / settings.pageSize)
  }, (_, pageIndex) => {
    const items = candidates.slice(pageIndex * settings.pageSize, (pageIndex + 1) * settings.pageSize);
    return {
      page: pageIndex + 1,
      pageSize: settings.pageSize,
      itemCount: items.length,
      items
    };
  });

  return {
    engineId: ENGINE_ID,
    version: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceVideoPath,
    sourceVideoHash,
    durationSeconds: round(durationSeconds),
    chunkCount: chunks.length,
    sourceCaptionPath,
    settings,
    referenceScript: {
      provided: parsedReference.sections.length > 0,
      sourcePath: parsedReference.sourcePath,
      sectionCount: parsedReference.sections.length,
      sections: parsedReference.sections
    },
    summary: {
      candidateCount: candidates.length,
      pageCount: pages.length,
      recommendedClipIds: candidates.filter((candidate) => candidate.recommended).map((candidate) => candidate.id),
      averageScore: candidates.length === 0
        ? 0
        : round(candidates.reduce((total, candidate) => total + candidate.score, 0) / candidates.length),
      strongestTags: strongestTags(candidates)
    },
    pages,
    candidates
  };
};
