import type {RenderConfig} from "../config/render-flags";

export type TypographyDecisionInput = {
  text: string;
  rhetoricalIntent: "authority" | "emphasis" | "premium_explain" | "neutral";
  availableFonts: Array<{family: string; source: "custom_ingested" | "system" | "fallback"}>;
  renderConfig: RenderConfig;
  maxLines?: number;
  maxCharsPerLine?: number;
  pairingThreshold?: number;
};

export type TypographyDecision = {
  primaryFont: {family: string; source: "custom_ingested" | "system" | "fallback"; role: string};
  secondaryFont?: {family: string; source: "custom_ingested" | "system" | "fallback"; role: string};
  graphUsed: boolean;
  pairingScore?: number;
  fallbackUsed: boolean;
  fallbackReasons: string[];
  coreWords: string[];
  linePlan: {
    lines: string[];
    maxLines: number;
    maxCharsPerLine: number;
  };
};

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const splitLines = (text: string, maxLines: number, maxCharsPerLine: number): string[] => {
  const words = normalizeText(text).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || current.length === 0) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines) {
      break;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
};

const selectCoreWords = (text: string, intent: TypographyDecisionInput["rhetoricalIntent"]): string[] => {
  const tokens = normalizeText(text)
    .split(" ")
    .map((word) => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""))
    .filter((word) => word.length >= 5);
  if (tokens.length === 0) {
    return [];
  }
  if (intent === "emphasis" || intent === "authority") {
    return tokens.slice(0, Math.min(3, tokens.length));
  }
  return tokens.slice(0, 2);
};

const scorePairing = (primary: string, secondary: string): number => {
  const sameStart = primary[0]?.toLowerCase() === secondary[0]?.toLowerCase();
  return sameStart ? 0.68 : 0.9;
};

export const generateTypographyDecision = (input: TypographyDecisionInput): TypographyDecision => {
  const maxLines = input.maxLines ?? 3;
  const maxCharsPerLine = input.maxCharsPerLine ?? 28;
  const pairingThreshold = input.pairingThreshold ?? 0.8;
  const fallbackReasons: string[] = [];

  const customFonts = input.availableFonts.filter((font) => font.source === "custom_ingested");
  const systemFonts = input.availableFonts.filter((font) => font.source === "system");
  const fontPool = customFonts.length > 0 ? customFonts : systemFonts;

  let primary = fontPool[0];
  let fallbackUsed = false;
  if (!primary) {
    fallbackUsed = true;
    fallbackReasons.push("No custom or system fonts available.");
    primary = {family: "sans-serif", source: "fallback"};
  } else if (primary.source !== "custom_ingested") {
    fallbackUsed = true;
    fallbackReasons.push("No custom ingested font available.");
  }

  let secondary: TypographyDecision["secondaryFont"] | undefined;
  let pairingScore: number | undefined;
  if (fontPool.length > 1) {
    const candidate = fontPool[1]!;
    pairingScore = scorePairing(primary.family, candidate.family);
    if (pairingScore >= pairingThreshold) {
      secondary = {
        family: candidate.family,
        source: candidate.source,
        role: "support"
      };
    }
  }

  const lines = splitLines(input.text, maxLines, maxCharsPerLine);
  const coreWords = selectCoreWords(input.text, input.rhetoricalIntent);

  return {
    primaryFont: {
      family: primary.family,
      source: primary.source,
      role: "headline"
    },
    secondaryFont: secondary,
    graphUsed: input.renderConfig.ENABLE_FONT_GRAPH,
    pairingScore,
    fallbackUsed,
    fallbackReasons,
    coreWords,
    linePlan: {
      lines,
      maxLines,
      maxCharsPerLine
    }
  };
};
