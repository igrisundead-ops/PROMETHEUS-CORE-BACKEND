import type {CreativeAsset, CreativeMoment} from "../types";
import {normalizeKeyword, normalizeText} from "../utils";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "you"
]);

const singularize = (value: string): string => {
  if (value.length > 4 && /(ches|shes|xes|zes|ses)$/i.test(value)) {
    return value.slice(0, -2);
  }
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
};

export const extractCreativeKeywords = (moment: CreativeMoment): string[] => {
  const tokens = normalizeText(moment.transcriptText)
    .split(" ")
    .map(singularize)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const emphasisWords = moment.words.map((word) => normalizeKeyword(word.text)).filter(Boolean);
  const merged = [...emphasisWords, ...tokens];
  return [...new Set(merged)].slice(0, 12);
};

export const scoreAssetForMoment = (asset: CreativeAsset, moment: CreativeMoment): number => {
  const keywords = extractCreativeKeywords(moment);
  const keywordsSet = new Set(keywords);
  let score = 0;

  asset.tags.forEach((tag) => {
    if (keywordsSet.has(normalizeKeyword(tag))) {
      score += 18;
    }
  });
  asset.keywords.forEach((keyword) => {
    if (keywordsSet.has(normalizeKeyword(keyword))) {
      score += 20;
    }
  });

  if (moment.momentType === "keyword" && asset.hasTextSlot) {
    score += 10;
  }
  if (moment.momentType === "title" && asset.name.toLowerCase().includes("title")) {
    score += 14;
  }
  if (moment.momentType === "payoff" && /graph|pipeline|card|plate|metric/i.test(asset.name)) {
    score += 12;
  }
  if (moment.momentType === "transition" && /transition|sweep|bridge/i.test(asset.name)) {
    score += 20;
  }
  if (moment.suggestedIntensity === "hero" && asset.renderCost === "high") {
    score += 10;
  }
  if (moment.suggestedIntensity === "minimal" && asset.renderCost === "high") {
    score -= 16;
  }
  if (moment.density > 4 && asset.type === "shape") {
    score += 6;
  }

  return score;
};

export const searchCreativeAssets = (
  assets: CreativeAsset[],
  moment: CreativeMoment,
  maxResults: number = 3
): CreativeAsset[] => {
  return [...assets]
    .map((asset) => ({
      asset,
      score: scoreAssetForMoment(asset, moment)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id))
    .slice(0, maxResults)
    .map((entry) => entry.asset);
};

