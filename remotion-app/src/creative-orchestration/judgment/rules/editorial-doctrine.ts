import type {
  EditorialCaptain,
  EditorialDoctrine,
  EmphasisTargets,
  JudgmentEngineInput,
  MinimalismLevel,
  RhetoricalPurpose,
  VisualPriorityEntry
} from "../types";
import {normalizeText} from "../../utils";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "is",
  "it",
  "this",
  "that",
  "with",
  "in",
  "on",
  "at",
  "by",
  "from",
  "we",
  "you",
  "i"
]);

const ABSTRACT_WORDS = new Set([
  "pressure",
  "trust",
  "freedom",
  "clarity",
  "identity",
  "confidence",
  "success",
  "failure",
  "change",
  "growth",
  "scale",
  "risk",
  "problem",
  "solution",
  "authority",
  "strategy"
]);

const EMPHASIS_MODIFIERS = new Set([
  "real",
  "core",
  "main",
  "key",
  "important",
  "true",
  "million",
  "billion",
  "dollar",
  "dollars"
]);

const tokenizeOriginal = (text: string): string[] => {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-zA-Z0-9$]+|[^a-zA-Z0-9%]+$/g, ""))
    .filter(Boolean);
};

const tokenizeNormalized = (text: string): string[] => {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
};

const interestingTokens = (text: string): string[] => {
  return tokenizeNormalized(text).filter((token) => !STOP_WORDS.has(token));
};

const isNumericMoment = (text: string): boolean => {
  return /(?:\$|£|€)?\d[\d,.]*\s*(?:%|percent|k|m|million|billion|thousand|dollars?)?\b|(?:a|one)\s+million\s+dollars?/i.test(text);
};

const extractConcreteCandidate = (text: string, punchWord: string | null): string | null => {
  const originalTokens = tokenizeOriginal(text);
  const normalizedTokens = tokenizeNormalized(text);
  const trailingConcrete = normalizedTokens[normalizedTokens.length - 1] ?? null;
  const containsOfPattern = /\bof\s+the\s+[a-z0-9]+\b/i.test(text) || /\bof\s+[a-z0-9]+\b/i.test(text);

  if (containsOfPattern && trailingConcrete && !STOP_WORDS.has(trailingConcrete) && !ABSTRACT_WORDS.has(trailingConcrete)) {
    return (originalTokens[originalTokens.length - 1] ?? trailingConcrete).toUpperCase();
  }

  if (punchWord && !ABSTRACT_WORDS.has(punchWord)) {
    return punchWord.toUpperCase();
  }

  const interesting = interestingTokens(text).filter((token) => !ABSTRACT_WORDS.has(token));
  const chosen = interesting.find((token) => token.length >= 4) ?? interesting[0] ?? null;
  return chosen ? chosen.toUpperCase() : null;
};

const extractHeroPhrase = (text: string, punchWord: string | null): string | null => {
  const originalTokens = tokenizeOriginal(text);
  const normalizedTokens = tokenizeNormalized(text);

  if (isNumericMoment(text)) {
    const numericMatch = text.match(/((?:\$|£|€)?\d[\d,.]*\s*(?:%|percent|k|m|million|billion|thousand|dollars?)|(?:a|one)\s+million\s+dollars?)/i);
    return numericMatch?.[1]?.trim().toUpperCase() ?? null;
  }

  if (!punchWord) {
    return null;
  }

  const punchIndex = normalizedTokens.findIndex((token) => token === punchWord);
  if (punchIndex < 0) {
    return null;
  }

  const previous = normalizedTokens[punchIndex - 1] ?? null;
  const next = normalizedTokens[punchIndex + 1] ?? null;

  if (previous && EMPHASIS_MODIFIERS.has(previous)) {
    return `${originalTokens[punchIndex - 1] ?? previous} ${originalTokens[punchIndex] ?? punchWord}`.trim().toUpperCase();
  }

  if (next && !STOP_WORDS.has(next) && next.length >= 4 && !ABSTRACT_WORDS.has(next)) {
    return `${originalTokens[punchIndex] ?? punchWord} ${originalTokens[punchIndex + 1] ?? next}`.trim().toUpperCase();
  }

  return null;
};

const hasSequentialKeywordOpportunity = (input: JudgmentEngineInput): boolean => {
  const interesting = interestingTokens(input.transcriptSegment || input.moment.transcriptText);
  const transcript = input.transcriptSegment || input.moment.transcriptText;
  return input.moment.momentType === "list" || (interesting.length >= 3 && /,|\band\b|\bor\b/i.test(transcript));
};

const resolveCaptain = (input: JudgmentEngineInput, args: {
  minimalismLevel: MinimalismLevel;
  emphasisTargets: EmphasisTargets;
  concreteCandidate: string | null;
  numericMoment: boolean;
  topVisualPriority: VisualPriorityEntry["subject"];
}): EditorialCaptain => {
  const busyFrame = (input.sceneAnalysis?.backgroundComplexity ?? 0.35) >= 0.72 || (input.sceneAnalysis?.sceneDensity ?? 0.35) >= 0.72;
  const preferRestraint = input.recentSequenceMetrics?.preferRestraintNext ?? false;
  const behindSubjectReady =
    (input.subjectSegmentation?.matteConfidence ?? 0.5) >= 0.76 &&
    input.subjectSegmentation?.behindSubjectTextSupported !== false &&
    !busyFrame;

  if (args.minimalismLevel === "minimal" || (preferRestraint && input.moment.importance < 0.95)) {
    return "restraint";
  }

  if (args.numericMoment) {
    return "text";
  }

  if (args.emphasisTargets.useBackgroundText && behindSubjectReady && args.emphasisTargets.isolatePunchWord) {
    return "text";
  }

  if (args.concreteCandidate && !busyFrame && input.moment.importance >= 0.82) {
    if (args.topVisualPriority === "product-object" || args.topVisualPriority === "proof-element") {
      return "asset";
    }
    return behindSubjectReady ? "text" : "asset";
  }

  if (input.moment.momentType === "transition" || args.topVisualPriority === "negative-space") {
    return "background";
  }

  return "text";
};

