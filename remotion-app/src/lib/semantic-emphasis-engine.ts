import {normalizeLongformWord} from "./longform-word-layout";
import type {TranscribedWord} from "./types";

export type SemanticToken = {
  word: string;
  importanceScore: number;
  reason: string;
  index: number;
};

export type HookCandidate = {
  text: string;
  wordIndices: number[];
  type: "literal" | "emotional" | "punchline";
  score: number;
  rhythm: number;
};

const POWER_WORDS: Record<string, {score: number; reason: string}> = {
  // Urgency
  "now": {score: 0.85, reason: "urgency"},
  "fast": {score: 0.8, reason: "urgency"},
  "today": {score: 0.75, reason: "urgency"},
  "losing": {score: 0.92, reason: "urgency"},
  "lost": {score: 0.88, reason: "urgency"},
  "dying": {score: 0.95, reason: "urgency"},
  "killing": {score: 0.94, reason: "urgency"},
  "missing": {score: 0.82, reason: "urgency"},
  "hurry": {score: 0.86, reason: "urgency"},
  "limited": {score: 0.84, reason: "urgency"},
  "hurting": {score: 0.89, reason: "urgency"},

  // Value / Money
  "money": {score: 0.94, reason: "value"},
  "cash": {score: 0.92, reason: "value"},
  "wealth": {score: 0.95, reason: "value"},
  "free": {score: 0.96, reason: "value"},
  "rich": {score: 0.9, reason: "value"},
  "profit": {score: 0.93, reason: "value"},
  "roi": {score: 0.92, reason: "value"},
  "sales": {score: 0.88, reason: "value"},
  "cost": {score: 0.85, reason: "value"},
  "expensive": {score: 0.87, reason: "value"},
  "cheap": {score: 0.84, reason: "value"},

  // Power / Authority
  "must": {score: 0.88, reason: "authority"},
  "force": {score: 0.86, reason: "authority"},
  "elite": {score: 0.94, reason: "authority"},
  "master": {score: 0.92, reason: "authority"},
  "top": {score: 0.82, reason: "authority"},
  "power": {score: 0.89, reason: "authority"},
  "secret": {score: 0.95, reason: "authority"},
  "hidden": {score: 0.88, reason: "authority"},
  "expert": {score: 0.87, reason: "authority"},
  "proven": {score: 0.89, reason: "authority"},
  "guaranteed": {score: 0.91, reason: "authority"},

  // Negative / Problem
  "stop": {score: 0.9, reason: "problem"},
  "broke": {score: 0.92, reason: "problem"},
  "fail": {score: 0.94, reason: "problem"},
  "danger": {score: 0.96, reason: "problem"},
  "scam": {score: 0.95, reason: "problem"},
  "wrong": {score: 0.88, reason: "problem"},
  "hate": {score: 0.9, reason: "problem"},
  "worst": {score: 0.92, reason: "problem"},
  "broken": {score: 0.89, reason: "problem"},

  // Tech / Future
  "ai": {score: 0.94, reason: "tech"},
  "data": {score: 0.88, reason: "tech"},
  "system": {score: 0.86, reason: "tech"},
  "code": {score: 0.84, reason: "tech"},
  "future": {score: 0.89, reason: "tech"},
  "smart": {score: 0.82, reason: "tech"},
  "automation": {score: 0.92, reason: "tech"}
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "how", "i", "if", "in", "into", "is", "it", "of", "on", "or", "so",
  "that", "the", "this", "to", "we", "with", "you", "your", "my", "our",
  "they", "their", "them", "he", "she", "his", "her", "me", "us"
]);

