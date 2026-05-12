import type {TypographyRoleSlotId} from "./typography-doctrine";

export type HouseFontPaletteId =
  | "jugendreisen-house"
  | "louize-house"
  | "ivar-script-house"
  | "sokoli-house";

export type HouseFontAssetFormat = "otf" | "ttf" | "woff" | "woff2";

export type HouseFontAssetSource = {
  path: string;
  format: HouseFontAssetFormat;
  weight: number;
  style: "normal" | "italic";
};

export type HouseFontDefinition = {
  id: "jugendreisen" | "louize" | "ivar-script" | "sokoli";
  candidateId: string;
  paletteId: HouseFontPaletteId;
  family: string;
  doctrineRoleId: TypographyRoleSlotId;
  enabled: boolean;
  notes: string[];
  sources: HouseFontAssetSource[];
};

export type HouseFontRegistryValidation = {
  expectedFontFamilies: string[];
  expectedFontPaths: string[];
  enabledHouseFontCount: number;
  enabledHouseFontFamilies: string[];
  enabledHouseFontPaths: string[];
  missingExpectedFontPaths: string[];
  missingEnabledFontPaths: string[];
  houseFontsAvailable: boolean;
};

export const HOUSE_FONT_DEFINITIONS: HouseFontDefinition[] = [
  {
    id: "jugendreisen",
    candidateId: "jugendreisen",
    paletteId: "jugendreisen-house",
    family: "Jugendreisen",
    doctrineRoleId: "hero_serif_primary",
    enabled: false,
    notes: [
      "Primary hero serif benchmark.",
      "Enable after dropping the licensed font files into public/fonts/house/jugendreisen/."
    ],
    sources: [
      {
        path: "fonts/house/jugendreisen/Jugendreisen-Regular.otf",
        format: "otf",
        weight: 400,
        style: "normal"
      }
    ]
  },
  {
    id: "louize",
    candidateId: "louize",
    paletteId: "louize-house",
    family: "Louize",
    doctrineRoleId: "hero_serif_alternate",
    enabled: false,
    notes: [
      "Soft alternate hero serif benchmark.",
      "Enable after dropping the licensed font files into public/fonts/house/louize/."
    ],
    sources: [
      {
        path: "fonts/house/louize/Louize-Regular.otf",
        format: "otf",
        weight: 400,
        style: "normal"
      },
      {
        path: "fonts/house/louize/Louize-Italic.otf",
        format: "otf",
        weight: 400,
        style: "italic"
      }
    ]
  },
  {
    id: "ivar-script",
    candidateId: "ivar-script",
    paletteId: "ivar-script-house",
    family: "Ivar Script",
    doctrineRoleId: "script_accent_rare",
    enabled: false,
    notes: [
      "Rare script accent benchmark.",
      "Enable after dropping the licensed font files into public/fonts/house/ivar-script/."
    ],
    sources: [
      {
        path: "fonts/house/ivar-script/IvarScript-Regular.otf",
        format: "otf",
        weight: 400,
        style: "normal"
      }
    ]
  },
  {
    id: "sokoli",
    candidateId: "sokoli",
    paletteId: "sokoli-house",
    family: "Sokoli",
    doctrineRoleId: "display_sans_pressure_release",
    enabled: false,
    notes: [
      "Pressure-release display face.",
      "Enable after dropping the licensed font files into public/fonts/house/sokoli/."
    ],
    sources: [
      {
        path: "fonts/house/sokoli/Sokoli-Regular.otf",
        format: "otf",
        weight: 400,
        style: "normal"
      }
    ]
  }
];

const houseFontDefinitionById = new Map(
  HOUSE_FONT_DEFINITIONS.map((definition) => [definition.id, definition] as const)
);

export const getHouseFontDefinition = (id: HouseFontDefinition["id"]): HouseFontDefinition | null => {
  return houseFontDefinitionById.get(id) ?? null;
};

export const getHouseFontDefinitionForCandidate = (candidateId: string): HouseFontDefinition | null => {
  return HOUSE_FONT_DEFINITIONS.find((definition) => definition.candidateId === candidateId) ?? null;
};

export const getActiveHouseFontDefinitions = (): HouseFontDefinition[] => {
  return HOUSE_FONT_DEFINITIONS.filter((definition) => definition.enabled && definition.sources.length > 0);
};

export const getActiveHouseFontPaletteIds = (): HouseFontPaletteId[] => {
  return getActiveHouseFontDefinitions().map((definition) => definition.paletteId);
};

export const validateHouseFontRegistry = ({
  fileExists
}: {
  fileExists?: (path: string) => boolean;
} = {}): HouseFontRegistryValidation => {
  const expectedFontPaths = HOUSE_FONT_DEFINITIONS.flatMap((definition) =>
    definition.sources.map((source) => source.path)
  );
  const enabledDefinitions = getActiveHouseFontDefinitions();
  const enabledHouseFontPaths = enabledDefinitions.flatMap((definition) =>
    definition.sources.map((source) => source.path)
  );
  const missingExpectedFontPaths = fileExists
    ? expectedFontPaths.filter((fontPath) => !fileExists(fontPath))
    : [];
  const missingEnabledFontPaths = fileExists
    ? enabledHouseFontPaths.filter((fontPath) => !fileExists(fontPath))
    : [];

  return {
    expectedFontFamilies: HOUSE_FONT_DEFINITIONS.map((definition) => definition.family),
    expectedFontPaths,
    enabledHouseFontCount: enabledDefinitions.length,
    enabledHouseFontFamilies: enabledDefinitions.map((definition) => definition.family),
    enabledHouseFontPaths,
    missingExpectedFontPaths,
    missingEnabledFontPaths,
    houseFontsAvailable: enabledDefinitions.length > 0 && missingEnabledFontPaths.length === 0
  };
};
