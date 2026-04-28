import {readFile} from "node:fs/promises";
import path from "node:path";

import type {AnimationLayeringRule, AnimationTriggerType} from "../types";

export type AnimationPrototypeSourceSignals = {
  detectedElements: string[];
  dataAttributes: string[];
  keywords: string[];
};

export type AnimationPrototypeStructuralRegion = {
  id: string;
  label: string;
  role: string;
  selector?: string;
  revealMode: "always" | "optional" | "partial" | "progressive" | "hidden";
  hideable: boolean;
  optional: boolean;
  canBeShownAlone: boolean;
  importance: number;
  notes?: string;
};

export type AnimationPrototypeCoverageStatus = "complete" | "partial" | "untagged" | "review" | "unsupported";

export type AnimationPrototypeRecord = {
  id: string;
  label: string;
  fileName: string;
  relativePath: string;
  sourceRoot: string;
  type: "text" | "svg" | "overlay" | "motion-effect";
  category: string;
  triggerType: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith: string[];
  layeringRules: AnimationLayeringRule[];
  graphTags: string[];
  aliases: string[];
  notes: string;
  sourceKind: "html-prototype";
  signals: AnimationPrototypeSourceSignals;
  functionalTags?: string[];
  semanticTriggers?: string[];
  visualWeight?: number;
  idealDurationMs?: number;
  placementPreference?: string[];
  reuseFrequencyLimit?: number;
  conflictRules?: string[];
  redundancyRiskScore?: number;
  structuralRegions?: AnimationPrototypeStructuralRegion[];
  partialRevealSupported?: boolean;
  replaceableTextSlots?: number;
  replaceableNumericSlots?: number;
  showMode?: "full" | "partial" | "background" | "accent";
  metadataConfidence?: number;
  coverageStatus?: AnimationPrototypeCoverageStatus;
};

export type AnimationPrototypeScanOptions = {
  sourceRoot: string;
  rootLabel?: string;
};

export type AnimationPrototypeFileRecord = {
  filePath: string;
  relativePath: string;
  fileName: string;
  content: string;
};

const ENV_ANIMATION_PROTOTYPE_ROOT = process.env.STRUCTURED_ANIMATION_ROOT?.trim() || process.env.ANIMATION_PROTOTYPE_ROOT?.trim() || "";

export const DEFAULT_ANIMATION_PROTOTYPE_ROOT = ENV_ANIMATION_PROTOTYPE_ROOT || "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\STRUCTURED ANIMATION";

export const DEFAULT_ANIMATION_PROTOTYPE_OUTPUT = path.join(
  process.cwd(),
  "src",
  "data",
  "animation-prototypes.generated.json"
);

export const DEFAULT_ANIMATION_PROTOTYPE_COVERAGE_OUTPUT = path.join(
  process.cwd(),
  "src",
  "data",
  "animation-prototypes.coverage.generated.json"
);

const ANIMATION_TRIGGER_ORDER: AnimationTriggerType[] = ["timeline", "word-level", "syllable-level"];

const TEXT_KEYWORDS = new Set([
  "word",
  "words",
  "text",
  "title",
  "quote",
  "typewriter",
  "typing",
  "highlight",
  "underline",
  "circle",
  "glow",
  "cursor",
  "replaceable"
]);

const TRANSITION_KEYWORDS = new Set([
  "blur",
  "reveal",
  "message",
  "interaction",
  "animation",
  "motion",
  "float",
  "fade",
  "transition"
]);

const TEMPLATE_KEYWORDS = new Set([
  "graph",
  "chart",
  "counter",
  "kpi",
  "date",
  "calendar",
  "step",
  "steps",
  "workflow",
  "blueprint",
  "timeline"
]);

const CARD_KEYWORDS = new Set([
  "card",
  "cards",
  "panel",
  "section",
  "social",
  "youtube",
  "facebook",
  "twitter",
  "linkedin",
  "instagram"
]);

const SEMANTIC_FAMILY_KEYWORDS = {
  comparison: ["comparison", "compare", "vs", "versus", "contrast", "tradeoff", "decision"],
  call: ["call", "calling", "contact", "outreach", "phone", "reach"],
  list: ["list", "step", "steps", "sequence", "ordered", "checkmark"],
  growth: ["growth", "grow", "increase", "progress", "scale", "improve"],
  counter: ["counter", "count", "countup", "metric", "stat", "statistics", "kpi", "percent"],
  quote: ["quote", "speech", "statement", "said", "quoted"],
  cta: ["cta", "subscribe", "follow", "join", "click", "download", "start"],
  bubble: ["bubble", "glass", "card", "panel", "callout"],
  focus: ["focus", "zoom", "spotlight", "target", "camera"],
  highlight: ["highlight", "underline", "circle", "replaceable", "emphasis"],
  timeline: ["timeline", "calendar", "date", "time"],
  workflow: ["workflow", "blueprint", "process", "pipeline"]
} as const;

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const slugify = (value: string): string => {
  return normalizeText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
};

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const titleCaseWord = (word: string): string => {
  if (/^[A-Z0-9]{2,}$/.test(word)) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

const humanizeLabel = (value: string): string => {
  return value
    .replace(/\.(html?|xhtml)$/i, "")
    .replace(/[()]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => titleCaseWord(word))
    .join(" ");
};

const extractFileStem = (fileName: string): string => {
  return fileName.replace(/\.(html?|xhtml)$/i, "");
};

const stripDetailSuffix = (fileStem: string): string => {
  return fileStem.split("(")[0]?.trim().replace(/[,\-]+$/, "").trim() || fileStem.trim();
};

const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
};