export const extractMeaning = (words: TranscribedWord[]): {tokens: SemanticToken[]; emotionalWeight: number} => {
  let totalEmotionalWeight = 0;
  const tokens: SemanticToken[] = words.map((word, index) => {
    const normalized = normalizeLongformWord(word.text);
    const power = POWER_WORDS[normalized];
    const isStopWord = STOP_WORDS.has(normalized);

    let score = POWER_WORDS[normalized]?.score ?? (isStopWord ? 0.1 : 0.4);
    
    // Boost score for punctuation
    if (/[!?]/.test(word.text)) score += 0.15;
    if (/[A-Z]{2,}/.test(word.text)) score += 0.2; // All caps boost

    if (power) {
      totalEmotionalWeight += score;
    }

    return {
      word: word.text,
      importanceScore: Math.min(1, score),
      reason: power?.reason ?? (isStopWord ? "filler" : "neutral"),
      index
    };
  });

  return {
    tokens,
    emotionalWeight: totalEmotionalWeight / Math.max(1, words.length)
  };
};

const buildLiteralHook = (tokens: SemanticToken[]): HookCandidate => {
  // Take first 3-5 words
  const count = Math.min(tokens.length, 5);
  const selected = tokens.slice(0, count);
  return {
    text: selected.map(t => t.word).join(" "),
    wordIndices: selected.map(t => t.index),
    type: "literal",
    score: selected.reduce((sum, t) => sum + t.importanceScore, 0) / count,
    rhythm: 0.7
  };
};

const buildEmotionalHook = (tokens: SemanticToken[]): HookCandidate => {
  // Take top importance words (max 4)
  const sorted = [...tokens].sort((a, b) => b.importanceScore - a.importanceScore);
  const selected = sorted.slice(0, 4).sort((a, b) => a.index - b.index);
  
  return {
    text: selected.map(t => t.word).join(" "),
    wordIndices: selected.map(t => t.index),
    type: "emotional",
    score: selected.reduce((sum, t) => sum + t.importanceScore, 0) / Math.max(1, selected.length),
    rhythm: 0.85
  };
};

const buildPunchlineHook = (tokens: SemanticToken[]): HookCandidate => {
  // Take highest importance word + surrounding context (max 3)
  const sorted = [...tokens].sort((a, b) => b.importanceScore - a.importanceScore);
  const bestToken = sorted[0];
  if (!bestToken) return buildLiteralHook(tokens);

  const start = Math.max(0, bestToken.index - 1);
  const end = Math.min(tokens.length, bestToken.index + 2);
  const selected = tokens.slice(start, end);

  return {
    text: selected.map(t => t.word).join(" "),
    wordIndices: selected.map(t => t.index),
    type: "punchline",
    score: (bestToken.importanceScore * 1.5 + selected.reduce((sum, t) => sum + t.importanceScore, 0)) / (selected.length + 1),
    rhythm: 0.95
  };
};

export const pickBestHook = (words: TranscribedWord[]): HookCandidate => {
  const {tokens} = extractMeaning(words);
  if (tokens.length === 0) {
    return {text: "", wordIndices: [], type: "literal", score: 0, rhythm: 0};
  }

  const candidates = [
    buildLiteralHook(tokens),
    buildEmotionalHook(tokens),
    buildPunchlineHook(tokens)
  ];

  // Final scoring: balance score + rhythm + brevity
  candidates.forEach(c => {
    const brevityPenalty = Math.max(0, c.wordIndices.length - 4) * 0.05;
    c.score = (c.score * 0.6 + c.rhythm * 0.4) - brevityPenalty;
  });

  return candidates.sort((a, b) => b.score - a.score)[0];
};

export const generateSemanticDecision = (words: TranscribedWord[]) => {
  const {tokens, emotionalWeight} = extractMeaning(words);
  const bestHook = pickBestHook(words);
  
  const hookIndices = new Set(bestHook.wordIndices);
  const contextTokens = tokens.filter(t => !hookIndices.has(t.index));

  return {
    hook: bestHook.text,
    context: contextTokens.map(t => t.word).join(" "),
    tokens,
    emotionalWeight,
    hookType: bestHook.type,
    importanceMap: tokens.reduce((acc, t) => ({...acc, [t.index]: t.importanceScore}), {}),
    aggressionLevel: Math.min(1, 0.7 + emotionalWeight * 0.5)
  };
};
