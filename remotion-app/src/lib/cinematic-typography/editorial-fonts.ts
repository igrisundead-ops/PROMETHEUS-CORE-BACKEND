import {loadFont as loadCormorantGaramond} from "@remotion/google-fonts/CormorantGaramond";
import {loadFont as loadCrimsonPro} from "@remotion/google-fonts/CrimsonPro";
import {loadFont as loadDMSans} from "@remotion/google-fonts/DMSans";
import {loadFont as loadFraunces} from "@remotion/google-fonts/Fraunces";
import {loadFont as loadInstrumentSerif} from "@remotion/google-fonts/InstrumentSerif";
import {loadFont as loadLora} from "@remotion/google-fonts/Lora";
import {loadFont as loadNotoSerifDisplay} from "@remotion/google-fonts/NotoSerifDisplay";
import {loadFont as loadPlayfairDisplay} from "@remotion/google-fonts/PlayfairDisplay";
import {
  EDITORIAL_FONT_PALETTES,
  getEditorialFontPalette,
  getEditorialFontPalettesForRole,
  type EditorialFontPalette,
  type EditorialFontPaletteId
} from "./font-runtime-registry";
import {loadHouseTypographyFonts} from "./house-font-loader";

export {
  EDITORIAL_FONT_PALETTES,
  getEditorialFontPalette,
  getEditorialFontPalettesForRole
};

export type {
  EditorialFontPalette,
  EditorialFontPaletteId
};

const FONT_LOAD_OPTIONS = {
  subsets: ["latin"] as ("latin")[],
  ignoreTooManyRequestsWarning: true
};

const CORE_WEIGHTS = ["400", "500", "600", "700", "800"] as const;

let editorialFontsLoaded = false;

export const loadEditorialCaptionFonts = (): void => {
  if (editorialFontsLoaded) {
    return;
  }

  editorialFontsLoaded = true;

  CORE_WEIGHTS.forEach((weight) => {
    loadFraunces(weight as any, FONT_LOAD_OPTIONS);
    loadFraunces(`${weight}italic` as any, FONT_LOAD_OPTIONS);
    loadPlayfairDisplay(weight as any, FONT_LOAD_OPTIONS);
    loadPlayfairDisplay(`${weight}italic` as any, FONT_LOAD_OPTIONS);
    loadCormorantGaramond(weight as any, FONT_LOAD_OPTIONS);
    loadCormorantGaramond(`${weight}italic` as any, FONT_LOAD_OPTIONS);
    loadCrimsonPro(weight as any, FONT_LOAD_OPTIONS);
    loadCrimsonPro(`${weight}italic` as any, FONT_LOAD_OPTIONS);
    loadLora(weight as any, FONT_LOAD_OPTIONS);
    loadLora(`${weight}italic` as any, FONT_LOAD_OPTIONS);
    loadInstrumentSerif(weight as any, FONT_LOAD_OPTIONS);
    loadInstrumentSerif(`${weight}italic` as any, FONT_LOAD_OPTIONS);
    loadNotoSerifDisplay(weight as any, FONT_LOAD_OPTIONS);
    loadNotoSerifDisplay(`${weight}italic` as any, FONT_LOAD_OPTIONS);
    loadDMSans(weight as any, FONT_LOAD_OPTIONS);
    loadDMSans(`${weight}italic` as any, FONT_LOAD_OPTIONS);
  });

  loadHouseTypographyFonts();
};
