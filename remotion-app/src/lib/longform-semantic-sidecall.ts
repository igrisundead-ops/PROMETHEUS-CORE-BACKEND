import {isLongformHelperWord, normalizeLongformWord} from "./longform-word-layout";
import type {CaptionChunk} from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "better",
  "by",
  "for",
  "from",
  "good",
  "has",
  "have",
  "here",
  "heres",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "made",
  "me",
  "of",
  "on",
  "or",
  "preview",
  "the",
  "this",
  "to",
  "up",
  "was",
  "with"
]);

const toSourceTitle = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  const fileName = value.split(/[\\/]/).pop() ?? value;
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const singularize = (value: string): string => {
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
};

const pluralize = (value: string): string => {
  if (value.endsWith("y") && value.length > 2) {
    return `${value.slice(0, -1)}ies`;
  }
  if (value.endsWith("s")) {
    return value;
  }
  return `${value}s`;
};

const cleanText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const toTitleCase = (value: string): string => {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const truncateWords = (value: string, maxWords: number): string => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return words.slice(0, maxWords).join(" ");
};

const PERSON_BLOCKLIST = new Set([
  "the",
  "this",
  "that",
  "these",
  "those",
  "here",
  "there",
  "what",
  "when",
  "where",
  "why",
  "how",
  "step",
  "steps"
]);

const STEP_COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

const STEP_ORDINAL_WORDS = new Set([
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth"
]);

const getCleanText = (chunk: CaptionChunk): string => {
  return cleanText(`${chunk.text} ${chunk.words.map((word) => word.text).join(" ")}`);
};

const getNameSpanPhrase = (chunk: CaptionChunk): string | null => {
  const span = (chunk.semantic?.nameSpans ?? []).find((candidate) => candidate.text.trim().length > 0);
  if (!span) {
    return null;
  }

  const normalized = cleanText(span.text);
  if (!normalized) {
    return null;
  }

  return toTitleCase(normalized);
};

const extractPersonReferencePhrase = (chunk: CaptionChunk): string | null => {
  const spanPhrase = getNameSpanPhrase(chunk);
  if (spanPhrase) {
    return spanPhrase;
  }

  const text = getCleanText(chunk);
  const matches = text.match(/\b([A-Z][a-z0-9']*(?:\s+[A-Z][a-z0-9']*){1,3})\b/g) ?? [];
  for (const match of matches) {
    const normalizedTokens = match
      .split(/\s+/)
      .map((token) => normalizeLongformWord(token))
      .filter(Boolean);

    if (normalizedTokens.length < 2) {
      continue;
    }

    if (normalizedTokens.every((token) => PERSON_BLOCKLIST.has(token))) {
      continue;
    }

    return toTitleCase(cleanText(match));
  }

  return null;
};