const collectKeywords = (fileName: string, content: string): string[] => {
  const sourceName = normalizeText(stripDetailSuffix(extractFileStem(fileName)));
  const hits = new Set<string>();

  tokenize(sourceName).forEach((token) => hits.add(token));

  const addIfPresent = (pattern: RegExp, tags: string[]): void => {
    if (pattern.test(content) || pattern.test(sourceName)) {
      tags.forEach((tag) => hits.add(tag));
    }
  };

  addIfPresent(/data-replaceable|syllabic break|part-one|part-two|replaceable/i, ["core", "replaceable", "syllabic", "word"]);
  addIfPresent(/<svg|preserveAspectRatio|viewbox/i, ["svg"]);
  addIfPresent(/<canvas/i, ["canvas"]);
  addIfPresent(/compare|comparison|versus|tradeoff|decision/i, ["comparison", "contrast", "analytical"]);
  addIfPresent(/call|contact|outreach|reach out/i, ["call", "contact", "outreach"]);
  addIfPresent(/step|sequence|ordered|list|check mark|checkmark/i, ["list", "steps", "sequence"]);
  addIfPresent(/grow|growth|increase|progress|scale/i, ["growth", "progress", "scale"]);
  addIfPresent(/counter|count up|countup|percent|percentage|kpi|metric/i, ["counter", "numeric", "kpi"]);
  addIfPresent(/quote|said|speech|quoted/i, ["quote", "speech"]);
  addIfPresent(/cta|subscribe|follow|join|click|download|start/i, ["cta", "action"]);
  addIfPresent(/bubble|glass|card|callout/i, ["bubble", "card", "accent"]);
  addIfPresent(/focus|zoom|spotlight|target|camera/i, ["focus", "zoom"]);
  addIfPresent(/timeline|calendar|date|time/i, ["timeline", "calendar"]);
  addIfPresent(/workflow|blueprint|process|pipeline/i, ["workflow", "blueprint"]);

  return [...hits];
};

const familyHasAny = (keywords: string[], family: keyof typeof SEMANTIC_FAMILY_KEYWORDS): boolean => {
  return keywords.some((keyword) => SEMANTIC_FAMILY_KEYWORDS[family].some((entry) => keyword.includes(entry)));
};

const textHasAny = (text: string, family: keyof typeof SEMANTIC_FAMILY_KEYWORDS): boolean => {
  return SEMANTIC_FAMILY_KEYWORDS[family].some((entry) => new RegExp(`\\b${entry.replace(/\s+/g, "\\s+")}\\b`, "i").test(text));
};

const inferPrototypeCinematicTags = (fileName: string, keywords: string[], content: string): string[] => {
  const normalized = normalizeText(`${fileName} ${keywords.join(" ")} ${content}`);
  const tags = new Set<string>(["cinematic", "premium"]);

  if (/(text|quote|typewriter|highlight|underline|step|steps|list|card|comparison|call|cta|growth|counter|timeline|workflow|selection|reveal|blur|bubble)/.test(normalized)) {
    tags.add("editorial");
  }
  if (/(glass|blur|frosted|bubble|card|panel|selection|clean|apple|minimal)/.test(normalized)) {
    tags.add("minimal");
  }
  if (/(glass|frosted|bubble|card|panel|blur|glow|shine)/.test(normalized)) {
    tags.add("glassmorphism");
  }
  if (/(glow|neon|hero|heroic|motion|animation|drift|parallax|reveal)/.test(normalized)) {
    tags.add("luminous");
  }

  return [...tags];
};

const inferPrototypeFunctionalTags = (fileName: string, keywords: string[], content: string): string[] => {
  const normalized = normalizeText(`${fileName} ${keywords.join(" ")} ${content}`);
  const tags = new Set<string>(keywords);
  const add = (family: keyof typeof SEMANTIC_FAMILY_KEYWORDS, extra: string[] = []): void => {
    if (!textHasAny(normalized, family) && !familyHasAny(keywords, family)) {
      return;
    }
    SEMANTIC_FAMILY_KEYWORDS[family].forEach((entry) => tags.add(entry));
    extra.forEach((entry) => tags.add(entry));
  };

  add("comparison", ["dual", "contrast", "analytical", "decision", "tradeoff", "side-by-side", "comparison-graphic"]);
  add("call", ["communication", "outreach", "contact", "phone", "reach-out", "callout"]);
  add("list", ["ordered", "sequence", "staggered", "steps", "checkmark", "process", "progression"]);
  add("growth", ["progress", "scale", "improvement", "trend", "increase", "upward", "ramp"]);
  add("counter", ["numeric", "metric", "kpi", "count-up", "statistics", "data", "score"]);
  add("quote", ["editorial", "speech", "statement", "spoken", "citation", "pull-quote"]);
  add("cta", ["conversion", "action", "subscribe", "follow", "join", "click", "prompt"]);
  add("bubble", ["accent", "floating", "glass", "rare-accent", "callout", "panel"]);
  add("focus", ["zoom", "spotlight", "center", "target", "camera", "framing"]);
  add("highlight", ["underline", "circle", "replaceable", "word-showcase", "emphasis", "syllabic-break"]);
  add("timeline", ["time", "date", "calendar", "chronology", "schedule"]);
  add("workflow", ["blueprint", "process", "pipeline", "system", "flow"]);

  if (normalized.includes("svg")) {
    tags.add("svg");
    tags.add("vector");
  }
  if (normalized.includes("motion") || normalized.includes("animation")) {
    tags.add("motion");
    tags.add("animated");
  }
  inferPrototypeCinematicTags(fileName, keywords, content).forEach((tag) => tags.add(tag));

  return [...tags];
};

const inferPrototypeSemanticTriggers = (fileName: string, keywords: string[], content: string): string[] => {
  const normalized = normalizeText(`${fileName} ${keywords.join(" ")} ${content}`);
  const triggers = new Set<string>();
  const triggerRules: Array<{family: keyof typeof SEMANTIC_FAMILY_KEYWORDS; triggers: string[]}> = [
    {family: "comparison", triggers: ["this-vs-that", "comparison-moment", "evaluate-two-values"]},
    {family: "call", triggers: ["call-moment", "contact-action", "outreach-moment"]},
    {family: "list", triggers: ["ordered-sequence", "step-one-to-step-n"]},
    {family: "growth", triggers: ["growth-moment", "progress-arc", "increase-moment"]},
    {family: "counter", triggers: ["numeric-emphasis", "count-up", "metric-moment"]},
    {family: "quote", triggers: ["quote-moment", "spoken-statement"]},
    {family: "cta", triggers: ["cta-moment", "action-prompt"]},
    {family: "bubble", triggers: ["rare-accent", "glass-card"]},
    {family: "focus", triggers: ["focus-target", "camera-focus"]},
    {family: "highlight", triggers: ["word-emphasis", "replaceable-word"]},
    {family: "timeline", triggers: ["time-marker", "timeline-beat"]},
    {family: "workflow", triggers: ["workflow-step", "process-map"]}
  ];

  triggerRules.forEach((rule) => {
    if (textHasAny(normalized, rule.family) || familyHasAny(keywords, rule.family)) {
      rule.triggers.forEach((trigger) => triggers.add(trigger));
    }
  });

  if (normalized.includes("syllabic") || normalized.includes("break for core words")) {
    triggers.add("syllabic-break");
    triggers.add("core-word-showcase");
  }

  if (normalized.includes("typewriter") || normalized.includes("typing") || normalized.includes("cursor")) {
    triggers.add("word-level");
  }

  return [...triggers];
};

