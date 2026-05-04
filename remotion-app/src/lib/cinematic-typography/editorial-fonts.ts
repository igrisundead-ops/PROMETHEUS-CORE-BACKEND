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
  loadHouseTypographyFonts();
};
