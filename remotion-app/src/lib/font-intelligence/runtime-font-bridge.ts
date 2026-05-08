import {
  buildRuntimeFontFaceCssForFamily,
  getBundledRuntimeFontRegistry,
  getRuntimeFontCssFamily,
  type RuntimeFontAssetRecord,
  type RuntimeFontLookupDiagnostic
} from "./font-runtime-registry";
import type {
  TypographyFontCandidate,
  TypographyRoleSlotId
} from "../cinematic-typography/typography-doctrine";

export type ManifestBackedPaletteId = `manifest-family_${string}`;

export type ManifestRoleMappingConfidence = "low" | "medium";
export type ManifestBridgeSourceMarker = "manifest-bridge";
export type ManifestFontKind = "serif" | "sans" | "script" | "decorative";

export type ManifestBackedEditorialFontPalette = {
  id: ManifestBackedPaletteId;
  displayFamily: string;
  supportFamily: string;
  italicFamily: string;
  displayWeight: number;
  supportWeight: number;
  availableWeights: number[];
  availableStyles: string[];
  moodTags: string[];
  doctrineRoleIds: TypographyRoleSlotId[];
  candidateId: ManifestBackedPaletteId;
  familyId: string;
  familyName: string;
  cssFamily: string;
  renderable: true;
  publicUrls: string[];
  fontFaceCss: string;
  records: RuntimeFontAssetRecord[];
  diagnostics: RuntimeFontLookupDiagnostic[];
  sourceMarker: ManifestBridgeSourceMarker;
  roleMappingConfidence: ManifestRoleMappingConfidence;
  fontKind: ManifestFontKind;
};

export type DynamicManifestTypographyCandidate = TypographyFontCandidate & {
  id: ManifestBackedPaletteId;
  paletteId: ManifestBackedPaletteId;
  familyId: string;
  roleMappingConfidence: ManifestRoleMappingConfidence;
  sourceMarker: ManifestBridgeSourceMarker;
};

export type ResolveRenderableTypographyFontInput = {
  candidateId?: string | null;
  familyId?: string | null;
  familyName?: string | null;
  requestedWeight?: number | null;
  requestedStyle?: string | null;
};

export type ResolvedRenderableTypographyFont = {
  candidateId: ManifestBackedPaletteId;
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

type ManifestBridgeFamilyInference = {
  fontKind: ManifestFontKind;
  genericFamily: "serif" | "sans-serif" | "cursive";
  doctrineRoleIds: TypographyRoleSlotId[];
  category: TypographyFontCandidate["categories"][number];
  moodTags: string[];
  motionTolerance: TypographyFontCandidate["motionTolerance"];
  intensityFit: TypographyFontCandidate["intensityFit"];
  premiumSignal: number;
  restraintSignal: number;
  roleMappingConfidence: ManifestRoleMappingConfidence;
};

const containsAny = (value: string, patterns: RegExp[]): boolean => {
  return patterns.some((pattern) => pattern.test(value));
};

const uniqueNumbers = (values: number[]): number[] => {
  return [...new Set(values)].sort((left, right) => left - right);
};

const uniqueStrings = (values: string[]): string[] => {
  return [...new Set(values)];
};

const normalizeStyle = (value: string | null | undefined): string => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "italic" || normalized === "oblique" ? normalized : "normal";
};

const sanitizeManifestToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "unknown";
};