const inferPrototypeVisualWeight = (category: string, type: AnimationPrototypeRecord["type"], keywords: string[]): number => {
  if (category === "comparison") return 0.76;
  if (category === "call") return 0.56;
  if (category === "list") return 0.62;
  if (category === "growth") return 0.68;
  if (category === "counter") return 0.7;
  if (category === "quote") return 0.6;
  if (category === "cta") return 0.58;
  if (category === "bubble-card") return 0.46;
  if (category === "focus") return 0.72;
  if (category === "highlight") return 0.64;
  if (type === "svg") return 0.66;
  if (keywords.includes("timeline") || keywords.includes("workflow")) return 0.64;
  return 0.52;
};

const inferPrototypeIdealDurationMs = (category: string, keywords: string[]): number => {
  if (category === "comparison") return 1800;
  if (category === "call") return 1400;
  if (category === "list") return 1900;
  if (category === "growth") return 2000;
  if (category === "counter") return 1500;
  if (category === "quote") return 1800;
  if (category === "cta") return 1500;
  if (category === "bubble-card") return 1700;
  if (category === "focus") return 1300;
  if (category === "highlight") return 1400;
  if (keywords.includes("timeline")) return 1800;
  if (keywords.includes("workflow")) return 1900;
  return 1600;
};

const inferPrototypePlacementPreference = (category: string): string[] => {
  if (category === "comparison") return ["left", "right", "center"];
  if (category === "call") return ["side", "lower-third", "corner"];
  if (category === "list") return ["lower-third", "center", "stack"];
  if (category === "growth") return ["lower-third", "center", "side"];
  if (category === "counter") return ["center", "lower-third", "top"];
  if (category === "quote") return ["center", "upper-perimeter", "lower-third"];
  if (category === "cta") return ["lower-third", "corner", "center"];
  if (category === "bubble-card") return ["corner", "side", "floating"];
  if (category === "focus") return ["center", "full-frame"];
  if (category === "highlight") return ["center", "word-level", "inline"];
  return ["center"];
};

const inferPrototypeReuseLimit = (category: string): number => {
  if (category === "cta") return 2;
  if (category === "bubble-card") return 2;
  if (category === "comparison") return 3;
  if (category === "call") return 3;
  if (category === "growth") return 3;
  if (category === "counter") return 4;
  if (category === "quote") return 4;
  if (category === "list") return 5;
  if (category === "focus") return 3;
  return 4;
};

const inferPrototypeConflictRules = (category: string): string[] => {
  const rules: string[] = [];
  if (category === "comparison") {
    rules.push("single-comparison-per-window", "avoid-competing-focal-elements");
  }
  if (category === "call") {
    rules.push("avoid-repeat-in-short-window");
  }
  if (category === "list") {
    rules.push("respect-order", "one-step-per-beat");
  }
  if (category === "growth") {
    rules.push("one-growth-idea-per-beat");
  }
  if (category === "counter") {
    rules.push("suppress-duplicate-literal-number", "prefer-italic-percent-signal");
  }
  if (category === "quote") {
    rules.push("one-quote-dominant-visual");
  }
  if (category === "cta") {
    rules.push("single-cta-per-window");
  }
  if (category === "bubble-card") {
    rules.push("rare-accent-only", "max-two-per-five-minutes");
  }
  if (category === "focus") {
    rules.push("align-to-target-bounding-box");
  }
  return rules;
};

const inferPrototypeRedundancyRisk = (category: string): number => {
  if (category === "counter") return 0.5;
  if (category === "bubble-card") return 0.44;
  if (category === "cta") return 0.35;
  if (category === "comparison") return 0.31;
  if (category === "call") return 0.26;
  if (category === "list") return 0.23;
  if (category === "growth") return 0.28;
  if (category === "quote") return 0.21;
  if (category === "focus") return 0.24;
  return 0.2;
};

const buildPrototypeRegion = (
  id: string,
  label: string,
  role: string,
  overrides: Partial<AnimationPrototypeStructuralRegion> = {}
): AnimationPrototypeStructuralRegion => ({
  id,
  label,
  role,
  selector: overrides.selector,
  revealMode: overrides.revealMode ?? "optional",
  hideable: overrides.hideable ?? true,
  optional: overrides.optional ?? true,
  canBeShownAlone: overrides.canBeShownAlone ?? false,
  importance: typeof overrides.importance === "number" ? Math.max(0, Math.min(1, overrides.importance)) : 0.5,
  notes: overrides.notes
});