const supportToolBudget = (input: JudgmentEngineInput, captain: EditorialCaptain, minimalismLevel: MinimalismLevel): EditorialDoctrine["supportToolBudget"] => {
  if (captain === "restraint" || minimalismLevel === "minimal") {
    return "none";
  }

  if (isNumericMoment(input.transcriptSegment || input.moment.transcriptText) || input.moment.importance >= 0.94) {
    return "paired";
  }

  return "single";
};

export const resolveEditorialDoctrine = (input: JudgmentEngineInput, args: {
  rhetoricalPurpose: RhetoricalPurpose;
  minimalismLevel: MinimalismLevel;
  emphasisTargets: EmphasisTargets;
  visualPriorityRanking: VisualPriorityEntry[];
}): EditorialDoctrine => {
  const transcript = input.transcriptSegment || input.moment.transcriptText;
  const numericMoment = isNumericMoment(transcript);
  const concreteCandidate = extractConcreteCandidate(transcript, args.emphasisTargets.punchWord);
  const heroPhrase = extractHeroPhrase(transcript, args.emphasisTargets.punchWord);
  const topVisualPriority = args.visualPriorityRanking[0]?.subject ?? "punch-word";
  const captain = resolveCaptain(input, {
    minimalismLevel: args.minimalismLevel,
    emphasisTargets: args.emphasisTargets,
    concreteCandidate,
    numericMoment,
    topVisualPriority
  });
  const sequentialKeywords = hasSequentialKeywordOpportunity(input);

  let conceptReductionMode: EditorialDoctrine["conceptReductionMode"] = "literal-caption";
  if (captain === "restraint") {
    conceptReductionMode = "literal-caption";
  } else if (sequentialKeywords && !args.emphasisTargets.preferMinimalism) {
    conceptReductionMode = "sequential-keywords";
  } else if (numericMoment || heroPhrase) {
    conceptReductionMode = "hero-phrase";
  } else if (args.emphasisTargets.isolatePunchWord && args.emphasisTargets.punchWord) {
    conceptReductionMode = "hero-word";
  }

  const heroText =
    conceptReductionMode === "hero-phrase"
      ? heroPhrase ?? concreteCandidate ?? args.emphasisTargets.punchWord?.toUpperCase() ?? null
      : conceptReductionMode === "hero-word"
        ? concreteCandidate ?? args.emphasisTargets.punchWord?.toUpperCase() ?? null
        : conceptReductionMode === "sequential-keywords"
          ? interestingTokens(transcript).slice(0, 3).map((token) => token.toUpperCase()).join(" -> ")
          : null;

  const supportText =
    conceptReductionMode === "hero-phrase"
      ? args.emphasisTargets.supportingTextNeeded
        ? transcript.trim()
        : null
      : args.emphasisTargets.supportingTextNeeded && captain !== "restraint"
        ? transcript.trim()
        : null;

  const preferTextOnlyForAbstractMoments = !concreteCandidate || ABSTRACT_WORDS.has((args.emphasisTargets.punchWord ?? "").toLowerCase());
  const pairingAllowed = captain !== "restraint" && !preferTextOnlyForAbstractMoments;
  const allowIndependentTypography = captain === "text" || captain === "background";

  const rationale = [
    captain === "asset"
      ? "A concrete concept creates a stronger visual treatment when the asset leads the beat."
      : captain === "background"
        ? "The beat reads better as a staged visual field than as a foreground text shout."
        : captain === "restraint"
          ? "The sequence needs restraint, so support cues should stay quiet."
          : "Typography should captain the beat because the punch concept carries the meaning fastest.",
    conceptReductionMode === "hero-word"
      ? "Reduce the line to one hero concept so the treatment can land cleanly."
      : conceptReductionMode === "hero-phrase"
        ? "A short phrase unlocks stronger hierarchy than a literal transcript."
        : conceptReductionMode === "sequential-keywords"
          ? "Multiple concrete nouns justify a sequential-keyword treatment instead of one flat caption."
          : "Keep the text closer to the spoken line because compression would cost clarity.",
    allowIndependentTypography
      ? "Typography can lead, but support elements still need to stay subordinate."
      : "Typography must support the captain instead of running an independent animation lane."
  ];

  return {
    captain,
    conceptReductionMode,
    heroText,
    supportText,
    concreteNounCandidate: concreteCandidate,
    primaryVisualSubject: topVisualPriority,
    allowTextAssetPairing: pairingAllowed,
    allowIndependentTypography,
    supportToolBudget: supportToolBudget(input, captain, args.minimalismLevel),
    preferTextOnlyForAbstractMoments,
    rationale
  };
};