const detectStepCount = (chunk: CaptionChunk): number => {
  const text = getCleanText(chunk).toLowerCase();
  const counts = new Set<number>();

  for (const [word, count] of Object.entries(STEP_COUNT_WORDS)) {
    if (new RegExp(`\\b${word}\\s+steps?\\b`, "i").test(text) || new RegExp(`\\bstep\\s+${word}\\b`, "i").test(text)) {
      counts.add(count);
    }
  }

  for (const match of text.matchAll(/\bstep\s*(\d+)\b/g)) {
    const parsed = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      counts.add(parsed);
    }
  }

  const ordinalMatches = Array.from(STEP_ORDINAL_WORDS).filter((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
  if (ordinalMatches.length >= 2) {
    counts.add(Math.min(ordinalMatches.length, 6));
  }

  return Math.max(...counts, 0);
};

const splitStepFragments = (chunk: CaptionChunk, stepCount: number): string[] => {
  const text = getCleanText(chunk)
    .replace(/\b(?:step\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b[:\-]?\s*/gi, "")
    .trim();

  if (!text) {
    return [];
  }

  const fragments = text
    .split(/\s*(?:;|,|—|–|\bthen\b|\bnext\b)\s*/i)
    .map((fragment) => cleanText(fragment))
    .filter(Boolean);

  if (fragments.length >= stepCount) {
    return fragments.slice(0, stepCount).map((fragment) => toTitleCase(truncateWords(fragment, 4)));
  }

  return fragments.map((fragment) => toTitleCase(truncateWords(fragment, 4)));
};

type LongformSemanticSidecallCandidate = {
  score: number;
  titleMatch: boolean;
  normalized: string;
  displayText: string;
  wordIndex: number;
};

export type LongformSemanticSidecallVariant = "entity-card" | "step-row" | "step-stack" | "keyword-card";

export type LongformSemanticSidecallStep = {
  label: string;
  detail: string;
};

export type LongformSemanticSidecallPresentation = {
  variant: LongformSemanticSidecallVariant;
  intentLabel: string;
  leadLabel: string;
  supportingLabel: string | null;
  graphicAsset: LongformSemanticGraphicAsset | null;
  keywords: string[];
  stepItems: LongformSemanticSidecallStep[];
};

export type LongformSemanticGraphicAsset = {
  assetId: string;
  label: string;
  copy: string;
  src: string;
};

type LongformSemanticGraphicAssetRule = {
  asset: LongformSemanticGraphicAsset;
  matchers: RegExp[];
};

const GRAPHIC_ASSET_RULES: LongformSemanticGraphicAssetRule[] = [
  {
    asset: {
      assetId: "thinking-concrete-choice",
      label: "Thought cue",
      copy: "Reflection / decision",
      src: "showcase-assets/imports/prometheus-concrete/thinking-concrete-choice.png"
    },
    matchers: [
      /\bthink(?:ing|s)?\b/i,
      /\bchoice\b/i,
      /\bdecide(?:d|s|ing)?\b/i,
      /\bconsider(?:ed|ing)?\b/i,
      /\breflect(?:ed|ion|ive|ing)?\b/i,
      /\bponder(?:ed|ing)?\b/i
    ]
  },
  {
    asset: {
      assetId: "send-messagea",
      label: "Text capsule",
      copy: "Name / label / message",
      src: "showcase-assets/imports/promethues-with-bg/send-messagea.png"
    },
    matchers: [
      /\bmessage\b/i,
      /\bemail\b/i,
      /\binbox\b/i,
      /\btext\b/i,
      /\bname\b/i,
      /\blabel\b/i,
      /\bcaption\b/i,
      /\bbubble\b/i,
      /\bcapsule\b/i,
      /\btag\b/i,
      /\bnote\b/i
    ]
  },
  {
    asset: {
      assetId: "notification-alarm-02",
      label: "Notification",
      copy: "Alert / update",
      src: "showcase-assets/imports/promethues-with-bg/notification-alarm-02.png"
    },
    matchers: [
      /\bnotification\b/i,
      /\balert\b/i,
      /\breminder\b/i,
      /\bping\b/i,
      /\bbell\b/i
    ]
  },
  {
    asset: {
      assetId: "telephone-call-outreach",
      label: "Outreach",
      copy: "Outbound contact",
      src: "showcase-assets/imports/promethues-with-bg/telephone-call-outreach.png"
    },
    matchers: [
      /\boutreach\b/i,
      /\bfollow[-\s]?up\b/i,
      /\breach out\b/i,
      /\bconnect(?:ion)?\b/i
    ]
  },
  {
    asset: {
      assetId: "telephone-call",
      label: "Call",
      copy: "Direct contact",
      src: "showcase-assets/imports/promethues-with-bg/telephone-call.png"
    },
    matchers: [
      /\bcall\b/i,
      /\bphone\b/i,
      /\bdial(?:ed|ing)?\b/i,
      /\bcontact\b/i
    ]
  },
  {
    asset: {
      assetId: "time-clock-hourglass",
      label: "Time",
      copy: "Two-minute rule",
      src: "showcase-assets/imports/promethues-with-bg/time-clock-hourglass.png"
    },
    matchers: [
      /\btwo[-\s]?minute\b/i,
      /\bminute\b/i,
      /\bminutes\b/i,
      /\bclock\b/i,
      /\bhourglass\b/i,
      /\btime\b/i,
      /\brule\b/i,
      /\bdeadline\b/i,
      /\btimer\b/i
    ]
  },
  {
    asset: {
      assetId: "hourglass-sand",
      label: "Timing",
      copy: "Hold / pacing",
      src: "showcase-assets/hourglass-sand.png"
    },
    matchers: [
      /\bwait\b/i,
      /\bdelay\b/i,
      /\bpause\b/i,
      /\bpacing\b/i
    ]
  }
];

const matchesAny = (text: string, matchers: RegExp[]): boolean => {
  return matchers.some((matcher) => matcher.test(text));
};

export const resolveLongformSemanticGraphicAsset = (
  chunk: CaptionChunk
): LongformSemanticGraphicAsset | null => {
  const text = getCleanText(chunk).toLowerCase();
  if (!text) {
    return null;
  }

  for (const rule of GRAPHIC_ASSET_RULES) {
    if (matchesAny(text, rule.matchers)) {
      return rule.asset;
    }
  }

  return null;
};

export const hasLongformSemanticGraphicAsset = (chunk: CaptionChunk): boolean => {
  return resolveLongformSemanticGraphicAsset(chunk) !== null;
};

const collectLongformSemanticCandidates = ({
  chunk,
  titleKeywords = defaultLongformSemanticKeywords
}: {
  chunk: CaptionChunk;
  titleKeywords?: Set<string>;
}): LongformSemanticSidecallCandidate[] => {
  const nameWordIndices = new Set<number>();
  (chunk.semantic?.nameSpans ?? []).forEach((span) => {
    for (let index = span.startWord; index <= span.endWord; index += 1) {
      nameWordIndices.add(index);
    }
  });

  const candidates = chunk.words
    .map((word, wordIndex) => {
      const normalized = normalizeLongformWord(word.text);
      if (!normalized || STOP_WORDS.has(normalized) || isLongformHelperWord(normalized)) {
        return null;
      }

      const titleMatch = titleKeywords.has(normalized) ||
        titleKeywords.has(singularize(normalized)) ||
        titleKeywords.has(pluralize(normalized));

      let score = normalized.length;
      if (titleMatch) {
        score += 40;
      }
      if (chunk.emphasisWordIndices.includes(wordIndex)) {
        score += 18;
      }
      if (nameWordIndices.has(wordIndex)) {
        score += 16;
      }
      if (chunk.semantic?.intent === "punch-emphasis") {
        score += 8;
      }
      if (chunk.semantic?.intent === "name-callout") {
        score += 6;
      }

      return {
        score,
        titleMatch,
        normalized,
        displayText: word.text.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""),
        wordIndex
      };
    })
    .filter((candidate): candidate is LongformSemanticSidecallCandidate => Boolean(candidate && candidate.displayText));

  return candidates.reduce<LongformSemanticSidecallCandidate[]>((accumulator, candidate) => {
    const existing = accumulator.find((entry) => entry.normalized === candidate.normalized);
    if (!existing) {
      accumulator.push(candidate);
      return accumulator;
    }

    if (candidate.score > existing.score) {
      existing.score = candidate.score;
      existing.displayText = candidate.displayText;
      existing.wordIndex = candidate.wordIndex;
      existing.titleMatch = candidate.titleMatch || existing.titleMatch;
    }

    return accumulator;
  }, []);
};

const buildPresentationKeywords = (
  candidates: LongformSemanticSidecallCandidate[],
  limit: number
): string[] => {
  const titleMatches = candidates.filter((candidate) => candidate.titleMatch);
  const sortedPool = (titleMatches.length > 0 ? titleMatches : candidates)
    .sort((left, right) => right.score - left.score || left.wordIndex - right.wordIndex);

  return sortedPool.slice(0, limit).map((candidate) => candidate.displayText);
};

export const buildLongformSemanticSidecallPresentation = ({
  chunk,
  titleKeywords = defaultLongformSemanticKeywords
}: {
  chunk: CaptionChunk;
  titleKeywords?: Set<string>;
}): LongformSemanticSidecallPresentation => {
  const candidates = collectLongformSemanticCandidates({chunk, titleKeywords});
  const personReference = extractPersonReferencePhrase(chunk);
  const stepCount = detectStepCount(chunk);
  const graphicAsset = resolveLongformSemanticGraphicAsset(chunk);

  if (personReference) {
    const supporting = buildPresentationKeywords(candidates, 2).find((keyword) => keyword !== personReference) ?? null;
    return {
      variant: "entity-card",
      intentLabel: "Named reference",
      leadLabel: personReference,
      supportingLabel: supporting,
      graphicAsset,
      keywords: [personReference, ...(supporting ? [supporting] : [])].slice(0, 3),
      stepItems: []
    };
  }

  if (stepCount >= 2) {
    const stepFragments = splitStepFragments(chunk, stepCount);
    const fallbackKeywords = buildPresentationKeywords(candidates, 3);
    const stepItems = Array.from({length: stepCount}, (_, index) => {
      const fragment = stepFragments[index] ?? fallbackKeywords[index] ?? `Step ${index + 1}`;
      return {
        label: `Step ${index + 1}`,
        detail: fragment
      };
    });

    return {
      variant: stepCount >= 4 || chunk.words.length >= 18 ? "step-stack" : "step-row",
      intentLabel: `${stepCount}-step sequence`,
      leadLabel: `${stepCount} steps`,
      supportingLabel: "Fluid sequence",
      graphicAsset,
      keywords: stepItems.map((item) => item.detail).slice(0, 3),
      stepItems
    };
  }

  const keywords = buildPresentationKeywords(candidates, 3);
  const leadLabel = keywords[0] ?? (toTitleCase(truncateWords(getCleanText(chunk), 4)) || "Key idea");

  return {
    variant: "keyword-card",
    intentLabel: chunk.semantic?.intent === "punch-emphasis" ? "Key idea" : "Title keyword",
    leadLabel,
    supportingLabel: keywords[1] ?? null,
    graphicAsset,
    keywords: keywords.slice(0, 2),
    stepItems: []
  };
};

export const buildLongformSemanticKeywordSet = ({
  description,
  sourceVideoPath
}: {
  description?: string | null;
  sourceVideoPath?: string | null;
}): Set<string> => {
  const sourceTitle = toSourceTitle(sourceVideoPath);
  const rawText = `${description ?? ""} ${sourceTitle}`;
  const tokens = rawText
    .split(/\s+/)
    .map((token) => normalizeLongformWord(token))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  return new Set(tokens.flatMap((token) => [token, singularize(token), pluralize(token)]));
};

const defaultLongformSemanticKeywords = buildLongformSemanticKeywordSet({});

export const getDefaultLongformSemanticKeywords = (): Set<string> => {
  return defaultLongformSemanticKeywords;
};

export const getLongformSemanticSidecallKeywords = ({
  chunk,
  titleKeywords = defaultLongformSemanticKeywords
}: {
  chunk: CaptionChunk;
  titleKeywords?: Set<string>;
}): string[] => {
  return buildLongformSemanticSidecallPresentation({chunk, titleKeywords}).keywords;
};
