import type {AnimationLayeringRule, AnimationTriggerType} from "../types";

type TargetFocusContractBase = {
  id: string;
  label: string;
  category: string;
  triggerType: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith: string[];
  layeringRules: AnimationLayeringRule[];
  graphTags: string[];
  aliases: string[];
  notes: string;
};

const layeringRule = (
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

export const targetFocusRuntimeHostContract: TargetFocusContractBase = {
  id: "target-focus-runtime",
  label: "Target Focus Runtime",
  category: "camera-focus-runtime",
  triggerType: ["timeline", "word-level", "syllable-level"],
  compatibleWith: [
    "focus-effect:target-focus-zoom",
    "host:motion-showcase-overlay",
    "host:motion-choreography-overlay",
    "host:svg-caption-overlay",
    "host:longform-word-emphasis-adornment",
    "host:semantic-sidecall-cue-visual"
  ],
  layeringRules: [
    layeringRule("target-focus-runtime-base", "host", 12, "Hosts the target-aware focus wrapper."),
    layeringRule("target-focus-runtime-overlay", "overlay", 28, "Keeps the vignette and focus treatment above the content.")
  ],
  graphTags: ["focus", "runtime", "camera", "zoom", "vignette", "target-aware"],
  aliases: ["target-focus-runtime", "TargetFocusRuntime", "Target Focus Runtime"],
  notes: "Runtime host for the reusable target-aware focus wrapper and vignette overlay."
};

export const targetFocusZoomEffectContract: TargetFocusContractBase = {
  id: "target-focus-zoom",
  label: "Target Focus Zoom + Dynamic Vignette",
  category: "camera-focus",
  triggerType: ["timeline", "word-level", "syllable-level"],
  compatibleWith: [
    "host:target-focus-runtime",
    "host:motion-showcase-overlay",
    "host:motion-choreography-overlay",
    "host:svg-caption-overlay",
    "host:longform-word-emphasis-adornment",
    "host:semantic-sidecall-cue-visual",
    "composite:core-replaceable-word",
    "primitive:typewriter",
    "primitive:highlight-word",
    "primitive:circle-reveal",
    "primitive:blur-underline"
  ],
  layeringRules: [
    layeringRule("target-focus-zoom-base", "base", 4, "Camera focus base layer."),
    layeringRule("target-focus-zoom-mask", "mask", 20, "Dynamic vignette mask layer."),
    layeringRule("target-focus-zoom-overlay", "overlay", 30, "Dynamic vignette and editorial focus overlay.")
  ],
  graphTags: ["focus", "camera", "zoom", "vignette", "target-aware", "editorial"],
  aliases: [
    "target-focus-zoom",
    "target-focus-zoom-dynamic-vignette",
    "TargetFocusZoom",
    "Target Focus Zoom",
    "Dynamic Vignette Focus",
    "camera-focus",
    "focus-zoom"
  ],
  notes: "Reusable target-aware focus effect that zooms into a selected target, centers a dynamic vignette, and returns to normal scale in a loopable cycle."
};
