import type {
  AnimationLayeringRule,
  AnimationTriggerType,
  MotionCompositeId,
  MotionPrimitiveContract,
  MotionPrimitiveId
} from "../types";

export type MotionCompositeContract = {
  id: MotionCompositeId;
  label: string;
  category: string;
  triggerType: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith: string[];
  layeringRules: AnimationLayeringRule[];
  graphTags: string[];
  aliases: string[];
  composition: MotionPrimitiveId[];
  notes: string;
};

const primitiveLayer = (
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

export const motionPrimitiveRegistry: MotionPrimitiveContract[] = [
  {
    id: "typewriter",
    sourceKind: "html-prototype-placeholder",
    sourcePrototypeFileName: "typewriter.html",
    expectedComponentName: "TypewriterPrimitive",
    status: "planned",
    notes: "Text-entry primitive for staged word and phrase reveals.",
    label: "Typewriter",
    category: "text",
    triggerType: ["timeline", "word-level"],
    compatibleWith: ["blur-reveal", "highlight-word", "core-replaceable-word"],
    layeringRules: [primitiveLayer("typewriter-base", "base", 2, "Base text reveal channel.")],
    graphTags: ["typing", "cursor", "word-reveal", "text"],
    aliases: ["typing", "typed-reveal", "text-typewriter"]
  },
  {
    id: "blur-reveal",
    sourceKind: "html-prototype-placeholder",
    sourcePrototypeFileName: "blur-reveal.html",
    expectedComponentName: "BlurRevealPrimitive",
    status: "planned",
    notes: "Reserved for premium text and card entrances with restrained blur and lift.",
    label: "Blur Reveal",
    category: "transition",
    triggerType: "timeline",
    compatibleWith: ["typewriter", "highlight-word", "circle-reveal", "blur-underline", "core-replaceable-word"],
    layeringRules: [primitiveLayer("blur-reveal-base", "base", 4, "Transition base channel.")],
    graphTags: ["blur", "reveal", "transition"],
    aliases: ["soft-reveal", "blur-dissolve"]
  },
  {
    id: "highlight-word",
    sourceKind: "html-prototype-placeholder",
    sourcePrototypeFileName: "highlight-word.html",
    expectedComponentName: "HighlightWordPrimitive",
    status: "planned",
    notes: "Reserved for key phrase emphasis and stat reinforcement.",
    label: "Highlight Word",
    category: "highlight",
    triggerType: ["word-level", "timeline"],
    compatibleWith: ["blur-underline", "circle-reveal", "core-replaceable-word"],
    layeringRules: [primitiveLayer("highlight-word-accent", "accent", 16, "Accent emphasis channel.")],
    graphTags: ["emphasis", "highlight", "word-lock"],
    aliases: ["word-highlight", "spotlight-word"]
  },
  {
    id: "circle-reveal",
    sourceKind: "html-prototype-placeholder",
    sourcePrototypeFileName: "circle-reveal.html",
    expectedComponentName: "CircleRevealPrimitive",
    status: "planned",
    notes: "Reserved for spotlight reveals and comparison emphasis moments.",
    label: "Circle Reveal",
    category: "highlight",
    triggerType: ["word-level", "syllable-level"],
    compatibleWith: ["highlight-word", "blur-underline", "core-replaceable-word"],
    layeringRules: [primitiveLayer("circle-reveal-overlay", "overlay", 18, "Circle path overlay channel.")],
    graphTags: ["circle", "spotlight", "reveal"],
    aliases: ["circle-emphasis", "spotlight-reveal"]
  },
  {
    id: "blur-underline",
    sourceKind: "html-prototype-placeholder",
    sourcePrototypeFileName: "blur-underline.html",
    expectedComponentName: "BlurUnderlinePrimitive",
    status: "planned",
    notes: "Reserved for independent end-word emphasis where the live caption font and sizing should stay untouched.",
    label: "Blur Underline",
    category: "emphasis",
    triggerType: ["word-level", "syllable-level"],
    compatibleWith: ["highlight-word", "circle-reveal", "core-replaceable-word"],
    layeringRules: [primitiveLayer("blur-underline-overlay", "overlay", 14, "Underline overlay channel.")],
    graphTags: ["underline", "blur", "emphasis"],
    aliases: ["underline-emphasis", "focus-underline"]
  }
];

export const coreReplaceableWordComposite: MotionCompositeContract = {
  id: "core-replaceable-word",
  label: "CORE Replaceable Word",
  category: "emphasis",
  triggerType: ["word-level", "syllable-level"],
  compatibleWith: ["highlight-word", "circle-reveal", "blur-underline", "typewriter"],
  layeringRules: [
    primitiveLayer("core-replaceable-word-base", "base", 0, "Composite word base."),
    primitiveLayer("core-replaceable-word-highlight", "accent", 18, "Highlight layer for the emphasized core word."),
    primitiveLayer("core-replaceable-word-circle", "overlay", 22, "Circle reveal overlay."),
    primitiveLayer("core-replaceable-word-underline", "overlay", 16, "Underline overlay for the syllabic break.")
  ],
  graphTags: ["core", "replaceable", "syllabic-break", "word-showcase", "neural-pathway"],
  aliases: [
    "core-replaceable-word",
    "core-replaceable-word-syllabic-break-for-core-words",
    "CORE replaceable word (syllabic break for core words)",
    "CORE replaceable word",
    "core replaceable word",
    "syllabic break for core words"
  ],
  composition: ["highlight-word", "circle-reveal", "blur-underline"],
  notes: "Composite alias for the core-word showcase pathway. It is not a standalone renderer; it chains the existing emphasis primitives."
};

const motionPrimitiveRegistryById = new Map(motionPrimitiveRegistry.map((entry) => [entry.id, entry]));

export const motionCompositeRegistry: MotionCompositeContract[] = [coreReplaceableWordComposite];

export const motionCompositeRegistryById = new Map(motionCompositeRegistry.map((entry) => [entry.id, entry]));

export const getMotionPrimitiveContract = (id: MotionPrimitiveId): MotionPrimitiveContract | null => {
  return motionPrimitiveRegistryById.get(id) ?? null;
};

export const getMotionCompositeContract = (id: MotionCompositeId): MotionCompositeContract | null => {
  return motionCompositeRegistryById.get(id) ?? null;
};

export const getMotionPrimitiveIds = (): MotionPrimitiveId[] => {
  return motionPrimitiveRegistry.map((entry) => entry.id);
};
