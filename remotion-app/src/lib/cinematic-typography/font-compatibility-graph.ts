import type {FontCategory} from "./font-system";
import {getRuntimePaletteIdForTypographyCandidate} from "./font-runtime-registry";
import {
  TYPOGRAPHY_DOCTRINE_V1,
  getTypographyBenchmarkForRole,
  getTypographyCandidatesForRole,
  type TypographyFontCandidate,
  type TypographyRoleSlotId
} from "./typography-doctrine";

export type FontCompatibilityRelation = "supports" | "fallback" | "contrast" | "redundant" | "avoid";

export type FontCompatibilityNode = {
  id: string;
  fontName: string;
  source: TypographyFontCandidate["source"];
  categories: FontCategory[];
  eligibleRoles: TypographyRoleSlotId[];
  benchmarkRoles: TypographyRoleSlotId[];
  premiumSignal: number;
  restraintSignal: number;
  motionTolerance: TypographyFontCandidate["motionTolerance"];
  notes: string[];
};

export type FontCompatibilityEdge = {
  id: string;
  from: string;
  to: string;
  relation: FontCompatibilityRelation;
  score: number;
  rationale: string;
};

export type RoleCompatibilityProfile = {
  roleId: TypographyRoleSlotId;
  doctrineBenchmarkNodeId: string | null;
  runtimeBenchmarkNodeId: string | null;
  candidateNodeIds: string[];
  approvedNodeIds: string[];
  rejectedNodeIds: string[];
};

export const FONT_COMPATIBILITY_NODES: FontCompatibilityNode[] = TYPOGRAPHY_DOCTRINE_V1.candidates.map((candidate) => ({
  id: candidate.id,
  fontName: candidate.name,
  source: candidate.source,
  categories: candidate.categories,
  eligibleRoles: candidate.eligibleRoles,
  benchmarkRoles: candidate.benchmarkForRole ? [candidate.benchmarkForRole] : [],
  premiumSignal: candidate.premiumSignal,
  restraintSignal: candidate.restraintSignal,
  motionTolerance: candidate.motionTolerance,
  notes: candidate.notes
}));

export const DOCTRINE_FONT_COMPATIBILITY_EDGES: FontCompatibilityEdge[] = [
  {
    id: "jugendreisen-dm-sans-supports",
    from: "jugendreisen",
    to: "dm-sans",
    relation: "supports",
    score: 0.96,
    rationale: "This is the current north-star pairing: prestige hero serif anchored by clean neutral utility support."
  },
  {
    id: "jugendreisen-ivar-script-contrast",
    from: "jugendreisen",
    to: "ivar-script",
    relation: "contrast",
    score: 0.78,
    rationale: "Promising luxury contrast, but only for very rare accent insertions."
  },
  {
    id: "jugendreisen-bs-acapulko-avoid",
    from: "jugendreisen",
    to: "bs-acapulko",
    relation: "avoid",
    score: 0.34,
    rationale: "Too much ornamental glamour too quickly; likely to turn into premium costume instead of premium structure."
  },
  {
    id: "jugendreisen-louize-fallback",
    from: "jugendreisen",
    to: "louize",
    relation: "fallback",
    score: 0.81,
    rationale: "Louize can act as a softer alternate hero serif if it stays visibly distinct from the benchmark."
  },
  {
    id: "jugendreisen-noto-display-fallback",
    from: "jugendreisen",
    to: "noto-serif-display",
    relation: "fallback",
    score: 0.73,
    rationale: "Noto Serif Display can serve monumental statement duty, but it must not flatten into a generic substitute."
  },
  {
    id: "jugendreisen-playfair-redundant",
    from: "jugendreisen",
    to: "playfair-display",
    relation: "redundant",
    score: 0.48,
    rationale: "Playfair is capable, but risks occupying too similar a prestige niche without adding enough identity."
  },
  {
    id: "fraunces-dm-sans-supports",
    from: "fraunces",
    to: "dm-sans",
    relation: "supports",
    score: 0.89,
    rationale: "Excellent editorial support pairing with warmth and readable utility balance."
  },
  {
    id: "fraunces-crimson-pro-fallback",
    from: "fraunces",
    to: "crimson-pro",
    relation: "fallback",
    score: 0.87,
    rationale: "Crimson Pro is the clearest documentary understudy when Fraunces would feel too warm, too luxe, or too voiced."
  },
  {
    id: "fraunces-instrument-serif-fallback",
    from: "fraunces",
    to: "instrument-serif",
    relation: "fallback",
    score: 0.74,
    rationale: "Instrument Serif can soften support moments, but it belongs in a hush-luxury support lane rather than competing for hero authority."
  },
  {
    id: "fraunces-cormorant-garamond-redundant",
    from: "fraunces",
    to: "cormorant-garamond",
    relation: "redundant",
    score: 0.41,
    rationale: "Cormorant no longer earns a primary support slot once Fraunces and Crimson cover premium warmth and documentary restraint."
  },
  {
    id: "crimson-pro-dm-sans-supports",
    from: "crimson-pro",
    to: "dm-sans",
    relation: "supports",
    score: 0.85,
    rationale: "Strong documentary and explanatory support relationship."
  },
  {
    id: "sokoli-dm-sans-contrast",
    from: "sokoli",
    to: "dm-sans",
    relation: "contrast",
    score: 0.67,
    rationale: "Could work as a pressure-release directive contrast, but should stay in a tightly bounded lane."
  },
  {
    id: "anton-jugendreisen-avoid",
    from: "anton",
    to: "jugendreisen",
    relation: "avoid",
    score: 0.29,
    rationale: "This pairing exposes the old habit of swapping authority for blunt force."
  },
  {
    id: "bebas-neue-jugendreisen-avoid",
    from: "bebas-neue",
    to: "jugendreisen",
    relation: "avoid",
    score: 0.18,
    rationale: "Directly conflicts with the new serif-led doctrine if treated as an equal hero language."
  }
];

