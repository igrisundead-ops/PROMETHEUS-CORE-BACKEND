import {captionPolicy} from "./caption-policy";
import type {ChunkIntent, ChunkSemanticMeta, NameSpan, TranscribedWord} from "./types";

export type SemanticWordChunk = {
  words: TranscribedWord[];
  startMs: number;
  endMs: number;
  text: string;
  semantic: ChunkSemanticMeta;
};

export type ChunkingPolicy = {
  hardMinWords: number;
  hardMaxWords: number;
  softMinWords: number;
  softMaxWords: number;
  pauseBreakMs: number;
  strongPauseMs: number;
  maxLineChars: number;
  hardMaxLineChars: number;
};

const BREAK_AVOID_AFTER = new Set(["a", "an", "and", "or", "to", "of", "in", "for", "if", "like"]);
const BREAK_AVOID_BEFORE = new Set(["and", "or", "to", "of", "in", "for", "is", "are", "if", "you"]);
const NAME_CUE_WORDS = new Set(["like", "called", "named", "coach", "with"]);
const PUNCH_WORDS = new Set(["you", "now", "stop", "start", "listen", "look", "must", "need", "today"]);
const HELPER_WORDS = new Set([
  "allow",
  "let",
  "lets",
  "make",
  "makes",
  "help",
  "helps",
  "keep",
  "get",
  "gets",
  "give",
  "gives",
  "show",
  "shows",
  "build",
  "create",
  "drive",
  "move",
  "feel",
  "see",
  "hear",
  "think",
  "know",
  "become",
  "go",
  "do",
  "be",
  "have",
  "need",
  "want",
  "start",
  "stop"
]);
const PRIMARY_WORDS = new Set([
  "people",
  "person",
  "clients",
  "client",
  "customers",
  "customer",
  "audience",
  "viewers",
  "you",
  "your",
  "me",
  "us",
  "them",
  "results",
  "experience",
  "mindset",
  "growth",
  "success",
  "business",
  "brand",
  "life",
  "money",
  "value",
  "trust",
  "confidence"
]);

