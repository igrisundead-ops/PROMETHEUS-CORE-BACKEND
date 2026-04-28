import {loadFont as loadCormorantGaramond} from "@remotion/google-fonts/CormorantGaramond";
import {loadFont as loadCrimsonPro} from "@remotion/google-fonts/CrimsonPro";
import {loadFont as loadDMSans} from "@remotion/google-fonts/DMSans";
import {loadFont as loadFraunces} from "@remotion/google-fonts/Fraunces";
import {loadFont as loadInstrumentSerif} from "@remotion/google-fonts/InstrumentSerif";
import {loadFont as loadLora} from "@remotion/google-fonts/Lora";
import {loadFont as loadNotoSerifDisplay} from "@remotion/google-fonts/NotoSerifDisplay";
import {loadFont as loadPlayfairDisplay} from "@remotion/google-fonts/PlayfairDisplay";

export type EditorialFontPaletteId =
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
};

const FONT_LOAD_OPTIONS = {
  subsets: ["latin"] as ("latin")[],
  ignoreTooManyRequestsWarning: true
};

export const EDITORIAL_FONT_PALETTES: EditorialFontPalette[] = [
  {
    id: "fraunces-editorial",
    displayFamily: "\"Fraunces\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Fraunces\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["editorial", "luxury", "cinematic"]
  },
  {
    id: "playfair-contrast",
    displayFamily: "\"Playfair Display\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Playfair Display\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    moodTags: ["editorial", "dramatic", "headline"]
  },
  {
    id: "cormorant-salon",
    displayFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["luxury", "poetic", "emotional"]
  },
  {
    id: "crimson-voice",
    displayFamily: "\"Crimson Pro\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Crimson Pro\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["documentary", "editorial", "human"]
  },
  {
    id: "lora-documentary",
    displayFamily: "\"Lora\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Lora\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    moodTags: ["documentary", "thoughtful", "clear"]
  },
  {
    id: "instrument-nocturne",
    displayFamily: "\"Instrument Serif\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Instrument Serif\", \"Times New Roman\", serif",
    displayWeight: 400,
    supportWeight: 500,
    moodTags: ["luxury", "premium", "soft-focus"]
  },
  {
    id: "noto-display",
    displayFamily: "\"Noto Serif Display\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Noto Serif Display\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    moodTags: ["monument", "prestige", "statement"]
  },
  {
    id: "dm-sans-core",
    displayFamily: "\"DM Sans\", sans-serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Fraunces\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    moodTags: ["modern", "precision", "directive"]
  }
];

const fontPaletteMap = new Map(EDITORIAL_FONT_PALETTES.map((palette) => [palette.id, palette]));

let editorialFontsLoaded = false;

export const loadEditorialCaptionFonts = (): void => {
  if (editorialFontsLoaded) {
    return;
  }

  editorialFontsLoaded = true;

  loadFraunces("normal", FONT_LOAD_OPTIONS);
  loadFraunces("italic", FONT_LOAD_OPTIONS);
  loadPlayfairDisplay("normal", FONT_LOAD_OPTIONS);
  loadPlayfairDisplay("italic", FONT_LOAD_OPTIONS);
  loadCormorantGaramond("normal", FONT_LOAD_OPTIONS);
  loadCormorantGaramond("italic", FONT_LOAD_OPTIONS);
  loadCrimsonPro("normal", FONT_LOAD_OPTIONS);
  loadCrimsonPro("italic", FONT_LOAD_OPTIONS);
  loadLora("normal", FONT_LOAD_OPTIONS);
  loadLora("italic", FONT_LOAD_OPTIONS);
  loadInstrumentSerif("normal", FONT_LOAD_OPTIONS);
  loadInstrumentSerif("italic", FONT_LOAD_OPTIONS);
  loadNotoSerifDisplay("normal", FONT_LOAD_OPTIONS);
  loadNotoSerifDisplay("italic", FONT_LOAD_OPTIONS);
  loadDMSans("normal", FONT_LOAD_OPTIONS);
  loadDMSans("italic", FONT_LOAD_OPTIONS);
};

export const getEditorialFontPalette = (
  paletteId: EditorialFontPaletteId | null | undefined
): EditorialFontPalette => {
  return fontPaletteMap.get(paletteId ?? "fraunces-editorial") ?? EDITORIAL_FONT_PALETTES[0];
};