export const buildManifestFamilyCandidateId = (familyId: string): ManifestBackedPaletteId => {
  const normalizedFamilyId = sanitizeManifestToken(familyId);
  const suffix = normalizedFamilyId.startsWith("family_")
    ? normalizedFamilyId.slice("family_".length)
    : normalizedFamilyId;
  return `manifest-family_${suffix}`;
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

const buildFamilyCorpus = (records: RuntimeFontAssetRecord[]): string => {
  return records
    .flatMap((record) => [
      record.familyName,
      record.fileName,
      record.originalFileName ?? "",
      record.style
    ])
    .join(" ")
    .toLowerCase();
};

const inferManifestBridgeFamily = (records: RuntimeFontAssetRecord[]): ManifestBridgeFamilyInference => {
  const familyCorpus = buildFamilyCorpus(records);
  const familyName = records[0]?.familyName ?? "";
  const isUppercaseFamily = familyName.trim().length > 0 && familyName === familyName.toUpperCase();

  const scriptPatterns = [
    /\bscript\b/,
    /\bbrush\b/,
    /\bcallig/,
    /\bhand/,
    /\bsignature\b/,
    /\bcursive\b/,
    /\bvibes\b/,
    /\baulion\b/,
    /\bbrushelva\b/,
    /\bragara\b/,
    /\bberlleigh\b/
  ];
  const sansPatterns = [
    /\bsans\b/,
    /\bgothic\b/,
    /\bgrotesk\b/,
    /\bneo\b/,
    /\bcondensed\b/,
    /\bdisplay sans\b/,
    /\bantenna\b/,
    /\bamerika\b/
  ];
  const serifPatterns = [
    /\bserif\b/,
    /\bgaramond\b/,
    /\bbodoni\b/,
    /\broman\b/,
    /\bdidot\b/,
    /\bdisplay\b/,
    /\beditorial\b/,
    /\baesthetic\b/,
    /\balmera\b/,
    /\bbaguile\b/,
    /\bbalona\b/,
    /\bcavergiz\b/,
    /\bleviathan\b/,
    /\bmangko\b/,
    /\breglarik\b/,
    /\bglamoure\b/
  ];
  const decorativePatterns = [
    /\bdemo\b/,
    /\bfree\b/,
    /\btrial\b/,
    /\bpersonal\b/,
    /\balternates?\b/,
    /\boblique\b/,
    /\bitalic\b/
  ];

  if (containsAny(familyCorpus, scriptPatterns)) {
    return {
      fontKind: "script",
      genericFamily: "cursive",
      doctrineRoleIds: ["script_accent_rare"],
      category: "script",
      moodTags: ["accent", "luxury", "manifest-bridge"],
      motionTolerance: "low",
      intensityFit: ["low", "medium"],
      premiumSignal: 0.58,
      restraintSignal: 0.62,
      roleMappingConfidence: "medium"
    };
  }

  if (containsAny(familyCorpus, sansPatterns) || isUppercaseFamily) {
    return {
      fontKind: "sans",
      genericFamily: "sans-serif",
      doctrineRoleIds: ["neutral_sans_core", "display_sans_pressure_release"],
      category: "neutral-sans",
      moodTags: ["precision", "directive", "manifest-bridge"],
      motionTolerance: "high",
      intensityFit: ["medium", "high"],
      premiumSignal: 0.57,
      restraintSignal: 0.71,
      roleMappingConfidence: containsAny(familyCorpus, sansPatterns) ? "medium" : "low"
    };
  }

  if (containsAny(familyCorpus, serifPatterns)) {
    return {
      fontKind: "serif",
      genericFamily: "serif",
      doctrineRoleIds: ["hero_serif_alternate", "editorial_serif_support"],
      category: "display-serif",
      moodTags: ["editorial", "cinematic", "manifest-bridge"],
      motionTolerance: "medium",
      intensityFit: ["low", "medium", "high"],
      premiumSignal: 0.61,
      restraintSignal: 0.72,
      roleMappingConfidence: "medium"
    };
  }

  if (containsAny(familyCorpus, decorativePatterns)) {
    return {
      fontKind: "decorative",
      genericFamily: "sans-serif",
      doctrineRoleIds: ["display_sans_pressure_release"],
      category: "decorative",
      moodTags: ["statement", "display", "manifest-bridge"],
      motionTolerance: "medium",
      intensityFit: ["medium", "high"],
      premiumSignal: 0.55,
      restraintSignal: 0.48,
      roleMappingConfidence: "low"
    };
  }

  return {
    fontKind: "serif",
    genericFamily: "serif",
    doctrineRoleIds: ["editorial_serif_support"],
    category: "display-serif",
    moodTags: ["editorial", "renderable", "manifest-bridge"],
    motionTolerance: "medium",
    intensityFit: ["low", "medium"],
    premiumSignal: 0.56,
    restraintSignal: 0.66,
    roleMappingConfidence: "low"
  };
};

const buildPaletteFamilyDescriptor = (cssFamily: string, genericFamily: "serif" | "sans-serif" | "cursive"): string => {
  return `"${cssFamily}", ${genericFamily}`;
};

const buildFamilyDiagnostics = ({
  familyId,
  familyName,
  roleMappingConfidence
}: {
  familyId: string;
  familyName: string;
  roleMappingConfidence: ManifestRoleMappingConfidence;
}): RuntimeFontLookupDiagnostic[] => {
  if (roleMappingConfidence !== "low") {
    return [];
  }

  return [{
    code: "family-name-fallback",
    message: `Manifest bridge assigned a provisional low-confidence role mapping to '${familyName}' (${familyId}).`,
    requestedValue: familyId
  }];
};

const buildManifestBackedPalette = (records: RuntimeFontAssetRecord[]): ManifestBackedEditorialFontPalette | null => {
  const primaryRecord = records[0];
  if (!primaryRecord) {
    return null;
  }

  if (
    !primaryRecord.fontId.trim() ||
    !primaryRecord.familyId.trim() ||
    !primaryRecord.familyName.trim() ||
    !records.every((record) => record.publicUrl.startsWith("/"))
  ) {
    return null;
  }

  const inference = inferManifestBridgeFamily(records);
  const availableWeights = uniqueNumbers(records.map((record) => record.weight ?? 400));
  const availableStyles = uniqueStrings(records.map((record) => normalizeStyle(record.style)));
  const cssFamily = getRuntimeFontCssFamily(primaryRecord);
  const familyDescriptor = buildPaletteFamilyDescriptor(cssFamily, inference.genericFamily);
  const candidateId = buildManifestFamilyCandidateId(primaryRecord.familyId);

  return {
    id: candidateId,
    displayFamily: familyDescriptor,
    supportFamily: familyDescriptor,
    italicFamily: familyDescriptor,
    displayWeight: findNearestWeight(700, availableWeights),
    supportWeight: findNearestWeight(400, availableWeights),
    availableWeights,
    availableStyles,
    moodTags: inference.moodTags,
    doctrineRoleIds: inference.doctrineRoleIds,
    candidateId,
    familyId: primaryRecord.familyId,
    familyName: primaryRecord.familyName,
    cssFamily,
    renderable: true,
    publicUrls: records.map((record) => record.publicUrl),
    fontFaceCss: buildRuntimeFontFaceCssForFamily(records),
    records,
    diagnostics: buildFamilyDiagnostics({
      familyId: primaryRecord.familyId,
      familyName: primaryRecord.familyName,
      roleMappingConfidence: inference.roleMappingConfidence
    }),
    sourceMarker: "manifest-bridge",
    roleMappingConfidence: inference.roleMappingConfidence,
    fontKind: inference.fontKind
  };
};

const buildDynamicManifestTypographyCandidate = (
  palette: ManifestBackedEditorialFontPalette
): DynamicManifestTypographyCandidate => {
  const inference = inferManifestBridgeFamily(palette.records);
  return {
    id: palette.candidateId,
    name: palette.familyName,
    source: "reference-pool",
    stage: "candidate",
    categories: [inference.category],
    eligibleRoles: palette.doctrineRoleIds,
    motionTolerance: inference.motionTolerance,
    premiumSignal: inference.premiumSignal,
    restraintSignal: inference.restraintSignal,
    intensityFit: inference.intensityFit,
    notes: [
      `Phase 2B-2A dynamic manifest bridge candidate.`,
      `Source marker: ${palette.sourceMarker}.`,
      `Role mapping confidence: ${palette.roleMappingConfidence}.`,
      `Renderable family ${palette.familyId} exposes ${palette.records.length} verified runtime source(s).`
    ],
    paletteId: palette.id,
    familyId: palette.familyId,
    roleMappingConfidence: palette.roleMappingConfidence,
    sourceMarker: palette.sourceMarker
  };
};

const buildManifestBackedPalettes = (): ManifestBackedEditorialFontPalette[] => {
  const registry = getBundledRuntimeFontRegistry();
  return [...registry.byFamilyId.entries()]
    .sort(([leftFamilyId], [rightFamilyId]) => leftFamilyId.localeCompare(rightFamilyId))
    .map(([, records]) => buildManifestBackedPalette(records))
    .filter((palette): palette is ManifestBackedEditorialFontPalette => palette !== null);
};

const manifestBackedPalettes = buildManifestBackedPalettes();
const dynamicManifestTypographyCandidates = manifestBackedPalettes.map((palette) => buildDynamicManifestTypographyCandidate(palette));

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

export const getManifestBackedPalettes = (): ManifestBackedEditorialFontPalette[] => {
  return manifestBackedPalettes;
};

export const getDynamicManifestTypographyCandidates = (): DynamicManifestTypographyCandidate[] => {
  return dynamicManifestTypographyCandidates;
};

export const getManifestBackedPaletteForCandidate = (
  candidateId: string | null | undefined
): ManifestBackedEditorialFontPalette | null => {
  if (!candidateId?.trim()) {
    return null;
  }

  return manifestBackedPaletteByCandidateId.get(candidateId as ManifestBackedPaletteId) ?? null;
};

export const getManifestBackedPaletteForFamilyName = (
  familyName: string | null | undefined
): ManifestBackedEditorialFontPalette | null => {
  if (!familyName?.trim()) {
    return null;
  }

  return manifestBackedPaletteByFamilyName.get(familyName.trim().toLowerCase()) ?? null;
};

export const getManifestBackedPaletteForFamilyId = (
  familyId: string | null | undefined
): ManifestBackedEditorialFontPalette | null => {
  if (!familyId?.trim()) {
    return null;
  }

  return manifestBackedPaletteByFamilyId.get(familyId.trim()) ?? null;
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
  const resolvedRecord = weightPool.find((record) => (record.weight ?? 400) === resolvedWeight) ?? weightPool[0] ?? palette.records[0]!;
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

export const resolveRenderableTypographyFontForRole = ({
  roleId,
  requestedWeight,
  requestedStyle
}: {
  roleId?: TypographyRoleSlotId | null;
  requestedWeight?: number | null;
  requestedStyle?: string | null;
}): ResolvedRenderableTypographyFont | null => {
  if (!roleId) {
    return null;
  }

  const rankedCandidates = dynamicManifestTypographyCandidates
    .filter((candidate) => candidate.eligibleRoles.includes(roleId))
    .sort((left, right) => {
      const confidenceDelta = (left.roleMappingConfidence === "medium" ? 1 : 0) - (right.roleMappingConfidence === "medium" ? 1 : 0);
      if (confidenceDelta !== 0) {
        return -confidenceDelta;
      }

      const signalDelta = (right.premiumSignal + right.restraintSignal) - (left.premiumSignal + left.restraintSignal);
      if (signalDelta !== 0) {
        return signalDelta;
      }

      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });

  for (const candidate of rankedCandidates) {
    const resolved = resolveRenderableTypographyFont({
      candidateId: candidate.id,
      requestedWeight,
      requestedStyle
    });
    if (resolved) {
      return resolved;
    }
  }

  return null;
};
