import type {PatternContext, PatternMemoryEntry, PatternMemorySnapshot} from "./pattern-types";

const unique = (values: Array<string | undefined | null>): string[] => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const createEntry = (entry: PatternMemoryEntry): PatternMemoryEntry => ({
  ...entry,
  triggerContext: unique(entry.triggerContext),
  effectStack: unique(entry.effectStack),
  animationStyle: unique(entry.animationStyle),
  compatibilityRules: unique(entry.compatibilityRules),
  antiPatterns: unique(entry.antiPatterns),
  compatibleWith: unique(entry.compatibleWith),
  assetRefs: unique(entry.assetRefs),
  tagSet: unique(entry.tagSet)
});

const seedPatternEntries: PatternMemoryEntry[] = [
  createEntry({
    id: "pattern:core-replaceable-word",
    patternType: "motion-composite",
    semanticIntent: "replaceable-word",
    sceneType: "feature-highlight",
    triggerContext: ["core words", "syllabic break", "word showcase", "headline emphasis"],
    detectedMomentType: "word-emphasis",
    semanticRole: "primary",
    layoutUsed: "headline-lockup",
    effectStack: ["primitive:highlight-word", "primitive:circle-reveal", "primitive:blur-underline"],
    animationStyle: ["blur-slide-up", "syllabic-break", "word-showcase"],
    timingProfile: {entryMs: 480, holdMs: 900, exitMs: 560, totalMs: 1940, easing: "power3.out", loop: false},
    entryBehavior: "Introduce the chosen word with blur, then lock it in with a readable hold.",
    exitBehavior: "Return the scene to rest scale instead of snapping away.",
    visualWeight: 0.74,
    redundancyRiskScore: 0.18,
    clutterRiskScore: 0.21,
    successScore: 0.92,
    rejectionReasons: [],
    compatibilityRules: ["pair-with-highlight-or-underline", "prefer-single-dominant-word"],
    antiPatterns: ["duplicate-literal-repetition", "stacked-number-copy"],
    compatibleWith: ["primitive:highlight-word", "primitive:circle-reveal", "primitive:blur-underline", "primitive:typewriter"],
    assetRefs: ["composite:core-replaceable-word"],
    tagSet: ["core", "replaceable", "syllabic-break", "word-showcase", "emphasis"],
    confidenceScore: 0.93,
    reuseCount: 4,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Primary word showcase pathway for core phrases and syllabic break moments.",
    source: "seed",
    category: "emphasis"
  }),
  createEntry({
    id: "pattern:comparison-side-by-side",
    patternType: "layout",
    semanticIntent: "comparison",
    sceneType: "comparison",
    triggerContext: ["this versus that", "compare two values", "A/B", "tradeoff", "decision"],
    detectedMomentType: "contrast",
    semanticRole: "primary",
    layoutUsed: "split-screen comparison",
    effectStack: ["template-family:graph-chart", "primitive:highlight-word"],
    animationStyle: ["lateral-sweep", "split-reveal", "editorial-compare"],
    timingProfile: {entryMs: 560, holdMs: 980, exitMs: 620, totalMs: 2160, easing: "ease-out", loop: false},
    entryBehavior: "Bring the two ideas in with lateral separation.",
    exitBehavior: "Release by reducing the visual weight of the weaker side.",
    visualWeight: 0.78,
    redundancyRiskScore: 0.31,
    clutterRiskScore: 0.28,
    successScore: 0.89,
    rejectionReasons: [],
    compatibilityRules: ["single-comparison-per-window", "pair-with-stat-if-number-heavy"],
    antiPatterns: ["duplicate-contrast", "triple-emphasis"],
    compatibleWith: ["template-family:graph-chart", "primitive:highlight-word", "primitive:circle-reveal"],
    assetRefs: ["bar-for-comparing-two-values"],
    tagSet: ["comparison", "vs", "versus", "contrast", "tradeoff", "choice", "decision", "dual-concept", "side-by-side"],
    confidenceScore: 0.91,
    reuseCount: 5,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Side-by-side comparison moments should not duplicate the same concept twice.",
    source: "seed",
    category: "comparison"
  }),
  createEntry({
    id: "pattern:call-outreach-contact",
    patternType: "motion-asset",
    semanticIntent: "call",
    sceneType: "call",
    triggerContext: ["call", "contact", "reach out", "outreach", "make a call"],
    detectedMomentType: "callout",
    semanticRole: "secondary",
    layoutUsed: "floating card",
    effectStack: ["motion-choreography-overlay", "primitive:typewriter"],
    animationStyle: ["editorial-card-rise", "contact-call", "soft-callout"],
    timingProfile: {entryMs: 420, holdMs: 820, exitMs: 500, totalMs: 1740, easing: "power3.out", loop: false},
    entryBehavior: "Rise gently into a side card or contact plate.",
    exitBehavior: "Let the card dissolve instead of bouncing out.",
    visualWeight: 0.54,
    redundancyRiskScore: 0.26,
    clutterRiskScore: 0.22,
    successScore: 0.84,
    rejectionReasons: [],
    compatibilityRules: ["pair-with-call-or-outreach-language", "avoid-repeat-in-short-window"],
    antiPatterns: ["stacked-contact-cards", "repeated-phone-icon"],
    compatibleWith: ["host:motion-choreography-overlay", "primitive:typewriter"],
    assetRefs: ["calling-animation"],
    tagSet: ["call", "calling", "contact", "outreach", "phone", "reach-out", "communication", "connection"],
    confidenceScore: 0.86,
    reuseCount: 3,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Call and outreach moments should stay concise and visually low-friction.",
    source: "seed",
    category: "call"
  }),
  createEntry({
    id: "pattern:list-stagger-steps",
    patternType: "layout",
    semanticIntent: "sequence",
    sceneType: "list",
    triggerContext: ["step one", "next", "secondly", "three points", "ordered list"],
    detectedMomentType: "list-steps",
    semanticRole: "primary",
    layoutUsed: "stacked sequence cards",
    effectStack: ["primitive:typewriter", "primitive:highlight-word"],
    animationStyle: ["blur-slide-up", "staggered-list", "ordered-reveal"],
    timingProfile: {entryMs: 360, holdMs: 1020, exitMs: 420, totalMs: 1800, easing: "power3.out", loop: false},
    entryBehavior: "Reveal one item at a time in a clean vertical chain.",
    exitBehavior: "Keep the list readable while transitioning to the next step.",
    visualWeight: 0.62,
    redundancyRiskScore: 0.19,
    clutterRiskScore: 0.24,
    successScore: 0.9,
    rejectionReasons: [],
    compatibilityRules: ["respect-order", "one-step-per-beat", "avoid-dense-cards"],
    antiPatterns: ["out-of-order-list", "simultaneous-multi-step"],
    compatibleWith: ["primitive:typewriter", "primitive:highlight-word"],
    assetRefs: ["check-mark-list-animation", "number-for-STEPS-counting-animation", "three-steps-list-animation", "four-steps-animation"],
    tagSet: ["list", "steps", "sequence", "ordered", "step-one", "step-two", "step-three", "step-four", "checkmark", "numbered"],
    confidenceScore: 0.9,
    reuseCount: 4,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Ordered explanation beats should respect semantic order and not split the chain.",
    source: "seed",
    category: "list"
  }),
  createEntry({
    id: "pattern:growth-progress-ramp",
    patternType: "motion-asset",
    semanticIntent: "growth",
    sceneType: "growth",
    triggerContext: ["growth", "increase", "progress", "ramp up", "improve", "scale"],
    detectedMomentType: "progress",
    semanticRole: "secondary",
    layoutUsed: "lower-third growth ramp",
    effectStack: ["template-family:graph-chart", "template-family:number-counter-kpi"],
    animationStyle: ["graph-rise", "progress-ramp", "kinetic-growth"],
    timingProfile: {entryMs: 520, holdMs: 960, exitMs: 520, totalMs: 2000, easing: "ease-out", loop: true},
    entryBehavior: "Introduce upward progress with a soft bottom-up lift.",
    exitBehavior: "Loop gently or settle at rest scale, never hard-cut.",
    visualWeight: 0.66,
    redundancyRiskScore: 0.24,
    clutterRiskScore: 0.23,
    successScore: 0.88,
    rejectionReasons: [],
    compatibilityRules: ["one-growth-idea-per-beat", "prefer-graph-over-text-duplication"],
    antiPatterns: ["duplicate-growth-label", "stacked-progress-cards"],
    compatibleWith: ["template-family:graph-chart", "template-family:number-counter-kpi"],
    assetRefs: ["growth-animation", "percentage-graph-animation-animate-for-percentages"],
    tagSet: ["growth", "progress", "increase", "scale", "improvement", "upward", "chart", "graph", "ramp"],
    confidenceScore: 0.88,
    reuseCount: 2,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Use for growth and progress beats with restrained motion variety.",
    source: "seed",
    category: "growth"
  }),
  createEntry({
    id: "pattern:counter-stat-emphasis",
    patternType: "motion-primitive",
    semanticIntent: "numeric-emphasis",
    sceneType: "stat",
    triggerContext: ["percent", "number", "stat", "count up", "metric"],
    detectedMomentType: "counter",
    semanticRole: "primary",
    layoutUsed: "stat lockup",
    effectStack: ["primitive:highlight-word", "primitive:blur-underline"],
    animationStyle: ["count-up", "stat-pop", "numeric-lockup"],
    timingProfile: {entryMs: 360, holdMs: 780, exitMs: 420, totalMs: 1560, easing: "power3.out", loop: false},
    entryBehavior: "Animate numbers with clarity, not spectacle.",
    exitBehavior: "Reduce the number back into the sentence without duplicating it.",
    visualWeight: 0.68,
    redundancyRiskScore: 0.44,
    clutterRiskScore: 0.26,
    successScore: 0.87,
    rejectionReasons: [],
    compatibilityRules: ["suppress-duplicate-literal-number", "prefer-italic-percent-signal"],
    antiPatterns: ["double-number-copy", "counter-plus-written-duplicate"],
    compatibleWith: ["primitive:highlight-word", "primitive:blur-underline"],
    assetRefs: ["number-counter", "number-counter-kpi"],
    tagSet: ["counter", "stat", "number", "percentage", "metric", "count-up", "numeric", "kpi"],
    confidenceScore: 0.9,
    reuseCount: 6,
    failureCount: 1,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Numeric emphasis should not be duplicated in a second literal caption.",
    source: "seed",
    category: "stat"
  }),
  createEntry({
    id: "pattern:quote-lifted-hold",
    patternType: "svg-variant",
    semanticIntent: "quote",
    sceneType: "quote",
    triggerContext: ["quote", "said", "told me", "quoted", "speech"],
    detectedMomentType: "quote",
    semanticRole: "primary",
    layoutUsed: "quote plate",
    effectStack: ["host:svg-caption-overlay", "primitive:blur-reveal"],
    animationStyle: ["editorial-quote", "soft-lift", "paper-hold"],
    timingProfile: {entryMs: 460, holdMs: 1020, exitMs: 560, totalMs: 2040, easing: "ease-out", loop: false},
    entryBehavior: "Lift the quote into view with strong hierarchy and low noise.",
    exitBehavior: "Fade the quote without extra punctuation copies.",
    visualWeight: 0.61,
    redundancyRiskScore: 0.21,
    clutterRiskScore: 0.2,
    successScore: 0.86,
    rejectionReasons: [],
    compatibilityRules: ["one-quote-dominant-visual", "prefer-clean-hold"],
    antiPatterns: ["stacked-quote-boxes", "duplicate-quotation-render"],
    compatibleWith: ["host:svg-caption-overlay", "primitive:blur-reveal"],
    assetRefs: ["quote-animation"],
    tagSet: ["quote", "said", "speech", "quoted", "statement", "lift", "editorial"],
    confidenceScore: 0.85,
    reuseCount: 3,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Quotes should feel editorial and compact, not like a second caption stream.",
    source: "seed",
    category: "quote"
  }),
  createEntry({
    id: "pattern:cta-resolved-hold",
    patternType: "overlay",
    semanticIntent: "cta",
    sceneType: "cta",
    triggerContext: ["subscribe", "follow", "join", "click", "call to action"],
    detectedMomentType: "cta",
    semanticRole: "secondary",
    layoutUsed: "call-to-action plate",
    effectStack: ["host:motion-showcase-overlay", "primitive:typewriter"],
    animationStyle: ["resolved-hold", "quiet-cta", "editorial-push"],
    timingProfile: {entryMs: 420, holdMs: 820, exitMs: 520, totalMs: 1760, easing: "ease-out", loop: false},
    entryBehavior: "Enter with confidence and leave enough visual breathing room.",
    exitBehavior: "Release cleanly after the action is understood.",
    visualWeight: 0.58,
    redundancyRiskScore: 0.23,
    clutterRiskScore: 0.24,
    successScore: 0.85,
    rejectionReasons: [],
    compatibilityRules: ["single-cta-per-window", "avoid-piling-into-overlay-stack"],
    antiPatterns: ["duplicate-cta-badges", "repeated-join-follow-copy"],
    compatibleWith: ["host:motion-showcase-overlay", "primitive:typewriter"],
    assetRefs: ["cta-animation"],
    tagSet: ["cta", "subscribe", "follow", "join", "click", "call-to-action", "action", "conversion"],
    confidenceScore: 0.86,
    reuseCount: 4,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "CTA beats should be restrained and not compete with the spoken close.",
    source: "seed",
    category: "cta"
  }),
  createEntry({
    id: "pattern:bubble-card-rare-accent",
    patternType: "motion-asset",
    semanticIntent: "bubble-card",
    sceneType: "bubble-card",
    triggerContext: ["bubble", "card", "glass", "callout", "rare accent"],
    detectedMomentType: "accent-card",
    semanticRole: "decorative",
    layoutUsed: "floating bubble card",
    effectStack: ["motion-choreography-overlay"],
    animationStyle: ["glass-accent", "floating-card", "rare-accent"],
    timingProfile: {entryMs: 520, holdMs: 780, exitMs: 540, totalMs: 1840, easing: "ease-out", loop: false},
    entryBehavior: "Use as a one-off accent, not as a recurring caption stream.",
    exitBehavior: "Return to calm before the next visual idea.",
    visualWeight: 0.44,
    redundancyRiskScore: 0.48,
    clutterRiskScore: 0.34,
    successScore: 0.79,
    rejectionReasons: [],
    compatibilityRules: ["max-two-per-five-minutes", "avoid-after-heavy-zoom"],
    antiPatterns: ["bubble-card-stacking", "persistent-accent-loop"],
    compatibleWith: ["host:motion-choreography-overlay"],
    assetRefs: ["glass-bubble-card", "bubble-card"],
    tagSet: ["bubble", "card", "glass", "accent", "floating", "rare", "supporting", "callout"],
    confidenceScore: 0.75,
    reuseCount: 1,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Bubble/card looks should be rare accents, not a new caption layer.",
    source: "seed",
    category: "card"
  }),
  createEntry({
    id: "pattern:restraint-high-density",
    patternType: "constraint",
    semanticIntent: "restraint-needed",
    sceneType: "restraint",
    triggerContext: ["dense scene", "avoid clutter", "repeated underline", "caption overload"],
    detectedMomentType: "suppression",
    semanticRole: "primary",
    layoutUsed: "no-new-layer",
    effectStack: [],
    animationStyle: ["minimal-hold", "restraint"],
    timingProfile: {entryMs: 0, holdMs: 0, exitMs: 0, totalMs: 0, easing: "linear", loop: false},
    entryBehavior: "Prefer silence and hierarchy instead of stacking more motion.",
    exitBehavior: "Keep the composition stable.",
    visualWeight: 0.08,
    redundancyRiskScore: 0.0,
    clutterRiskScore: 0.0,
    successScore: 0.96,
    rejectionReasons: [],
    compatibilityRules: ["suppress-additional-emphasis", "prefer-single-dominant-visual"],
    antiPatterns: ["dense-layering", "more-is-more"],
    compatibleWith: [],
    assetRefs: [],
    tagSet: ["restraint", "density", "minimal", "suppression", "hierarchy", "quiet", "disciplined"],
    confidenceScore: 0.98,
    reuseCount: 8,
    failureCount: 0,
    lastUsedAt: null,
    sourceVideoId: null,
    active: true,
    notes: "Active governance pattern that blocks extra emphasis in dense scenes.",
    source: "seed",
    category: "constraint"
  })
];

