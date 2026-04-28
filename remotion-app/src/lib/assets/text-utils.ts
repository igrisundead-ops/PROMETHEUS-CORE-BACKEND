import type {MotionMoodTag, MotionTier} from "../types";

export const uniqueStrings = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

export const normalizeAssetText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const singularizeToken = (value: string): string => {
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

export const tokenizeAssetText = (value: string): string[] => {
  const normalized = normalizeAssetText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map(singularizeToken)
    .filter((token) => token.length > 1);
};

export const splitDelimitedText = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/[|,;/\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const buildSearchTerms = (...values: Array<string | undefined | null>): string[] => {
  const terms = new Set<string>();

  values.forEach((value) => {
    const tokens = tokenizeAssetText(String(value ?? ""));
    if (tokens.length === 0) {
      return;
    }

    terms.add(tokens.join(" "));
    tokens.forEach((token, index) => {
      terms.add(token);
      if (index < tokens.length - 1) {
        terms.add(`${token} ${tokens[index + 1]}`);
      }
    });
  });

  return [...terms];
};

export const slugifyAssetValue = (value: string): string => {
  return normalizeAssetText(value).replace(/\s+/g, "-");
};

export const motionLevelToTier = (value?: string): MotionTier => {
  const normalized = normalizeAssetText(value ?? "");
  if (/(hero|cinematic|impact|bold|aggressive|high)/.test(normalized)) {
    return "hero";
  }
  if (/(premium|editorial|polished|elevated|medium)/.test(normalized)) {
    return "premium";
  }
  if (/(calm|subtle|soft|minimal|low)/.test(normalized)) {
    return "minimal";
  }
  return "editorial";
};

export const inferMoodTags = (values: string[]): MotionMoodTag[] => {
  const pool = normalizeAssetText(values.join(" "));
  const tags = new Set<MotionMoodTag>(["neutral"]);

  if (/(warm|gold|amber|glow|luxury|premium|sun)/.test(pool)) {
    tags.add("warm");
  }
  if (/(cool|glass|blue|frosted|hud|tech|editorial)/.test(pool)) {
    tags.add("cool");
  }
  if (/(calm|subtle|soft|minimal|reflective|thoughtful|quiet)/.test(pool)) {
    tags.add("calm");
  }
  if (/(motion|animated|kinetic|sweep|pulse|speed|dynamic|burst)/.test(pool)) {
    tags.add("kinetic");
  }
  if (/(authority|executive|business|premium|command|statement)/.test(pool)) {
    tags.add("authority");
  }
  if (/(hero|cinematic|monumental|spotlight|dramatic)/.test(pool)) {
    tags.add("heroic");
  }

  return [...tags];
};
