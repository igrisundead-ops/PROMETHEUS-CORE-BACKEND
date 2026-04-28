import {randomUUID} from "node:crypto";

import {sha256Text} from "../utils/hash";
import {buildGodPromptPack} from "./prompts";
import {
  godGeneratedAssetDraftSchema,
  type GodGeneratedAssetDraft,
  type GodGenerationBrief,
  type GodProviderAttempt
} from "./types";

type FetchLike = typeof fetch;

export type GodProviderResult = {
  draft: GodGeneratedAssetDraft;
  rawResponse: unknown;
  confidence: number | null;
  summary: string;
};

export type GodProvider = {
  id: string;
  kind: string;
  generate: (brief: GodGenerationBrief) => Promise<GodProviderResult>;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ");

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

type LocalVariant = "orb" | "panel" | "frame" | "text-glow" | "symbol" | "flare" | "texture" | "ui-fragment";

const buildAssetTitle = (brief: GodGenerationBrief): string => {
  return brief.sceneContext.sceneLabel ? `${brief.sceneContext.sceneLabel} Module` : `${brief.semanticRole} Module`;
};

const pickPalette = (brief: GodGenerationBrief): {
  accent: string;
  accentSoft: string;
  accentGlow: string;
  glass: string;
  text: string;
} => {
  const text = normalizeText(`${brief.visualTone} ${brief.sceneContext.toneTarget} ${brief.sceneContext.motionLanguage}`.toLowerCase());

  if (/(warm|gold|amber|sun|luxe|premium)/.test(text)) {
    return {
      accent: "rgba(255, 209, 120, 0.92)",
      accentSoft: "rgba(255, 209, 120, 0.18)",
      accentGlow: "rgba(255, 192, 82, 0.48)",
      glass: "rgba(255, 255, 255, 0.10)",
      text: "rgba(255, 247, 232, 0.96)"
    };
  }

  if (/(cool|blue|steel|glass|editorial|clean|crisp)/.test(text)) {
    return {
      accent: "rgba(168, 224, 255, 0.94)",
      accentSoft: "rgba(168, 224, 255, 0.18)",
      accentGlow: "rgba(99, 179, 237, 0.48)",
      glass: "rgba(255, 255, 255, 0.09)",
      text: "rgba(244, 250, 255, 0.96)"
    };
  }

  return {
    accent: "rgba(245, 245, 245, 0.96)",
    accentSoft: "rgba(245, 245, 245, 0.15)",
    accentGlow: "rgba(245, 245, 245, 0.34)",
    glass: "rgba(255, 255, 255, 0.08)",
    text: "rgba(250, 250, 250, 0.96)"
  };
};

const buildMotionNotes = (brief: GodGenerationBrief): string[] => {
  return [
    `Preferred form: ${brief.preferredForm}`,
    `Motion language: ${brief.motionLanguage}`,
    `Entrance style: ${brief.motionMetadata.recommendedEntranceStyle}`,
    `Hover style: ${brief.motionMetadata.recommendedHoverStyle}`,
    `Duration range: ${brief.motionMetadata.recommendedDurationRangeMs[0]}-${brief.motionMetadata.recommendedDurationRangeMs[1]}ms`
  ];
};

const MOOD_TAGS = new Set(["neutral", "warm", "cool", "calm", "kinetic", "authority", "heroic"]);
const isMoodTag = (value: string): value is GodGeneratedAssetDraft["themeTags"][number] => MOOD_TAGS.has(value);

const buildTextPayload = (brief: GodGenerationBrief): string => {
  const candidateText = brief.sceneContext.requiredText ?? brief.sceneContext.sceneLabel ?? brief.semanticRole;
  return normalizeText(candidateText || "");
};

const buildBaseStyles = (palette: ReturnType<typeof pickPalette>): string => {
  return `
  :root {
    color-scheme: dark;
    --accent: ${palette.accent};
    --accent-soft: ${palette.accentSoft};
    --accent-glow: ${palette.accentGlow};
    --glass: ${palette.glass};
    --text: ${palette.text};
    --shadow: rgba(0, 0, 0, 0.36);
    --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  }
  * { box-sizing: border-box; }
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    background: transparent;
    overflow: hidden;
  }
  body {
    display: grid;
    place-items: center;
    isolation: isolate;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    isolation: isolate;
    background: transparent;
    color: var(--text);
  }
  .field {
    position: absolute;
    inset: -8%;
    background:
      radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.06), transparent 34%),
      radial-gradient(circle at 50% 55%, rgba(255, 255, 255, 0.04), transparent 52%);
    pointer-events: none;
    filter: blur(0.1px);
  }
  .field::before,
  .field::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .field::before {
    background:
      radial-gradient(circle at 20% 20%, var(--accent-soft), transparent 30%),
      radial-gradient(circle at 82% 35%, rgba(255, 255, 255, 0.05), transparent 24%),
      radial-gradient(circle at 48% 78%, rgba(255, 255, 255, 0.04), transparent 28%);
    animation: drift 10s var(--ease-out) infinite alternate;
  }
  .field::after {
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 26%, transparent 74%, rgba(255, 255, 255, 0.05)),
      radial-gradient(circle at 50% 50%, transparent 0 38%, rgba(0, 0, 0, 0.04) 75%, rgba(0, 0, 0, 0.12) 100%);
    mix-blend-mode: screen;
    animation: glow 7s var(--ease-out) infinite alternate;
  }
  .orb {
    position: absolute;
    left: 50%;
    top: 48%;
    width: min(34vw, 33vh);
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    backdrop-filter: blur(22px) saturate(165%);
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04));
    border: 1px solid rgba(255, 255, 255, 0.22);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.24),
      0 0 48px var(--accent-soft),
      inset 0 1px 0 rgba(255, 255, 255, 0.34),
      inset 0 -18px 40px rgba(0, 0, 0, 0.16);
    animation: floatOrb 8s var(--ease-out) infinite alternate;
  }
  .orb::before,
  .orb::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
  }
  .orb::before {
    background:
      radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.42), transparent 18%),
      radial-gradient(circle at 52% 55%, rgba(255, 255, 255, 0.12), transparent 42%),
      radial-gradient(circle at 50% 50%, transparent 40%, rgba(255, 255, 255, 0.06) 61%, transparent 74%);
    mix-blend-mode: screen;
  }
  .orb::after {
    inset: 8%;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: inset 0 0 26px rgba(255, 255, 255, 0.12);
    animation: orbit 9s linear infinite;
  }
  .frame {
    position: absolute;
    inset: 12%;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      0 18px 44px rgba(0, 0, 0, 0.20);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.03));
    backdrop-filter: blur(24px) saturate(170%);
    overflow: hidden;
    animation: rise 8s var(--ease-out) infinite alternate;
  }
  .frame::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, transparent 0 14%, rgba(255, 255, 255, 0.08) 14.4% 15.2%, transparent 15.4% 84.6%, rgba(255, 255, 255, 0.08) 84.8% 85.6%, transparent 86% 100%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.10), transparent 24%, transparent 76%, rgba(255, 255, 255, 0.06));
    mix-blend-mode: screen;
    opacity: 0.72;
  }
  .frame::after {
    content: "";
    position: absolute;
    inset: 8% 8% 14%;
    border-radius: 22px;
    background:
      radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.14), transparent 38%),
      radial-gradient(circle at 50% 50%, transparent 34%, rgba(0, 0, 0, 0.12) 100%);
    filter: blur(0.2px);
    opacity: 0.9;
  }
  .textGlow {
    position: absolute;
    left: 50%;
    top: 64%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text);
    text-shadow:
      0 0 10px rgba(255, 255, 255, 0.38),
      0 0 28px rgba(255, 255, 255, 0.22),
      0 0 64px rgba(255, 255, 255, 0.12);
    filter: blur(10px);
    animation: textReveal 1.9s var(--ease-out) 120ms both;
  }
  .textGlow__title {
    font-size: clamp(30px, 4.2vw, 72px);
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 0.95;
  }
  .textGlow__sub {
    margin-top: 0.7rem;
    font-size: clamp(11px, 1vw, 14px);
    letter-spacing: 0.34em;
    text-transform: uppercase;
    opacity: 0.76;
  }
  .copy {
    position: absolute;
    left: 50%;
    top: 72%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text);
    text-shadow:
      0 0 8px rgba(255, 255, 255, 0.28),
      0 0 24px rgba(255, 255, 255, 0.12);
    animation: textReveal 1.6s var(--ease-out) 140ms both;
  }
  .copy__text {
    font-size: clamp(22px, 3.2vw, 54px);
    font-weight: 600;
    letter-spacing: 0.04em;
    line-height: 1.02;
  }
  .copy__sub {
    margin-top: 0.75rem;
    font-size: clamp(10px, 0.9vw, 13px);
    letter-spacing: 0.38em;
    text-transform: uppercase;
    opacity: 0.74;
  }
  .symbol {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(28vw, 28vh);
    height: min(28vw, 28vh);
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.16), transparent 34%),
      radial-gradient(circle at 50% 50%, transparent 45%, rgba(255, 255, 255, 0.12) 50%, transparent 56%);
    box-shadow: 0 0 34px rgba(255, 255, 255, 0.14), inset 0 0 30px rgba(255, 255, 255, 0.06);
    animation: pulse 6s var(--ease-out) infinite alternate;
  }
  @keyframes drift {
    from { transform: translate3d(-1.2%, -0.8%, 0) scale(1); opacity: 0.92; }
    to { transform: translate3d(1.6%, 1.2%, 0) scale(1.02); opacity: 1; }
  }
  @keyframes glow {
    from { transform: scale(1); opacity: 0.84; }
    to { transform: scale(1.05); opacity: 1; }
  }
  @keyframes floatOrb {
    0% { transform: translate(-50%, -50%) rotate3d(0.34, 0.9, 0.2, -10deg) translateY(12px); }
    100% { transform: translate(-50%, -50%) rotate3d(0.14, 0.96, 0.12, 12deg) translateY(-10px); }
  }
  @keyframes orbit {
    from { transform: rotate(0deg) scale(1); }
    to { transform: rotate(360deg) scale(1.01); }
  }
  @keyframes rise {
    from { transform: translateY(8px); opacity: 0.92; }
    to { transform: translateY(-10px); opacity: 1; }
  }
  @keyframes textReveal {
    0% { opacity: 0; transform: translate(-50%, -30%); filter: blur(18px); }
    100% { opacity: 1; transform: translate(-50%, -50%); filter: blur(0); }
  }
  @keyframes pulse {
    from { transform: translate(-50%, -50%) scale(0.96); opacity: 0.82; }
    to { transform: translate(-50%, -50%) scale(1.03); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .field::before,
    .field::after,
    .orb,
    .orb::after,
    .frame,
    .textGlow,
    .copy,
    .symbol {
      animation: none !important;
    }
  }
  `;
};

const buildHtml = (brief: GodGenerationBrief, variant: LocalVariant): string => {
  const palette = pickPalette(brief);
  const baseStyles = buildBaseStyles(palette);
  const textPayload = buildTextPayload(brief);
  const showText = variant === "text-glow" || Boolean(brief.sceneContext.requiredText);
  const subline = escapeHtml(`${brief.visualTone} • ${brief.motionLanguage}`);

  const body =
    variant === "panel" || variant === "ui-fragment"
      ? `<div class="stage"><div class="field"></div><div class="frame"></div>${showText ? `<div class="copy"><div class="copy__text">${escapeHtml(textPayload || brief.semanticRole)}</div><div class="copy__sub">${subline}</div></div>` : ""}</div>`
      : variant === "frame"
        ? `<div class="stage"><div class="field"></div><div class="frame"></div></div>`
        : variant === "text-glow"
          ? `<div class="stage"><div class="field"></div><div class="textGlow"><div class="textGlow__title">${escapeHtml(textPayload || brief.semanticRole)}</div><div class="textGlow__sub">${subline}</div></div></div>`
          : variant === "symbol"
            ? `<div class="stage"><div class="field"></div><div class="symbol"></div></div>`
            : `<div class="stage"><div class="field"></div><div class="orb"></div>${showText ? `<div class="copy"><div class="copy__text">${escapeHtml(textPayload || brief.semanticRole)}</div><div class="copy__sub">${subline}</div></div>` : ""}</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(buildAssetTitle(brief))}</title>
    <style>
${baseStyles}
    </style>
  </head>
  <body>
${body}
  </body>
</html>`;
};

const buildDraft = (brief: GodGenerationBrief, variant: LocalVariant): GodGeneratedAssetDraft => {
  const html = buildHtml(brief, variant);
  const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
  const css = cssMatch?.[1]?.trim() ?? "";
  const draftHash = sha256Text(html);
  const palette = pickPalette(brief);
  const textPayload = buildTextPayload(brief);
  const motionMetadata = {
    ...brief.motionMetadata,
    recommendedLoopStyle: brief.motionMetadata.recommendedLoopStyle ?? "slow drift with soft settle"
  };

  return godGeneratedAssetDraftSchema.parse({
    title: brief.sceneContext.sceneLabel ? `${brief.sceneContext.sceneLabel} Accent` : `${brief.semanticRole} Accent`,
    label: brief.sceneContext.sceneLabel ? brief.sceneContext.sceneLabel : brief.semanticRole,
    assetRole: brief.sceneContext.assetRole,
    family:
      variant === "panel" || variant === "ui-fragment"
        ? "panel"
        : variant === "frame"
          ? "frame"
          : variant === "text-glow"
            ? "texture"
            : variant === "symbol"
              ? "foreground-element"
              : variant === "texture"
                ? "texture"
                : "flare",
    tier: brief.sceneContext.isSceneSpecific || brief.preferredForm === "text-glow" ? "premium" : "hero",
    renderMode: "iframe",
    preferredForm: variant,
    html,
    css,
    themeTags: (() => {
      const filtered = unique(brief.sceneContext.referenceTags.filter((tag) => isMoodTag(String(tag))));
      return filtered.length > 0 ? filtered : ["neutral"];
    })(),
    semanticTags: unique([
      brief.semanticRole,
      brief.assetPurpose,
      brief.sceneContext.compositionNeed,
      brief.preferredForm,
      ...(brief.sceneContext.referenceTags ?? [])
    ]),
    subjectTags: unique([
      brief.semanticRole,
      brief.sceneContext.sceneLabel,
      brief.sceneContext.exactMoment,
      brief.sceneContext.templateFamily
    ]),
    emotionalTags: brief.sceneContext.assetRole === "background" ? ["calm"] : ["neutral"],
    functionalTags: unique([
      "transparent-overlay",
      "glassmorphism",
      "modular-module",
      "motion-asset",
      brief.preferredForm,
      brief.sceneContext.assetRole,
      brief.sceneContext.compositionNeed
    ]),
    placementZone: brief.sceneContext.assetRole === "background" ? "background-depth" : "foreground-cross",
    safeArea: brief.sceneContext.assetRole === "background" ? "full-frame" : "avoid-caption-region",
    durationPolicy: brief.sceneContext.isSceneSpecific ? "scene-span" : "entry-only",
    opacity: brief.sceneContext.assetRole === "background" ? 0.62 : 0.9,
    blendMode: brief.sceneContext.assetRole === "background" ? "soft-light" : "screen",
    loopable: true,
    transparencyRequired: true,
    noBackgroundRequired: true,
    paletteGuidance: brief.paletteGuidance.length > 0 ? brief.paletteGuidance : [palette.accent],
    reusabilityGoal: brief.reusabilityGoal,
    forbiddenElements: brief.forbiddenElements,
    motionMetadata,
    sourceProvider: "local-template",
    providerConfidence: clamp01(
      variant === "text-glow" && !textPayload ? 0.72 :
      variant === "frame" ? 0.84 :
      variant === "panel" ? 0.86 :
      0.9
    ),
    briefHash: brief.briefId,
    draftHash,
    preferredSize: {
      width: brief.sizeGuidance.width,
      height: brief.sizeGuidance.height
    },
    previewCopy: textPayload || brief.sceneContext.sceneLabel || brief.semanticRole,
    notes: buildMotionNotes(brief)
  });
};

export const createLocalTemplateProvider = (): GodProvider => {
  return {
    id: "god-local-template",
    kind: "local-template",
    generate: async (brief) => {
      const variant = brief.preferredForm;
      const draft = buildDraft(brief, variant);
      return {
        draft,
        rawResponse: {
          mode: "local-template",
          variant,
          generationId: randomUUID()
        },
        confidence: draft.providerConfidence ?? 0.9,
        summary: `Local template provider produced a ${variant} asset for ${brief.semanticRole}.`
      };
    }
  };
};

export const createRemoteJsonProvider = ({
  endpoint,
  apiKey,
  model,
  fetchImpl = fetch,
  timeoutMs = 45000
}: {
  endpoint: string;
  apiKey: string;
  model?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): GodProvider | null => {
  if (!endpoint.trim()) {
    return null;
  }

  return {
    id: "god-remote-json",
    kind: "remote-json",
    generate: async (brief) => {
      const {masterPrompt, systemPrompt, userPrompt} = buildGodPromptPack(brief);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            ...(apiKey.trim() ? {authorization: `Bearer ${apiKey.trim()}`} : {})
          },
          body: JSON.stringify({
            model: model?.trim() || undefined,
            masterPrompt,
            systemPrompt,
            userPrompt,
            brief,
            outputFormat: "god-html-css-v1",
            transparentBackground: true,
            providerAgnostic: true
          })
        });

        if (!response.ok) {
          throw new Error(`Remote GOD provider failed (${response.status}): ${await response.text()}`);
        }

        const payload = await response.json() as unknown;
        const candidate = godGeneratedAssetDraftSchema.parse(
          (payload as {draft?: unknown; asset?: unknown; result?: unknown}).draft ??
          (payload as {draft?: unknown; asset?: unknown; result?: unknown}).asset ??
          (payload as {draft?: unknown; asset?: unknown; result?: unknown}).result ??
          payload
        );

        return {
          draft: candidate,
          rawResponse: payload,
          confidence: candidate.providerConfidence ?? 0.74,
          summary: `Remote JSON provider returned ${candidate.preferredForm} draft.`
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
};

export const buildGodProviderChain = (options: {
  endpoint: string;
  apiKey: string;
  model?: string;
  kind?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): GodProvider[] => {
  const providers: GodProvider[] = [];
  const remote = createRemoteJsonProvider(options);
  const local = createLocalTemplateProvider();

  if (options.kind?.trim() === "remote-json" && remote) {
    providers.push(remote, local);
    return providers;
  }

  if (remote && options.kind?.trim() !== "local-template") {
    providers.push(remote);
  }

  providers.push(local);
  return providers;
};

export const runGodProviderChain = async ({
  brief,
  providers
}: {
  brief: GodGenerationBrief;
  providers: GodProvider[];
}): Promise<{
  draft: GodGeneratedAssetDraft;
  attempts: GodProviderAttempt[];
}> => {
  const attempts: GodProviderAttempt[] = [];
  let lastError: unknown = null;

  for (const provider of providers) {
    const startedAt = new Date().toISOString();
    const started = Date.now();

    try {
      const result = await provider.generate(brief);
      const draft = godGeneratedAssetDraftSchema.parse(result.draft);
      const confidence = clamp01(result.confidence ?? draft.providerConfidence ?? 0.74);
      const finishedAt = new Date().toISOString();
      attempts.push({
        providerId: provider.id,
        providerKind: provider.kind,
        startedAt,
        finishedAt,
        durationMs: Date.now() - started,
        status: confidence >= 0.58 ? "success" : "fallback",
        confidence,
        warningCount: 0,
        error: null,
        summary: result.summary,
        responseHash: sha256Text(JSON.stringify(result.rawResponse ?? result.draft)),
        responsePreview: JSON.stringify(result.rawResponse ?? result.draft).slice(0, 300)
      });

      if (confidence >= 0.58) {
        return {
          draft,
          attempts
        };
      }

      lastError = new Error(`Provider ${provider.id} confidence ${confidence.toFixed(2)} below threshold.`);
    } catch (error) {
      lastError = error;
      attempts.push({
        providerId: provider.id,
        providerKind: provider.kind,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        status: "failed",
        confidence: null,
        warningCount: 0,
        error: error instanceof Error ? error.message : String(error),
        summary: `Provider ${provider.id} failed.`,
        responseHash: null,
        responsePreview: null
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No GOD provider succeeded.");
};