export const buildSeedPatternMemoryEntries = (): PatternMemoryEntry[] => {
  return seedPatternEntries.map((entry) => ({...entry}));
};

export const DEFAULT_PATTERN_MEMORY_VERSION = "2026-04-15-pattern-memory-v1";
export const DEFAULT_PATTERN_MEMORY_RULES_VERSION = "2026-04-15-pattern-rules-v1";

export const buildPatternMemoryIndex = (entries: PatternMemoryEntry[]): PatternMemorySnapshot["index"] => {
  const byId: Record<string, number> = {};
  const bySemanticIntent: Record<string, string[]> = {};
  const bySceneType: Record<string, string[]> = {};
  const byEffectId: Record<string, string[]> = {};
  const byAssetId: Record<string, string[]> = {};
  const byTag: Record<string, string[]> = {};
  const bySourceVideoId: Record<string, string[]> = {};

  entries.forEach((entry, index) => {
    byId[entry.id] = index;

    const add = (bucket: Record<string, string[]>, key: string, value: string): void => {
      const normalizedKey = key.trim().toLowerCase();
      if (!normalizedKey) {
        return;
      }
      const current = bucket[normalizedKey] ?? [];
      if (!current.includes(value)) {
        bucket[normalizedKey] = [...current, value];
      }
    };

    add(bySemanticIntent, entry.semanticIntent, entry.id);
    add(bySceneType, entry.sceneType, entry.id);
    entry.effectStack.forEach((effectId) => add(byEffectId, effectId, entry.id));
    entry.assetRefs.forEach((assetId) => add(byAssetId, assetId, entry.id));
    entry.tagSet.forEach((tag) => add(byTag, tag, entry.id));
    if (entry.sourceVideoId) {
      add(bySourceVideoId, entry.sourceVideoId, entry.id);
    }
  });

  return {
    byId,
    bySemanticIntent,
    bySceneType,
    byEffectId,
    byAssetId,
    byTag,
    bySourceVideoId
  };
};

