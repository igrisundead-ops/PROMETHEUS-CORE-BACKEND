import React, {useEffect} from "react";
import {staticFile} from "remotion";

import {
  getActiveHouseFontDefinitions
} from "./house-font-registry";

const loadedHouseFontSourceKeys = new Set<string>();
let houseFontsRequested = false;

const buildSourceDescriptor = (path: string, format: string): string => {
  return `url("${staticFile(path)}") format("${format}")`;
};

const loadActiveHouseFontFaces = async (): Promise<void> => {
  if (typeof document === "undefined" || !document.fonts) {
    return;
  }

  const fontFaceSet = document.fonts as FontFaceSet & {
    add?: (fontFace: FontFace) => void;
  };

  const activeDefinitions = getActiveHouseFontDefinitions();
  for (const definition of activeDefinitions) {
    for (const source of definition.sources) {
      const sourceKey = `${definition.id}:${source.path}:${source.weight}:${source.style}`;
      if (loadedHouseFontSourceKeys.has(sourceKey)) {
        continue;
      }

      const fontFace = new FontFace(
        definition.family,
        buildSourceDescriptor(source.path, source.format),
        {
          weight: String(source.weight),
          style: source.style,
          display: "swap"
        }
      );

      try {
        const loadedFace = await fontFace.load();
        fontFaceSet.add?.(loadedFace);
        loadedHouseFontSourceKeys.add(sourceKey);
      } catch (error) {
        console.warn(`[typography] Failed to load house font source ${source.path}`, error);
      }
    }
  }
};

export const loadHouseTypographyFonts = (): void => {
  if (houseFontsRequested) {
    return;
  }

  houseFontsRequested = true;
  void loadActiveHouseFontFaces();
};

export const getHouseTypographyPreviewFontFamilies = (): string[] => {
  return getActiveHouseFontDefinitions().map((definition) => definition.family);
};

export const HouseFontBootstrap: React.FC = () => {
  useEffect(() => {
    loadHouseTypographyFonts();
  }, []);

  return null;
};
