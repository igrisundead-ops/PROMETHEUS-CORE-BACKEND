import type {TypographyRoleSlotId} from "./typography-doctrine";
import {
  getActiveHouseFontDefinitions,
  type HouseFontPaletteId
} from "./house-font-registry";

export type EditorialFontPaletteId =
  | HouseFontPaletteId
  | "fraunces-editorial"
  | "playfair-contrast"
  | "cormorant-salon"
  | "crimson-voice"
  | "lora-documentary"
  | "instrument-nocturne"
  | "noto-display"
  | "dm-sans-core";

export type EditorialFontPalette = {
  id: EditorialFontPaletteId;
  displayFamily: string;
  supportFamily: string;
  italicFamily: string;
  displayWeight: number;
  supportWeight: number;
  moodTags: string[];
  doctrineRoleIds: TypographyRoleSlotId[];
};

export const EDITORIAL_FONT_PALETTES: EditorialFontPalette[] = [
  {
    id: "jugendreisen-house",
    displayFamily: "\"Jugendreisen\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Jugendreisen\", \"Times New Roman\", serif",
    displayWeight: 400,
    supportWeight: 500,
    moodTags: ["luxury", "prestige", "cinematic"],
    doctrineRoleIds: ["hero_serif_primary"]
  },
  {
    id: "louize-house",
    displayFamily: "\"Louize\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Louize\", \"Times New Roman\", serif",
    displayWeight: 400,
    supportWeight: 500,
    moodTags: ["luxury", "editorial", "soft-focus"],
    doctrineRoleIds: ["hero_serif_alternate"]
  },
  {
    id: "ivar-script-house",
    displayFamily: "\"Ivar Script\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Ivar Script\", \"Times New Roman\", serif",
    displayWeight: 400,
    supportWeight: 500,
    moodTags: ["luxury", "editorial", "accent"],
    doctrineRoleIds: ["script_accent_rare"]
  },
  {
    id: "sokoli-house",
    displayFamily: "\"Sokoli\", \"Arial Narrow\", sans-serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Sokoli\", \"Arial Narrow\", sans-serif",
    displayWeight: 400,
    supportWeight: 500,
    moodTags: ["directive", "pressure", "display"],
    doctrineRoleIds: ["display_sans_pressure_release"]
  },
  {
    id: "fraunces-editorial",
    displayFamily: "\"Fraunces\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Fraunces\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["editorial", "luxury", "cinematic"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "playfair-contrast",
    displayFamily: "\"Playfair Display\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Playfair Display\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    moodTags: ["editorial", "dramatic", "headline"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "cormorant-salon",
    displayFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["luxury", "poetic", "emotional"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "crimson-voice",
    displayFamily: "\"Crimson Pro\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Crimson Pro\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["documentary", "editorial", "human"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "lora-documentary",
    displayFamily: "\"Lora\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Lora\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["documentary", "thoughtful", "clear"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "instrument-nocturne",
    displayFamily: "\"Instrument Serif\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Instrument Serif\", \"Times New Roman\", serif",
    displayWeight: 400,
    supportWeight: 500,
    moodTags: ["luxury", "premium", "soft-focus"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "noto-display",
    displayFamily: "\"Noto Serif Display\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Noto Serif Display\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    moodTags: ["monument", "prestige", "statement"],
    doctrineRoleIds: ["hero_serif_alternate"]
  },
  {
    id: "dm-sans-core",
    displayFamily: "\"DM Sans\", sans-serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Fraunces\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    moodTags: ["modern", "precision", "directive"],
    doctrineRoleIds: ["neutral_sans_core"]
  }
];

const fontPaletteMap = new Map(EDITORIAL_FONT_PALETTES.map((palette) => [palette.id, palette]));

export const TYPOGRAPHY_RUNTIME_CANDIDATE_TO_PALETTE: Partial<Record<string, EditorialFontPaletteId>> = {
  "dm-sans": "dm-sans-core",
  "fraunces": "fraunces-editorial",
  "crimson-pro": "crimson-voice",
  "instrument-serif": "instrument-nocturne",
  "noto-serif-display": "noto-display",
  "playfair-display": "playfair-contrast",
  "cormorant-garamond": "cormorant-salon"
};

export const getEditorialFontPalette = (
  paletteId: EditorialFontPaletteId | null | undefined
): EditorialFontPalette => {
  return fontPaletteMap.get(paletteId ?? "fraunces-editorial") ?? EDITORIAL_FONT_PALETTES[0];
};

export const getEditorialFontPalettesForRole = (
  roleId: TypographyRoleSlotId
): EditorialFontPalette[] => {
  return EDITORIAL_FONT_PALETTES.filter((palette) => palette.doctrineRoleIds.includes(roleId));
};

export const getRuntimePaletteIdForTypographyCandidate = (
  candidateId: string
): EditorialFontPaletteId | null => {
  const activeHouseFont = getActiveHouseFontDefinitions().find((definition) => definition.candidateId === candidateId);
  if (activeHouseFont) {
    return activeHouseFont.paletteId;
  }
  return TYPOGRAPHY_RUNTIME_CANDIDATE_TO_PALETTE[candidateId] ?? null;
};

export const isRuntimeSelectableTypographyCandidate = (candidateId: string): boolean => {
  return Boolean(getRuntimePaletteIdForTypographyCandidate(candidateId));
};

export const getRuntimeSelectableTypographyCandidateIds = (): string[] => {
  return Object.keys(TYPOGRAPHY_RUNTIME_CANDIDATE_TO_PALETTE);
};