const isRuntimeSelectableNodeId = (candidateId: string): boolean => {
  return Boolean(getRuntimePaletteIdForTypographyCandidate(candidateId));
};

const RUNTIME_CURATED_FONT_COMPATIBILITY_EDGES: FontCompatibilityEdge[] = [
  {
    id: "noto-serif-display-dm-sans-supports",
    from: "noto-serif-display",
    to: "dm-sans",
    relation: "supports",
    score: 0.84,
    rationale: "When Noto Serif Display carries the monument lane, DM Sans keeps support information precise and stable."
  },
  {
    id: "noto-serif-display-fraunces-fallback",
    from: "noto-serif-display",
    to: "fraunces",
    relation: "fallback",
    score: 0.77,
    rationale: "Fraunces gives Noto Serif Display a warmer editorial support partner without competing for the same hero silhouette."
  },
  {
    id: "playfair-display-dm-sans-supports",
    from: "playfair-display",
    to: "dm-sans",
    relation: "supports",
    score: 0.79,
    rationale: "Playfair Display can still ride with DM Sans when the scene wants lighter prestige and clear utility text."
  },
  {
    id: "instrument-serif-dm-sans-supports",
    from: "instrument-serif",
    to: "dm-sans",
    relation: "supports",
    score: 0.76,
    rationale: "Instrument Serif remains a hush-luxury support voice when DM Sans handles clarity and pace."
  }
];

export const FONT_COMPATIBILITY_EDGES: FontCompatibilityEdge[] = [
  ...DOCTRINE_FONT_COMPATIBILITY_EDGES.filter((edge) => isRuntimeSelectableNodeId(edge.from) && isRuntimeSelectableNodeId(edge.to)),
  ...RUNTIME_CURATED_FONT_COMPATIBILITY_EDGES
];

const candidateStageRank = (candidate: TypographyFontCandidate): number => {
  if (candidate.stage === "benchmark") return 4;
  if (candidate.stage === "approved") return 3;
  if (candidate.stage === "candidate") return 2;
  if (candidate.stage === "legacy") return 1;
  return 0;
};

const getOperationalBenchmarkForRole = (roleId: TypographyRoleSlotId): TypographyFontCandidate | null => {
  const doctrineBenchmark = getTypographyBenchmarkForRole(roleId);
  if (doctrineBenchmark && isRuntimeSelectableNodeId(doctrineBenchmark.id)) {
    return doctrineBenchmark;
  }

  const runtimeCandidates = getTypographyCandidatesForRole(roleId)
    .filter((candidate) => isRuntimeSelectableNodeId(candidate.id) && candidate.stage !== "rejected" && candidate.stage !== "legacy")
    .sort((left, right) => {
      const stageDelta = candidateStageRank(right) - candidateStageRank(left);
      if (stageDelta !== 0) {
        return stageDelta;
      }
      const rightScore = right.premiumSignal * 0.65 + right.restraintSignal * 0.35;
      const leftScore = left.premiumSignal * 0.65 + left.restraintSignal * 0.35;
      return rightScore - leftScore || left.name.localeCompare(right.name);
    });

  return runtimeCandidates[0] ?? null;
};

export const ROLE_COMPATIBILITY_PROFILES: RoleCompatibilityProfile[] = TYPOGRAPHY_DOCTRINE_V1.roleSlots.map((role) => {
  const candidates = getTypographyCandidatesForRole(role.id);
  const doctrineBenchmark = getTypographyBenchmarkForRole(role.id);
  const runtimeBenchmark = getOperationalBenchmarkForRole(role.id);
  return {
    roleId: role.id,
    doctrineBenchmarkNodeId: doctrineBenchmark?.id ?? null,
    runtimeBenchmarkNodeId: runtimeBenchmark?.id ?? null,
    candidateNodeIds: candidates.filter((candidate) => candidate.stage === "candidate").map((candidate) => candidate.id),
    approvedNodeIds: candidates.filter((candidate) => candidate.stage === "approved").map((candidate) => candidate.id),
    rejectedNodeIds: candidates.filter((candidate) => candidate.stage === "rejected" || candidate.stage === "legacy").map((candidate) => candidate.id)
  };
});

export const rankTypographyCandidatesForRole = (roleId: TypographyRoleSlotId): FontCompatibilityNode[] => {
  const benchmark = getOperationalBenchmarkForRole(roleId);
  const benchmarkEdges = benchmark
    ? FONT_COMPATIBILITY_EDGES.filter((edge) => edge.from === benchmark.id || edge.to === benchmark.id)
    : [];

  return FONT_COMPATIBILITY_NODES
    .filter((node) => node.eligibleRoles.includes(roleId))
    .sort((left, right) => {
      const leftEdge = benchmarkEdges.find((edge) => edge.to === left.id || edge.from === left.id);
      const rightEdge = benchmarkEdges.find((edge) => edge.to === right.id || edge.from === right.id);
      const leftScore = (leftEdge?.score ?? 0.5) + left.premiumSignal * 0.35 + left.restraintSignal * 0.2;
      const rightScore = (rightEdge?.score ?? 0.5) + right.premiumSignal * 0.35 + right.restraintSignal * 0.2;
      return rightScore - leftScore || left.fontName.localeCompare(right.fontName);
    });
};
