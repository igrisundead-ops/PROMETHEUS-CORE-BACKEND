import type {MotionShowcaseCue} from "../../types";

export type AzureGCounterTone = "year" | "currency" | "quantity" | "percentage";

export type AzureGCounterPresetId =
  | "year-chronicle-v1"
  | "currency-rise-v1"
  | "quantity-lift-v1"
  | "percentage-pulse-v1";

export type AzureGCounterPreset = {
  id: AzureGCounterPresetId;
  label: string;
  description: string;
  semanticTags: readonly string[];
  subjectTags: readonly string[];
  emotionalTags: readonly string[];
  runtimeParams: {
    enterFrames: number;
    settleFrames: number;
    lingerFrames: number;
    blurFromPx: number;
    scaleFrom: number;
    plateOpacity: number;
    sheenOpacity: number;
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    rail: string;
    text: string;
  };
};

export type AzureGCounterPresetCatalog = {
  yearChronicle: AzureGCounterPreset;
  currencyRise: AzureGCounterPreset;
  quantityLift: AzureGCounterPreset;
  percentagePulse: AzureGCounterPreset;
};

export type AzureGCounterSource = Pick<MotionShowcaseCue, "canonicalLabel" | "matchedText" | "templateGraphicCategory">;

export type AzureGCounterSpec = {
  preset: AzureGCounterPreset;
  tone: AzureGCounterTone;
  rawText: string;
  normalizedText: string;
  prefix: string;
  suffix: string;
  startValue: number;
  targetValue: number;
  displayValue: string;
};

const NUMBER_WORD_VALUES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000
};

const MAGNITUDE_WORDS = new Set(["thousand", "million", "billion", "k", "m", "b"]);
const CURRENCY_WORDS = new Set(["dollar", "dollars", "usd", "revenue", "profit", "money", "cash", "income", "sales", "budget", "price", "value"]);

