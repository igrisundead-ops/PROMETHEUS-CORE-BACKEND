import {
  buildRuntimeFontFaceCssForFamily,
  getBundledRuntimeFontRegistry,
  getRuntimeFontCssFamily,
  resolveRuntimeFontFamilyById,
  resolveRuntimeFontFamilyByName,
  type RuntimeFontAssetRecord,
  type RuntimeFontLookupDiagnostic,
  type SelectedRuntimeFont
} from "./font-runtime-registry";
import type {TypographyRoleSlotId} from "../cinematic-typography/typography-doctrine";

export type ManifestBackedPaletteId = `manifest-${string}`;

export type ManifestBackedEditorialFontPalette = {
  id: ManifestBackedPaletteId;
  displayFamily: string;
  supportFamily: string;
  italicFamily: string;
  displayWeight: number;
  supportWeight: number;
  availableWeights: number[];
  moodTags: string[];
  doctrineRoleIds: TypographyRoleSlotId[];
  candidateId: string;
  familyId: string;
  familyName: string;
  cssFamily: string;
  renderable: true;
  publicUrls: string[];
  fontFaceCss: string;
  availableStyles: string[];
  records: RuntimeFontAssetRecord[];
  diagnostics: RuntimeFontLookupDiagnostic[];
};

export type ResolveRenderableTypographyFontInput = {
  candidateId?: string | null;
  familyId?: string | null;
  familyName?: string | null;
  requestedWeight?: number | null;
  requestedStyle?: string | null;
};

export type ResolvedRenderableTypographyFont = {
  candidateId: string;
  palette: ManifestBackedEditorialFontPalette;
  requestedWeight: number;
  requestedStyle: string;
  resolvedWeight: number;
  resolvedStyle: string;
  resolvedRecord: RuntimeFontAssetRecord;
  fauxBoldRisk: boolean;
  fauxItalicRisk: boolean;
  diagnostics: RuntimeFontLookupDiagnostic[];
};

type ManifestBridgeProofDefinition = {
  candidateId: string;
  preferredFamilyName: string;
  doctrineRoleIds: TypographyRoleSlotId[];
  moodTags: string[];
  genericFamily: "serif" | "sans-serif";
  preferredDisplayWeight: number;
  preferredSupportWeight: number;
};

const PHASE_2B_MANIFEST_BRIDGE_PROOF_DEFINITIONS: ManifestBridgeProofDefinition[] = [
  {
    candidateId: "manifest-aesthetic",
    preferredFamilyName: "Aesthetic",
    doctrineRoleIds: ["hero_serif_alternate", "editorial_serif_support"],
    moodTags: ["luxury", "editorial", "cinematic"],
    genericFamily: "serif",
    preferredDisplayWeight: 400,
    preferredSupportWeight: 400
  },
  {
    candidateId: "manifest-amerika",
    preferredFamilyName: "Amerika",
    doctrineRoleIds: ["editorial_serif_support", "display_sans_pressure_release"],
    moodTags: ["statement", "dramatic", "editorial"],
    genericFamily: "serif",
    preferredDisplayWeight: 400,
    preferredSupportWeight: 400
  },
  {
    candidateId: "manifest-antenna",
    preferredFamilyName: "ANTENNA",
    doctrineRoleIds: ["neutral_sans_core"],
    moodTags: ["modern", "precision", "directive"],
    genericFamily: "sans-serif",
    preferredDisplayWeight: 400,
    preferredSupportWeight: 400
  }
];

const uniqueNumbers = (values: number[]): number[] => {
  return [...new Set(values)].sort((left, right) => left - right);
};

const uniqueStrings = (values: string[]): string[] => {
  return [...new Set(values)];
};

const findNearestWeight = (requestedWeight: number, availableWeights: number[]): number => {
  if (availableWeights.length === 0) {
    return requestedWeight;
  }

  return [...availableWeights].sort((left, right) => {
    const distanceDelta = Math.abs(left - requestedWeight) - Math.abs(right - requestedWeight);
    if (distanceDelta !== 0) {
      return distanceDelta;
    }

    return left - right;
  })[0]!;
};

const normalizeStyle = (value: string | null | undefined): string => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "italic" || normalized === "oblique" ? normalized : "normal";
};

