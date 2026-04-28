import type {EmphasisEffect, EmphasisTargets, JudgmentEngineInput, MinimalismLevel} from "../types";
import {DEFAULT_ALLOWED_EFFECTS} from "../constants";
import {normalizeText, normalizeKeyword} from "../../utils";

const tokenize = (text: string): string[] => {
  return normalizeText(text).split(" ").map((token) => normalizeKeyword(token)).filter(Boolean);
};

const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "to", "of", "for", "is", "it", "this", "that", "you", "your"]);

export const detectPunchWord = (input: JudgmentEngineInput): string | null => {
  const tokens = tokenize(input.transcriptSegment || input.moment.transcriptText);
  const interesting = tokens.filter((token) => !STOP_WORDS.has(token));
  if (interesting.length === 0) {
    return null;
  }
  const emotionalToken = interesting.find((token) => /(proof|trust|mistake|risk|scale|growth|premium|authority|freedom|confidence|everything|change)/.test(token));
  return emotionalToken ?? interesting.sort((left, right) => right.length - left.length)[0] ?? null;
};

export const resolveMinimalismLevel = (input: JudgmentEngineInput): MinimalismLevel => {
  const restraintSignals = [
    input.sceneAnalysis?.backgroundComplexity ?? 0.35,
    input.sceneAnalysis?.motionDensity ?? 0.35,
    input.sceneAnalysis?.mobileReadabilityRisk ?? 0.2,
    input.creatorStyleProfile?.reducedMotionPreference ?? 0.3,
    input.recentSequenceMetrics?.preferRestraintNext ? 0.82 : 0.18,
    (input.recentSequenceMetrics?.surpriseBudgetRemaining ?? 1) < 0.45 ? 0.78 : 0.2
  ];
  const restraintAverage = restraintSignals.reduce((sum, value) => sum + value, 0) / restraintSignals.length;
  const majorPayoff = input.moment.momentType === "payoff" || input.moment.importance >= 0.95;
  if (restraintAverage >= 0.7) {
    return majorPayoff ? "restrained" : "minimal";
  }
  if (restraintAverage >= 0.54) {
    return "restrained";
  }
  if ((input.moment.energy >= 0.8 || input.creatorStyleProfile?.noveltyPreference && input.creatorStyleProfile.noveltyPreference >= 0.75) && !input.recentSequenceMetrics?.preferRestraintNext) {
    return "expressive";
  }
  return "balanced";
};

export const determineEmphasisTargets = (input: JudgmentEngineInput, minimalismLevel: MinimalismLevel): EmphasisTargets => {
  const transcript = input.transcriptSegment || input.moment.transcriptText;
  const punchWord = detectPunchWord(input);
  const emotionalPunch = input.moment.momentType === "hook" || input.moment.importance >= 0.9 || /!|changes everything|never/i.test(transcript);
  const supportNeeded = input.moment.words.length >= 7;
  const busyFrame = (input.sceneAnalysis?.backgroundComplexity ?? 0.35) >= 0.72 || (input.sceneAnalysis?.sceneDensity ?? 0.35) >= 0.72;
  const allowedEffects: EmphasisEffect[] = [...DEFAULT_ALLOWED_EFFECTS];
  const blockedEffects: EmphasisTargets["blockedEffects"] = [];
  const repeatedHeroBackgroundText = (input.recentSequenceMetrics?.recentHeroBackgroundTextCount ?? 0) >= 1;

  if (!busyFrame && minimalismLevel !== "minimal") {
    allowedEffects.push("masking");
  } else {
    blockedEffects.push("background-text");
  }

  if ((input.sceneAnalysis?.brightness ?? 0.5) > 0.7) {
    blockedEffects.push("glow");
  } else if (minimalismLevel === "expressive") {
    allowedEffects.push("glow");
  }

  if ((input.subjectSegmentation?.matteConfidence ?? 0.5) >= 0.7 && !busyFrame) {
    allowedEffects.push("background-text");
  }
  if (repeatedHeroBackgroundText || input.recentSequenceMetrics?.preferRestraintNext) {
    blockedEffects.push("background-text");
  }

  return {
    punchWord,
    supportingTextNeeded: supportNeeded,
    isolatePunchWord: Boolean(punchWord) && emotionalPunch,
    useBackgroundText: allowedEffects.includes("background-text") && emotionalPunch && !blockedEffects.includes("background-text"),
    preferMinimalism: minimalismLevel === "minimal" || minimalismLevel === "restrained",
    allowedEffects: [...new Set(allowedEffects)],
    blockedEffects: [...new Set(blockedEffects)],
    reason: emotionalPunch
      ? "The moment has a strong emotional center, so the punch word should carry the visual spike."
      : "Emphasis stays restrained and subservient to readability."
  };
};