export const AZUREG_COUNTER_PRESETS = {
  yearChronicle: {
    id: "year-chronicle-v1",
    label: "Year Chronicle",
    description: "A restrained year marker with editorial lift.",
    semanticTags: ["year", "timeline", "milestone", "counter", "chronicle"],
    subjectTags: ["year", "date", "time"],
    emotionalTags: ["calm", "authority", "anticipation"],
    runtimeParams: {
      enterFrames: 14,
      settleFrames: 18,
      lingerFrames: 8,
      blurFromPx: 12,
      scaleFrom: 0.965,
      plateOpacity: 0.88,
      sheenOpacity: 0.2
    },
    palette: {
      primary: "#f8f2e3",
      secondary: "#9fb8ff",
      accent: "#f0c67a",
      rail: "#7b72ff",
      text: "#fff9ef"
    }
  },
  currencyRise: {
    id: "currency-rise-v1",
    label: "Currency Rise",
    description: "Cinematic growth readout for money, scale, and lift.",
    semanticTags: ["currency", "money", "revenue", "growth", "counter"],
    subjectTags: ["money", "budget", "profit", "value"],
    emotionalTags: ["confidence", "authority", "energy"],
    runtimeParams: {
      enterFrames: 16,
      settleFrames: 20,
      lingerFrames: 10,
      blurFromPx: 14,
      scaleFrom: 0.96,
      plateOpacity: 0.9,
      sheenOpacity: 0.24
    },
    palette: {
      primary: "#fff7eb",
      secondary: "#f08c4f",
      accent: "#f2c67a",
      rail: "#8bb6ff",
      text: "#fff9f0"
    }
  },
  quantityLift: {
    id: "quantity-lift-v1",
    label: "Quantity Lift",
    description: "Premium numeric motion for counts, scale, and totals.",
    semanticTags: ["count", "quantity", "kpi", "metric", "counter"],
    subjectTags: ["count", "metric", "total"],
    emotionalTags: ["focus", "energy", "clarity"],
    runtimeParams: {
      enterFrames: 15,
      settleFrames: 18,
      lingerFrames: 8,
      blurFromPx: 13,
      scaleFrom: 0.97,
      plateOpacity: 0.88,
      sheenOpacity: 0.2
    },
    palette: {
      primary: "#f6fbff",
      secondary: "#8bb6ff",
      accent: "#9fb8ff",
      rail: "#d2c2ff",
      text: "#f8fbff"
    }
  },
  percentagePulse: {
    id: "percentage-pulse-v1",
    label: "Percentage Pulse",
    description: "A light, responsive readout for ratios and progress.",
    semanticTags: ["percent", "ratio", "progress", "counter"],
    subjectTags: ["percentage", "progress", "ratio"],
    emotionalTags: ["focus", "calm", "clarity"],
    runtimeParams: {
      enterFrames: 12,
      settleFrames: 16,
      lingerFrames: 8,
      blurFromPx: 10,
      scaleFrom: 0.975,
      plateOpacity: 0.86,
      sheenOpacity: 0.18
    },
    palette: {
      primary: "#effffb",
      secondary: "#48b39d",
      accent: "#8ae2d0",
      rail: "#8bb6ff",
      text: "#f0fffb"
    }
  }
} as const satisfies AzureGCounterPresetCatalog;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeCounterText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9$\u20ac\u00a3%.,+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const parseLeadingNumber = (value: string): number | null => {
  const digitsMatch = value.match(/\b(\d[\d,]*(?:\.\d+)?)\b/);
  if (digitsMatch) {
    const parsed = Number.parseFloat(digitsMatch[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const tokens = normalizeCounterText(value).split(" ").filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    const numericValue = NUMBER_WORD_VALUES[token];
    if (numericValue === undefined) {
      continue;
    }
    found = true;
    if (numericValue === 100) {
      current = Math.max(1, current) * numericValue;
      continue;
    }
    if (numericValue >= 1000) {
      total += Math.max(1, current) * numericValue;
      current = 0;
      continue;
    }
    current += numericValue;
  }

  if (!found) {
    return null;
  }

  return total + current;
};

const detectTone = (value: string): AzureGCounterTone => {
  const normalized = normalizeCounterText(value);
  const yearMatch = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  const hasPercent = /%|\bpercent(?:age|ages)?\b/.test(normalized);
  const hasCurrencyWord = [...CURRENCY_WORDS].some((word) => normalized.includes(word));
  const hasCurrency = /[$\u20ac\u00a3]/.test(normalized) || /\b(?:usd|dollar(?:s)?|euro(?:s)?|pound(?:s)?)\b/.test(normalized) || hasCurrencyWord;
  const hasMagnitude = /\b(?:thousand|million|billion|k|m|b)\b/.test(normalized);

  if (hasPercent) {
    return "percentage";
  }
  if (yearMatch && !hasMagnitude) {
    return "year";
  }
  if (hasCurrency) {
    return "currency";
  }
  return "quantity";
};

const deriveStartValue = ({
  tone,
  targetValue
}: {
  tone: AzureGCounterTone;
  targetValue: number;
}): number => {
  if (tone === "year") {
    return Math.max(0, Math.floor(targetValue / 100) * 100);
  }

  if (tone === "percentage") {
    return 0;
  }

  if (tone === "currency") {
    if (targetValue >= 1_000_000_000) {
      return Math.max(0, Math.floor((targetValue * 0.8) / 10_000_000) * 10_000_000);
    }
    if (targetValue >= 1_000_000) {
      return Math.max(0, Math.floor((targetValue * 0.8) / 100_000) * 100_000);
    }
    if (targetValue >= 10_000) {
      return Math.max(0, Math.floor((targetValue * 0.72) / 1_000) * 1_000);
    }
    return Math.max(0, Math.floor(targetValue * 0.5));
  }

  if (targetValue >= 1_000_000) {
    return Math.max(0, Math.floor((targetValue * 0.78) / 100_000) * 100_000);
  }
  if (targetValue >= 10_000) {
    return Math.max(0, Math.floor((targetValue * 0.72) / 1_000) * 1_000);
  }
  if (targetValue >= 1_000) {
    return Math.max(0, Math.floor((targetValue * 0.64) / 100) * 100);
  }
  if (targetValue >= 100) {
    return Math.max(0, Math.floor((targetValue * 0.4) / 10) * 10);
  }

  return 0;
};

const resolveMagnitudeMultiplier = (value: string): number => {
  const normalized = normalizeCounterText(value);
  if (/\b(k)\b/.test(normalized)) {
    return 1_000;
  }
  if (/\b(m)\b/.test(normalized)) {
    return 1_000_000;
  }
  if (/\b(b)\b/.test(normalized)) {
    return 1_000_000_000;
  }
  if (/\bthousand\b/.test(normalized)) {
    return 1_000;
  }
  if (/\bmillion\b/.test(normalized)) {
    return 1_000_000;
  }
  if (/\bbillion\b/.test(normalized)) {
    return 1_000_000_000;
  }
  return 1;
};

const resolvePrefix = (value: string): string => {
  const normalized = normalizeCounterText(value);
  if (/[$]/.test(normalized) || /\b(?:usd|dollar(?:s)?)\b/.test(normalized)) {
    return "$";
  }
  if (/\u20ac/.test(normalized) || /\beuro(?:s)?\b/.test(normalized)) {
    return "\u20ac";
  }
  if (/\u00a3/.test(normalized) || /\bpound(?:s)?\b/.test(normalized)) {
    return "\u00a3";
  }
  return "";
};

const resolveSuffix = (value: string): string => {
  const normalized = normalizeCounterText(value);
  if (/%|\bpercent(?:age|ages)?\b/.test(normalized)) {
    return "%";
  }
  return "";
};

const resolveTargetValue = ({
  tone,
  rawText
}: {
  tone: AzureGCounterTone;
  rawText: string;
}): number => {
  const magnitude = resolveMagnitudeMultiplier(rawText);
  const numericValue = parseLeadingNumber(rawText);

  if (tone === "year" || tone === "percentage") {
    return numericValue !== null ? Math.round(numericValue) : 0;
  }

  if (numericValue !== null) {
    if (magnitude > 1 && numericValue < 1000) {
      return Math.round(numericValue * magnitude);
    }
    return Math.round(numericValue);
  }

  return 0;
};

const getPresetForTone = (tone: AzureGCounterTone): AzureGCounterPreset => {
  if (tone === "year") {
    return AZUREG_COUNTER_PRESETS.yearChronicle;
  }
  if (tone === "currency") {
    return AZUREG_COUNTER_PRESETS.currencyRise;
  }
  if (tone === "percentage") {
    return AZUREG_COUNTER_PRESETS.percentagePulse;
  }
  return AZUREG_COUNTER_PRESETS.quantityLift;
};

export const formatAzureGCounterValue = ({
  tone,
  prefix,
  suffix,
  value
}: {
  tone: AzureGCounterTone;
  prefix: string;
  suffix: string;
  value: number;
}): string => {
  const rounded = Math.max(0, Math.round(value));
  if (tone === "year") {
    return `${rounded}`;
  }
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(rounded);
  return `${prefix}${formatted}${suffix}`;
};

export const resolveAzureGCounterSpec = (source: AzureGCounterSource): AzureGCounterSpec => {
  const rawText = source.matchedText.trim() || source.canonicalLabel.trim();
  const normalizedText = normalizeCounterText(rawText);
  const tone = detectTone(rawText);
  const preset = getPresetForTone(tone);
  const prefix = resolvePrefix(rawText);
  const suffix = resolveSuffix(rawText);
  const targetValue = resolveTargetValue({
    tone,
    rawText
  });
  const startValue = deriveStartValue({
    tone,
    targetValue
  });

  return {
    preset,
    tone,
    rawText,
    normalizedText,
    prefix,
    suffix,
    startValue,
    targetValue,
    displayValue: formatAzureGCounterValue({
      tone,
      prefix,
      suffix,
      value: targetValue
    })
  };
};
