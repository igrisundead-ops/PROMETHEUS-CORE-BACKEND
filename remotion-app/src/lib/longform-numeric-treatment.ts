import {resolveAzureGCounterSpec, type AzureGCounterSpec, type AzureGCounterTone} from "./motion-platform/azureg-animations";
import type {CaptionChunk} from "./types";

export type LongformNumericTreatment = {
  id: string;
  chunkIds: string[];
  startMs: number;
  endMs: number;
  unitRevealMs: number;
  sourceText: string;
  supportText: string | null;
  spec: AzureGCounterSpec;
  score: number;
};

const ACTIVE_LEAD_MS = 140;
const ACTIVE_TAIL_MS = 220;
const MAX_ADJACENT_GAP_MS = 220;

const NUMERIC_SIGNAL_WORDS = new Set([
  "hundred",
  "thousand",
  "million",
  "billion",
  "percent",
  "percentage",
  "dollar",
  "dollars",
  "usd",
  "euro",
  "euros",
  "pound",
  "pounds",
  "year",
  "years",
  "figure",
  "figures",
  "k",
  "m",
  "b"
]);

const NUMERIC_SUPPORT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "from",
  "guess",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what"
]);

const NUMBER_WORDS = new Set([
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "thousand",
  "million",
  "billion"
]);

const normalizeToken = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^[^a-z0-9$%]+|[^a-z0-9$%]+$/g, "");
};

const toCleanText = (chunks: CaptionChunk[]): string => {
  return chunks
    .map((chunk) => chunk.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const hasStrongNumericSignal = (value: string): boolean => {
  const normalized = value.toLowerCase();
  if (/\d/.test(normalized) || /[%$€£]/.test(normalized)) {
    return true;
  }

  const tokens = normalized
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean);

  return tokens.some((token) => NUMERIC_SIGNAL_WORDS.has(token));
};

const hasToneUnitSignal = (value: string, tone: AzureGCounterTone): boolean => {
  const normalized = value.toLowerCase();
  if (tone === "percentage") {
    return /%|\bpercent(?:age|ages)?\b/.test(normalized);
  }
  if (tone === "currency") {
    return /[$€£]|\b(?:usd|dollar(?:s)?|euro(?:s)?|pound(?:s)?)\b/.test(normalized);
  }
  if (tone === "year") {
    return /\b(19\d{2}|20\d{2})\b/.test(normalized);
  }
  return /\d/.test(normalized) || /\b(?:hundred|thousand|million|billion|k|m|b)\b/.test(normalized);
};

const shouldUseNumericTreatment = ({
  sourceText,
  spec
}: {
  sourceText: string;
  spec: AzureGCounterSpec;
}): boolean => {
  if (!hasStrongNumericSignal(sourceText) || spec.targetValue <= 0) {
    return false;
  }

  if (spec.tone === "quantity" && spec.targetValue < 10 && !/\d/.test(sourceText)) {
    return false;
  }

  return true;
};

const extractSupportText = ({
  sourceText,
  tone
}: {
  sourceText: string;
  tone: AzureGCounterTone;
}): string | null => {
  const filtered = sourceText
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return false;
      }
      if (/^\d[\d,]*(?:\.\d+)?$/.test(normalized)) {
        return false;
      }
      if (NUMBER_WORDS.has(normalized)) {
        return false;
      }
      if (normalized === "percent" || normalized === "percentage" || normalized === "%" || normalized === "k" || normalized === "m" || normalized === "b") {
        return false;
      }
      if (tone === "currency" && ["dollar", "dollars", "usd", "euro", "euros", "pound", "pounds"].includes(normalized)) {
        return false;
      }
      if (NUMERIC_SUPPORT_STOP_WORDS.has(normalized)) {
        return false;
      }
      return true;
    });

  if (filtered.length === 0) {
    return null;
  }

  return filtered
    .slice(0, 4)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const areAdjacent = (left: CaptionChunk, right: CaptionChunk): boolean => {
  return Math.max(0, right.startMs - left.endMs) <= MAX_ADJACENT_GAP_MS;
};

