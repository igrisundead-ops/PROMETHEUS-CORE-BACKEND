import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  FONT_COMPATIBILITY_EDGES,
  type FontCompatibilityEdge
} from "../src/lib/cinematic-typography/font-compatibility-graph";
import {
  getRuntimePaletteIdForTypographyCandidate,
  isRuntimeSelectableTypographyCandidate
} from "../src/lib/cinematic-typography/font-runtime-registry";
import {TYPOGRAPHY_ROLE_FALLBACK_ORDER} from "../src/lib/cinematic-typography/runtime-font-selector";
import {
  TYPOGRAPHY_DOCTRINE_V1,
  type TypographyFontCandidate,
  type TypographyRoleSlotId
} from "../src/lib/cinematic-typography/typography-doctrine";

type GraphFontNode = {
  id: string;
  name: string;
  source: TypographyFontCandidate["source"];
  stage: TypographyFontCandidate["stage"];
  categories: TypographyFontCandidate["categories"];
  doctrineRoles: TypographyRoleSlotId[];
  benchmarkForRole: TypographyRoleSlotId | null;
  runtimeSelectable: boolean;
  runtimeStatus: "active-runtime" | "legacy-runtime" | "doctrine-only";
  runtimePaletteId: string | null;
  doctrineOnly: boolean;
  premiumSignal: number;
  restraintSignal: number;
  motionTolerance: TypographyFontCandidate["motionTolerance"];
  intensityFit: TypographyFontCandidate["intensityFit"];
  notes: string[];
};

type GraphRoleNode = {
  id: TypographyRoleSlotId;
  label: string;
  targetCount: number;
  benchmarkCandidateId: string | null;
  benchmarkRuntimeSelectable: boolean;
  activeRuntimeCandidateIds: string[];
  legacyRuntimeCandidateIds: string[];
  doctrineOnlyCandidateIds: string[];
  fallbackRoleIds: TypographyRoleSlotId[];
  laneStatus: "runtime-ready" | "partial-runtime" | "doctrine-only";
  weakReasons: string[];
};

