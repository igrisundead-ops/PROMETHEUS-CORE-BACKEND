import React, {useEffect} from "react";

import {
  PHASE_2A_PROOF_RUNTIME_FONT_ID,
  RUNTIME_FONT_MANIFEST_PUBLIC_URL,
  buildRuntimeFontFaceCssForFamily,
  createRuntimeFontRegistry,
  getBundledRuntimeFontRegistry,
  getRuntimeFontFormatLabel,
  resolveRuntimeFontById,
  resolveRuntimeFontFamilyById,
  resolveSelectedRuntimeFont,
  type ManualSelectedRuntimeFont,
  type RuntimeFontAssetRecord,
  type RuntimeFontLookupDiagnostic,
  type RuntimeFontLookupResult,
  type RuntimeFontRegistry,
  type SelectedRuntimeFont
} from "./font-runtime-registry";

type RuntimeFontLoadResult = RuntimeFontLookupResult & {
  loaded: boolean;
};

const registeredRuntimeFontRecordKeys = new Set<string>();
const registeredRuntimeFontFamilyKeys = new Set<string>();
let browserRuntimeFontRegistryPromise: Promise<RuntimeFontRegistry> | null = null;

const buildRuntimeFontRecordKey = (record: RuntimeFontAssetRecord): string => {
  return `${record.fontId}:${record.publicUrl}:${record.weight ?? 400}:${record.style}`;
};

const getFontFaceSet = (): (FontFaceSet & {add?: (fontFace: FontFace) => void}) | null => {
  if (typeof document === "undefined" || !document.fonts) {
    return null;
  }

  return document.fonts as FontFaceSet & {
    add?: (fontFace: FontFace) => void;
  };
};

const fetchRuntimeFontRegistry = async (): Promise<RuntimeFontRegistry> => {
  if (typeof document === "undefined") {
    return getBundledRuntimeFontRegistry();
  }

  if (browserRuntimeFontRegistryPromise) {
    return browserRuntimeFontRegistryPromise;
  }

  browserRuntimeFontRegistryPromise = (async () => {
    const response = await fetch(RUNTIME_FONT_MANIFEST_PUBLIC_URL, {cache: "force-cache"});
    if (!response.ok) {
      throw new Error(`Failed to fetch runtime font manifest from ${RUNTIME_FONT_MANIFEST_PUBLIC_URL} (${response.status}).`);
    }

    return createRuntimeFontRegistry(await response.json());
  })().catch((error) => {
    browserRuntimeFontRegistryPromise = null;
    throw error;
  });

  return browserRuntimeFontRegistryPromise;
};

