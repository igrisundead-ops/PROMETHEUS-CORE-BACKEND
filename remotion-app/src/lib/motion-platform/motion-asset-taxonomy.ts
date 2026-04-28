import type {
  MotionAssetAccessPolicy,
  MotionAssetLifecycle,
  MotionAssetManifest,
  MotionAssetRenderMode,
  MotionAssetRuntimeParams,
  MotionAssetSourceKind,
  MotionAssetStructuralRegion,
  MotionMoodTag,
  MotionAssetCoverageStatus
} from "../types";

type MotionAssetTaxonomy = {
  semanticTags: string[];
  subjectTags: string[];
  emotionalTags: MotionMoodTag[];
  functionalTags: string[];
  semanticTriggers: string[];
  visualWeight: number;
  idealDurationMs: number;
  placementPreference: string[];
  reuseFrequencyLimit: number;
  conflictRules: string[];
  redundancyRiskScore: number;
  structuralRegions: MotionAssetStructuralRegion[];
  partialRevealSupported: boolean;
  metadataConfidence: number;
  coverageStatus: MotionAssetCoverageStatus;
  lifecycle: MotionAssetLifecycle;
  accessPolicy: MotionAssetAccessPolicy;
  preloadPriority: number;
  runtimeParams: MotionAssetRuntimeParams;
  renderMode: MotionAssetRenderMode;
  sourceKind: MotionAssetSourceKind;
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

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const singularizeToken = (value: string): string => {
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

const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map(singularizeToken)
    .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token));
};