const resolveRenderableFontSelection = (selectedFont: SelectedRuntimeFont): ManifestBridgeProofDefinition | null => {
  return PHASE_2B_MANIFEST_BRIDGE_PROOF_DEFINITIONS.find((definition) => {
    return definition.preferredFamilyName.toLowerCase() === selectedFont.familyName.toLowerCase();
  }) ?? null;
};

const resolvePreferredWeight = (preferredWeight: number, availableWeights: number[]): number => {
  if (availableWeights.length === 0) {
    return preferredWeight;
  }

  return findNearestWeight(preferredWeight, availableWeights);
};

const buildPaletteFamilyDescriptor = (cssFamily: string, genericFamily: ManifestBridgeProofDefinition["genericFamily"]): string => {
  return `"${cssFamily}", ${genericFamily}`;
};

const toManifestPaletteId = (familyId: string): ManifestBackedPaletteId => {
  return `manifest-${familyId}`;
};

const buildManifestBackedPalette = (
  definition: ManifestBridgeProofDefinition,
  selectedFont: SelectedRuntimeFont
): ManifestBackedEditorialFontPalette => {
  const availableWeights = uniqueNumbers(selectedFont.records.map((record) => record.weight ?? 400));
  const availableStyles = uniqueStrings(selectedFont.records.map((record) => normalizeStyle(record.style)));
  const cssFamily = getRuntimeFontCssFamily(selectedFont.primaryRecord);
  const familyDescriptor = buildPaletteFamilyDescriptor(cssFamily, definition.genericFamily);

  return {
    id: toManifestPaletteId(selectedFont.familyId),
    displayFamily: familyDescriptor,
    supportFamily: familyDescriptor,
    italicFamily: familyDescriptor,
    displayWeight: resolvePreferredWeight(definition.preferredDisplayWeight, availableWeights),
    supportWeight: resolvePreferredWeight(definition.preferredSupportWeight, availableWeights),
    availableWeights,
    moodTags: definition.moodTags,
    doctrineRoleIds: definition.doctrineRoleIds,
    candidateId: definition.candidateId,
    familyId: selectedFont.familyId,
    familyName: selectedFont.familyName,
    cssFamily,
    renderable: true,
    publicUrls: selectedFont.records.map((record) => record.publicUrl),
    fontFaceCss: buildRuntimeFontFaceCssForFamily(selectedFont.records),
    availableStyles,
    records: selectedFont.records,
    diagnostics: selectedFont.diagnostics
  };
};

const resolveManifestBackedPaletteForSelectedFont = (
  selectedFont: SelectedRuntimeFont | null
): ManifestBackedEditorialFontPalette | null => {
  if (!selectedFont) {
    return null;
  }

  const definition = resolveRenderableFontSelection(selectedFont);
  if (!definition) {
    return null;
  }

  return buildManifestBackedPalette(definition, selectedFont);
};

export const getManifestBackedPalettes = (): ManifestBackedEditorialFontPalette[] => {
  return PHASE_2B_MANIFEST_BRIDGE_PROOF_DEFINITIONS
    .map((definition) => {
      const lookup = resolveRuntimeFontFamilyByName(definition.preferredFamilyName, getBundledRuntimeFontRegistry());
      return resolveManifestBackedPaletteForSelectedFont(lookup.selectedFont);
    })
    .filter((palette): palette is ManifestBackedEditorialFontPalette => palette !== null);
};

const manifestBackedPalettes = getManifestBackedPalettes();

const manifestBackedPaletteByCandidateId = new Map(
  manifestBackedPalettes.map((palette) => [palette.candidateId, palette] as const)
);

const manifestBackedPaletteByFamilyId = new Map(
  manifestBackedPalettes.map((palette) => [palette.familyId, palette] as const)
);

const manifestBackedPaletteByFamilyName = new Map(
  manifestBackedPalettes.map((palette) => [palette.familyName.toLowerCase(), palette] as const)
);

const manifestBackedPaletteById = new Map(
  manifestBackedPalettes.map((palette) => [palette.id, palette] as const)
);