const normalizeWord = (value: string): string => value.replace(/[\u2018\u2019]/g, "'").replace(/[^a-zA-Z0-9']/g, "").toLowerCase();

const isTitleLike = (value: string): boolean => /^[A-Z][a-z]+(?:'[A-Za-z]+)?$/.test(value);
const isAlphabeticWord = (value: string): boolean => /^[A-Za-z][A-Za-z'-]*$/.test(value);

const toChunkText = (words: TranscribedWord[]): string => words.map((word) => word.text).join(" ").trim();

const toChunk = (words: TranscribedWord[], semantic: ChunkSemanticMeta): SemanticWordChunk => {
  const startMs = words[0]?.startMs ?? 0;
  const endMs = words[words.length - 1]?.endMs ?? startMs;
  return {
    words,
    startMs,
    endMs,
    text: toChunkText(words),
    semantic
  };
};

const mergeNameSpans = (spans: NameSpan[]): NameSpan[] => {
  if (spans.length === 0) {
    return [];
  }

  const sorted = spans.slice().sort((a, b) => a.startWord - b.startWord || a.endWord - b.endWord);
  const merged: NameSpan[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    if (current.startWord <= previous.endWord + 1) {
      previous.endWord = Math.max(previous.endWord, current.endWord);
      previous.text = `${previous.text} ${current.text}`.trim();
      continue;
    }
    merged.push(current);
  }
  return merged;
};

export const detectNameSpans = (words: TranscribedWord[]): NameSpan[] => {
  if (words.length === 0) {
    return [];
  }

  const spans: NameSpan[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const currentRaw = words[index].text.replace(/[^A-Za-z']/g, "");
    const nextRaw = words[index + 1]?.text.replace(/[^A-Za-z']/g, "") ?? "";

    if (isTitleLike(currentRaw) && isTitleLike(nextRaw)) {
      let end = index + 1;
      while (end + 1 < words.length) {
        const candidate = words[end + 1].text.replace(/[^A-Za-z']/g, "");
        if (!isTitleLike(candidate)) {
          break;
        }
        end += 1;
      }
      spans.push({
        startWord: index,
        endWord: end,
        text: words.slice(index, end + 1).map((word) => word.text).join(" ")
      });
      index = end;
      continue;
    }

    const previousNormalized = normalizeWord(words[index - 1]?.text ?? "");
    const secondRaw = words[index + 1]?.text.replace(/[^A-Za-z']/g, "") ?? "";
    if (
      NAME_CUE_WORDS.has(previousNormalized) &&
      isAlphabeticWord(currentRaw) &&
      isAlphabeticWord(secondRaw) &&
      currentRaw.length > 2 &&
      secondRaw.length > 2
    ) {
      spans.push({
        startWord: index,
        endWord: index + 1,
        text: `${words[index].text} ${words[index + 1].text}`
      });
      index += 1;
    }
  }

  return mergeNameSpans(spans);
};

const isBoundaryInsideNameSpan = (boundaryLeftIndex: number, nameSpans: NameSpan[]): boolean => {
  return nameSpans.some((span) => boundaryLeftIndex >= span.startWord && boundaryLeftIndex < span.endWord);
};

const isPunchChunk = (chunkWords: TranscribedWord[]): boolean => {
  if (chunkWords.length === 0) {
    return false;
  }

  if (chunkWords.some((word) => /[!?]$/.test(word.text))) {
    return true;
  }

  if (chunkWords.some((word) => /[A-Z]{2,}/.test(word.text))) {
    return true;
  }

  if (chunkWords.length <= 2) {
    return chunkWords.some((word) => PUNCH_WORDS.has(normalizeWord(word.text)));
  }

  return false;
};

const getRelativeNameSpans = (nameSpans: NameSpan[], start: number, end: number, sourceWords: TranscribedWord[]): NameSpan[] => {
  const relative: NameSpan[] = [];
  nameSpans.forEach((span) => {
    if (span.endWord < start || span.startWord > end) {
      return;
    }
    const clippedStart = Math.max(span.startWord, start);
    const clippedEnd = Math.min(span.endWord, end);
    relative.push({
      startWord: clippedStart - start,
      endWord: clippedEnd - start,
      text: sourceWords.slice(clippedStart, clippedEnd + 1).map((word) => word.text).join(" ")
    });
  });
  return relative;
};

const resolveIntent = (chunkWords: TranscribedWord[], nameSpans: NameSpan[]): ChunkIntent => {
  if (nameSpans.length > 0) {
    return "name-callout";
  }
  if (isPunchChunk(chunkWords)) {
    return "punch-emphasis";
  }
  return "default";
};

const scoreBoundary = ({
  start,
  end,
  words,
  nameSpans,
  chunkingPolicy
}: {
  start: number;
  end: number;
  words: TranscribedWord[];
  nameSpans: NameSpan[];
  chunkingPolicy: ChunkingPolicy;
}): number => {
  const count = end - start + 1;
  const softCenter = (chunkingPolicy.softMinWords + chunkingPolicy.softMaxWords) / 2;
  let score = -Math.abs(count - softCenter);

  const estimateWordLength = (raw: string): number => {
    const cleaned = raw.replace(/[^A-Za-z0-9]/g, "");
    const base = cleaned.length;
    const uppercase = cleaned.replace(/[^A-Z]/g, "").length;
    const extra = Math.max(0, base - 8) * 0.35 + uppercase * 0.05;
    return base + extra;
  };

  const estimateLineLength = (from: number, to: number): number => {
    if (from > to) {
      return 0;
    }
    let length = 0;
    for (let i = from; i <= to; i += 1) {
      length += estimateWordLength(words[i].text);
      if (i > from) {
        length += 1;
      }
    }
    return Number(length.toFixed(2));
  };

  const maxLineChars = chunkingPolicy.maxLineChars;
  const hardMaxLineChars = chunkingPolicy.hardMaxLineChars;
  const lineLength = estimateLineLength(start, end);

  if (count >= chunkingPolicy.softMinWords && count <= chunkingPolicy.softMaxWords) {
    score += 1.6;
  }

  if (end >= words.length - 1) {
    score += 6;
    return score;
  }

  if (isBoundaryInsideNameSpan(end, nameSpans)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (lineLength > hardMaxLineChars && count > 1) {
    return Number.NEGATIVE_INFINITY;
  }
  if (lineLength > maxLineChars) {
    score -= (lineLength - maxLineChars) * 1.2;
  } else {
    score += 0.8;
  }

  const current = words[end];
  const next = words[end + 1];
  const pauseMs = next.startMs - current.endMs;

  if (pauseMs >= chunkingPolicy.strongPauseMs) {
    score += 5.2;
  } else if (pauseMs >= chunkingPolicy.pauseBreakMs) {
    score += 2.8;
  }

  if (/[.!?]$/.test(current.text)) {
    score += 5;
  } else if (/[,;:]$/.test(current.text)) {
    score += 2.2;
  }

  const left = normalizeWord(current.text);
  const right = normalizeWord(next.text);
  if (BREAK_AVOID_AFTER.has(left)) {
    score -= 1.4;
  }
  if (BREAK_AVOID_BEFORE.has(right)) {
    score -= 1.2;
  }

  const helperPair = HELPER_WORDS.has(left) && (PRIMARY_WORDS.has(right) || right.length > 3);
  if (helperPair) {
    score -= 2.6;
  }

  if (count === 1 && !PUNCH_WORDS.has(left)) {
    score -= 2.4;
  } else if (count === 2) {
    score -= 0.8;
  }

  return score;
};

export const buildSemanticChunks = (
  words: TranscribedWord[],
  chunkingPolicy: ChunkingPolicy = captionPolicy.chunking
): SemanticWordChunk[] => {
  if (words.length === 0) {
    return [];
  }

  const nameSpans = detectNameSpans(words);
  const chunks: SemanticWordChunk[] = [];
  let start = 0;

  while (start < words.length) {
    const minEnd = Math.min(words.length - 1, start + chunkingPolicy.hardMinWords - 1);
    const maxEnd = Math.min(words.length - 1, start + chunkingPolicy.hardMaxWords - 1);

    let bestEnd = maxEnd;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let end = minEnd; end <= maxEnd; end += 1) {
      const score = scoreBoundary({start, end, words, nameSpans, chunkingPolicy});
      if (score > bestScore) {
        bestScore = score;
        bestEnd = end;
      }
    }

    const chunkWords = words.slice(start, bestEnd + 1);
    const relativeNameSpans = getRelativeNameSpans(nameSpans, start, bestEnd, words);
    const semantic: ChunkSemanticMeta = {
      intent: resolveIntent(chunkWords, relativeNameSpans),
      nameSpans: relativeNameSpans,
      isVariation: false,
      suppressDefault: false
    };
    chunks.push(toChunk(chunkWords, semantic));
    start = bestEnd + 1;
  }

  return chunks;
};

const titleCaseWord = (rawWord: string): string => {
  const match = /^([^A-Za-z']*)([A-Za-z][A-Za-z']*)([^A-Za-z']*)$/.exec(rawWord);
  if (!match) {
    return rawWord;
  }

  const [, prefix, core, suffix] = match;
  const normalizedCore = core.toLowerCase();
  const titledCore = normalizedCore.charAt(0).toUpperCase() + normalizedCore.slice(1);
  return `${prefix}${titledCore}${suffix}`;
};

export const applyProperCaseToNameWords = (words: TranscribedWord[], nameSpans: NameSpan[]): TranscribedWord[] => {
  if (nameSpans.length === 0 || !captionPolicy.styling.keepProperCaseNames) {
    return words;
  }

  const nameWordIndexes = new Set<number>();
  nameSpans.forEach((span) => {
    for (let index = span.startWord; index <= span.endWord; index += 1) {
      nameWordIndexes.add(index);
    }
  });

  return words.map((word, index) => {
    if (!nameWordIndexes.has(index)) {
      return word;
    }
    return {
      ...word,
      text: titleCaseWord(word.text)
    };
  });
};
