import type {CaptionChunk, ThreeWordLayoutVariant} from "./types";

type RoutedStyle = Pick<CaptionChunk, "styleKey" | "motionKey" | "layoutVariant">;

type SafeThreeWordCardVariant = Exclude<ThreeWordLayoutVariant, "inline">;

const SAFE_THREE_WORD_CARD_VARIANTS: SafeThreeWordCardVariant[] = [
  "dream-big-now",
  "your-master-mind",
  "take-action-now",
  "build-legacy-your"
];

const inlineThreeWordStyle: RoutedStyle = {
  styleKey: "trio_tall_punch_middle",
  motionKey: "three_word_tall_blade",
  layoutVariant: "inline"
};

const threeWordCardStyles: Record<SafeThreeWordCardVariant, RoutedStyle> = {
  "dream-big-now": {
    styleKey: "trio_ref_dream_big_now_v1",
    motionKey: "three_word_tall_blade",
    layoutVariant: "dream-big-now"
  },
  "your-master-mind": {
    styleKey: "trio_ref_your_master_mind_v1",
    motionKey: "three_word_serif_orbit",
    layoutVariant: "your-master-mind"
  },
  "take-action-now": {
    styleKey: "trio_ref_take_action_now_v1",
    motionKey: "three_word_tall_blade",
    layoutVariant: "take-action-now"
  },
  "build-legacy-your": {
    styleKey: "trio_ref_build_legacy_your_v1",
    motionKey: "three_word_script_glide",
    layoutVariant: "build-legacy-your"
  }
};

const normalizeWord = (word: string) => word.replace(/[\u2018\u2019]/g, "'").trim();

const normalizeWords = (words: string[]) => words.map(normalizeWord).filter(Boolean);

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const canUseThreeWordCard = (words: string[]): boolean => {
  const cleanWords = normalizeWords(words);
  if (cleanWords.length !== 3) {
    return false;
  }

  const compactWords = cleanWords.map((word) => word.replace(/[^a-z0-9']/gi, ""));
  if (compactWords.some((word) => word.length === 0 || word.length > 12)) {
    return false;
  }

  const totalCompactChars = compactWords.reduce((sum, word) => sum + word.length, 0);
  if (totalCompactChars > 21) {
    return false;
  }

  const punctuationChars = cleanWords.reduce(
    (sum, word) => sum + (word.match(/[.,!?;:()[\]{}\-"]/g)?.length ?? 0),
    0
  );
  if (punctuationChars > 2) {
    return false;
  }

  return true;
};

export const pickThreeWordCardVariant = (words: string[]): ThreeWordLayoutVariant => {
  if (!canUseThreeWordCard(words)) {
    return "inline";
  }

  const cleanWords = normalizeWords(words);
  const phraseKey = cleanWords
    .map((word) => word.toLowerCase().replace(/[^a-z0-9']/g, ""))
    .join(" ");

  if (!phraseKey) {
    return "inline";
  }

  const hash = hashString(phraseKey);
  return SAFE_THREE_WORD_CARD_VARIANTS[hash % SAFE_THREE_WORD_CARD_VARIANTS.length];
};

export const getThreeWordCardStyle = (variant: ThreeWordLayoutVariant): RoutedStyle => {
  if (variant === "inline") {
    return inlineThreeWordStyle;
  }
  return threeWordCardStyles[variant];
};

export const SAFE_THREE_WORD_CARD_STYLE_KEYS = SAFE_THREE_WORD_CARD_VARIANTS.map(
  (variant) => threeWordCardStyles[variant].styleKey
);

export const SAFE_THREE_WORD_CARD_LAYOUTS = SAFE_THREE_WORD_CARD_VARIANTS;