type GraphExport = {
  generatedAt: string;
  phases: {
    phase1: string;
    phase2: string;
    phase3: string;
    phase4: string;
  };
  fonts: GraphFontNode[];
  roles: GraphRoleNode[];
  compatibilityEdges: FontCompatibilityEdge[];
  fallbackEdges: Array<{
    id: string;
    fromRoleId: TypographyRoleSlotId;
    toRoleId: TypographyRoleSlotId;
  }>;
  strongestPairings: Array<{
    id: string;
    from: string;
    to: string;
    relation: string;
    score: number;
    rationale: string;
  }>;
  weakOrMissingLanes: GraphRoleNode[];
  doctrineOnlyFonts: GraphFontNode[];
  runtimeMissingFonts: GraphFontNode[];
  unresolvedPlaceholders: GraphFontNode[];
  recommendedNextLoads: Array<{
    candidateId: string;
    name: string;
    reason: string;
    targetRoleId: TypographyRoleSlotId;
  }>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const outputDirectory = path.resolve(repoRoot, "docs/generated");
const outputJsonPath = path.resolve(outputDirectory, "typography-font-graph.json");
const outputMarkdownPath = path.resolve(outputDirectory, "typography-font-graph-report.md");
const outputMermaidPath = path.resolve(outputDirectory, "typography-font-graph.mmd");

const candidateById = new Map(
  TYPOGRAPHY_DOCTRINE_V1.candidates.map((candidate) => [candidate.id, candidate] as const)
);

const buildFontNodes = (): GraphFontNode[] => {
  return TYPOGRAPHY_DOCTRINE_V1.candidates.map((candidate) => {
    const runtimePaletteId = getRuntimePaletteIdForTypographyCandidate(candidate.id);
    const runtimeSelectable = isRuntimeSelectableTypographyCandidate(candidate.id);
    const runtimeStatus =
      runtimeSelectable && candidate.stage !== "legacy"
        ? "active-runtime"
        : runtimeSelectable
          ? "legacy-runtime"
          : "doctrine-only";

    return {
      id: candidate.id,
      name: candidate.name,
      source: candidate.source,
      stage: candidate.stage,
      categories: candidate.categories,
      doctrineRoles: candidate.eligibleRoles,
      benchmarkForRole: candidate.benchmarkForRole ?? null,
      runtimeSelectable,
      runtimeStatus,
      runtimePaletteId,
      doctrineOnly: !runtimeSelectable,
      premiumSignal: candidate.premiumSignal,
      restraintSignal: candidate.restraintSignal,
      motionTolerance: candidate.motionTolerance,
      intensityFit: candidate.intensityFit,
      notes: candidate.notes
    };
  });
};

const buildRoleNodes = (fontNodes: GraphFontNode[]): GraphRoleNode[] => {
  return TYPOGRAPHY_DOCTRINE_V1.roleSlots.map((role) => {
    const roleFonts = fontNodes.filter((font) => font.doctrineRoles.includes(role.id));
    const activeRuntimeCandidateIds = roleFonts
      .filter((font) => font.runtimeStatus === "active-runtime")
      .map((font) => font.id);
    const legacyRuntimeCandidateIds = roleFonts
      .filter((font) => font.runtimeStatus === "legacy-runtime")
      .map((font) => font.id);
    const doctrineOnlyCandidateIds = roleFonts
      .filter((font) => font.runtimeStatus === "doctrine-only")
      .map((font) => font.id);
    const benchmark = roleFonts.find((font) => font.benchmarkForRole === role.id) ?? null;
    const weakReasons: string[] = [];

    if (activeRuntimeCandidateIds.length === 0) {
      weakReasons.push("no-active-runtime-font");
    }
    if (benchmark && !benchmark.runtimeSelectable) {
      weakReasons.push("benchmark-not-runtime-selectable");
    }
    if (legacyRuntimeCandidateIds.length > 0 && activeRuntimeCandidateIds.length === 0) {
      weakReasons.push("legacy-runtime-only");
    }

    let laneStatus: GraphRoleNode["laneStatus"] = "runtime-ready";
    if (activeRuntimeCandidateIds.length === 0) {
      laneStatus = legacyRuntimeCandidateIds.length > 0 ? "partial-runtime" : "doctrine-only";
    } else if (benchmark && !benchmark.runtimeSelectable) {
      laneStatus = "partial-runtime";
    }

    return {
      id: role.id,
      label: role.label,
      targetCount: role.targetCount,
      benchmarkCandidateId: benchmark?.id ?? null,
      benchmarkRuntimeSelectable: Boolean(benchmark?.runtimeSelectable),
      activeRuntimeCandidateIds,
      legacyRuntimeCandidateIds,
      doctrineOnlyCandidateIds,
      fallbackRoleIds: TYPOGRAPHY_ROLE_FALLBACK_ORDER[role.id],
      laneStatus,
      weakReasons
    };
  });
};

const strongestPairings = (edges: FontCompatibilityEdge[]) => {
  return edges
    .filter((edge) => edge.relation === "supports" || edge.relation === "fallback" || edge.relation === "contrast")
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      score: edge.score,
      rationale: edge.rationale
    }));
};

const buildFallbackEdges = () => {
  return (Object.entries(TYPOGRAPHY_ROLE_FALLBACK_ORDER) as Array<[TypographyRoleSlotId, TypographyRoleSlotId[]]>)
    .flatMap(([fromRoleId, fallbackRoleIds]) =>
      fallbackRoleIds.map((toRoleId) => ({
        id: `${fromRoleId}-fallback-${toRoleId}`,
        fromRoleId,
        toRoleId
      }))
    );
};

const buildRecommendedNextLoads = (roles: GraphRoleNode[]): GraphExport["recommendedNextLoads"] => {
  const recommendations: GraphExport["recommendedNextLoads"] = [];

  for (const role of roles) {
    if (!role.benchmarkCandidateId || role.benchmarkRuntimeSelectable) {
      continue;
    }

    const benchmark = candidateById.get(role.benchmarkCandidateId);
    if (!benchmark) {
      continue;
    }

    recommendations.push({
      candidateId: benchmark.id,
      name: benchmark.name,
      reason: `Benchmark for ${role.id} exists only in doctrine right now.`,
      targetRoleId: role.id
    });
  }

  const hasPressureReleaseRuntime = roles.find((role) => role.id === "display_sans_pressure_release")?.activeRuntimeCandidateIds.length ?? 0;
  if (hasPressureReleaseRuntime === 0) {
    const sokoli = candidateById.get("sokoli");
    if (sokoli) {
      recommendations.push({
        candidateId: sokoli.id,
        name: sokoli.name,
        reason: "Pressure-release lane has no active runtime house face.",
        targetRoleId: "display_sans_pressure_release"
      });
    }
  }

  return recommendations;
};