export const getManifestBackedPaletteForCandidate = (
  candidateId: string | null | undefined
): ManifestBackedEditorialFontPalette | null => {
  if (!candidateId) {
    return null;
  }

  return manifestBackedPaletteByCandidateId.get(candidateId) ?? null;
};

export const getManifestBackedPaletteForFamilyName = (
  familyName: string | null | undefined
): ManifestBackedEditorialFontPalette | null => {
  if (!familyName?.trim()) {
    return null;
  }

  const directPalette = manifestBackedPaletteByFamilyName.get(familyName.trim().toLowerCase());
  if (directPalette) {
    return directPalette;
  }

  const lookup = resolveRuntimeFontFamilyByName(familyName, getBundledRuntimeFontRegistry());
  return resolveManifestBackedPaletteForSelectedFont(lookup.selectedFont);
};

export const getManifestBackedPaletteForFamilyId = (
  familyId: string | null | undefined
): ManifestBackedEditorialFontPalette | null => {
  if (!familyId?.trim()) {
    return null;
  }

  const directPalette = manifestBackedPaletteByFamilyId.get(familyId.trim());
  if (directPalette) {
    return directPalette;
  }

  const lookup = resolveRuntimeFontFamilyById(familyId, getBundledRuntimeFontRegistry());
  return resolveManifestBackedPaletteForSelectedFont(lookup.selectedFont);
};

export const getManifestBackedPaletteById = (
  paletteId: string | null | undefined
): ManifestBackedEditorialFontPalette | null => {
  if (!paletteId?.trim()) {
    return null;
  }

  return manifestBackedPaletteById.get(paletteId as ManifestBackedPaletteId) ?? null;
};

export const getManifestBridgeDiagnostics = (
  input: ResolveRenderableTypographyFontInput
): RuntimeFontLookupDiagnostic[] => {
  return resolveRenderableTypographyFont(input)?.diagnostics ?? [];
};

export const resolveRenderableTypographyFont = (
  input: ResolveRenderableTypographyFontInput
): ResolvedRenderableTypographyFont | null => {
  const palette = input.candidateId
    ? getManifestBackedPaletteForCandidate(input.candidateId)
    : input.familyId
      ? getManifestBackedPaletteForFamilyId(input.familyId)
      : getManifestBackedPaletteForFamilyName(input.familyName ?? null);

  if (!palette) {
    return null;
  }

  const requestedWeight = Math.max(1, Math.round(input.requestedWeight ?? palette.displayWeight));
  const requestedStyle = normalizeStyle(input.requestedStyle);
  const styleExactCandidates = palette.records.filter((record) => normalizeStyle(record.style) === requestedStyle);
  const weightPool = styleExactCandidates.length > 0 ? styleExactCandidates : palette.records;
  const resolvedWeight = findNearestWeight(
    requestedWeight,
    uniqueNumbers(weightPool.map((record) => record.weight ?? 400))
  );
  const resolvedRecord = weightPool.find((record) => {
    return (record.weight ?? 400) === resolvedWeight;
  }) ?? weightPool[0] ?? palette.records[0]!;
  const resolvedStyle = normalizeStyle(resolvedRecord.style);
  const fauxBoldRisk = resolvedWeight !== requestedWeight;
  const fauxItalicRisk = resolvedStyle !== requestedStyle;
  const diagnostics = [
    ...palette.diagnostics,
    ...(fauxBoldRisk
      ? [{
        code: "font-id-not-found" as const,
        message: `Nearest available runtime font weight ${resolvedWeight} was used instead of requested ${requestedWeight} for candidate '${palette.candidateId}'.`,
        requestedValue: String(requestedWeight)
      }]
      : []),
    ...(fauxItalicRisk
      ? [{
        code: "family-name-fallback" as const,
        message: `Runtime font style '${resolvedStyle}' was used instead of requested '${requestedStyle}' for candidate '${palette.candidateId}'.`,
        requestedValue: requestedStyle
      }]
      : [])
  ];

  return {
    candidateId: palette.candidateId,
    palette,
    requestedWeight,
    requestedStyle,
    resolvedWeight,
    resolvedStyle,
    resolvedRecord,
    fauxBoldRisk,
    fauxItalicRisk,
    diagnostics
  };
};