const buildCandidate = (candidateChunks: CaptionChunk[]): LongformNumericTreatment | null => {
  if (candidateChunks.length === 0) {
    return null;
  }

  const sourceText = toCleanText(candidateChunks);
  const spec = resolveAzureGCounterSpec({
    canonicalLabel: sourceText,
    matchedText: sourceText,
    templateGraphicCategory: "number-counter-kpi"
  });

  if (!shouldUseNumericTreatment({sourceText, spec})) {
    return null;
  }

  const firstChunk = candidateChunks[0];
  const lastChunk = candidateChunks[candidateChunks.length - 1];
  const supportText = extractSupportText({
    sourceText,
    tone: spec.tone
  });
  const emphasisBoost = candidateChunks.reduce((sum, chunk) => sum + (chunk.emphasisWordIndices?.length ?? 0), 0);
  const unitRevealMs =
    candidateChunks.length > 1 &&
    !hasToneUnitSignal(firstChunk.text, spec.tone) &&
    hasToneUnitSignal(lastChunk.text, spec.tone)
      ? lastChunk.startMs
      : firstChunk.startMs;

  return {
    id: `${candidateChunks.map((chunk) => chunk.id).join("+")}:${spec.tone}`,
    chunkIds: candidateChunks.map((chunk) => chunk.id),
    startMs: firstChunk.startMs,
    endMs: lastChunk.endMs,
    unitRevealMs,
    sourceText,
    supportText,
    spec,
    score:
      (candidateChunks.length - 1) * 16 +
      (spec.tone === "percentage" ? 34 : spec.tone === "currency" ? 30 : spec.tone === "year" ? 24 : 18) +
      Math.min(26, Math.round(Math.log10(spec.targetValue + 1) * 10)) +
      emphasisBoost * 4 +
      (supportText ? 8 : 0)
  };
};

const dedupeCandidates = (candidates: LongformNumericTreatment[]): LongformNumericTreatment[] => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.chunkIds.join("+")}:${candidate.spec.tone}:${candidate.spec.targetValue}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const resolveActiveLongformNumericTreatment = ({
  chunks,
  activeChunk,
  currentTimeMs
}: {
  chunks: CaptionChunk[];
  activeChunk: CaptionChunk | null;
  currentTimeMs: number;
}): LongformNumericTreatment | null => {
  if (!activeChunk) {
    return null;
  }

  const activeIndex = chunks.findIndex((chunk) => chunk.id === activeChunk.id);
  if (activeIndex < 0) {
    return null;
  }

  const previousChunk = activeIndex > 0 ? chunks[activeIndex - 1] : null;
  const nextChunk = activeIndex < chunks.length - 1 ? chunks[activeIndex + 1] : null;
  const candidates = dedupeCandidates([
    buildCandidate([activeChunk]),
    previousChunk && areAdjacent(previousChunk, activeChunk) ? buildCandidate([previousChunk, activeChunk]) : null,
    nextChunk && areAdjacent(activeChunk, nextChunk) ? buildCandidate([activeChunk, nextChunk]) : null,
    previousChunk && nextChunk && areAdjacent(previousChunk, activeChunk) && areAdjacent(activeChunk, nextChunk)
      ? buildCandidate([previousChunk, activeChunk, nextChunk])
      : null
  ].filter((candidate): candidate is LongformNumericTreatment => Boolean(candidate)));

  const activeCandidates = candidates.filter((candidate) => {
    return currentTimeMs >= candidate.startMs - ACTIVE_LEAD_MS && currentTimeMs <= candidate.endMs + ACTIVE_TAIL_MS;
  });

  if (activeCandidates.length === 0) {
    return null;
  }

  return [...activeCandidates].sort((left, right) => {
    return right.score - left.score ||
      right.chunkIds.length - left.chunkIds.length ||
      left.startMs - right.startMs;
  })[0] ?? null;
};
