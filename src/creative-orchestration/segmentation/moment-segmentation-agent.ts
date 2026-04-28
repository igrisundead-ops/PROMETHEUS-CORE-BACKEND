import type {CreativeAgent, CreativeContext, CreativeMoment, CreativeMomentType} from "../types";
import {clamp, clamp01, hashString, normalizeText, uniqueById} from "../utils";

const QUESTION_STARTERS = new Set(["what", "why", "how", "when", "where", "who", "which", "can", "should", "could"]);
const LIST_STARTERS = new Set(["first", "second", "third", "one", "two", "three", "step", "steps", "point", "points"]);
const PAYOFF_WORDS = new Set(["mistake", "bottleneck", "solution", "result", "payoff", "reason", "because", "fix", "faster", "better"]);

const momentTypeFromText = (text: string, chunkIndex: number, isLastChunk: boolean): CreativeMomentType => {
  const normalized = normalizeText(text);
  const firstWord = normalized.split(" ")[0] ?? "";
  const wordCount = normalized ? normalized.split(" ").length : 0;

  if (chunkIndex === 0 && wordCount <= 8) {
    return "hook";
  }
  if (normalized.includes("?") || QUESTION_STARTERS.has(firstWord)) {
    return "question";
  }
  if (/^\d+[\.:)]/.test(normalized) || LIST_STARTERS.has(firstWord)) {
    return "list";
  }
  if (PAYOFF_WORDS.has(firstWord) || [...PAYOFF_WORDS].some((term) => normalized.includes(term))) {
    return "payoff";
  }
  if (wordCount <= 3 && chunkIndex <= 2) {
    return "title";
  }
  if (isLastChunk && wordCount <= 6) {
    return "transition";
  }
  if (wordCount <= 5) {
    return "keyword";
  }
  if (wordCount >= 14) {
    return "explanation";
  }
  return "ambient";
};

const inferMomentEnergy = (text: string, wordCount: number, emphasisCount: number): number => {
  const punctuationBoost = /[!?]/.test(text) ? 0.18 : 0;
  const lengthBoost = clamp01(wordCount / 12) * 0.35;
  return clamp01(0.25 + lengthBoost + emphasisCount * 0.12 + punctuationBoost);
};

const inferImportance = (momentType: CreativeMomentType, wordCount: number, chunkIndex: number): number => {
  const typeBoost: Record<CreativeMomentType, number> = {
    hook: 0.92,
    keyword: 0.82,
    question: 0.9,
    list: 0.72,
    explanation: 0.55,
    transition: 0.48,
    payoff: 0.95,
    title: 0.88,
    ambient: 0.3
  };
  return clamp01(typeBoost[momentType] + (wordCount <= 4 ? 0.06 : 0) - Math.min(0.08, chunkIndex * 0.008));
};

export class MomentSegmentationAgent implements CreativeAgent<CreativeContext> {
  id = "moment-segmentation";
  label = "Moment Segmentation";

  async propose(context: CreativeContext): Promise<never[]> {
    void context;
    return [];
  }

  segment(context: CreativeContext): CreativeMoment[] {
    const chunks = [...context.chunks].sort((a, b) => a.startMs - b.startMs);
    const rawMoments = chunks.map((chunk, chunkIndex) => {
      const emphasisCount = chunk.emphasisWordIndices?.length ?? 0;
      const momentType = momentTypeFromText(chunk.text, chunkIndex, chunkIndex === chunks.length - 1);
      const energy = inferMomentEnergy(chunk.text, chunk.words.length, emphasisCount);
      const importance = inferImportance(momentType, chunk.words.length, chunkIndex);
      const density = chunk.words.length / Math.max(0.5, (chunk.endMs - chunk.startMs) / 1000);
      const suggestedIntensity =
        importance >= 0.9 || energy >= 0.88
          ? "hero"
          : importance >= 0.75 || energy >= 0.72
            ? "high"
            : importance >= 0.5 || energy >= 0.5
              ? "medium"
              : "minimal";

      return {
        id: `moment-${String(chunkIndex + 1).padStart(4, "0")}`,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        transcriptText: chunk.text,
        words: chunk.words,
        momentType,
        energy,
        importance,
        density,
        suggestedIntensity,
        chunkIds: [chunk.id]
      } satisfies CreativeMoment;
    });

    const merged: CreativeMoment[] = [];
    for (const moment of rawMoments) {
      const last = merged[merged.length - 1];
      const mergeable =
        Boolean(last) &&
        last.momentType === moment.momentType &&
        moment.startMs - last.endMs <= 220 &&
        last.momentType !== "title" &&
        last.momentType !== "question";

      if (!mergeable) {
        merged.push({...moment, words: [...moment.words], chunkIds: [...(moment.chunkIds ?? [])]});
        continue;
      }

      const combinedWords = uniqueById([...last.words, ...moment.words].map((word, index) => ({
        ...word,
        id: `word-${hashString(`${last.id}|${moment.id}|${index}`)}`
      }))).map((word) => ({
        text: word.text,
        startMs: word.startMs,
        endMs: word.endMs,
        confidence: word.confidence
      }));
      last.endMs = moment.endMs;
      last.transcriptText = [last.transcriptText, moment.transcriptText].join(" ").replace(/\s+/g, " ").trim();
      last.words = combinedWords;
      last.energy = clamp01((last.energy + moment.energy) / 2);
      last.importance = clamp01(Math.max(last.importance, moment.importance));
      last.density = combinedWords.length / Math.max(0.5, (last.endMs - last.startMs) / 1000);
      last.suggestedIntensity = last.importance >= 0.9 || last.energy >= 0.88
        ? "hero"
        : last.importance >= 0.75 || last.energy >= 0.72
          ? "high"
          : last.importance >= 0.5 || last.energy >= 0.5
            ? "medium"
            : "minimal";
      last.chunkIds = [...(last.chunkIds ?? []), ...(moment.chunkIds ?? [])];
    }

    return merged.map((moment, index) => ({
      ...moment,
      id: `moment-${String(index + 1).padStart(4, "0")}`,
      chunkIds: [...new Set(moment.chunkIds ?? [])]
    }));
  }
}