const buildExport = (): GraphExport => {
  const fonts = buildFontNodes();
  const roles = buildRoleNodes(fonts);
  const compatibilityEdges = FONT_COMPATIBILITY_EDGES;
  const fallbackEdges = buildFallbackEdges();
  const weakOrMissingLanes = roles.filter((role) => role.laneStatus !== "runtime-ready");
  const doctrineOnlyFonts = fonts.filter((font) => font.runtimeStatus === "doctrine-only");
  const runtimeMissingFonts = fonts.filter((font) => !font.runtimeSelectable && font.stage !== "legacy" && font.stage !== "rejected");
  const unresolvedPlaceholders = doctrineOnlyFonts.filter((font) => font.source === "reference-pool");

  return {
    generatedAt: new Date().toISOString(),
    phases: {
      phase1: "done",
      phase2: "started",
      phase3: "not-started",
      phase4: "not-started"
    },
    fonts,
    roles,
    compatibilityEdges,
    fallbackEdges,
    strongestPairings: strongestPairings(compatibilityEdges),
    weakOrMissingLanes,
    doctrineOnlyFonts,
    runtimeMissingFonts,
    unresolvedPlaceholders,
    recommendedNextLoads: buildRecommendedNextLoads(roles)
  };
};

const renderFontSummaryLine = (font: GraphFontNode): string => {
  const roles = font.doctrineRoles.join(", ");
  const runtime = font.runtimeSelectable
    ? `${font.runtimeStatus} via ${font.runtimePaletteId}`
    : "doctrine-only";
  return `- \`${font.name}\`: roles=${roles}; stage=${font.stage}; runtime=${runtime}`;
};

const renderRoleSummaryLine = (role: GraphRoleNode): string => {
  const benchmark = role.benchmarkCandidateId ?? "none";
  const active = role.activeRuntimeCandidateIds.join(", ") || "none";
  const doctrineOnly = role.doctrineOnlyCandidateIds.join(", ") || "none";
  return `- \`${role.id}\`: status=${role.laneStatus}; benchmark=${benchmark}; active=${active}; doctrine-only=${doctrineOnly}`;
};

const renderPairingLine = (pairing: GraphExport["strongestPairings"][number]): string => {
  const fromName = candidateById.get(pairing.from)?.name ?? pairing.from;
  const toName = candidateById.get(pairing.to)?.name ?? pairing.to;
  return `- \`${fromName}\` -> \`${toName}\` (${pairing.relation}, ${pairing.score.toFixed(2)}): ${pairing.rationale}`;
};

const renderMarkdownReport = (graph: GraphExport): string => {
  const missingRuntimeFonts = graph.runtimeMissingFonts.map((font) => `\`${font.name}\``).join(", ") || "none";
  const doctrineOnlyLanes = graph.weakOrMissingLanes
    .filter((role) => role.laneStatus === "doctrine-only")
    .map((role) => `\`${role.id}\``)
    .join(", ") || "none";
  const partialLanes = graph.weakOrMissingLanes
    .filter((role) => role.laneStatus === "partial-runtime")
    .map((role) => `\`${role.id}\``)
    .join(", ") || "none";
  const loadNext = graph.recommendedNextLoads
    .map((entry) => `- \`${entry.name}\` for \`${entry.targetRoleId}\`: ${entry.reason}`)
    .join("\n");

  return [
    "# Typography Font Graph Report",
    "",
    `Generated: ${graph.generatedAt}`,
    "",
    "## Phase Status",
    "",
    `- Phase 1: ${graph.phases.phase1}`,
    `- Phase 2: ${graph.phases.phase2}`,
    `- Phase 3: ${graph.phases.phase3}`,
    `- Phase 4: ${graph.phases.phase4}`,
    "",
    "## Lane Audit",
    "",
    `- Missing runtime fonts: ${missingRuntimeFonts}`,
    `- Fully doctrine-only lanes: ${doctrineOnlyLanes}`,
    `- Partial-runtime lanes: ${partialLanes}`,
    "",
    "## Role Nodes",
    "",
    ...graph.roles.map(renderRoleSummaryLine),
    "",
    "## Font Nodes",
    "",
    ...graph.fonts.map(renderFontSummaryLine),
    "",
    "## Strongest Pairings",
    "",
    ...graph.strongestPairings.map(renderPairingLine),
    "",
    "## Unresolved Placeholders",
    "",
    ...graph.unresolvedPlaceholders.map((font) => `- \`${font.name}\` for ${font.doctrineRoles.join(", ")}`),
    "",
    "## What Should Be Loaded Next",
    "",
    loadNext || "- none",
    ""
  ].join("\n");
};

