import type {
  MotionAssetFamily,
  MotionAssetManifest,
  MotionAssetSafeArea,
  MotionMoodTag,
  MotionTier
} from "../types";
import {enrichMotionAssetManifest} from "./motion-asset-taxonomy";

const asset = <T extends MotionAssetManifest>(manifest: T): T & MotionAssetManifest => {
  return enrichMotionAssetManifest(manifest);
};

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "by",
  "for",
  "from",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "their",
  "these",
  "those",
  "to",
  "was",
  "were",
  "with",
  "you",
  "your"
]);

const normalizeSearchText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const singularizeSearchToken = (value: string): string => {
  if (value.length > 4 && /(ches|shes|xes|zes|ses)$/i.test(value)) {
    return value.slice(0, -2);
  }
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
};

const buildTextTerms = (value: string): string[] => {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(" ")
    .map(singularizeSearchToken)
    .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token));

  if (tokens.length === 0) {
    return [];
  }

  const terms = new Set<string>();
  terms.add(tokens.join(" "));
  tokens.forEach((token, index) => {
    terms.add(token);
    if (index < tokens.length - 1) {
      terms.add(`${token} ${tokens[index + 1]}`);
    }
  });

  return [...terms];
};

const getManifestSearchTerms = (manifest: MotionAssetManifest): string[] => {
  const values = [
    ...(manifest.searchTerms ?? []),
    manifest.canonicalLabel ?? "",
    manifest.id,
    manifest.family,
    manifest.tier,
    ...(manifest.themeTags ?? []),
    manifest.sourceId ?? ""
  ];

  const terms = new Set<string>();
  values.forEach((value) => {
    buildTextTerms(String(value)).forEach((term) => terms.add(term));
  });
  return [...terms];
};

export const motionAssetLibrary: MotionAssetManifest[] = [
  asset({
    id: "minimal-frame-lines",
    family: "frame",
    tier: "minimal",
    src: "motion-assets/minimal-frame-lines.svg",
    alphaMode: "straight",
    placementZone: "edge-frame",
    durationPolicy: "scene-span",
    themeTags: ["neutral", "calm", "authority"],
    safeArea: "avoid-caption-region",
    loopable: true,
    blendMode: "screen",
    opacity: 0.72
  }),
  asset({
    id: "minimal-light-sweep",
    family: "light-sweep",
    tier: "minimal",
    src: "motion-assets/minimal-light-sweep.svg",
    alphaMode: "straight",
    placementZone: "lower-third",
    durationPolicy: "entry-only",
    themeTags: ["warm", "calm", "authority"],
    safeArea: "avoid-caption-region",
    loopable: false,
    blendMode: "screen",
    opacity: 0.56
  }),
  asset({
    id: "editorial-side-panels",
    family: "panel",
    tier: "editorial",
    src: "motion-assets/editorial-side-panels.svg",
    alphaMode: "straight",
    placementZone: "side-panels",
    durationPolicy: "scene-span",
    themeTags: ["cool", "authority", "kinetic"],
    safeArea: "avoid-caption-region",
    loopable: true,
    blendMode: "screen",
    opacity: 0.7
  }),
  asset({
    id: "editorial-grid-cut",
    family: "grid",
    tier: "editorial",
    src: "motion-assets/editorial-grid-cut.svg",
    alphaMode: "straight",
    placementZone: "background-depth",
    durationPolicy: "ping-pong",
    themeTags: ["cool", "kinetic", "neutral"],
    safeArea: "avoid-caption-region",
    loopable: true,
    blendMode: "soft-light",
    opacity: 0.58
  }),
  asset({
    id: "premium-halo-field",
    family: "flare",
    tier: "premium",
    src: "motion-assets/premium-halo-field.svg",
    alphaMode: "straight",
    placementZone: "background-depth",
    durationPolicy: "scene-span",
    themeTags: ["warm", "heroic", "authority"],
    safeArea: "avoid-caption-region",
    loopable: true,
    blendMode: "screen",
    opacity: 0.6
  }),
  asset({
    id: "premium-lens-beam",
    assetRole: "showcase",
    family: "texture",
    tier: "premium",
    src: "motion-assets/premium-lens-beam.svg",
    alphaMode: "straight",
    placementZone: "full-frame",
    durationPolicy: "entry-only",
    themeTags: ["warm", "kinetic", "heroic"],
    safeArea: "avoid-caption-region",
    loopable: false,
    blendMode: "screen",
    opacity: 0.14
  }),
  asset({
    id: "hero-depth-mask",
    family: "depth-mask",
    tier: "hero",
    src: "motion-assets/hero-depth-mask.svg",
    alphaMode: "luma-mask",
    placementZone: "background-depth",
    durationPolicy: "scene-span",
    themeTags: ["heroic", "cool", "authority"],
    safeArea: "avoid-caption-region",
    loopable: true,
    blendMode: "multiply",
    opacity: 0.5
  }),
  asset({
    id: "hero-foreground-arc",
    family: "foreground-element",
    tier: "hero",
    src: "motion-assets/hero-foreground-arc.svg",
    alphaMode: "straight",
    placementZone: "foreground-cross",
    durationPolicy: "entry-only",
    themeTags: ["heroic", "warm", "kinetic"],
    safeArea: "edge-safe",
    loopable: false,
    blendMode: "screen",
    opacity: 0.8
  })
];

