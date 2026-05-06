import {generateSemanticDecision} from "./semantic-emphasis-engine";
import type {TranscribedWord} from "./types";

export type LongformLineRole = "hook" | "context" | "reinforcement" | "cta";

export type LongformWordLine = {
  id: string;
  words: TranscribedWord[];
  startMs: number;
  endMs: number;
  estimatedUnits: number;
  role?: LongformLineRole;
};

const helperWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "with"
]);

export const normalizeLongformWord = (value: string): string => {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[^a-zA-Z0-9']/g, "").toLowerCase();
};

export const isLongformHelperWord = (value: string): boolean => {
  return helperWords.has(normalizeLongformWord(value));
};

export const estimateLongformWordUnits = (word: TranscribedWord): number => {
  const normalized = normalizeLongformWord(word.text);
  const rawLength = word.text.replace(/\s+/g, "").length;
  const helperMultiplier = helperWords.has(normalized) ? 0.62 : 1;
  const punctuationBonus = /[.,!?]/.test(word.text) ? 0.3 : 0;
  const uppercaseBonus = /[A-Z]/.test(word.text) ? 0.15 : 0;
  const numericBonus = /\d/.test(word.text) ? 0.4 : 0;
  return (rawLength + punctuationBonus + uppercaseBonus + numericBonus) * helperMultiplier;
};

const buildLine = (id: string, words: TranscribedWord[], role?: LongformLineRole): LongformWordLine => {
  return {
    id,
    words,
    startMs: words[0]?.startMs ?? 0,
    endMs: words[words.length - 1]?.endMs ?? 0,
    estimatedUnits: words.reduce((sum, word, index) => {
      return sum + estimateLongformWordUnits(word) + (index > 0 ? 1.25 : 0);
    }, 0),
    role
  };
};

const scoreLineSplit = (first: LongformWordLine, second: LongformWordLine): number => {
  const secondFirstWord = normalizeLongformWord(second.words[0]?.text ?? "");
  const firstCount = first.words.length;
  const secondCount = second.words.length;
  const balancePenalty = Math.abs(first.estimatedUnits - second.estimatedUnits) * 1.18;
  const countPenalty = Math.abs(firstCount - secondCount) * 1.4;
  const weakSecondStartPenalty = helperWords.has(secondFirstWord) ? 3.5 : 0;
  const overPackedFirstPenalty = firstCount > 4 ? 2.2 : 0;
  const weakSecondLinePenalty = secondCount <= 1 ? 6 : 0;
  const compactSecondLineBonus = secondCount <= 3 ? -1.4 : 0;

  return (
    balancePenalty +
    countPenalty +
    weakSecondStartPenalty +
    overPackedFirstPenalty +
    weakSecondLinePenalty +
    compactSecondLineBonus
  );
};

const shouldUseTwoLineLayout = (words: TranscribedWord[]): boolean => {
  if (words.length <= 3) {
    return false;
  }

  const totalUnits = words.reduce((sum, word, index) => {
    return sum + estimateLongformWordUnits(word) + (index > 0 ? 1.25 : 0);
  }, 0);

  return words.length >= 5 || totalUnits > 26;
};

export const splitLongformWordsIntoLines = (words: TranscribedWord[]): LongformWordLine[] => {
  if (!shouldUseTwoLineLayout(words)) {
    return [buildLine("line-1", words, "hook")];
  }

  let bestCandidate: {first: LongformWordLine; second: LongformWordLine; score: number} | null = null;

  for (let splitIndex = 2; splitIndex <= words.length - 2; splitIndex += 1) {
    const first = buildLine("line-1", words.slice(0, splitIndex));
    const second = buildLine("line-2", words.slice(splitIndex));
    const score = scoreLineSplit(first, second);

    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = {first, second, score};
    }
  }

  if (!bestCandidate) {
    return [buildLine("line-1", words, "hook")];
  }

  const {first, second} = bestCandidate;
  const firstIsHook = first.estimatedUnits <= second.estimatedUnits * 1.15 || /^[A-Z]/.test(first.words[0]?.text ?? "");

  first.role = firstIsHook ? "hook" : "context";
  second.role = firstIsHook ? "context" : "hook";

  return [first, second];
};

export const semanticSplitLongformWords = (words: TranscribedWord[], semanticReductionAllowed: boolean = true): LongformWordLine[] => {
  if (words.length <= 1) {
    return [buildLine("line-1", words, "hook")];
  }

  if (!semanticReductionAllowed) {
    return splitLongformWordsIntoLines(words);
  }

  const semantic = generateSemanticDecision(words);
  const hookIndices = new Set(semantic.tokens.filter(t => t.importanceScore >= 0.8).map(t => t.index));
  
  if (hookIndices.size === 0) {
    return splitLongformWordsIntoLines(words);
  }

  const hookWords = words.filter((_, i) => hookIndices.has(i));
  const contextWords = words.filter((_, i) => !hookIndices.has(i));

  const lines: LongformWordLine[] = [];
  if (hookWords.length > 0) {
    lines.push(buildLine("hook-line", hookWords, "hook"));
  }
  if (contextWords.length > 0) {
    lines.push(buildLine("context-line", contextWords, "context"));
  }

  return lines;
};

const sameWord = (left: TranscribedWord, right: TranscribedWord): boolean => {
  return (
    left.startMs === right.startMs &&
    left.endMs === right.endMs &&
    normalizeLongformWord(left.text) === normalizeLongformWord(right.text)
  );
};

export const findLongformWordAnchor = ({
  lines,
  word
}: {
  lines: LongformWordLine[];
  word: TranscribedWord;
}): {
  lineIndex: number;
  centerRatio: number;
  lineWordCount: number;
} | null => {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const wordIndex = line.words.findIndex((candidate) => sameWord(candidate, word));
    if (wordIndex < 0) {
      continue;
    }

    let cursor = 0;
    for (let index = 0; index < wordIndex; index += 1) {
      cursor += estimateLongformWordUnits(line.words[index]) + (index > 0 ? 1.25 : 0);
    }

    if (wordIndex > 0) {
      cursor += 1.25;
    }

    const wordUnits = estimateLongformWordUnits(line.words[wordIndex]);
    const centerRatio = line.estimatedUnits > 0 ? (cursor + wordUnits / 2) / line.estimatedUnits : 0.5;

    return {
      lineIndex,
      centerRatio,
      lineWordCount: line.words.length
    };
  }

  return null;
};
