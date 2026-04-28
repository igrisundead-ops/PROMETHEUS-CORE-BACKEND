import generatedAnimationPrototypes from "../../data/animation-prototypes.generated.json" with {type: "json"};
import {svgTypographyVariantsV1, type SvgTypographyVariant} from "../stylebooks/svg-typography-v1";
import type {
  AnimationLayeringRule,
  AnimationTriggerType,
  MotionAssetManifest,
  MotionPrimitiveContract
} from "../types";
import {getUnifiedMotionAssetCatalog} from "./motion-asset-registry";
import {
  motionCompositeRegistry,
  motionPrimitiveRegistry
} from "./motion-primitive-registry";
import {
  targetFocusRuntimeHostContract,
  targetFocusZoomEffectContract
} from "./target-focus-registry";
import {
  normalizeAnimationPrototypeCatalog,
  type AnimationPrototypeRecord
} from "./animation-prototype-catalog";

export type AnimationNodeKind =
  | "motion-asset"
  | "svg-variant"
  | "motion-primitive"
  | "motion-composite"
  | "focus-effect"
  | "runtime-host"
  | "selector"
  | "template-family"
  | "prototype";

export type AnimationNodeType = "text" | "svg" | "overlay" | "motion-effect";

export type AnimationGraphEdgeRelation =
  | "alias-of"
  | "can-trigger"
  | "composes"
  | "hosts"
  | "family-of"
  | "routes-to"
  | "supports";

export type AnimationNode = {
  id: string;
  label: string;
  kind: AnimationNodeKind;
  type: AnimationNodeType;
  category: string;
  triggerType: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith: string[];
  layeringRules: AnimationLayeringRule[];
  graphTags: string[];
  aliases: string[];
  sourceRef: string;
  notes: string;
  metadata: Record<string, unknown>;
};

export type AnimationGraphEdge = {
  from: string;
  to: string;
  relation: AnimationGraphEdgeRelation;
  weight: number;
  reason: string;
};

export type AnimationRegistryIssue = {
  severity: "warning" | "error";
  code: string;
  nodeId?: string;
  message: string;
};

export type AnimationRegistrySnapshot = {
  nodes: AnimationNode[];
  edges: AnimationGraphEdge[];
  issues: AnimationRegistryIssue[];
};

type AnimationNodeSeed = Omit<AnimationNode, "compatibleWith" | "graphTags" | "aliases" | "layeringRules"> & {
  compatibleWith?: string[];
  graphTags?: string[];
  aliases?: string[];
  layeringRules?: AnimationLayeringRule[];
};

type NodeReferenceInput = string | AnimationNode;