const tierOrder: MotionTier[] = ["minimal", "editorial", "premium", "hero"];

export const getAssetFamiliesForTier = (tier: MotionTier): MotionAssetFamily[] => {
  if (tier === "minimal") {
    return ["frame", "light-sweep"];
  }
  if (tier === "editorial") {
    return ["frame", "panel", "grid", "light-sweep"];
  }
  if (tier === "premium") {
    return ["frame", "panel", "grid", "flare", "texture", "light-sweep"];
  }
  return ["frame", "panel", "grid", "flare", "texture", "depth-mask", "foreground-element"];
};

export const LONGFORM_SAFE_MOTION_ASSET_FAMILIES: MotionAssetFamily[] = [
  "frame",
  "panel",
  "grid",
  "flare",
  "light-sweep",
  "depth-mask"
];

const scoreMoodCoverage = (themeTags: MotionMoodTag[], desired: MotionMoodTag[]): number => {
  return desired.reduce((score, tag) => score + (themeTags.includes(tag) ? 6 : 0), 0);
};

const scoreQueryCoverage = (manifest: MotionAssetManifest, queryText?: string): number => {
  if (!queryText) {
    return 0;
  }

  const queryTerms = buildTextTerms(queryText);
  if (queryTerms.length === 0) {
    return 0;
  }

  const searchTerms = new Set(getManifestSearchTerms(manifest));
  let score = 0;

  queryTerms.forEach((term) => {
    if (searchTerms.has(term)) {
      score += term.includes(" ") ? 8 : 3;
    }
  });

  return score;
};

export const resolveMotionAssets = ({
  tier,
  moodTags,
  safeArea,
  families,
  library,
  queryText
}: {
  tier: MotionTier;
  moodTags: MotionMoodTag[];
  safeArea: MotionAssetSafeArea;
  families?: MotionAssetFamily[];
  library?: MotionAssetManifest[];
  queryText?: string;
}): MotionAssetManifest[] => {
  const requestedFamilies = families ?? getAssetFamiliesForTier(tier);
  const maxTierIndex = tierOrder.indexOf(tier);
  const catalog = library ?? motionAssetLibrary;

  return requestedFamilies
    .map((family) => {
      const candidates = catalog
        .filter((manifest) => (manifest.assetRole ?? "background") !== "showcase")
        .filter((manifest) => manifest.family === family)
        .filter((manifest) => tierOrder.indexOf(manifest.tier) <= maxTierIndex)
        .map((manifest) => ({
          manifest,
          score:
            scoreMoodCoverage(manifest.themeTags, moodTags) +
            scoreQueryCoverage(manifest, queryText) +
            (manifest.safeArea === safeArea ? 8 : 0) +
            (manifest.tier === tier ? 10 : 0)
        }))
        .sort((a, b) => b.score - a.score);

      return candidates[0]?.manifest ?? null;
    })
    .filter((manifest): manifest is MotionAssetManifest => manifest !== null);
};