const injectRuntimeFontFamilyStyle = (selectedFont: SelectedRuntimeFont): void => {
  if (typeof document === "undefined") {
    return;
  }

  const styleId = `runtime-font-family-${selectedFont.familyId.replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
  if (document.getElementById(styleId)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.dataset.runtimeFontFamilyId = selectedFont.familyId;
  styleElement.textContent = buildRuntimeFontFaceCssForFamily(selectedFont.records);
  document.head.appendChild(styleElement);
};

const loadRuntimeFontFamilyWithFontFace = async (selectedFont: SelectedRuntimeFont): Promise<void> => {
  const fontFaceSet = getFontFaceSet();
  if (!fontFaceSet || typeof FontFace !== "function") {
    injectRuntimeFontFamilyStyle(selectedFont);
    return;
  }

  await Promise.all(selectedFont.records.map(async (record) => {
    const recordKey = buildRuntimeFontRecordKey(record);
    if (registeredRuntimeFontRecordKeys.has(recordKey)) {
      return;
    }

    const fontFace = new FontFace(
      selectedFont.cssFamily,
      `url("${record.publicUrl}") format("${getRuntimeFontFormatLabel(record.format)}")`,
      {
        weight: String(record.weight ?? 400),
        style: record.style,
        display: "swap"
      }
    );

    const loadedFontFace = await fontFace.load();
    fontFaceSet.add?.(loadedFontFace);
    registeredRuntimeFontRecordKeys.add(recordKey);
  }));
};

const ensureRuntimeFontFamilyReady = async (selectedFont: SelectedRuntimeFont): Promise<void> => {
  const fontFaceSet = getFontFaceSet();
  if (!fontFaceSet?.load) {
    return;
  }

  await Promise.all(selectedFont.records.map((record) => {
    return fontFaceSet.load(`${record.weight ?? 400} 1em "${selectedFont.cssFamily}"`);
  }));
};

const ensureRuntimeFontFamilyLoaded = async (selectedFont: SelectedRuntimeFont): Promise<void> => {
  if (registeredRuntimeFontFamilyKeys.has(selectedFont.familyId)) {
    await ensureRuntimeFontFamilyReady(selectedFont);
    return;
  }

  await loadRuntimeFontFamilyWithFontFace(selectedFont);
  injectRuntimeFontFamilyStyle(selectedFont);
  registeredRuntimeFontFamilyKeys.add(selectedFont.familyId);
  await ensureRuntimeFontFamilyReady(selectedFont);
};

const toLoadResult = async (lookup: RuntimeFontLookupResult): Promise<RuntimeFontLoadResult> => {
  if (!lookup.selectedFont || typeof document === "undefined") {
    return {
      ...lookup,
      loaded: false
    };
  }

  await ensureRuntimeFontFamilyLoaded(lookup.selectedFont);

  return {
    ...lookup,
    loaded: true
  };
};

const toLookupError = (error: unknown): RuntimeFontLoadResult => {
  const diagnostic: RuntimeFontLookupDiagnostic = {
    code: "selection-empty",
    message: error instanceof Error ? error.message : String(error),
    requestedValue: null
  };

  return {
    selectedFont: null,
    diagnostics: [diagnostic],
    loaded: false
  };
};

export const ensureRuntimeFontLoadedById = async (fontId: string): Promise<RuntimeFontLoadResult> => {
  try {
    const registry = await fetchRuntimeFontRegistry();
    return toLoadResult(resolveRuntimeFontById(fontId, registry));
  } catch (error) {
    return toLookupError(error);
  }
};

export const ensureRuntimeFontFamilyLoadedById = async (familyId: string): Promise<RuntimeFontLoadResult> => {
  try {
    const registry = await fetchRuntimeFontRegistry();
    return toLoadResult(resolveRuntimeFontFamilyById(familyId, registry));
  } catch (error) {
    return toLookupError(error);
  }
};

export const ensureSelectedRuntimeFontLoaded = async (request: {
  selectedFontId?: string | null;
  selectedFont?: ManualSelectedRuntimeFont | RuntimeFontAssetRecord | null;
}): Promise<RuntimeFontLoadResult> => {
  try {
    const registry = await fetchRuntimeFontRegistry();
    return toLoadResult(resolveSelectedRuntimeFont(request, registry));
  } catch (error) {
    return toLookupError(error);
  }
};

export const primeRuntimeFontBootstrap = async ({
  selectedFontId = PHASE_2A_PROOF_RUNTIME_FONT_ID,
  selectedFont = null
}: {
  selectedFontId?: string | null;
  selectedFont?: ManualSelectedRuntimeFont | RuntimeFontAssetRecord | null;
} = {}): Promise<RuntimeFontLoadResult> => {
  return ensureSelectedRuntimeFontLoaded({
    selectedFontId,
    selectedFont
  });
};

export const RuntimeFontBootstrap: React.FC<{
  selectedFontId?: string | null;
  selectedFont?: ManualSelectedRuntimeFont | RuntimeFontAssetRecord | null;
}> = ({
  selectedFontId = PHASE_2A_PROOF_RUNTIME_FONT_ID,
  selectedFont = null
}) => {
  useEffect(() => {
    void primeRuntimeFontBootstrap({
      selectedFontId,
      selectedFont
    }).then((result) => {
      if (!result.loaded && result.diagnostics.length > 0) {
        console.warn("[runtime-font-bootstrap]", result.diagnostics);
      }
    });
  }, [selectedFont?.familyId, selectedFont?.familyName, selectedFont?.fontId, selectedFontId]);

  return null;
};
