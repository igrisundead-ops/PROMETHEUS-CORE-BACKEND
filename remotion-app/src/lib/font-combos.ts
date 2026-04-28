import videoMetadata from "../data/video.metadata.json" with {type: "json"};

export type FontCombo = {
  id: string;
  label: string;
  mainFont: string;
  italicFont: string;
  preferred: boolean;
};

const FONT_COMBOS: FontCombo[] = [
  {
    id: "cinzel-allura",
    label: "Cinzel + Allura",
    mainFont: "\"Cinzel\", \"Cormorant Garamond\", serif",
    italicFont: "\"Allura\", \"Cormorant Garamond\", serif",
    preferred: true
  },
  {
    id: "bodoni-garamond",
    label: "Bodoni Moda + Cormorant Garamond",
    mainFont: "\"Bodoni Moda\", \"Cormorant Garamond\", serif",
    italicFont: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    preferred: true
  },
  {
    id: "league-greatvibes",
    label: "League Gothic + Great Vibes",
    mainFont: "\"League Gothic\", \"Bebas Neue\", sans-serif",
    italicFont: "\"Great Vibes\", cursive",
    preferred: true
  },
  {
    id: "oswald-allura",
    label: "Oswald + Allura",
    mainFont: "\"Oswald\", \"League Gothic\", sans-serif",
    italicFont: "\"Allura\", \"Cormorant Garamond\", serif",
    preferred: false
  },
  {
    id: "bebas-greatvibes",
    label: "Bebas Neue + Great Vibes",
    mainFont: "\"Bebas Neue\", \"Arial Narrow\", sans-serif",
    italicFont: "\"Great Vibes\", cursive",
    preferred: false
  }
];

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const listFontCombos = (): FontCombo[] => FONT_COMBOS.slice();

export const pickFontCombo = (seed: string): FontCombo => {
  const preferred = FONT_COMBOS.filter((combo) => combo.preferred);
  const pool = preferred.length > 0 ? preferred : FONT_COMBOS;
  const index = pool.length > 0 ? hashString(seed) % pool.length : 0;
  return pool[index] ?? pool[0];
};

export const getFontComboById = (id: string | undefined | null): FontCombo | null => {
  if (!id) {
    return null;
  }
  const normalized = id.trim().toLowerCase();
  return FONT_COMBOS.find((combo) => combo.id.toLowerCase() === normalized) ?? null;
};

const comboSeed = `${videoMetadata.width}x${videoMetadata.height}-${videoMetadata.durationInFrames}`;
const overrideId = typeof process !== "undefined" ? process.env.FONT_COMBO_ID : undefined;
export const ACTIVE_FONT_COMBO: FontCombo =
  getFontComboById(overrideId) ?? pickFontCombo(comboSeed);

export const logActiveFontCombo = (): void => {
  const globalKey = "__fontComboLogged";
  const root = globalThis as unknown as Record<string, boolean>;
  if (root[globalKey]) {
    return;
  }
  root[globalKey] = true;
  console.info(
    `[FontCombo] Using "${ACTIVE_FONT_COMBO.label}" (id=${ACTIVE_FONT_COMBO.id}) ` +
      `main=${ACTIVE_FONT_COMBO.mainFont} italic=${ACTIVE_FONT_COMBO.italicFont}`
  );
};