const toMermaidNodeId = (id: string): string => id.replace(/[^a-zA-Z0-9_]/g, "_");

const renderMermaidNode = (font: GraphFontNode): string => {
  const label = `${font.name}\\n${font.runtimeStatus}`;
  return `  ${toMermaidNodeId(font.id)}["${label}"]`;
};

const renderMermaidRoleNode = (roleId: TypographyRoleSlotId): string => {
  return `  ${toMermaidNodeId(`role_${roleId}`)}["${roleId}"]`;
};

const renderMermaidEdge = (edge: FontCompatibilityEdge): string => {
  const fromId = toMermaidNodeId(edge.from);
  const toId = toMermaidNodeId(edge.to);
  if (edge.relation === "avoid" || edge.relation === "redundant") {
    return `  ${fromId} -. ${edge.relation} .-> ${toId}`;
  }
  return `  ${fromId} -->|${edge.relation}| ${toId}`;
};

const renderMermaid = (graph: GraphExport): string => {
  const byIds = new Set<string>();
  const lines: string[] = ["graph TD"];
  const groups: Array<{title: string; roleIds: TypographyRoleSlotId[]; includeIds?: string[]}> = [
    {title: "Neutral / Support", roleIds: ["neutral_sans_core"]},
    {title: "Hero Serif / Alternate", roleIds: ["hero_serif_primary", "hero_serif_alternate"]},
    {title: "Editorial Serif", roleIds: ["editorial_serif_support"]},
    {title: "Script / Accent", roleIds: ["script_accent_rare"]},
    {title: "Pressure Release", roleIds: ["display_sans_pressure_release"], includeIds: ["anton", "bebas-neue"]},
    {title: "Experimental / Display", roleIds: [], includeIds: ["sokoli"]}
  ];

  for (const group of groups) {
    lines.push(`  subgraph ${toMermaidNodeId(group.title)}["${group.title}"]`);
    for (const roleId of group.roleIds) {
      lines.push(renderMermaidRoleNode(roleId));
      byIds.add(`role_${roleId}`);
      const roleFonts = graph.fonts.filter((font) => font.doctrineRoles.includes(roleId));
      for (const font of roleFonts) {
        if (byIds.has(font.id)) {
          continue;
        }
        lines.push(renderMermaidNode(font));
        byIds.add(font.id);
      }
    }
    for (const fontId of group.includeIds ?? []) {
      const font = graph.fonts.find((entry) => entry.id === fontId);
      if (font && !byIds.has(font.id)) {
        lines.push(renderMermaidNode(font));
        byIds.add(font.id);
      }
    }
    lines.push("  end");
  }

  for (const font of graph.fonts) {
    for (const roleId of font.doctrineRoles) {
      lines.push(`  ${toMermaidNodeId(`role_${roleId}`)} --> ${toMermaidNodeId(font.id)}`);
    }
  }

  for (const edge of graph.compatibilityEdges) {
    lines.push(renderMermaidEdge(edge));
  }

  return lines.join("\n");
};

const main = async (): Promise<void> => {
  const graph = buildExport();
  const markdown = renderMarkdownReport(graph);
  const mermaid = renderMermaid(graph);

  await mkdir(outputDirectory, {recursive: true});
  await writeFile(outputJsonPath, JSON.stringify(graph, null, 2), "utf8");
  await writeFile(outputMarkdownPath, markdown, "utf8");
  await writeFile(outputMermaidPath, mermaid, "utf8");

  console.log(`Typography graph JSON written to: ${path.relative(repoRoot, outputJsonPath)}`);
  console.log(`Typography graph report written to: ${path.relative(repoRoot, outputMarkdownPath)}`);
  console.log(`Typography graph mermaid written to: ${path.relative(repoRoot, outputMermaidPath)}`);
  console.log(`Font nodes: ${graph.fonts.length}`);
  console.log(`Role nodes: ${graph.roles.length}`);
};

await main();