const normalizeKey = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const titleCase = (value: string): string => {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => (/^[A-Z0-9]{2,}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
};

const makeLayeringRule = (
  id: string,
  channel: AnimationLayeringRule["channel"],
  zIndex: number,
  note?: string
): AnimationLayeringRule => ({
  id,
  channel,
  zIndex,
  note
});

const NODE_KIND_PRIORITY: Record<AnimationNodeKind, number> = {
  "template-family": 0,
  "motion-asset": 10,
  prototype: 15,
  "svg-variant": 20,
  "motion-primitive": 30,
  "motion-composite": 40,
  "focus-effect": 42,
  "runtime-host": 1000,
  selector: 1100
};

const animationPrototypeCatalog = normalizeAnimationPrototypeCatalog(
  generatedAnimationPrototypes as AnimationPrototypeRecord[]
);

const createNode = (seed: AnimationNodeSeed): AnimationNode => {
  const layeringRules = seed.layeringRules && seed.layeringRules.length > 0
    ? seed.layeringRules
    : [makeLayeringRule(`${seed.id}-layer`, "base", 0)];

  return {
    ...seed,
    layeringRules,
    compatibleWith: unique(seed.compatibleWith ?? []),
    graphTags: unique(seed.graphTags ?? [seed.category, seed.type]),
    aliases: unique([seed.id, seed.label, ...(seed.aliases ?? [])])
  };
};

const primitiveNodeId = (id: string): string => `primitive:${id}`;
const compositeNodeId = (id: string): string => `composite:${id}`;
const svgVariantNodeId = (id: string): string => `svg:${id}`;
const assetNodeId = (id: string): string => `asset:${id}`;
const hostNodeId = (id: string): string => `host:${id}`;
const selectorNodeId = (id: string): string => `logic:${id}`;
const templateFamilyNodeId = (id: string): string => `template-family:${id}`;
const prototypeNodeId = (id: string): string => `prototype:${id}`;

const inferPrimitiveType = (contract: MotionPrimitiveContract): AnimationNodeType => {
  return contract.id === "typewriter" || contract.id === "highlight-word" || contract.id === "blur-underline"
    ? "text"
    : "motion-effect";
};

const buildPrimitiveNodes = (): AnimationNode[] => {
  return motionPrimitiveRegistry.map((contract) =>
    createNode({
      id: primitiveNodeId(contract.id),
      label: contract.label ?? titleCase(contract.id),
      kind: "motion-primitive",
      type: inferPrimitiveType(contract),
      category: contract.category ?? "motion-effect",
      triggerType: contract.triggerType ?? "timeline",
      compatibleWith: contract.compatibleWith ?? [],
      layeringRules: contract.layeringRules ?? [makeLayeringRule(`${contract.id}-layer`, "base", 0)],
      graphTags: unique([
        contract.category,
        contract.id,
        ...(contract.graphTags ?? []),
        ...(contract.aliases ?? [])
      ]),
      aliases: unique([contract.id, contract.label, ...(contract.aliases ?? [])]),
      sourceRef: "src/lib/motion-platform/motion-primitive-registry.ts",
      notes: contract.notes,
      metadata: contract
    })
  );
};

const buildCompositeNodes = (): AnimationNode[] => {
  return motionCompositeRegistry.map((composite) =>
    createNode({
      id: compositeNodeId(composite.id),
      label: composite.label,
      kind: "motion-composite",
      type: "motion-effect",
      category: composite.category,
      triggerType: composite.triggerType,
      compatibleWith: composite.compatibleWith,
      layeringRules: composite.layeringRules,
      graphTags: composite.graphTags,
      aliases: composite.aliases,
      sourceRef: "src/lib/motion-platform/motion-primitive-registry.ts",
      notes: composite.notes,
      metadata: composite
    })
  );
};

const buildFocusEffectNodes = (): AnimationNode[] => {
  return [
    createNode({
      id: `focus-effect:${targetFocusZoomEffectContract.id}`,
      label: targetFocusZoomEffectContract.label,
      kind: "focus-effect",
      type: "overlay",
      category: targetFocusZoomEffectContract.category,
      triggerType: targetFocusZoomEffectContract.triggerType,
      compatibleWith: targetFocusZoomEffectContract.compatibleWith,
      layeringRules: targetFocusZoomEffectContract.layeringRules,
      graphTags: targetFocusZoomEffectContract.graphTags,
      aliases: targetFocusZoomEffectContract.aliases,
      sourceRef: "src/lib/motion-platform/target-focus-registry.ts",
      notes: targetFocusZoomEffectContract.notes,
      metadata: targetFocusZoomEffectContract
    })
  ];
};

const isTimelineLike = (value: string): boolean => /timeline|time|date|counter|graph|step|workflow|card|animation/.test(value);

const inferSvgVariantCategory = (variant: SvgTypographyVariant): string => {
  const tags = new Set([...(variant.compatibility.tags ?? []), ...(variant.animationType ?? []), ...(variant.effects ?? [])].map((entry) => entry.toLowerCase()));
  if (tags.has("typing") || tags.has("cursor-sweep")) {
    return "typing";
  }
  if (tags.has("script")) {
    return "script";
  }
  if (tags.has("impact") || tags.has("split-impact")) {
    return "impact";
  }
  if (tags.has("blur-heavy") || tags.has("blur")) {
    return "blur";
  }
  if (tags.has("stagger")) {
    return "stagger";
  }
  if (tags.has("clean")) {
    return "clean";
  }
  if (tags.has("cinematic")) {
    return "cinematic";
  }
  return variant.compatibility.tags[0]?.toLowerCase() ?? "text";
};

const inferSvgVariantCompatibleWith = (variant: SvgTypographyVariant): string[] => {
  const text = normalizeKey([variant.id, variant.sourcePresetId, variant.sourceVariant, ...(variant.animationType ?? []), ...(variant.effects ?? []), ...(variant.compatibility.tags ?? [])].join(" "));
  const compatibles = new Set<string>([hostNodeId("svg-caption-overlay")]);

  if (/(typing|typed|cursor)/.test(text)) {
    compatibles.add(primitiveNodeId("typewriter"));
  }
  if (/(blur|wipe|reveal|sweep|drop|stagger|stack|split|fade)/.test(text)) {
    compatibles.add(primitiveNodeId("blur-reveal"));
  }
  if (/(highlight|glow|bold|script|stroke|line)/.test(text)) {
    compatibles.add(primitiveNodeId("highlight-word"));
  }
  if (/(circle|spotlight|impact|split)/.test(text)) {
    compatibles.add(primitiveNodeId("circle-reveal"));
  }
  if (/(underline|rule|bar|line)/.test(text)) {
    compatibles.add(primitiveNodeId("blur-underline"));
  }

  return [...compatibles];
};

const inferAssetCategory = (asset: MotionAssetManifest): string => {
  if (asset.templateGraphicCategory) {
    return asset.templateGraphicCategory;
  }
  if (asset.assetRole === "showcase") {
    return "showcase";
  }
  return asset.family;
};

const inferAssetType = (asset: MotionAssetManifest): AnimationNodeType => {
  return asset.templateGraphicCategory ? "motion-effect" : "overlay";
};

const inferAssetLayeringRule = (asset: MotionAssetManifest): AnimationLayeringRule => {
  const zIndex =
    asset.placementZone === "foreground-cross" ? 24 :
    asset.placementZone === "side-panels" ? 16 :
    asset.placementZone === "lower-third" ? 14 :
    asset.placementZone === "background-depth" ? 4 :
    asset.placementZone === "upper-perimeter" ? 12 :
    8;
  const channel =
    asset.placementZone === "background-depth" ? "base" :
    asset.placementZone === "foreground-cross" ? "overlay" :
    asset.placementZone === "side-panels" ? "accent" :
    "host";
  return makeLayeringRule(`asset-${asset.id}-layer`, channel, zIndex);
};

const inferAssetCompatibleWith = (asset: MotionAssetManifest): string[] => {
  const compatibles = new Set<string>([
    hostNodeId("motion-choreography-overlay"),
    selectorNodeId("showcase-intelligence")
  ]);

  if (asset.assetRole === "showcase" || asset.templateGraphicCategory) {
    compatibles.add(hostNodeId("semantic-sidecall-cue-visual"));
  }
  if (asset.templateGraphicCategory) {
    compatibles.add(templateFamilyNodeId(asset.templateGraphicCategory));
  }
  return [...compatibles];
};

const inferAssetGraphTags = (asset: MotionAssetManifest): string[] => {
  return unique([
    asset.id,
    asset.canonicalLabel,
    asset.family,
    asset.tier,
    asset.assetRole,
    asset.templateGraphicCategory ?? undefined,
    ...(asset.functionalTags ?? []),
    ...(asset.semanticTriggers ?? []),
    ...(asset.themeTags ?? []),
    ...(asset.semanticTags ?? []),
    ...(asset.subjectTags ?? []),
    ...(asset.placementPreference ?? []),
    ...(asset.conflictRules ?? []),
    ...(asset.structuralRegions ?? []).flatMap((region) => [region.id, region.label, region.role, region.selector, region.revealMode, region.notes]),
    ...(asset.aliases ?? [])
  ]);
};

const buildSvgVariantNodes = (): AnimationNode[] => {
  return svgTypographyVariantsV1.map((variant, index) =>
    createNode({
      id: svgVariantNodeId(variant.id),
      label: variant.label ?? titleCase(variant.sourceVariant.replace(/[-_]+/g, " ")),
      kind: "svg-variant",
      type: "svg",
      category: variant.category ?? inferSvgVariantCategory(variant),
      triggerType: variant.triggerType ?? "timeline",
      compatibleWith: unique([...(variant.compatibleWith ?? []), ...inferSvgVariantCompatibleWith(variant)]),
      layeringRules:
        variant.layeringRules ?? [
          makeLayeringRule(`svg-${variant.id}-layer`, "host", 12 + index, "SVG typography variant layer.")
        ],
      graphTags: unique([
        variant.id,
        variant.sourcePresetId,
        variant.sourceVariant,
        ...(variant.animationType ?? []),
        ...(variant.effects ?? []),
        ...(variant.compatibility.tags ?? []),
        ...(variant.aliases ?? [])
      ]),
      aliases: unique([variant.id, variant.sourcePresetId, variant.sourceVariant, ...(variant.aliases ?? [])]),
      sourceRef: "src/lib/stylebooks/svg-typography-v1.ts",
      notes: `SVG typography stylebook variant from ${variant.sourcePresetId}.`,
      metadata: variant
    })
  );
};

const buildMotionAssetNodes = (): AnimationNode[] => {
  return getUnifiedMotionAssetCatalog().map((asset) =>
    createNode({
      id: assetNodeId(asset.id),
      label: asset.canonicalLabel ?? asset.id,
      kind: "motion-asset",
      type: inferAssetType(asset),
      category: inferAssetCategory(asset),
      triggerType: asset.triggerType ?? "timeline",
      compatibleWith: unique([...(asset.compatibleWith ?? []), ...inferAssetCompatibleWith(asset)]),
      layeringRules: asset.layeringRules ?? [inferAssetLayeringRule(asset)],
      graphTags: inferAssetGraphTags(asset),
      aliases: unique([asset.id, asset.canonicalLabel, asset.sourceId, asset.sourceFile, asset.sourceHtml, ...(asset.aliases ?? [])]),
      sourceRef: "src/lib/motion-platform/motion-asset-registry.ts",
      notes: `Unified motion asset for ${asset.family} / ${asset.tier}.`,
      metadata: asset
    })
  );
};

const buildPrototypeNodes = (): AnimationNode[] => {
  const prototypeNodes = animationPrototypeCatalog.map((prototype) =>
    createNode({
      id: prototypeNodeId(prototype.id),
      label: prototype.label,
      kind: "prototype",
      type: prototype.type,
      category: prototype.category,
      triggerType: prototype.triggerType,
      compatibleWith: prototype.compatibleWith,
      layeringRules: prototype.layeringRules,
      graphTags: unique([
        ...prototype.graphTags,
        ...(prototype.functionalTags ?? []),
        ...(prototype.semanticTriggers ?? []),
        ...(prototype.placementPreference ?? []),
        ...(prototype.conflictRules ?? []),
        ...(prototype.structuralRegions ?? []).flatMap((region) => [region.id, region.label, region.role, region.selector, region.revealMode]),
        ...(prototype.aliases ?? [])
      ]),
      aliases: prototype.aliases,
      sourceRef: `src/data/${prototype.relativePath}`,
      notes: prototype.notes,
      metadata: prototype
    })
  );

  if (!prototypeNodes.some((node) => node.id === prototypeNodeId("graph-widget"))) {
    prototypeNodes.push(createNode({
      id: prototypeNodeId("graph-widget"),
      label: "Graph Widget",
      kind: "prototype",
      type: "motion-effect",
      category: "template-graphic",
      triggerType: "timeline",
      compatibleWith: [
        templateFamilyNodeId("graph-chart"),
        selectorNodeId("semantic-sidecall-governor"),
        hostNodeId("semantic-sidecall-cue-visual")
      ],
      layeringRules: [
        makeLayeringRule(
          "graph-widget-layer",
          "host",
          10,
          "Route graph-widget style prototypes and chart cues through the semantic graph pathway."
        )
      ],
      graphTags: [
        "semantic",
        "template-graphic",
        "visual",
        "svg",
        "graph",
        "chart",
        "analytics",
        "widget"
      ],
      aliases: [
        "graph-widget",
        "graph widget",
        "graph chart widget"
      ],
      sourceRef: "src/lib/motion-platform/animation-registry.ts",
      notes: "Synthetic fallback prototype for graph-widget style chart visuals.",
      metadata: {
        source: "synthetic-graph-widget",
        category: "template-graphic"
      }
    }));
  }

  return prototypeNodes;
};

const buildTemplateFamilyNodes = (prototypeNodes: AnimationNode[]): AnimationNode[] => {
  const families = [
    {
      id: "graph-chart",
      label: "Graph Chart",
      aliases: ["graph-chart", "graph chart", "analytics graph"],
      graphTags: ["graph", "chart", "analytics", "data"],
      keywords: ["graph", "chart"],
      note: "Route graph-widget style prototypes and chart cues through the semantic graph pathway."
    },
    {
      id: "number-counter-kpi",
      label: "Number Counter KPI",
      aliases: ["number-counter-kpi", "counter kpi", "numeric counter"],
      graphTags: ["counter", "kpi", "numeric", "metrics"],
      keywords: ["counter", "kpi", "numeric"],
      note: "Route counter and KPI prototypes through the numeric emphasis pathway."
    },
    {
      id: "timeline-calendar",
      label: "Timeline Calendar",
      aliases: ["timeline-calendar", "time calendar", "date timeline"],
      graphTags: ["timeline", "calendar", "date", "time"],
      keywords: ["timeline", "calendar", "date"],
      note: "Route date and timeline prototypes through the chronology pathway."
    },
    {
      id: "blueprint-workflow",
      label: "Blueprint Workflow",
      aliases: ["blueprint-workflow", "workflow blueprint", "process blueprint"],
      graphTags: ["workflow", "blueprint", "process", "steps"],
      keywords: ["workflow", "blueprint", "steps"],
      note: "Route step, workflow, and process prototypes through the blueprint pathway."
    }
  ] as const;

  return families.map((family) => {
    const compatiblePrototypes = prototypeNodes
      .filter((node) => family.keywords.some((keyword) => node.graphTags.some((tag) => normalizeKey(tag).includes(keyword))))
      .map((node) => node.id);

    return createNode({
      id: templateFamilyNodeId(family.id),
      label: family.label,
      kind: "template-family",
      type: "motion-effect",
      category: family.id,
      triggerType: "timeline",
      compatibleWith: unique([
        ...compatiblePrototypes,
        selectorNodeId("semantic-sidecall-governor"),
        selectorNodeId("showcase-intelligence"),
        hostNodeId("semantic-sidecall-cue-visual")
      ]),
      layeringRules: [makeLayeringRule(`template-${family.id}-layer`, "base", 8, family.note)],
      graphTags: [...family.graphTags],
      aliases: [...family.aliases],
      sourceRef: "src/lib/motion-platform/semantic-sidecall-governor.ts",
      notes: family.note,
      metadata: family
    });
  });
};

const buildSelectorNodes = (): AnimationNode[] => {
  return [
    createNode({
      id: selectorNodeId("semantic-sidecall-governor"),
      label: "Semantic Sidecall Governor",
      kind: "selector",
      type: "motion-effect",
      category: "selector",
      triggerType: "timeline",
      compatibleWith: [
        templateFamilyNodeId("graph-chart"),
        templateFamilyNodeId("number-counter-kpi"),
        templateFamilyNodeId("timeline-calendar"),
        templateFamilyNodeId("blueprint-workflow"),
        hostNodeId("semantic-sidecall-cue-visual")
      ],
      layeringRules: [makeLayeringRule("semantic-sidecall-governor-layer", "host", 2, "Routes semantic sidecall categories to template families.")],
      graphTags: ["selector", "governor", "routing", "semantic"],
      aliases: ["semantic-sidecall-governor", "SemanticSidecallGovernor"],
      sourceRef: "src/lib/motion-platform/semantic-sidecall-governor.ts",
      notes: "Selector node for the semantic sidecall routing engine.",
      metadata: {source: "semantic-sidecall-governor"}
    }),
    createNode({
      id: selectorNodeId("showcase-intelligence"),
      label: "Showcase Intelligence",
      kind: "selector",
      type: "motion-effect",
      category: "selector",
      triggerType: "timeline",
      compatibleWith: [
        templateFamilyNodeId("graph-chart"),
        templateFamilyNodeId("number-counter-kpi"),
        templateFamilyNodeId("timeline-calendar"),
        templateFamilyNodeId("blueprint-workflow"),
        hostNodeId("semantic-sidecall-cue-visual"),
        hostNodeId("motion-choreography-overlay")
      ],
      layeringRules: [makeLayeringRule("showcase-intelligence-layer", "host", 4, "Routes showcase cues into the motion stack.")],
      graphTags: ["selector", "showcase", "routing", "intelligence"],
      aliases: ["showcase-intelligence", "ShowcaseIntelligence"],
      sourceRef: "src/lib/motion-platform/showcase-intelligence.ts",
      notes: "Selector node for showcase cue routing.",
      metadata: {source: "showcase-intelligence"}
    })
  ];
};

const buildHostNodes = ({
  svgVariantNodes,
  primitiveNodes,
  compositeNodes,
  templateFamilyNodes,
  focusEffectNodes
}: {
  svgVariantNodes: AnimationNode[];
  primitiveNodes: AnimationNode[];
  compositeNodes: AnimationNode[];
  templateFamilyNodes: AnimationNode[];
  focusEffectNodes: AnimationNode[];
}): AnimationNode[] => {
  const primitiveIds = primitiveNodes.map((node) => node.id);
  const compositeIds = compositeNodes.map((node) => node.id);
  const templateFamilyIds = templateFamilyNodes.map((node) => node.id);
  const focusEffectIds = focusEffectNodes.map((node) => node.id);

  return [
    createNode({
      id: hostNodeId("svg-caption-overlay"),
      label: "SvgCaptionOverlay",
      kind: "runtime-host",
      type: "overlay",
      category: "caption-overlay",
      triggerType: "timeline",
      compatibleWith: [...svgVariantNodes.map((node) => node.id), ...focusEffectIds],
      layeringRules: [makeLayeringRule("svg-caption-overlay-layer", "host", 6, "Hosts caption SVG variants.")],
      graphTags: ["caption", "svg", "overlay", "typing"],
      aliases: ["SvgCaptionOverlay", "svg-caption-overlay"],
      sourceRef: "src/components/SvgCaptionOverlay.tsx",
      notes: "Runtime host for SVG caption variants.",
      metadata: {host: "SvgCaptionOverlay"}
    }),
    createNode({
      id: hostNodeId("motion-choreography-overlay"),
      label: "MotionChoreographyOverlay",
      kind: "runtime-host",
      type: "overlay",
      category: "choreography-overlay",
      triggerType: "timeline",
      compatibleWith: [...primitiveIds, ...compositeIds, ...focusEffectIds],
      layeringRules: [makeLayeringRule("motion-choreography-overlay-layer", "host", 10, "Hosts choreography primitives and composite emphasis pathways.")],
      graphTags: ["overlay", "choreography", "text", "motion"],
      aliases: ["MotionChoreographyOverlay", "motion-choreography-overlay"],
      sourceRef: "src/components/MotionChoreographyOverlay.tsx",
      notes: "Runtime host for motion choreography layers.",
      metadata: {host: "MotionChoreographyOverlay"}
    }),
    createNode({
      id: hostNodeId("longform-word-emphasis-adornment"),
      label: "LongformWordEmphasisAdornment",
      kind: "runtime-host",
      type: "overlay",
      category: "emphasis-overlay",
      triggerType: ["word-level", "syllable-level"],
      compatibleWith: [...primitiveIds, ...compositeIds, ...focusEffectIds],
      layeringRules: [makeLayeringRule("longform-word-emphasis-adornment-layer", "overlay", 18, "Hosts word-level emphasis primitives.")],
      graphTags: ["emphasis", "underline", "circle", "word"],
      aliases: ["LongformWordEmphasisAdornment", "longform-word-emphasis-adornment"],
      sourceRef: "src/components/LongformWordEmphasisAdornment.tsx",
      notes: "Runtime host for longform word emphasis adornments.",
      metadata: {host: "LongformWordEmphasisAdornment"}
    }),
    createNode({
      id: hostNodeId("semantic-sidecall-cue-visual"),
      label: "SemanticSidecallCueVisual",
      kind: "runtime-host",
      type: "svg",
      category: "template-visual",
      triggerType: "timeline",
      compatibleWith: [...templateFamilyIds, ...focusEffectIds],
      layeringRules: [makeLayeringRule("semantic-sidecall-cue-visual-layer", "host", 8, "Hosts semantic template visuals.")],
      graphTags: ["semantic", "template-graphic", "visual", "svg"],
      aliases: ["SemanticSidecallCueVisual", "semantic-sidecall-cue-visual"],
      sourceRef: "src/components/SemanticSidecallCueVisual.tsx",
      notes: "Runtime host for semantic sidecall template visuals.",
      metadata: {host: "SemanticSidecallCueVisual"}
    }),
    createNode({
      id: hostNodeId("motion-showcase-overlay"),
      label: "MotionShowcaseOverlay",
      kind: "runtime-host",
      type: "overlay",
      category: "showcase-overlay",
      triggerType: "timeline",
      compatibleWith: [...templateFamilyIds, hostNodeId("semantic-sidecall-cue-visual"), hostNodeId("target-focus-runtime"), ...focusEffectIds],
      layeringRules: [makeLayeringRule("motion-showcase-overlay-layer", "host", 9, "Hosts the showcase cue overlay and showcase routing visuals.")],
      graphTags: ["showcase", "motion", "asset", "template-graphic"],
      aliases: ["MotionShowcaseOverlay", "motion-showcase-overlay"],
      sourceRef: "src/components/MotionShowcaseOverlay.tsx",
      notes: "Runtime host for showcase cue overlays and semantic sidecall cards.",
      metadata: {host: "MotionShowcaseOverlay"}
    }),
    createNode({
      id: hostNodeId("cinematic-pip-overlay"),
      label: "CinematicPiPOverlay",
      kind: "runtime-host",
      type: "overlay",
      category: "picture-in-picture",
      triggerType: "timeline",
      compatibleWith: [...templateFamilyIds, hostNodeId("motion-showcase-overlay"), hostNodeId("target-focus-runtime")],
      layeringRules: [makeLayeringRule("cinematic-pip-overlay-layer", "host", 11, "Hosts the cinematic picture-in-picture composition engine.")],
      graphTags: ["pip", "subject", "composition", "card", "free-space", "editorial", "premium"],
      aliases: ["CinematicPiPOverlay", "cinematic-pip-overlay"],
      sourceRef: "src/components/CinematicPiPOverlay.tsx",
      notes: "Runtime host for the cinematic PiP composition engine and free-space layout surface.",
      metadata: {host: "CinematicPiPOverlay"}
    }),
    createNode({
      id: hostNodeId("target-focus-runtime"),
      label: targetFocusRuntimeHostContract.label,
      kind: "runtime-host",
      type: "overlay",
      category: targetFocusRuntimeHostContract.category,
      triggerType: targetFocusRuntimeHostContract.triggerType,
      compatibleWith: [...focusEffectIds, ...[
        hostNodeId("motion-choreography-overlay"),
        hostNodeId("svg-caption-overlay"),
        hostNodeId("longform-word-emphasis-adornment"),
        hostNodeId("semantic-sidecall-cue-visual")
      ]],
      layeringRules: [makeLayeringRule("target-focus-runtime-layer", "host", 12, "Hosts the reusable target focus runtime.")],
      graphTags: targetFocusRuntimeHostContract.graphTags,
      aliases: targetFocusRuntimeHostContract.aliases,
      sourceRef: "src/components/TargetFocusRuntime.tsx",
      notes: targetFocusRuntimeHostContract.notes,
      metadata: {host: "TargetFocusRuntime"}
    })
  ];
};

const buildAnimationNodes = (): AnimationNode[] => {
  const primitiveNodes = buildPrimitiveNodes();
  const compositeNodes = buildCompositeNodes();
  const focusEffectNodes = buildFocusEffectNodes();
  const svgVariantNodes = buildSvgVariantNodes();
  const motionAssetNodes = buildMotionAssetNodes();
  const prototypeNodes = buildPrototypeNodes();
  const templateFamilyNodes = buildTemplateFamilyNodes(prototypeNodes);
  const selectorNodes = buildSelectorNodes();
  const hostNodes = buildHostNodes({
    svgVariantNodes,
    primitiveNodes,
    compositeNodes,
    templateFamilyNodes,
    focusEffectNodes
  });

  return [
    ...primitiveNodes,
    ...compositeNodes,
    ...focusEffectNodes,
    ...svgVariantNodes,
    ...motionAssetNodes,
    ...prototypeNodes,
    ...templateFamilyNodes,
    ...selectorNodes,
    ...hostNodes
  ];
};

const resolveNodeId = (nodes: AnimationNode[], ref: string): string => {
  const normalized = normalizeKey(ref);
  const direct = nodes.find((node) => node.id === ref || normalizeKey(node.id) === normalized);
  if (direct) {
    return direct.id;
  }
  const aliasIndex = buildAliasIndex(nodes);
  return aliasIndex.get(normalized) ?? ref;
};

const relationWeight: Record<AnimationGraphEdgeRelation, number> = {
  "alias-of": 5,
  "can-trigger": 45,
  composes: 90,
  hosts: 80,
  "family-of": 70,
  "routes-to": 65,
  supports: 60
};

const determineEdgeRelation = (from: AnimationNode, to: AnimationNode): AnimationGraphEdgeRelation => {
  if (from.kind === "motion-composite" && to.kind === "motion-primitive") {
    return "composes";
  }
  if (from.kind === "focus-effect" && to.kind === "runtime-host") {
    return "routes-to";
  }
  if (from.kind === "template-family" && to.kind === "prototype") {
    return "family-of";
  }
  if (from.kind === "runtime-host") {
    return "hosts";
  }
  if (from.kind === "selector") {
    return "routes-to";
  }
  if (from.kind === "motion-asset") {
    return "supports";
  }
  return "can-trigger";
};

const buildAnimationEdges = (nodes: AnimationNode[]): AnimationGraphEdge[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = new Map<string, AnimationGraphEdge>();

  nodes.forEach((from) => {
    from.compatibleWith.forEach((targetRef) => {
      const target = byId.get(resolveNodeId(nodes, targetRef));
      if (!target || target.id === from.id) {
        return;
      }

      const relation = determineEdgeRelation(from, target);
      const edgeKey = `${from.id}::${target.id}::${relation}`;
      if (edges.has(edgeKey)) {
        return;
      }

      edges.set(edgeKey, {
        from: from.id,
        to: target.id,
        relation,
        weight: relationWeight[relation] + Math.min(25, from.graphTags.filter((tag) => target.graphTags.includes(tag)).length * 6),
        reason: `${from.kind} ${from.label} ${relation} ${target.kind} ${target.label}`
      });
    });
  });

  return [...edges.values()].sort((left, right) => right.weight - left.weight || left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
};

const buildAliasIndex = (nodes: AnimationNode[]): Map<string, string> => {
  const index = new Map<string, string>();
  nodes.forEach((node) => {
    [node.id, ...node.aliases].forEach((alias) => {
      const key = normalizeKey(alias);
      if (!index.has(key)) {
        index.set(key, node.id);
      }
    });
  });
  return index;
};

const getLayerScore = (node: AnimationNode): number => {
  const ruleScore = node.layeringRules[0]?.zIndex ?? 0;
  return ruleScore + NODE_KIND_PRIORITY[node.kind];
};

const REF_LOOKUP_PRIORITY: Record<AnimationNodeKind, number> = {
  "motion-composite": 0,
  "motion-primitive": 1,
  "focus-effect": 2,
  "runtime-host": 3,
  prototype: 4,
  "template-family": 5,
  "svg-variant": 6,
  "motion-asset": 7,
  selector: 8
};

export class AnimationRegistry {
  private readonly nodeById: Map<string, AnimationNode>;

  private readonly aliasIndex: Map<string, string>;

  private readonly normalizedRefIndex: Map<string, AnimationNode>;

  private readonly outgoingEdgesByNodeId: Map<string, AnimationGraphEdge[]>;

  readonly nodes: AnimationNode[];

  readonly edges: AnimationGraphEdge[];

  readonly issues: AnimationRegistryIssue[];

  constructor(snapshot: AnimationRegistrySnapshot) {
    this.nodes = snapshot.nodes;
    this.edges = snapshot.edges;
    this.issues = snapshot.issues;
    this.nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    this.aliasIndex = buildAliasIndex(snapshot.nodes);
    this.normalizedRefIndex = snapshot.nodes.reduce((index, node) => {
      const refKeys = new Set<string>([
        normalizeKey(node.id),
        normalizeKey(node.id.includes(":") ? node.id.split(":").slice(-1)[0] ?? node.id : node.id),
        ...node.aliases.map((alias) => normalizeKey(alias))
      ]);

      refKeys.forEach((key) => {
        const existing = index.get(key);
        if (!existing || REF_LOOKUP_PRIORITY[node.kind] < REF_LOOKUP_PRIORITY[existing.kind]) {
          index.set(key, node);
        }
      });

      return index;
    }, new Map<string, AnimationNode>());
    this.outgoingEdgesByNodeId = snapshot.edges.reduce((index, edge) => {
      const current = index.get(edge.from) ?? [];
      current.push(edge);
      index.set(edge.from, current);
      return index;
    }, new Map<string, AnimationGraphEdge[]>());
  }

  getNode(ref: string): AnimationNode | null {
    const normalized = normalizeKey(ref);
    const direct = this.nodeById.get(ref);
    if (direct) {
      return direct;
    }
    const normalizedDirect = this.normalizedRefIndex.get(normalized);
    if (normalizedDirect) {
      return normalizedDirect;
    }
    const aliasId = this.aliasIndex.get(normalized);
    return aliasId ? this.nodeById.get(aliasId) ?? null : null;
  }

  getNeighbors(
    ref: string,
    relations?: AnimationGraphEdgeRelation | AnimationGraphEdgeRelation[]
  ): AnimationNode[] {
    const node = this.getNode(ref);
    if (!node) {
      return [];
    }
    const relationSet = relations
      ? new Set(Array.isArray(relations) ? relations : [relations])
      : null;
    const edges = (this.outgoingEdgesByNodeId.get(node.id) ?? []).filter((edge) => !relationSet || relationSet.has(edge.relation));
    return edges
      .map((edge) => this.nodeById.get(edge.to))
      .filter((neighbor): neighbor is AnimationNode => Boolean(neighbor))
      .sort((left, right) => getLayerScore(left) - getLayerScore(right) || left.label.localeCompare(right.label));
  }

  resolveChain(
    ref: string,
    options: {
      maxDepth?: number;
      includeStart?: boolean;
      relations?: AnimationGraphEdgeRelation | AnimationGraphEdgeRelation[];
    } = {}
  ): AnimationNode[] {
    const start = this.getNode(ref);
    if (!start) {
      return [];
    }

    const maxDepth = options.maxDepth ?? 3;
    const includeStart = options.includeStart ?? true;
    const relationSet = options.relations
      ? new Set(Array.isArray(options.relations) ? options.relations : [options.relations])
      : new Set<AnimationGraphEdgeRelation>(["can-trigger", "composes", "hosts", "family-of", "routes-to", "supports"]);

    const visited = new Set<string>();
    const queue: Array<{node: AnimationNode; depth: number}> = [{node: start, depth: 0}];
    const chain: AnimationNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      if (visited.has(current.node.id)) {
        continue;
      }
      visited.add(current.node.id);

      if (current.depth > 0 || includeStart) {
        chain.push(current.node);
      }
      if (current.depth >= maxDepth) {
        continue;
      }

      (this.outgoingEdgesByNodeId.get(current.node.id) ?? [])
        .filter((edge) => relationSet.has(edge.relation))
        .forEach((edge) => {
          const next = this.nodeById.get(edge.to);
          if (next && !visited.has(next.id)) {
            queue.push({node: next, depth: current.depth + 1});
          }
        });
    }

    return chain;
  }

  resolveLayerStack(refs: NodeReferenceInput[]): AnimationNode[] {
    const nodes = refs
      .map((ref) => (typeof ref === "string" ? this.getNode(ref) : ref))
      .filter((node): node is AnimationNode => Boolean(node));
    const seen = new Set<string>();
    return nodes
      .filter((node) => {
        if (seen.has(node.id)) {
          return false;
        }
        seen.add(node.id);
        return true;
      })
      .sort((left, right) => getLayerScore(left) - getLayerScore(right) || left.label.localeCompare(right.label));
  }

  validate(): AnimationRegistryIssue[] {
    const issues: AnimationRegistryIssue[] = [];

    this.nodes.forEach((node) => {
      if (!node.label.trim()) {
        issues.push({
          severity: "error",
          code: "missing-label",
          nodeId: node.id,
          message: `Node ${node.id} is missing a label.`
        });
      }
      if (!node.category.trim()) {
        issues.push({
          severity: "error",
          code: "missing-category",
          nodeId: node.id,
          message: `Node ${node.id} is missing a category.`
        });
      }
      if (!node.graphTags.length) {
        issues.push({
          severity: "warning",
          code: "unclassified-node",
          nodeId: node.id,
          message: `Node ${node.id} has no graph tags.`
        });
      }

      node.compatibleWith.forEach((ref) => {
        if (!this.getNode(ref)) {
          issues.push({
            severity: "error",
            code: "dangling-compatible-ref",
            nodeId: node.id,
            message: `Node ${node.id} references unresolved compatible target ${ref}.`
          });
        }
      });
    });

    return issues;
  }
}

export const buildAnimationRegistrySnapshot = (): AnimationRegistrySnapshot => {
  const nodes = buildAnimationNodes();
  const edges = buildAnimationEdges(nodes);
  const registry = new AnimationRegistry({nodes, edges, issues: []});
  const issues = registry.validate();
  return {nodes, edges, issues};
};

const DEFAULT_ANIMATION_REGISTRY_SNAPSHOT = buildAnimationRegistrySnapshot();

const assertNoFatalIssues = (issues: AnimationRegistryIssue[]): void => {
  const fatal = issues.filter((issue) => issue.severity === "error");
  if (fatal.length > 0) {
    const detail = fatal.map((issue) => `${issue.code}:${issue.nodeId ?? "global"} ${issue.message}`).join("\n");
    throw new Error(`Animation registry validation failed:\n${detail}`);
  }
};

assertNoFatalIssues(DEFAULT_ANIMATION_REGISTRY_SNAPSHOT.issues);

export const animationRegistry = new AnimationRegistry(DEFAULT_ANIMATION_REGISTRY_SNAPSHOT);
export const animationRegistryIssues = DEFAULT_ANIMATION_REGISTRY_SNAPSHOT.issues;
export const animationRegistryNodes = DEFAULT_ANIMATION_REGISTRY_SNAPSHOT.nodes;
export const animationRegistryEdges = DEFAULT_ANIMATION_REGISTRY_SNAPSHOT.edges;

export const getAnimationNode = (ref: string): AnimationNode | null => animationRegistry.getNode(ref);
export const getAnimationNeighbors = (
  ref: string,
  relations?: AnimationGraphEdgeRelation | AnimationGraphEdgeRelation[]
): AnimationNode[] => animationRegistry.getNeighbors(ref, relations);
export const resolveAnimationChain = (
  ref: string,
  options?: Parameters<AnimationRegistry["resolveChain"]>[1]
): AnimationNode[] => animationRegistry.resolveChain(ref, options);
export const resolveAnimationLayerStack = (refs: NodeReferenceInput[]): AnimationNode[] => animationRegistry.resolveLayerStack(refs);
