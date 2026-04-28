import type {GodGenerationBrief} from "./types";

const joinLines = (parts: string[]): string => parts.join("\n");

export const GOD_MASTER_PROMPT_VERSION = "god-master-prompt-v1";

export const buildGodMasterPrompt = (): string => {
  return joinLines([
    "Create a self-contained HTML/CSS motion asset with no background. The canvas must be transparent so it composites cleanly over source media and vintage surfaces.",
    "Use only HTML and CSS. Do not use JavaScript.",
    "Core aesthetic: Apple-esque minimalism, premium glassmorphism, cinematic restraint, flat motion with deliberate easing-out.",
    "The asset should feel modular, editorial, and reusable, not like random stock art or clipart.",
    "Transparent background is the default. Do not bake in a solid matte unless the brief explicitly demands it.",
    "Prefer clean layering, subtle depth, luminous edges, premium blur, restrained glow, and elegant negative space.",
    "Avoid clutter, watermarks, low-end gradients, childish styling, inconsistent perspective, and hardcoded text unless explicitly requested.",
    "The outer container must isolate the composition and prevent bleed-through. Transparent outside bounds only.",
    "If text is requested, use layered text-shadow/vignette treatment with a cinematic blur-in reveal.",
    "If a glass object is requested, use backdrop-filter blur, alpha-based depth, radial inner shine, and a deep shadow that fades as it rises.",
    "Animation language should favor smooth easing, quiet drift, subtle rise, polish, and editorial timing.",
    "Return production-ready markup that can be saved directly into a reusable asset module."
  ]);
};

export const buildGodSystemPrompt = (brief: GodGenerationBrief): string => {
  return joinLines([
    "You are the GOD asset generation engine.",
    "GOD means governed on-demand asset generation.",
    "You generate custom motion modules only when the existing asset library is not good enough for the exact visual moment.",
    "Return strict JSON only. No prose, no markdown, no code fences.",
    `Master prompt version: ${GOD_MASTER_PROMPT_VERSION}`,
    `Preferred visual form: ${brief.preferredForm}`,
    `Asset purpose: ${brief.assetPurpose}`,
    `Semantic role: ${brief.semanticRole}`,
    `Visual tone: ${brief.visualTone}`,
    `Motion language: ${brief.motionLanguage}`,
    `Reusability goal: ${brief.reusabilityGoal}`,
    `Forbidden elements: ${brief.forbiddenElements.join(", ") || "none"}`,
    `Required elements: ${brief.requiredElements.join(", ") || "none"}`,
    `Composition constraints: ${brief.compositionConstraints.join(", ") || "none"}`,
    `Palette guidance: ${brief.paletteGuidance.join(", ") || "none"}`
  ]);
};

export const buildGodUserPrompt = (brief: GodGenerationBrief): string => {
  return joinLines([
    "Generate one premium modular asset that obeys the brief exactly.",
    "The returned asset must be cleanly compositable over video.",
    "Default to transparent background and transparent outer bounds.",
    "Return JSON with these keys: title, label, assetRole, family, tier, renderMode, preferredForm, html, css, svg, themeTags, semanticTags, subjectTags, emotionalTags, functionalTags, placementZone, safeArea, durationPolicy, opacity, blendMode, loopable, transparencyRequired, noBackgroundRequired, paletteGuidance, reusabilityGoal, forbiddenElements, motionMetadata, sourceProvider, providerConfidence, previewCopy, notes.",
    "If you cannot satisfy the brief, lower your confidence rather than inventing a sloppy substitute.",
    "Do not add watermarks, hardcoded background fills, or baked-in body backgrounds.",
    "Prefer modular forms that can be reused in multiple scenes.",
    `Scene context: ${JSON.stringify(brief.sceneContext)}`,
    `Brief payload: ${JSON.stringify(brief)}`
  ]);
};

export const buildGodPromptPack = (brief: GodGenerationBrief): {
  masterPrompt: string;
  systemPrompt: string;
  userPrompt: string;
} => {
  const masterPrompt = buildGodMasterPrompt();
  return {
    masterPrompt,
    systemPrompt: buildGodSystemPrompt(brief),
    userPrompt: buildGodUserPrompt(brief)
  };
};

