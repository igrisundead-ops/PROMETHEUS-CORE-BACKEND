import React, {useEffect} from "react";
import {continueRender, delayRender, staticFile} from "remotion";

import {
  EDITORIAL_FONT_PALETTES
} from "./font-runtime-registry";
import {
  getActiveHouseFontDefinitions
} from "./house-font-registry";
import type {HouseFontAssetSource, HouseFontDefinition} from "./house-font-registry";

const loadedHouseFontSourceKeys = new Set<string>();
const injectedHouseFontSourceKeys = new Set<string>();
const readyEditorialFontKeys = new Set<string>();
const warnedFontLoadKeys = new Set<string>();
const pendingFontLoadPromises = new Map<string, Promise<void>>();
let houseFontsRequested = false;
let houseFontsReadyPromise: Promise<void> | null = null;

const buildSourceDescriptor = (path: string, format: string): string => {
  return `url("${staticFile(path)}") format("${format}")`;
};

const getFontFaceSet = (): (FontFaceSet & {add?: (fontFace: FontFace) => void}) | null => {
  if (typeof document === "undefined" || !document.fonts) {
    return null;
  }

  return document.fonts as FontFaceSet & {
    add?: (fontFace: FontFace) => void;
  };
};

const warnFontLoadFailure = (warningKey: string, error: unknown): void => {
  if (warnedFontLoadKeys.has(warningKey)) {
    return;
  }

  warnedFontLoadKeys.add(warningKey);
  console.warn(`[typography] ${warningKey}`, error);
};

const injectHouseFontFaceStyle = ({
  definition,
  source
}: {
  definition: HouseFontDefinition;
  source: HouseFontAssetSource;
}): void => {
  if (typeof document === "undefined") {
    return;
  }

  const sourceKey = `${definition.id}:${source.path}:${source.weight}:${source.style}`;
  if (injectedHouseFontSourceKeys.has(sourceKey)) {
    return;
  }

  const styleId = `house-font-${sourceKey.replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
  if (document.getElementById(styleId)) {
    injectedHouseFontSourceKeys.add(sourceKey);
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.dataset.houseFontSourceKey = sourceKey;
  styleElement.textContent = [
    "@font-face {",
    `  font-family: "${definition.family.replace(/(["\\])/g, "\\$1")}";`,
    `  src: ${buildSourceDescriptor(source.path, source.format)};`,
    `  font-style: ${source.style};`,
    `  font-weight: ${source.weight};`,
    "  font-display: swap;",
    "}"
  ].join("\n");
  document.head.appendChild(styleElement);
  injectedHouseFontSourceKeys.add(sourceKey);
};

const withRenderGate = async ({
  loadKey,
  description,
  run
}: {
  loadKey: string;
  description: string;
  run: () => Promise<void>;
}): Promise<void> => {
  const existingLoad = pendingFontLoadPromises.get(loadKey);
  if (existingLoad) {
    await existingLoad;
    return;
  }

  const gatedLoad = (async () => {
    const renderHandle = delayRender(description);
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
      await Promise.race([
        run(),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Font load timeout (3000ms) for ${loadKey}`)), 3000);
        })
      ]);
    } catch (error) {
      warnFontLoadFailure(`Font hydration fallback for ${loadKey}`, error);
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      continueRender(renderHandle);
    }
  })();

  pendingFontLoadPromises.set(loadKey, gatedLoad);

  try {
    await gatedLoad;
  } finally {
    pendingFontLoadPromises.delete(loadKey);
  }
};

const loadActiveHouseFontFaces = async (): Promise<void> => {
  const fontFaceSet = getFontFaceSet();
  if (!fontFaceSet) {
    return;
  }

  const activeDefinitions = getActiveHouseFontDefinitions();
  for (const definition of activeDefinitions) {
    for (const source of definition.sources) {
      const sourceKey = `${definition.id}:${source.path}:${source.weight}:${source.style}`;
      if (loadedHouseFontSourceKeys.has(sourceKey)) {
        continue;
      }

      if (typeof FontFace !== "function") {
        injectHouseFontFaceStyle({definition, source});
        loadedHouseFontSourceKeys.add(sourceKey);
        continue;
      }

      await withRenderGate({
        loadKey: sourceKey,
        description: `Loading font: ${definition.family}`,
        run: async () => {
          const fontFace = new FontFace(
            definition.family,
            buildSourceDescriptor(source.path, source.format),
            {
              weight: String(source.weight),
              style: source.style,
              display: "swap"
            }
          );

          const loadedFace = await fontFace.load();
          fontFaceSet.add?.(loadedFace);
          loadedHouseFontSourceKeys.add(sourceKey);
        }
      });
    }
  }
};

const ensureEditorialFontFamiliesReady = async (): Promise<void> => {
  const fontFaceSet = getFontFaceSet();
  if (!fontFaceSet?.load) {
    return;
  }

  for (const palette of EDITORIAL_FONT_PALETTES) {
    const loadKey = `editorial-family:${palette.id}`;
    if (readyEditorialFontKeys.has(loadKey)) {
      continue;
    }

    await withRenderGate({
      loadKey,
      description: `Hydrating font family: ${palette.primaryFamilyName}`,
      run: async () => {
        await fontFaceSet.load(`1em "${palette.primaryFamilyName}"`);
        readyEditorialFontKeys.add(loadKey);
      }
    });
  }
};

export const primeHouseTypographyFonts = async (): Promise<void> => {
  if (houseFontsReadyPromise) {
    return houseFontsReadyPromise;
  }

  houseFontsReadyPromise = (async () => {
    await Promise.all([
      loadActiveHouseFontFaces(),
      ensureEditorialFontFamiliesReady()
    ]);
  })().catch((error) => {
    houseFontsReadyPromise = null;
    throw error;
  });

  return houseFontsReadyPromise;
};

export const loadHouseTypographyFonts = (): void => {
  if (houseFontsRequested) {
    return;
  }

  houseFontsRequested = true;
  void primeHouseTypographyFonts();
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