export const buildPatternMemoryFingerprint = (snapshot: Omit<PatternMemorySnapshot, "fingerprint">): string => {
  const material = JSON.stringify({
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    rulesVersion: snapshot.rulesVersion,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      lastUsedAt: entry.lastUsedAt ?? null
    })),
    index: snapshot.index,
    notes: snapshot.notes
  });
  let hash = 2166136261;
  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pm-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const buildSeedPatternMemorySnapshot = (generatedAt = new Date().toISOString()): PatternMemorySnapshot => {
  const entries = buildSeedPatternMemoryEntries();
  const index = buildPatternMemoryIndex(entries);
  const base = {
    version: DEFAULT_PATTERN_MEMORY_VERSION,
    generatedAt,
    rulesVersion: DEFAULT_PATTERN_MEMORY_RULES_VERSION,
    entries,
    index,
    notes: [
      "Seeded from the current motion registry and structured animation families.",
      "Pattern Memory favors restraint when density or redundancy rises."
    ]
  };

  return {
    ...base,
    fingerprint: buildPatternMemoryFingerprint(base)
  };
};

export const coercePatternContext = (context: Partial<PatternContext>): PatternContext => ({
  jobId: context.jobId,
  videoId: context.videoId,
  sourceVideoId: context.sourceVideoId,
  sceneId: context.sceneId,
  momentId: context.momentId,
  sourceVideoHash: context.sourceVideoHash,
  prompt: context.prompt ?? "",
  transcriptText: context.transcriptText ?? "",
  chunkText: context.chunkText ?? "",
  momentText: context.momentText ?? context.chunkText ?? "",
  semanticIntent: context.semanticIntent ?? "unknown",
  secondaryIntents: context.secondaryIntents ?? [],
  sceneType: context.sceneType ?? "feature-highlight",
  detectedMomentType: context.detectedMomentType ?? "unknown",
  semanticRole: context.semanticRole ?? "secondary",
  visualDensity: round(context.visualDensity ?? 0, 3),
  captionDensity: round(context.captionDensity ?? 0, 3),
  speakerDominance: round(context.speakerDominance ?? 0, 3),
  motionTier: context.motionTier ?? "editorial",
  activeEffectIds: context.activeEffectIds ?? [],
  activeAssetIds: context.activeAssetIds ?? [],
  activeTagIds: context.activeTagIds ?? [],
  assetTags: context.assetTags ?? [],
  momentTags: context.momentTags ?? [],
  semanticSignals: context.semanticSignals ?? [],
  minuteBucket: context.minuteBucket ?? 0,
  timelinePositionMs: context.timelinePositionMs ?? 0,
  timelineWindowMs: context.timelineWindowMs ?? 0,
  importance: round(context.importance ?? 0, 3),
  hasPause: Boolean(context.hasPause),
  isDenseScene: Boolean(context.isDenseScene),
  isLongForm: context.isLongForm ?? true,
  selectionMode: context.selectionMode,
  targetRef: context.targetRef
});