const inferPrototypeStructuralRegions = ({
  fileName,
  category,
  keywords,
  content,
  type
}: {
  fileName: string;
  category: string;
  keywords: string[];
  content: string;
  type: AnimationPrototypeRecord["type"];
}): AnimationPrototypeStructuralRegion[] => {
  const normalized = normalizeText(`${fileName} ${keywords.join(" ")} ${content}`);
  const regions: AnimationPrototypeStructuralRegion[] = [];
  const push = (region: AnimationPrototypeStructuralRegion): void => {
    if (!regions.some((entry) => entry.id === region.id)) {
      regions.push(region);
    }
  };

  if (category === "comparison") {
    push(buildPrototypeRegion("comparison-left", "Comparison Left", "comparison-label", {selector: "[data-region='comparison-left']", canBeShownAlone: true, importance: 0.92, revealMode: "always"}));
    push(buildPrototypeRegion("comparison-right", "Comparison Right", "comparison-label", {selector: "[data-region='comparison-right']", canBeShownAlone: true, importance: 0.92, revealMode: "always"}));
    push(buildPrototypeRegion("comparison-divider", "Comparison Divider", "separator", {selector: "[data-region='comparison-divider']", importance: 0.66, revealMode: "optional"}));
    push(buildPrototypeRegion("comparison-caption", "Comparison Caption", "supporting-text", {selector: "[data-region='comparison-caption']", importance: 0.58, revealMode: "progressive"}));
  }

  if (category === "call") {
    push(buildPrototypeRegion("call-title", "Call Title", "headline", {selector: "[data-region='call-title']", canBeShownAlone: true, importance: 0.8, revealMode: "always"}));
    push(buildPrototypeRegion("call-body", "Call Body", "body", {selector: "[data-region='call-body']", importance: 0.66, revealMode: "progressive"}));
    push(buildPrototypeRegion("call-icon", "Call Icon", "icon", {selector: "[data-region='call-icon']", importance: 0.4, revealMode: "optional"}));
    push(buildPrototypeRegion("call-action", "Call Action", "action", {selector: "[data-region='call-action']", importance: 0.7, revealMode: "always"}));
  }

  if (category === "list") {
    push(buildPrototypeRegion("list-step-indicator", "Step Indicator", "step-indicator", {selector: "[data-region='step-indicator']", canBeShownAlone: true, importance: 0.7, revealMode: "always"}));
    push(buildPrototypeRegion("list-step-body", "Step Body", "step-body", {selector: "[data-region='step-body']", importance: 0.82, revealMode: "progressive"}));
    push(buildPrototypeRegion("list-number", "Step Number", "number-slot", {selector: "[data-region='step-number']", canBeShownAlone: true, importance: 0.86, revealMode: "always"}));
    push(buildPrototypeRegion("list-connector", "Sequence Connector", "connector", {selector: "[data-region='sequence-connector']", importance: 0.48, revealMode: "optional"}));
  }

  if (category === "growth") {
    push(buildPrototypeRegion("growth-plot", "Growth Plot", "chart-area", {selector: "[data-region='growth-plot']", canBeShownAlone: true, importance: 0.92, revealMode: "always"}));
    push(buildPrototypeRegion("growth-bars", "Growth Bars", "graph-bars", {selector: "[data-region='growth-bars']", importance: 0.9, revealMode: "progressive"}));
    push(buildPrototypeRegion("growth-label", "Growth Label", "metric-label", {selector: "[data-region='growth-label']", importance: 0.68, revealMode: "optional"}));
    push(buildPrototypeRegion("growth-trend", "Trend Line", "trend-line", {selector: "[data-region='growth-trend']", importance: 0.74, revealMode: "progressive"}));
  }

  if (category === "counter") {
    push(buildPrototypeRegion("counter-number", "Counter Number", "number-slot", {selector: "[data-region='counter-number']", canBeShownAlone: true, importance: 0.96, revealMode: "always"}));
    push(buildPrototypeRegion("counter-unit", "Counter Unit", "unit-label", {selector: "[data-region='counter-unit']", importance: 0.58, revealMode: "optional"}));
    push(buildPrototypeRegion("counter-percent", "Percent Sign", "percent-sign", {selector: "[data-region='counter-percent']", importance: 0.42, revealMode: "optional"}));
    push(buildPrototypeRegion("counter-support", "Support Copy", "support-copy", {selector: "[data-region='counter-support']", importance: 0.62, revealMode: "progressive"}));
  }

  if (category === "quote") {
    push(buildPrototypeRegion("quote-body", "Quote Body", "quote-body", {selector: "[data-region='quote-body']", canBeShownAlone: true, importance: 0.9, revealMode: "always"}));
    push(buildPrototypeRegion("quote-attribution", "Attribution", "attribution", {selector: "[data-region='quote-attribution']", importance: 0.62, revealMode: "optional"}));
    push(buildPrototypeRegion("quote-mark", "Quote Mark", "quote-mark", {selector: "[data-region='quote-mark']", importance: 0.38, revealMode: "optional"}));
  }

  if (category === "cta") {
    push(buildPrototypeRegion("cta-headline", "CTA Headline", "headline", {selector: "[data-region='cta-headline']", canBeShownAlone: true, importance: 0.86, revealMode: "always"}));
    push(buildPrototypeRegion("cta-action", "CTA Action", "action", {selector: "[data-region='cta-action']", importance: 0.92, revealMode: "always"}));
    push(buildPrototypeRegion("cta-support", "CTA Support", "support-copy", {selector: "[data-region='cta-support']", importance: 0.54, revealMode: "progressive"}));
  }

  if (category === "bubble-card") {
    push(buildPrototypeRegion("bubble-frame", "Bubble Frame", "frame", {selector: "[data-region='bubble-frame']", canBeShownAlone: true, importance: 0.66, revealMode: "always"}));
    push(buildPrototypeRegion("bubble-body", "Bubble Body", "body", {selector: "[data-region='bubble-body']", importance: 0.8, revealMode: "progressive"}));
    push(buildPrototypeRegion("bubble-accent", "Accent Chip", "accent", {selector: "[data-region='bubble-accent']", importance: 0.44, revealMode: "optional"}));
  }

  if (category === "focus") {
    push(buildPrototypeRegion("focus-target", "Focus Target", "target-region", {selector: "[data-region='focus-target']", canBeShownAlone: true, importance: 0.95, revealMode: "always"}));
    push(buildPrototypeRegion("focus-vignette", "Vignette", "background-dim", {selector: "[data-region='focus-vignette']", importance: 0.4, revealMode: "optional"}));
    push(buildPrototypeRegion("focus-support", "Support Layer", "support-layer", {selector: "[data-region='focus-support']", importance: 0.5, revealMode: "progressive"}));
  }

  if (category === "highlight" || category === "emphasis") {
    push(buildPrototypeRegion("highlight-word", "Highlight Word", "replaceable-text", {selector: "[data-region='highlight-word']", canBeShownAlone: true, importance: 0.95, revealMode: "always"}));
    push(buildPrototypeRegion("highlight-underline", "Underline Stroke", "underline", {selector: "[data-region='underline']", importance: 0.7, revealMode: "optional"}));
    push(buildPrototypeRegion("highlight-circle", "Circle Stroke", "circle", {selector: "[data-region='circle']", importance: 0.68, revealMode: "optional"}));
  }

  if (normalized.includes("timeline") || category === "template-graphic" && keywords.some((keyword) => ["timeline", "calendar", "date", "time"].includes(keyword))) {
    push(buildPrototypeRegion("timeline-track", "Timeline Track", "timeline-track", {selector: "[data-region='timeline-track']", canBeShownAlone: true, importance: 0.86, revealMode: "always"}));
    push(buildPrototypeRegion("timeline-marker", "Timeline Marker", "timeline-marker", {selector: "[data-region='timeline-marker']", importance: 0.72, revealMode: "progressive"}));
    push(buildPrototypeRegion("timeline-label", "Timeline Label", "label", {selector: "[data-region='timeline-label']", importance: 0.6, revealMode: "optional"}));
  }

  if (normalized.includes("workflow") || category === "template-graphic" && keywords.some((keyword) => ["workflow", "blueprint", "steps", "process"].includes(keyword))) {
    push(buildPrototypeRegion("workflow-step", "Workflow Step", "step-card", {selector: "[data-region='workflow-step']", canBeShownAlone: true, importance: 0.88, revealMode: "always"}));
    push(buildPrototypeRegion("workflow-connector", "Workflow Connector", "connector", {selector: "[data-region='workflow-connector']", importance: 0.58, revealMode: "optional"}));
    push(buildPrototypeRegion("workflow-note", "Workflow Note", "support-note", {selector: "[data-region='workflow-note']", importance: 0.52, revealMode: "progressive"}));
  }

  if (regions.length === 0) {
    push(buildPrototypeRegion(`${slugify(stripDetailSuffix(extractFileStem(fileName)))}-full`, "Full Frame", "full-frame", {selector: "[data-region='root']", canBeShownAlone: true, importance: 0.9, revealMode: "always"}));
  }

  if (type === "svg" && !regions.some((region) => region.role === "svg-root")) {
    push(buildPrototypeRegion("svg-root", "SVG Root", "svg-root", {selector: "svg", canBeShownAlone: true, importance: 0.95, revealMode: "always"}));
  }

  return regions;
};