const buildTextTerms = (value: string): string[] => {
  const tokens = tokenize(value);
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

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const matchAny = (text: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

const buildFunctionalTags = (manifest: MotionAssetManifest, text: string): string[] => {
  const tags = new Set<string>(tokenize(assetTextPool(manifest).join(" ")));
  const familyMatchers: Array<{patterns: RegExp[]; tags: string[]}> = [
    {
      patterns: [/\b(compare|comparison|compare two|vs|versus|against|tradeoff|choice|contrast|difference|better than|worse than|before after)\b/],
      tags: ["comparison", "contrast", "dual-concept", "decision", "evaluation", "side-by-side", "analytical", "tradeoff", "comparison-graphic"]
    },
    {
      patterns: [/\b(call|calling|contact|outreach|reach out|phone|dial|connect)\b/],
      tags: ["call", "calling", "contact", "outreach", "communication", "connection", "phone", "reach-out"]
    },
    {
      patterns: [/\b(step|steps|first|second|third|next|finally|sequence|ordered|check mark|checkmark|list)\b/],
      tags: ["list", "steps", "sequence", "ordered", "checkmark", "numbered", "process", "progression", "flow"]
    },
    {
      patterns: [/\b(grow|growth|increase|progress|scale|improve|ramp|upward)\b/],
      tags: ["growth", "progress", "increase", "scale", "improvement", "ramp", "upward", "trend", "momentum"]
    },
    {
      patterns: [/\b(counter|count up|countup|percent|percentage|metric|stat|stats|number|numbers|kpi)\b/],
      tags: ["counter", "numeric", "kpi", "metric", "percentage", "stat", "number", "data", "count-up"]
    },
    {
      patterns: [/\b(quote|quoted|said|speech|statement|spoken|voice)\b/],
      tags: ["quote", "spoken", "statement", "voice", "editorial", "citation"]
    },
    {
      patterns: [/\b(subscribe|follow|join|click|download|start|buy|sign up|cta|action)\b/],
      tags: ["cta", "conversion", "action", "subscribe", "follow", "join", "click", "response", "prompt"]
    },
    {
      patterns: [/\b(bubble|card|panel|callout|glass|frosted)\b/],
      tags: ["bubble", "card", "panel", "callout", "glass", "accent", "floating", "supporting"]
    },
    {
      patterns: [/\b(focus|zoom|spotlight|target|camera|stage)\b/],
      tags: ["focus", "zoom", "spotlight", "target", "camera", "framing"]
    },
    {
      patterns: [/\b(highlight|underline|circle|emphasis|replaceable|word showcase|syllabic)\b/],
      tags: ["highlight", "underline", "circle", "emphasis", "replaceable", "word-showcase", "syllabic-break"]
    },
    {
      patterns: [/\b(typography|typewriter|typing|cursor|svg|text)\b/],
      tags: ["typography", "typewriter", "typing", "cursor", "text", "svg"]
    },
    {
      patterns: [/\b(timeline|calendar|date|time|workflow|blueprint|process|pipeline)\b/],
      tags: ["timeline", "calendar", "date", "time", "workflow", "blueprint", "process", "pipeline"]
    }
  ];

  familyMatchers.forEach((group) => {
    if (matchAny(text, group.patterns)) {
      group.tags.forEach((tag) => tags.add(tag));
    }
  });

  const styleSignals = normalizeText([
    manifest.id,
    manifest.canonicalLabel,
    manifest.family,
    manifest.tier,
    manifest.assetRole,
    manifest.sourceKind,
    manifest.sourceBatch,
    manifest.sourceHtml,
    text
  ].join(" "));

  if (manifest.assetRole === "showcase" || manifest.sourceKind === "authoring-batch" || manifest.sourceKind === "god-generated" || Boolean(manifest.sourceHtml)) {
    tags.add("cinematic");
    tags.add("premium");
  }
  if (/(text|quote|step|steps|list|card|comparison|call|cta|growth|counter|timeline|workflow|highlight|underline|circle|selection|reveal|blur)/.test(styleSignals)) {
    tags.add("editorial");
  }
  if (/(glass|blur|frosted|bubble|panel|clean|apple|minimal|crisp|quiet)/.test(styleSignals)) {
    tags.add("minimal");
  }
  if (/(glass|blur|frosted|bubble|panel|glow|shine|vignette)/.test(styleSignals)) {
    tags.add("glassmorphism");
  }

  if (manifest.assetRole === "showcase") {
    tags.add("showcase");
    tags.add("motion");
  }
  if (manifest.virtualAsset) {
    tags.add("generated");
  }

  return [...tags];
};

const buildSemanticTriggers = (manifest: MotionAssetManifest, text: string): string[] => {
  const triggers = new Set<string>();
  const ruleSets: Array<{patterns: RegExp[]; triggers: string[]}> = [
    {patterns: [/\b(vs|versus|compare|comparison|against|tradeoff|contrast)\b/], triggers: ["this-vs-that", "comparison-moment"]},
    {patterns: [/\b(step one|step 1|first|second|third|next|finally|sequence)\b/], triggers: ["ordered-sequence", "list-step"]},
    {patterns: [/\b(call|contact|outreach|reach out)\b/], triggers: ["call-moment", "contact-action"]},
    {patterns: [/\b(growth|increase|progress|scale|upward|improve)\b/], triggers: ["growth-moment", "progress-moment"]},
    {patterns: [/\b(counter|count up|percent|percentage|stat|metric|number)\b/], triggers: ["numeric-emphasis", "data-point"]},
    {patterns: [/\b(quote|said|quoted|speech)\b/], triggers: ["quote-moment"]},
    {patterns: [/\b(subscribe|follow|join|click|download|start)\b/], triggers: ["cta-moment", "action-prompt"]},
    {patterns: [/\b(bubble|card|glass|panel)\b/], triggers: ["accent-card", "rare-accent"]},
    {patterns: [/\b(highlight|underline|circle|emphasis|replaceable)\b/], triggers: ["word-emphasis", "highlight-accent"]},
    {patterns: [/\b(timeline|calendar|date|time)\b/], triggers: ["timeline-marker"]},
    {patterns: [/\b(workflow|blueprint|process|pipeline)\b/], triggers: ["process-map", "workflow-step"]}
  ];

  ruleSets.forEach((rule) => {
    if (matchAny(text, rule.patterns)) {
      rule.triggers.forEach((trigger) => triggers.add(trigger));
    }
  });

  if (manifest.sourceHtml) {
    triggers.add("html-prototype");
  }

  return [...triggers];
};

const inferVisualWeight = (manifest: MotionAssetManifest, semanticTags: string[], emotionalTags: MotionMoodTag[]): number => {
  const base =
    manifest.assetRole === "showcase" ? 0.62 :
    manifest.templateGraphicCategory ? 0.74 :
    manifest.family === "foreground-element" ? 0.66 :
    manifest.placementZone === "background-depth" ? 0.42 :
    0.54;

  const semanticBoost = semanticTags.some((tag) => ["comparison", "growth", "counter", "cta", "quote"].includes(tag)) ? 0.08 : 0;
  const emphasisBoost = semanticTags.some((tag) => ["highlight", "underline", "circle", "replaceable"].includes(tag)) ? 0.06 : 0;
  const emotionalBoost = emotionalTags.some((tag) => tag === "authority" || tag === "heroic") ? 0.04 : 0;
  return round(clamp01(base + semanticBoost + emphasisBoost + emotionalBoost), 3);
};

const inferIdealDurationMs = (manifest: MotionAssetManifest, semanticTags: string[]): number => {
  if (semanticTags.includes("comparison")) return 1800;
  if (semanticTags.includes("call")) return 1500;
  if (semanticTags.includes("list")) return 1900;
  if (semanticTags.includes("growth")) return 2100;
  if (semanticTags.includes("counter")) return 1600;
  if (semanticTags.includes("quote")) return 1900;
  if (semanticTags.includes("cta")) return 1500;
  if (semanticTags.includes("bubble")) return 1750;
  if (semanticTags.includes("focus")) return 1300;
  if (semanticTags.includes("highlight") || semanticTags.includes("underline") || semanticTags.includes("circle")) return 1400;
  if (manifest.assetRole === "showcase") return 1700;
  return 1600;
};

const inferPlacementPreference = (manifest: MotionAssetManifest, semanticTags: string[]): string[] => {
  if (semanticTags.includes("comparison")) return ["left", "right", "center"];
  if (semanticTags.includes("call")) return ["side-panels", "lower-third", "corner"];
  if (semanticTags.includes("list")) return ["lower-third", "center", "stack"];
  if (semanticTags.includes("growth") || semanticTags.includes("counter")) return ["lower-third", "center", "side-panels"];
  if (semanticTags.includes("quote")) return ["center", "upper-perimeter", "lower-third"];
  if (semanticTags.includes("cta")) return ["lower-third", "corner", "center"];
  if (semanticTags.includes("bubble")) return ["corner", "side-panels", "floating"];
  if (semanticTags.includes("focus")) return ["center", "full-frame"];
  if (manifest.placementZone) return [manifest.placementZone];
  return ["center"];
};

const inferReuseFrequencyLimit = (semanticTags: string[]): number => {
  if (semanticTags.includes("cta")) return 2;
  if (semanticTags.includes("bubble")) return 2;
  if (semanticTags.includes("comparison")) return 3;
  if (semanticTags.includes("call")) return 3;
  if (semanticTags.includes("growth")) return 3;
  if (semanticTags.includes("counter")) return 4;
  if (semanticTags.includes("quote")) return 4;
  if (semanticTags.includes("list")) return 5;
  return 4;
};

const inferConflictRules = (semanticTags: string[], emotionalTags: MotionMoodTag[]): string[] => {
  const rules = new Set<string>();
  if (semanticTags.includes("counter")) {
    rules.add("avoid-duplicate-numeric-emphasis");
    rules.add("prefer-italic-percent-signal");
  }
  if (semanticTags.includes("comparison")) {
    rules.add("single-comparison-per-window");
    rules.add("avoid-competing-focal-elements");
  }
  if (semanticTags.includes("list")) {
    rules.add("respect-order");
    rules.add("one-step-per-beat");
  }
  if (semanticTags.includes("bubble")) {
    rules.add("rare-accent-only");
    rules.add("max-two-per-five-minutes");
  }
  if (semanticTags.includes("cta")) {
    rules.add("single-cta-per-window");
    rules.add("avoid-overlay-stack-collision");
  }
  if (semanticTags.includes("call")) {
    rules.add("avoid-repeat-in-short-window");
  }
  if (semanticTags.includes("quote")) {
    rules.add("one-quote-dominant-visual");
  }
  if (semanticTags.includes("focus")) {
    rules.add("align-to-target-bounding-box");
  }
  if (emotionalTags.includes("authority")) {
    rules.add("prefer-single-dominant-visual");
  }

  return [...rules];
};

const inferRedundancyRiskScore = (semanticTags: string[]): number => {
  if (semanticTags.includes("counter")) return 0.48;
  if (semanticTags.includes("bubble")) return 0.44;
  if (semanticTags.includes("cta")) return 0.36;
  if (semanticTags.includes("list")) return 0.24;
  if (semanticTags.includes("comparison")) return 0.28;
  if (semanticTags.includes("focus")) return 0.22;
  return 0.2;
};

const normalizeStructuralRegion = (region: MotionAssetStructuralRegion): MotionAssetStructuralRegion => ({
  ...region,
  importance: clamp01(region.importance),
  revealMode: region.revealMode,
  hideable: Boolean(region.hideable),
  optional: Boolean(region.optional),
  canBeShownAlone: Boolean(region.canBeShownAlone)
});

const inferMetadataConfidence = ({
  manifest,
  semanticTags,
  structuralRegions
}: {
  manifest: MotionAssetManifest;
  semanticTags: string[];
  structuralRegions: MotionAssetStructuralRegion[];
}): number => {
  if (typeof manifest.metadataConfidence === "number") {
    return clamp01(manifest.metadataConfidence);
  }
  let score = 0.44;
  score += Math.min(0.2, semanticTags.length * 0.012);
  score += Math.min(0.12, (manifest.functionalTags ?? []).length * 0.01);
  score += Math.min(0.16, structuralRegions.length * 0.035);
  if (manifest.sourceHtml || manifest.sourceBatch) {
    score += 0.1;
  }
  if (manifest.templateGraphicCategory) {
    score += 0.08;
  }
  if (manifest.assetRole === "showcase") {
    score += 0.05;
  }
  return clamp01(round(score));
};

const inferCoverageStatus = ({
  manifest,
  structuralRegions,
  metadataConfidence
}: {
  manifest: MotionAssetManifest;
  structuralRegions: MotionAssetStructuralRegion[];
  metadataConfidence: number;
}): MotionAssetCoverageStatus => {
  if (manifest.coverageStatus) {
    return manifest.coverageStatus;
  }
  if (metadataConfidence >= 0.82 && structuralRegions.length >= 2) {
    return "complete";
  }
  if (metadataConfidence >= 0.62) {
    return "review";
  }
  if (structuralRegions.length > 0) {
    return "partial";
  }
  return "untagged";
};

const hasAny = (values: string[], patterns: RegExp[]): boolean => {
  return patterns.some((pattern) => values.some((value) => pattern.test(value)));
};

const assetTextPool = (manifest: MotionAssetManifest): string[] => {
  return unique([
    manifest.id,
    manifest.canonicalLabel,
    manifest.family,
    manifest.tier,
    manifest.assetRole,
    manifest.templateGraphicCategory ?? undefined,
    manifest.sourceKind,
    manifest.sourceId,
    manifest.sourceBatch,
    manifest.sourceFile,
    manifest.sourceHtml,
    ...(manifest.functionalTags ?? []),
    ...(manifest.semanticTriggers ?? []),
    ...(manifest.themeTags ?? []),
    ...(manifest.searchTerms ?? []),
    ...(manifest.semanticTags ?? []),
    ...(manifest.subjectTags ?? []),
    ...(manifest.emotionalTags ?? []),
    ...(manifest.placementPreference ?? []),
    ...(manifest.conflictRules ?? []),
    ...(manifest.structuralRegions ?? []).flatMap((region) => [
      region.id,
      region.label,
      region.role,
      region.selector,
      region.revealMode,
      region.notes
    ]),
    manifest.placementZone,
    manifest.durationPolicy,
    manifest.lifecycle,
    manifest.renderMode
  ]);
};

const inferSourceKind = (manifest: MotionAssetManifest): MotionAssetSourceKind => {
  if (manifest.virtualAsset) {
    return "generated-placeholder";
  }
  if (
    manifest.sourceKind === "god-generated" ||
    /\/motion-assets\/god\//i.test(String(manifest.sourceFile ?? manifest.sourceHtml ?? manifest.sourceBatch ?? "")) ||
    /god/i.test(String(manifest.sourceBatch ?? ""))
  ) {
    return "god-generated";
  }
  if (manifest.sourceHtml || manifest.sourceBatch) {
    return "authoring-batch";
  }
  if (manifest.source === "supabase" || manifest.source === "drive") {
    return "remote-cache";
  }
  if (manifest.assetRole === "showcase") {
    return "showcase-cache";
  }
  return "local-public";
};

const inferRenderMode = (manifest: MotionAssetManifest, sourceKind: MotionAssetSourceKind): MotionAssetRenderMode => {
  if (sourceKind === "god-generated" && manifest.sourceHtml) {
    return "iframe";
  }
  if (sourceKind === "authoring-batch" && manifest.sourceHtml) {
    return "image";
  }
  return "image";
};

const inferLifecycle = (manifest: MotionAssetManifest, sourceKind: MotionAssetSourceKind): MotionAssetLifecycle => {
  if (sourceKind === "god-generated" || sourceKind === "authoring-batch") {
    return "authoring";
  }
  return manifest.durationPolicy;
};

const inferAccessPolicy = (
  manifest: MotionAssetManifest,
  sourceKind: MotionAssetSourceKind
): MotionAssetAccessPolicy => {
  const visibility = sourceKind === "god-generated"
    ? "public"
    : sourceKind === "authoring-batch"
    ? "authoring"
    : sourceKind === "remote-cache"
      ? "internal"
      : "public";

  return {
    visibility,
    requiresSourceBundle: Boolean(manifest.sourceHtml || manifest.sourceBatch),
    allowsRuntimeParameterOverrides: !manifest.virtualAsset,
    lockedFields: ["color", "materials"]
  };
};

const inferSemanticTags = (manifest: MotionAssetManifest): string[] => {
  const text = normalizeText(assetTextPool(manifest).join(" "));
  const tags = new Set<string>();

  const directTokens = tokenize(assetTextPool(manifest).join(" "));
  directTokens.forEach((token) => tags.add(token));

  const tagGroups: Array<{patterns: RegExp[]; tags: string[]}> = [
    {
      patterns: [/(folder|stack|container|compartment|organizer|archive|directory)/],
      tags: ["folder", "container", "project", "organization"]
    },
    {
      patterns: [/(education|educational|book|manual|guide|learn|learning|course|school|classroom)/],
      tags: ["education", "guide", "learning"]
    },
    {
      patterns: [/(analytics|chart|graph|metric|kpi|dashboard|budget|finance|money|counter|data)/],
      tags: ["analytics", "data", "finance", "dashboard"]
    },
    {
      patterns: [/(profile|showcase|presentation|portrait|card|box|badge)/],
      tags: ["profile", "presentation", "showcase"]
    },
    {
      patterns: [/(typography|poster|headline|type|command|bar|ui|interface)/],
      tags: ["typography", "interface", "presentation"]
    },
    {
      patterns: [/(workflow|process|blueprint|plan|system|pipeline|sequence)/],
      tags: ["workflow", "process", "planning"]
    },
    {
      patterns: [/(camera|lens|photo|image|portrait|media|screen)/],
      tags: ["camera", "media", "visual"]
    },
    {
      patterns: [/(motion|animation|gsap|transition|reveal|cinematic|drift|parallax)/],
      tags: ["motion", "cinematic", "transition"]
    }
  ];

  tagGroups.forEach((group) => {
    if (hasAny([text], group.patterns)) {
      group.tags.forEach((tag) => tags.add(tag));
    }
  });

  if (manifest.assetRole === "showcase") {
    tags.add("showcase");
  }
  if (manifest.virtualAsset) {
    tags.add("generated");
  }

  return [...tags];
};

const inferSubjectTags = (manifest: MotionAssetManifest): string[] => {
  const text = normalizeText(assetTextPool(manifest).join(" "));
  const tags = new Set<string>();

  const subjectRules: Array<{patterns: RegExp[]; tags: string[]}> = [
    {patterns: [/(folder|stack)/], tags: ["folder", "stack"]},
    {patterns: [/(container|compartment)/], tags: ["container"]},
    {patterns: [/(project)/], tags: ["project"]},
    {patterns: [/(education|book|manual|guide|course)/], tags: ["education"]},
    {patterns: [/(analytics|chart|graph|metric|kpi|dashboard)/], tags: ["analytics", "chart"]},
    {patterns: [/(profile|portrait)/], tags: ["profile", "portrait"]},
    {patterns: [/(card|box|panel)/], tags: ["card"]},
    {patterns: [/(poster|headline|typography)/], tags: ["poster", "typography"]},
    {patterns: [/(workflow|blueprint|process)/], tags: ["workflow", "blueprint"]},
    {patterns: [/(camera|lens|photo|media)/], tags: ["camera", "media"]}
  ];

  subjectRules.forEach((rule) => {
    if (hasAny([text], rule.patterns)) {
      rule.tags.forEach((tag) => tags.add(tag));
    }
  });

  if (tags.size === 0) {
    tags.add(manifest.canonicalLabel ?? manifest.id);
  }

  return [...tags];
};

const inferEmotionalTags = (manifest: MotionAssetManifest): MotionMoodTag[] => {
  const values = normalizeText(assetTextPool(manifest).join(" "));
  const tags = new Set<MotionMoodTag>(manifest.themeTags ?? ["neutral"]);

  if (/(warm|red|gold|amber|orange|fire|glow|sun)/.test(values)) {
    tags.add("warm");
  }
  if (/(cool|blue|steel|glass|editorial|ice|clean|crisp)/.test(values)) {
    tags.add("cool");
  }
  if (/(calm|soft|quiet|minimal|frosted|blur|gentle)/.test(values)) {
    tags.add("calm");
  }
  if (/(kinetic|motion|animated|gsap|transition|sweep|pulse|drift|parallax)/.test(values)) {
    tags.add("kinetic");
  }
  if (/(authority|premium|luxury|hero|heroic|executive|bold|strong|confidence)/.test(values)) {
    tags.add("authority");
  }
  if (/(hero|heroic|cinematic|spotlight|reveal|monumental|premium)/.test(values)) {
    tags.add("heroic");
  }

  return [...tags];
};

const inferRuntimeParams = (manifest: MotionAssetManifest): MotionAssetRuntimeParams => {
  const baseOpacity = Math.max(0, Math.min(1, manifest.opacity));
  const depth =
    manifest.placementZone === "background-depth"
      ? 0.14
      : manifest.placementZone === "foreground-cross"
        ? 0.28
        : manifest.assetRole === "showcase"
          ? 0.2
          : 0.08;

  const parallax =
    manifest.placementZone === "background-depth"
      ? 0.08
      : manifest.placementZone === "foreground-cross"
        ? 0.03
        : manifest.placementZone === "side-panels"
          ? 0.05
          : 0.02;

  return {
    opacity: baseOpacity,
    depth,
    parallax,
    loop: manifest.loopable,
    reveal: 1,
    timingOffsetMs: 0
  };
};

const inferPreloadPriority = (manifest: MotionAssetManifest, semanticTags: string[], emotionalTags: MotionMoodTag[]): number => {
  const text = normalizeText(assetTextPool(manifest).join(" "));
  let score = 24;

  if (manifest.assetRole === "showcase") {
    score += 12;
  }
  if (manifest.sourceHtml) {
    score += 16;
  }
  if (manifest.virtualAsset) {
    score -= 8;
  }
  if (manifest.tier === "hero") {
    score += 18;
  } else if (manifest.tier === "premium") {
    score += 12;
  } else if (manifest.tier === "editorial") {
    score += 8;
  }
  if (manifest.family === "foreground-element") {
    score += 14;
  }
  if (manifest.placementZone === "background-depth") {
    score += 10;
  }
  if (manifest.placementZone === "side-panels" || manifest.placementZone === "lower-third") {
    score += 6;
  }
  if (semanticTags.some((tag) => ["folder", "project", "container", "education"].includes(tag))) {
    score += 18;
  }
  if (semanticTags.some((tag) => ["analytics", "workflow", "typography", "presentation", "comparison", "call", "list", "growth", "counter", "quote", "cta"].includes(tag))) {
    score += 10;
  }
  if (emotionalTags.some((tag) => tag === "heroic" || tag === "authority")) {
    score += 8;
  }
  if (/(folder|project|education|container|showcase|analytics|workflow|typography)/.test(text)) {
    score += 8;
  }

  return Math.max(0, Math.min(100, score));
};

export const deriveMotionAssetTaxonomy = (manifest: MotionAssetManifest): MotionAssetTaxonomy => {
  const sourceKind = inferSourceKind(manifest);
  const structuralRegions = (manifest.structuralRegions ?? []).map(normalizeStructuralRegion);
  const semanticTags = unique([
    ...(manifest.semanticTags ?? []),
    ...inferSemanticTags(manifest)
  ]);
  const subjectTags = unique([
    ...(manifest.subjectTags ?? []),
    ...inferSubjectTags(manifest)
  ]);
  const emotionalTags = unique([
    ...(manifest.emotionalTags ?? []),
    ...inferEmotionalTags(manifest)
  ]) as MotionMoodTag[];
  const text = normalizeText(assetTextPool(manifest).join(" "));
  const functionalTags = unique([
    ...(manifest.functionalTags ?? []),
    ...buildFunctionalTags(manifest, text)
  ]);
  const semanticTriggers = unique([
    ...(manifest.semanticTriggers ?? []),
    ...buildSemanticTriggers(manifest, text)
  ]);
  const lifecycle = manifest.lifecycle ?? inferLifecycle(manifest, sourceKind);
  const accessPolicy = manifest.accessPolicy ?? inferAccessPolicy(manifest, sourceKind);
  const renderMode = manifest.renderMode ?? inferRenderMode(manifest, sourceKind);
  const runtimeParams = {
    ...inferRuntimeParams(manifest),
    ...(manifest.runtimeParams ?? {})
  };
  const visualWeight = typeof manifest.visualWeight === "number"
    ? clamp01(manifest.visualWeight)
    : inferVisualWeight(manifest, semanticTags, emotionalTags);
  const idealDurationMs = typeof manifest.idealDurationMs === "number"
    ? Math.max(240, Math.round(manifest.idealDurationMs))
    : inferIdealDurationMs(manifest, semanticTags);
  const placementPreference = unique([
    ...(manifest.placementPreference ?? []),
    ...inferPlacementPreference(manifest, semanticTags)
  ]);
  const reuseFrequencyLimit = typeof manifest.reuseFrequencyLimit === "number"
    ? Math.max(1, Math.round(manifest.reuseFrequencyLimit))
    : inferReuseFrequencyLimit(semanticTags);
  const conflictRules = unique([
    ...(manifest.conflictRules ?? []),
    ...inferConflictRules(semanticTags, emotionalTags)
  ]);
  const redundancyRiskScore = typeof manifest.redundancyRiskScore === "number"
    ? clamp01(manifest.redundancyRiskScore)
    : inferRedundancyRiskScore(semanticTags);
  const metadataConfidence = inferMetadataConfidence({manifest, semanticTags, structuralRegions});
  const coverageStatus = inferCoverageStatus({manifest, structuralRegions, metadataConfidence});

  return {
    semanticTags,
    subjectTags,
    emotionalTags,
    functionalTags,
    semanticTriggers,
    visualWeight,
    idealDurationMs,
    placementPreference,
    reuseFrequencyLimit,
    conflictRules,
    redundancyRiskScore,
    structuralRegions,
    partialRevealSupported: manifest.partialRevealSupported ?? structuralRegions.some((region) => region.revealMode !== "always"),
    metadataConfidence,
    coverageStatus,
    lifecycle,
    accessPolicy,
    preloadPriority: manifest.preloadPriority ?? inferPreloadPriority(manifest, semanticTags, emotionalTags),
    runtimeParams,
    renderMode,
    sourceKind
  };
};

export const enrichMotionAssetManifest = <T extends MotionAssetManifest>(manifest: T): T & MotionAssetManifest => {
  const taxonomy = deriveMotionAssetTaxonomy(manifest);
  const searchTerms = unique([
    ...(manifest.searchTerms ?? []),
    ...taxonomy.semanticTags,
    ...taxonomy.subjectTags,
    ...taxonomy.emotionalTags,
    ...taxonomy.functionalTags,
    ...taxonomy.semanticTriggers,
    manifest.canonicalLabel,
    manifest.family,
    manifest.tier,
    manifest.assetRole,
    manifest.sourceKind,
    manifest.lifecycle,
    manifest.renderMode,
    manifest.placementZone,
    manifest.durationPolicy,
    manifest.safeArea,
    manifest.sourceBatch,
    manifest.sourceFile,
    manifest.sourceHtml
  ].flatMap((value) => buildTextTerms(String(value ?? ""))));

  return {
    ...manifest,
    sourceKind: taxonomy.sourceKind,
    semanticTags: taxonomy.semanticTags,
    subjectTags: taxonomy.subjectTags,
    emotionalTags: taxonomy.emotionalTags,
    functionalTags: taxonomy.functionalTags,
    semanticTriggers: taxonomy.semanticTriggers,
    visualWeight: taxonomy.visualWeight,
    idealDurationMs: taxonomy.idealDurationMs,
    placementPreference: taxonomy.placementPreference,
    reuseFrequencyLimit: taxonomy.reuseFrequencyLimit,
    conflictRules: taxonomy.conflictRules,
    redundancyRiskScore: taxonomy.redundancyRiskScore,
    structuralRegions: taxonomy.structuralRegions,
    partialRevealSupported: taxonomy.partialRevealSupported,
    replaceableTextSlots: manifest.replaceableTextSlots,
    replaceableNumericSlots: manifest.replaceableNumericSlots,
    showMode: manifest.showMode,
    metadataConfidence: taxonomy.metadataConfidence,
    coverageStatus: taxonomy.coverageStatus,
    lifecycle: taxonomy.lifecycle,
    accessPolicy: taxonomy.accessPolicy,
    preloadPriority: taxonomy.preloadPriority,
    runtimeParams: taxonomy.runtimeParams,
    renderMode: taxonomy.renderMode,
    searchTerms,
    themeTags: unique([
      ...(manifest.themeTags ?? []),
      ...taxonomy.emotionalTags
    ]) as MotionMoodTag[]
  };
};

export const scoreMotionAssetProximity = ({
  queryText,
  asset
}: {
  queryText?: string;
  asset: MotionAssetManifest;
}): number => {
  if (!queryText) {
    return 0;
  }

  const normalizedQuery = normalizeText(queryText);
  if (!normalizedQuery) {
    return 0;
  }

  const queryTokens = tokenize(normalizedQuery);
  if (queryTokens.length === 0) {
    return 0;
  }

  const taxonomy = deriveMotionAssetTaxonomy(asset);
  const assetTerms = new Set([
    ...(asset.searchTerms ?? []),
    ...taxonomy.semanticTags,
    ...taxonomy.subjectTags,
    ...taxonomy.emotionalTags,
    ...taxonomy.functionalTags,
    ...taxonomy.semanticTriggers,
    asset.canonicalLabel ?? "",
    asset.family,
    asset.tier,
    asset.placementZone,
    asset.assetRole ?? "",
    asset.lifecycle ?? "",
    asset.renderMode ?? ""
  ].flatMap((value) => buildTextTerms(String(value ?? ""))));

  let score = 0;

  queryTokens.forEach((token, index) => {
    if (assetTerms.has(token)) {
      score += 3;
      const previousToken = index > 0 ? queryTokens[index - 1] : "";
      const nextToken = index < queryTokens.length - 1 ? queryTokens[index + 1] : "";
      if (previousToken && assetTerms.has(`${previousToken} ${token}`)) {
        score += 4;
      }
      if (nextToken && assetTerms.has(`${token} ${nextToken}`)) {
        score += 4;
      }
    }
  });

  const phraseMatches = [
    asset.canonicalLabel,
    ...(taxonomy.subjectTags ?? []),
    ...(taxonomy.semanticTags ?? []),
    ...(taxonomy.emotionalTags ?? [])
  ].filter(Boolean);
  phraseMatches.forEach((phrase) => {
    const normalizedPhrase = normalizeText(String(phrase));
    if (!normalizedPhrase) {
      return;
    }
    if (normalizedQuery.includes(normalizedPhrase)) {
      score += normalizedPhrase.includes(" ") ? 10 : 6;
    }
  });

  const matchedTokens = queryTokens.filter((token) => assetTerms.has(token));
  if (matchedTokens.length >= 2) {
    const firstIndex = queryTokens.findIndex((token) => assetTerms.has(token));
    const lastIndex = [...queryTokens].reverse().findIndex((token) => assetTerms.has(token));
    const reversedLastIndex = lastIndex < 0 ? -1 : queryTokens.length - 1 - lastIndex;
    const span = firstIndex >= 0 && reversedLastIndex >= 0 ? Math.max(0, reversedLastIndex - firstIndex) : queryTokens.length;
    score += Math.max(0, 14 - span * 2);
  }

  if (taxonomy.semanticTags.some((tag) => ["folder", "project", "container", "education"].includes(tag))) {
    score += 6;
  }
  if (taxonomy.emotionalTags.some((tag) => tag === "authority" || tag === "heroic")) {
    score += 3;
  }

  return score;
};