const inferPrototypeMetadataConfidence = ({
  keywords,
  dataAttributes,
  structuralRegions,
  category,
  type,
  content
}: {
  keywords: string[];
  dataAttributes: string[];
  structuralRegions: AnimationPrototypeStructuralRegion[];
  category: string;
  type: AnimationPrototypeRecord["type"];
  content: string;
}): number => {
  let confidence = 0.42;
  confidence += Math.min(0.22, keywords.length * 0.015);
  confidence += Math.min(0.14, dataAttributes.length * 0.04);
  confidence += Math.min(0.18, structuralRegions.length * 0.04);
  if (category !== "motion-effect") {
    confidence += 0.12;
  }
  if (type === "svg") {
    confidence += 0.05;
  }
  if (/data-replaceable|syllabic break|highlight|underline|circle|graph|chart|counter|step|workflow|quote|call|cta/i.test(content)) {
    confidence += 0.08;
  }
  // Repeated module classes usually mean the prototype has a clear reusable structure.
  const classMatches = [...content.matchAll(/class\s*=\s*["']([^"']+)["']/gi)].flatMap((match) => {
    return String(match[1] ?? "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  });
  if (classMatches.length > 0) {
    const counts = new Map<string, number>();
    classMatches.forEach((className) => {
      counts.set(className, (counts.get(className) ?? 0) + 1);
    });
    const strongestRepeat = Math.max(...counts.values());
    if (strongestRepeat >= 6) {
      confidence += 0.05;
    } else if (strongestRepeat >= 4) {
      confidence += 0.04;
    } else if (strongestRepeat >= 3) {
      confidence += 0.025;
    }
  }
  if (keywords.length >= 8) {
    confidence += 0.04;
  }
  return Math.max(0, Math.min(0.98, round(confidence)));
};

const inferPrototypeCoverageStatus = ({
  confidence,
  structuralRegions,
  keywords
}: {
  confidence: number;
  structuralRegions: AnimationPrototypeStructuralRegion[];
  keywords: string[];
}): AnimationPrototypeCoverageStatus => {
  if (keywords.length === 0) {
    return "untagged";
  }
  if (confidence >= 0.82 && structuralRegions.length >= 2) {
    return "complete";
  }
  if (confidence >= 0.62) {
    return "review";
  }
  return "partial";
};

const findDataAttributes = (content: string): string[] => {
  const attributes = new Set<string>();
  const matches = content.matchAll(/\b(data-[a-z0-9-]+)\s*=/gi);
  for (const match of matches) {
    attributes.add(match[1].toLowerCase());
  }
  return [...attributes];
};

const detectElements = (content: string): string[] => {
  const lower = content.toLowerCase();
  const elements = new Set<string>();
  if (lower.includes("<svg")) {
    elements.add("svg");
  }
  if (lower.includes("<canvas")) {
    elements.add("canvas");
  }
  if (lower.includes("<video")) {
    elements.add("video");
  }
  if (lower.includes("<div")) {
    elements.add("div");
  }
  if (lower.includes("<span")) {
    elements.add("span");
  }
  if (lower.includes("<button")) {
    elements.add("button");
  }
  return [...elements];
};

const inferType = ({
  content,
  keywords
}: {
  content: string;
  keywords: string[];
}): AnimationPrototypeRecord["type"] => {
  const lower = content.toLowerCase();
  if (lower.includes("<svg")) {
    return "svg";
  }
  if (familyHasAny(keywords, "bubble") || familyHasAny(keywords, "call")) {
    return "overlay";
  }
  if (familyHasAny(keywords, "highlight") || familyHasAny(keywords, "quote")) {
    return "text";
  }
  if (keywords.some((keyword) => CARD_KEYWORDS.has(keyword))) {
    return "overlay";
  }
  if (keywords.some((keyword) => TEMPLATE_KEYWORDS.has(keyword))) {
    return "motion-effect";
  }
  if (keywords.some((keyword) => TEXT_KEYWORDS.has(keyword))) {
    return "text";
  }
  if (keywords.some((keyword) => TRANSITION_KEYWORDS.has(keyword))) {
    return "motion-effect";
  }
  return "motion-effect";
};

const inferCategory = ({
  fileName,
  keywords
}: {
  fileName: string;
  keywords: string[];
}): string => {
  const normalizedFileName = normalizeText(fileName);

  if (normalizedFileName.includes("core replaceable word")) {
    return "emphasis";
  }
  if (familyHasAny(keywords, "comparison") || textHasAny(normalizedFileName, "comparison")) {
    return "comparison";
  }
  if (familyHasAny(keywords, "call") || textHasAny(normalizedFileName, "call")) {
    return "call";
  }
  if (familyHasAny(keywords, "list") || familyHasAny(keywords, "workflow")) {
    return "list";
  }
  if (familyHasAny(keywords, "growth")) {
    return "growth";
  }
  if (familyHasAny(keywords, "counter")) {
    return "counter";
  }
  if (familyHasAny(keywords, "quote")) {
    return "quote";
  }
  if (familyHasAny(keywords, "cta")) {
    return "cta";
  }
  if (familyHasAny(keywords, "bubble")) {
    return "bubble-card";
  }
  if (familyHasAny(keywords, "focus")) {
    return "focus";
  }
  if (keywords.includes("graph") || keywords.includes("chart")) {
    return "template-graphic";
  }
  if (keywords.includes("counter") || keywords.includes("kpi")) {
    return "template-graphic";
  }
  if (keywords.includes("date") || keywords.includes("calendar") || keywords.includes("timeline")) {
    return "template-graphic";
  }
  if (keywords.includes("workflow") || keywords.includes("blueprint") || keywords.includes("step") || keywords.includes("steps")) {
    return "template-graphic";
  }
  if (keywords.includes("card") || keywords.some((keyword) => CARD_KEYWORDS.has(keyword))) {
    return "card";
  }
  if (keywords.includes("highlight") || keywords.includes("underline") || keywords.includes("circle") || keywords.includes("glow")) {
    return "highlight";
  }
  if (keywords.includes("selection") || keywords.includes("focus")) {
    return "highlight";
  }
  if (keywords.includes("quote") || keywords.includes("blur") || keywords.includes("reveal") || keywords.includes("interaction")) {
    return "transition";
  }
  if (keywords.includes("typewriter") || keywords.includes("typing") || keywords.includes("cursor") || keywords.includes("replaceable")) {
    return "emphasis";
  }
  if (normalizedFileName.includes("youtube") || normalizedFileName.includes("facebook") || normalizedFileName.includes("twitter") || normalizedFileName.includes("linkedin") || normalizedFileName.includes("instagram")) {
    return "social";
  }
  return "motion-effect";
};

const inferTriggerType = ({
  category,
  keywords,
  content
}: {
  category: string;
  keywords: string[];
  content: string;
}): AnimationTriggerType | AnimationTriggerType[] => {
  const triggerTypes = new Set<AnimationTriggerType>();
  const source = normalizeText(`${keywords.join(" ")} ${content}`);

  if (category === "template-graphic" || category === "card" || category === "social" || category === "comparison" || category === "growth" || category === "counter" || category === "quote" || category === "cta" || category === "bubble-card" || category === "focus" || category === "list") {
    triggerTypes.add("timeline");
  }
  if (category === "highlight" || category === "emphasis" || category === "call") {
    triggerTypes.add("word-level");
  }
  if (category === "comparison" || category === "list" || category === "counter" || category === "growth") {
    triggerTypes.add("word-level");
  }
  if (source.includes("syllabic") || source.includes("syllable") || source.includes("break for core words")) {
    triggerTypes.add("syllable-level");
    triggerTypes.add("word-level");
  }
  if (source.includes("typewriter") || source.includes("typing") || source.includes("cursor") || source.includes("highlight-word")) {
    triggerTypes.add("word-level");
  }
  if (source.includes("graph") || source.includes("counter") || source.includes("steps") || source.includes("date")) {
    triggerTypes.add("timeline");
  }
  if (source.includes("quote") || source.includes("reveal") || source.includes("blur")) {
    triggerTypes.add("timeline");
  }

  if (triggerTypes.size === 0) {
    triggerTypes.add(category === "motion-effect" ? "timeline" : "word-level");
  }

  return triggerTypes.size === 1 ? [...triggerTypes][0] : [...triggerTypes].sort((left, right) => ANIMATION_TRIGGER_ORDER.indexOf(left) - ANIMATION_TRIGGER_ORDER.indexOf(right));
};

const inferCompatibleWith = ({
  category,
  keywords,
  fileName
}: {
  category: string;
  keywords: string[];
  fileName: string;
}): string[] => {
  const normalized = normalizeText(`${fileName} ${keywords.join(" ")}`);
  const compatibles = new Set<string>();

  if (normalized.includes("core replaceable word")) {
    ["highlight-word", "circle-reveal", "blur-underline", "typewriter"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "highlight" || category === "emphasis") {
    ["highlight-word", "circle-reveal", "blur-underline", "core-replaceable-word"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "comparison") {
    ["template-family:graph-chart", "primitive:highlight-word", "primitive:circle-reveal", "primitive:blur-underline", "semantic-sidecall-governor"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "call") {
    ["host:motion-choreography-overlay", "primitive:typewriter", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "list") {
    ["template-family:blueprint-workflow", "primitive:typewriter", "primitive:highlight-word", "semantic-sidecall-governor"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "growth") {
    ["template-family:graph-chart", "template-family:number-counter-kpi", "primitive:highlight-word", "semantic-sidecall-governor"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "counter") {
    ["template-family:number-counter-kpi", "primitive:highlight-word", "primitive:blur-underline", "semantic-sidecall-governor"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "quote") {
    ["host:svg-caption-overlay", "primitive:blur-reveal", "primitive:highlight-word"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "cta") {
    ["host:motion-showcase-overlay", "primitive:typewriter", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "bubble-card") {
    ["host:motion-choreography-overlay", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "focus") {
    ["focus-effect:target-focus-zoom", "host:semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "transition") {
    ["blur-reveal", "typewriter", "highlight-word"].forEach((entry) => compatibles.add(entry));
  }
  if (category === "template-graphic") {
    if (normalized.includes("graph") || normalized.includes("chart")) {
      ["template-family:graph-chart", "semantic-sidecall-governor", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
    }
    if (normalized.includes("counter") || normalized.includes("kpi")) {
      ["template-family:number-counter-kpi", "semantic-sidecall-governor", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
    }
    if (normalized.includes("date") || normalized.includes("calendar") || normalized.includes("timeline")) {
      ["template-family:timeline-calendar", "semantic-sidecall-governor", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
    }
    if (normalized.includes("step") || normalized.includes("workflow") || normalized.includes("blueprint")) {
      ["template-family:blueprint-workflow", "semantic-sidecall-governor", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
    }
  }
  if (category === "card" || category === "social") {
    ["motion-choreography-overlay", "semantic-sidecall-cue-visual"].forEach((entry) => compatibles.add(entry));
  }

  return [...compatibles];
};

const inferLayeringRules = ({
  type,
  category,
  fileName
}: {
  type: AnimationPrototypeRecord["type"];
  category: string;
  fileName: string;
}): AnimationLayeringRule[] => {
  const normalized = normalizeText(fileName);
  const zIndex = type === "svg" ? 12 : category === "template-graphic" ? 10 : category === "card" ? 8 : category === "transition" ? 6 : 14;
  const channel = type === "overlay" ? "overlay" : category === "template-graphic" ? "host" : category === "transition" ? "base" : "accent";

  return [
    {
      id: `${slugify(fileName) || "prototype"}-layer`,
      channel,
      zIndex,
      note: normalized.includes("core replaceable word")
        ? "Composite emphasis stack for the core-word pathway."
        : undefined
    }
  ];
};

const inferGraphTags = ({
  fileName,
  content,
  category,
  type,
  dataAttributes,
  keywords
}: {
  fileName: string;
  content: string;
  category: string;
  type: AnimationPrototypeRecord["type"];
  dataAttributes: string[];
  keywords: string[];
}): string[] => {
  const tags = new Set<string>();
  const normalized = normalizeText(`${fileName} ${content}`);

  tags.add(category);
  tags.add(type);
  keywords.forEach((keyword) => tags.add(keyword));
  dataAttributes.forEach((attribute) => tags.add(attribute));
  if (category === "comparison") {
    ["comparison", "vs", "contrast", "tradeoff", "decision", "analysis", "dual-concept", "side-by-side", "analytical", "compare"].forEach((tag) => tags.add(tag));
  }
  if (category === "call") {
    ["call", "contact", "outreach", "communication", "phone", "connection", "reach-out", "caller", "calling"].forEach((tag) => tags.add(tag));
  }
  if (category === "list") {
    ["list", "steps", "sequence", "ordered", "checkmark", "numbered", "process", "progression", "workflow"].forEach((tag) => tags.add(tag));
  }
  if (category === "growth") {
    ["growth", "progress", "increase", "scale", "improvement", "upward", "trend", "momentum"].forEach((tag) => tags.add(tag));
  }
  if (category === "counter") {
    ["counter", "numeric", "metric", "kpi", "statistics", "count-up", "number", "data"].forEach((tag) => tags.add(tag));
  }
  if (category === "quote") {
    ["quote", "speech", "statement", "editorial", "citation", "spoken"].forEach((tag) => tags.add(tag));
  }
  if (category === "cta") {
    ["cta", "conversion", "action", "subscribe", "follow", "join", "click", "prompt"].forEach((tag) => tags.add(tag));
  }
  if (category === "bubble-card") {
    ["bubble", "card", "glass", "accent", "floating", "supporting", "callout"].forEach((tag) => tags.add(tag));
  }
  if (category === "focus") {
    ["focus", "zoom", "spotlight", "target", "camera", "framing"].forEach((tag) => tags.add(tag));
  }
  if (category === "highlight" || category === "emphasis") {
    ["highlight", "underline", "circle", "replaceable", "word-showcase", "syllabic-break"].forEach((tag) => tags.add(tag));
  }
  if (category === "template-graphic") {
    ["template", "graphic", "chart", "timeline", "calendar", "workflow", "blueprint"].forEach((tag) => tags.add(tag));
  }

  if (normalized.includes("core replaceable word")) {
    ["core", "replaceable", "syllabic-break", "word-showcase", "highlight", "underline", "circle"].forEach((tag) => tags.add(tag));
  }
  if (normalized.includes("graph")) {
    tags.add("analytics");
  }
  if (normalized.includes("counter")) {
    tags.add("numeric");
  }
  if (normalized.includes("date") || normalized.includes("calendar") || normalized.includes("timeline")) {
    tags.add("time");
  }
  if (normalized.includes("step") || normalized.includes("workflow") || normalized.includes("blueprint")) {
    tags.add("process");
  }
  if (normalized.includes("card")) {
    tags.add("layout");
  }
  if (normalized.includes("social")) {
    tags.add("social");
  }

  return [...tags];
};

const inferAliases = ({
  fileName,
  id,
  category
}: {
  fileName: string;
  id: string;
  category: string;
}): string[] => {
  const aliases = new Set<string>();
  const stem = extractFileStem(fileName);

  aliases.add(stem);
  aliases.add(fileName);
  aliases.add(id.replace(/-/g, " "));
  aliases.add(slugify(stem));

  if (category === "template-graphic") {
    aliases.add(stem.replace(/[^a-z0-9]+/gi, " ").trim());
  }
  if (category === "comparison" || category === "call" || category === "list" || category === "growth" || category === "counter" || category === "quote" || category === "cta" || category === "bubble-card" || category === "focus") {
    aliases.add(category);
    aliases.add(category.replace(/-/g, " "));
  }

  return [...aliases].filter(Boolean);
};

export const normalizeAnimationPrototypeRecord = (
  record: AnimationPrototypeRecord
): AnimationPrototypeRecord => {
  const sourceRoot = record.sourceRoot || DEFAULT_ANIMATION_PROTOTYPE_ROOT;
  const fileName = record.fileName || `${record.id}.html`;
  const relativePath = record.relativePath || fileName;
  const label = record.label || humanizeLabel(stripDetailSuffix(extractFileStem(fileName)));

  return {
    ...record,
    sourceRoot,
    fileName,
    relativePath,
    label,
    functionalTags: unique(record.functionalTags ?? []),
    semanticTriggers: unique(record.semanticTriggers ?? []),
    visualWeight: typeof record.visualWeight === "number" ? Math.max(0, Math.min(1, record.visualWeight)) : 0.5,
    idealDurationMs: typeof record.idealDurationMs === "number" ? Math.max(240, Math.round(record.idealDurationMs)) : 1600,
    placementPreference: unique(record.placementPreference ?? ["center"]),
    reuseFrequencyLimit: typeof record.reuseFrequencyLimit === "number" ? Math.max(1, Math.round(record.reuseFrequencyLimit)) : 4,
    conflictRules: unique(record.conflictRules ?? []),
    redundancyRiskScore: typeof record.redundancyRiskScore === "number" ? Math.max(0, Math.min(1, record.redundancyRiskScore)) : 0.2,
    structuralRegions: (record.structuralRegions ?? []).map((region) => ({
      ...region,
      importance: Math.max(0, Math.min(1, region.importance))
    })),
    partialRevealSupported: record.partialRevealSupported ?? (record.structuralRegions?.some((region) => region.revealMode !== "always") ?? false),
    replaceableTextSlots: typeof record.replaceableTextSlots === "number" ? Math.max(0, Math.round(record.replaceableTextSlots)) : undefined,
    replaceableNumericSlots: typeof record.replaceableNumericSlots === "number" ? Math.max(0, Math.round(record.replaceableNumericSlots)) : undefined,
    showMode: record.showMode ?? "full",
    metadataConfidence: typeof record.metadataConfidence === "number" ? Math.max(0, Math.min(1, record.metadataConfidence)) : 0.5,
    coverageStatus: record.coverageStatus ?? "review"
  };
};

export const inferAnimationPrototypeRecord = ({
  filePath,
  relativePath,
  fileName,
  content,
  sourceRoot
}: AnimationPrototypeFileRecord & {sourceRoot: string}): AnimationPrototypeRecord => {
  const baseStem = stripDetailSuffix(extractFileStem(fileName));
  const id = slugify(baseStem) || slugify(extractFileStem(fileName)) || `prototype-${Math.random().toString(36).slice(2, 8)}`;
  const keywords = collectKeywords(fileName, content);
  const category = inferCategory({fileName, keywords});
  const type = inferType({content, keywords});
  const triggerType = inferTriggerType({category, keywords, content});
  const compatibleWith = inferCompatibleWith({category, keywords, fileName});
  const layeringRules = inferLayeringRules({type, category, fileName});
  const graphTags = inferGraphTags({fileName, content, category, type, dataAttributes: findDataAttributes(content), keywords});
  const aliases = inferAliases({fileName, id, category});
  const functionalTags = inferPrototypeFunctionalTags(fileName, keywords, content);
  const semanticTriggers = inferPrototypeSemanticTriggers(fileName, keywords, content);
  const visualWeight = inferPrototypeVisualWeight(category, type, keywords);
  const idealDurationMs = inferPrototypeIdealDurationMs(category, keywords);
  const placementPreference = inferPrototypePlacementPreference(category);
  const reuseFrequencyLimit = inferPrototypeReuseLimit(category);
  const conflictRules = inferPrototypeConflictRules(category);
  const redundancyRiskScore = inferPrototypeRedundancyRisk(category);
  const structuralRegions = inferPrototypeStructuralRegions({fileName, category, keywords, content, type});
  const metadataConfidence = inferPrototypeMetadataConfidence({keywords, dataAttributes: findDataAttributes(content), structuralRegions, category, type, content});
  const coverageStatus = inferPrototypeCoverageStatus({confidence: metadataConfidence, structuralRegions, keywords});
  const partialRevealSupported = structuralRegions.some((region) => region.revealMode !== "always");
  const replaceableTextSlots = structuralRegions.filter((region) => /text|word|label|headline|body|copy|quote/i.test(region.role) || /text|word|label|headline|body|copy|quote/i.test(region.id)).length || (functionalTags.includes("replaceable") ? 1 : 0);
  const replaceableNumericSlots = structuralRegions.filter((region) => /number|numeric|percent|metric|counter/i.test(region.role) || /number|numeric|percent|metric|counter/i.test(region.id)).length;
  const showMode = category === "bubble-card" || category === "cta" ? "accent" : category === "focus" ? "partial" : category === "comparison" || category === "growth" || category === "counter" || category === "list" ? "partial" : "full";
  const signals: AnimationPrototypeSourceSignals = {
    detectedElements: detectElements(content),
    dataAttributes: findDataAttributes(content),
    keywords
  };

  return normalizeAnimationPrototypeRecord({
    id,
    label: humanizeLabel(baseStem),
    fileName,
    relativePath,
    sourceRoot,
    type,
    category,
    triggerType,
    compatibleWith,
    layeringRules,
    graphTags,
    aliases,
    notes: `Auto-indexed from ${path.basename(filePath)} using filename, content, and data-* metadata.`,
    sourceKind: "html-prototype",
    signals,
    functionalTags,
    semanticTriggers,
    visualWeight,
    idealDurationMs,
    placementPreference,
    reuseFrequencyLimit,
    conflictRules,
    redundancyRiskScore,
    structuralRegions,
    partialRevealSupported,
    replaceableTextSlots,
    replaceableNumericSlots,
    showMode,
    metadataConfidence,
    coverageStatus
  });
};

export const normalizeAnimationPrototypeCatalog = (
  records: AnimationPrototypeRecord[]
): AnimationPrototypeRecord[] => {
  const seen = new Set<string>();
  return records.reduce<AnimationPrototypeRecord[]>((accumulator, record) => {
    const normalized = normalizeAnimationPrototypeRecord(record);
    if (seen.has(normalized.id)) {
      return accumulator;
    }
    seen.add(normalized.id);
    accumulator.push(normalized);
    return accumulator;
  }, []);
};

export const loadAnimationPrototypeCatalog = async (
  catalogPath: string
): Promise<AnimationPrototypeRecord[]> => {
  try {
    const contents = await readFile(catalogPath, "utf-8");
    const parsed = JSON.parse(contents) as AnimationPrototypeRecord[];
    return normalizeAnimationPrototypeCatalog(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
};
