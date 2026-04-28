import {sha256Text} from "../utils/hash";
import type {BackendEnv} from "../config";
import type {
  GodBenchmarkResult,
  GodGeneratedAssetDraft,
  GodGenerationBrief,
  GodValidationCheck,
  GodValidationResult
} from "./types";
import {
  godBenchmarkResultSchema,
  godValidationCheckSchema,
  godValidationResultSchema
} from "./types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const unique = (values: Array<string | undefined | null>): string[] => {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
};

const extractBodyText = (html: string): string => {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
};

const hasOpaqueCanvasBackground = (html: string): boolean => {
  return /(?:html|body|\.stage)[^{]*\{[^}]{0,240}?background\s*:\s*(?!transparent\b)(?!none\b)(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|linear-gradient\(|radial-gradient\()/i.test(html);
};

const computeTransparencyScore = (html: string): number => {
  const checks = [
    /background\s*:\s*transparent/i.test(html),
    /html,\s*body[\s\S]{0,220}background\s*:\s*transparent/i.test(html),
    /isolation\s*:\s*isolate/i.test(html),
    /overflow\s*:\s*hidden/i.test(html)
  ];
  const hitCount = checks.filter(Boolean).length;
  return clamp01(0.18 + hitCount * 0.18 - (hasOpaqueCanvasBackground(html) ? 0.22 : 0));
};

const computeTechnicalScore = (html: string): number => {
  let score = 0.42;
  if (/<!doctype html>/i.test(html)) score += 0.06;
  if (/<meta charset=/i.test(html)) score += 0.03;
  if (/background\s*:\s*transparent/i.test(html)) score += 0.12;
  if (/isolation\s*:\s*isolate/i.test(html)) score += 0.08;
  if (/overflow\s*:\s*hidden/i.test(html)) score += 0.06;
  if (/backdrop-filter\s*:\s*blur/i.test(html)) score += 0.05;
  if (/@keyframes/i.test(html)) score += 0.08;
  if (/animation\s*:/i.test(html)) score += 0.08;
  if (!/<script/i.test(html)) score += 0.06;
  if (!/https?:\/\//i.test(html)) score += 0.05;
  return clamp01(score);
};

const computeCompositingScore = (html: string): number => {
  let score = computeTransparencyScore(html);
  if (/inset\s+0/i.test(html) || /inset:\s*0/i.test(html)) score += 0.06;
  if (/box-shadow/i.test(html)) score += 0.04;
  if (/border:\s*1px\s+solid/i.test(html)) score += 0.04;
  if (/mix-blend-mode/i.test(html)) score += 0.03;
  if (/radial-gradient/i.test(html)) score += 0.05;
  if (hasOpaqueCanvasBackground(html)) score -= 0.18;
  if (/watermark|stock|shutterstock|adobe/i.test(html)) score -= 0.22;
  return clamp01(score);
};

const computeAestheticScore = (html: string): number => {
  let score = 0.42;
  if (/backdrop-filter\s*:\s*blur/i.test(html)) score += 0.14;
  if (/radial-gradient/i.test(html)) score += 0.1;
  if (/box-shadow/i.test(html)) score += 0.08;
  if (/text-shadow/i.test(html)) score += 0.08;
  if (/cubic-bezier/i.test(html)) score += 0.08;
  if (/glass|frosted|vignette|glow|blur/i.test(html)) score += 0.1;
  if (/clutter|random|clipart|watermark|lorem/i.test(html)) score -= 0.18;
  return clamp01(score);
};

const computeStyleScore = (brief: GodGenerationBrief, html: string): number => {
  const query = unique([
    brief.semanticRole,
    brief.visualTone,
    brief.motionLanguage,
    brief.assetPurpose,
    brief.preferredForm,
    ...brief.paletteGuidance,
    ...brief.requiredElements
  ]);
  const body = extractBodyText(html).toLowerCase();
  let score = 0.44;

  query.forEach((term) => {
    const normalized = term.toLowerCase().trim();
    if (!normalized) {
      return;
    }
    if (body.includes(normalized)) {
      score += normalized.includes(" ") ? 0.06 : 0.03;
    }
  });

  if (brief.preferredForm === "text-glow" && /text-shadow/i.test(html)) score += 0.08;
  if (brief.preferredForm === "orb" && /border-radius:\s*999px/i.test(html)) score += 0.08;
  if (brief.preferredForm === "panel" && /backdrop-filter/i.test(html)) score += 0.06;
  if (brief.noBackgroundRequired && /background\s*:\s*transparent/i.test(html)) score += 0.08;
  if (brief.forbiddenElements.some((term) => body.includes(term.toLowerCase()))) score -= 0.18;

  return clamp01(score);
};

const computeMotionScore = (html: string): number => {
  let score = 0.4;
  if (/animation\s*:/i.test(html)) score += 0.12;
  if (/@keyframes/i.test(html)) score += 0.12;
  if (/transform\s*:/i.test(html)) score += 0.1;
  if (/translate3d|translateY|rotate3d|scale/i.test(html)) score += 0.08;
  if (/cubic-bezier/i.test(html)) score += 0.08;
  if (/blur\s*:\s*|filter\s*:\s*blur/i.test(html)) score += 0.06;
  if (/duration|timing|settle|drift|rise|pulse|reveal/i.test(html)) score += 0.06;
  return clamp01(score);
};

const computeReuseScore = (brief: GodGenerationBrief, html: string): number => {
  let score = 0.5;
  const lower = html.toLowerCase();
  if (!brief.sceneContext.requiredText && !/<div class="copy">/i.test(html)) score += 0.12;
  if (!/scene-specific|one-off|single-use/i.test(lower)) score += 0.06;
  if (/modular|reusable|overlay|transparent/i.test(lower)) score += 0.08;
  if (/backdrop-filter|radial-gradient|box-shadow/i.test(lower)) score += 0.06;
  if (brief.sceneContext.isSceneSpecific) score -= 0.08;
  if (brief.sceneContext.variationRequested) score += 0.04;
  return clamp01(score);
};

const createCheck = (id: string, passed: boolean, score: number, notes: string[] = []): GodValidationCheck => {
  return godValidationCheckSchema.parse({
    id,
    passed,
    score: clamp01(score),
    notes
  });
};

export const validateGodDraft = (brief: GodGenerationBrief, draft: GodGeneratedAssetDraft): GodValidationResult => {
  const html = draft.html ?? "";
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  if (!html.trim()) {
    hardErrors.push("Generated HTML was empty.");
  }
  if (!/<!doctype html>/i.test(html)) {
    warnings.push("HTML did not include an explicit doctype.");
  }
  if (/<script/i.test(html)) {
    hardErrors.push("Generated asset included JavaScript even though HTML/CSS only was required.");
  }
  if (/watermark|shutterstock|adobe|made with/i.test(html)) {
    hardErrors.push("Generated asset appears to contain watermark or branding contamination.");
  }
  if (brief.noBackgroundRequired && hasOpaqueCanvasBackground(html)) {
    hardErrors.push("Generated asset appears to include a non-transparent background fill.");
  }
  if (brief.transparencyRequired && !/background\s*:\s*transparent/i.test(html)) {
    warnings.push("Transparency was requested but the generated HTML does not explicitly set a transparent background.");
  }
  if (/<img[^>]+src="https?:\/\//i.test(html)) {
    warnings.push("External image references reduce portability and reuse.");
  }

  const technicalScore = computeTechnicalScore(html);
  const compositingScore = computeCompositingScore(html);
  const aestheticScore = computeAestheticScore(html);
  const styleScore = computeStyleScore(brief, html);
  const motionScore = computeMotionScore(html);
  const reuseScore = computeReuseScore(brief, html);
  const overallScore = clamp01(
    technicalScore * 0.22 +
      compositingScore * 0.22 +
      aestheticScore * 0.18 +
      styleScore * 0.16 +
      motionScore * 0.12 +
      reuseScore * 0.1
  );

  const checks = [
    createCheck("technical-quality", technicalScore >= 0.76, technicalScore, technicalScore >= 0.76 ? ["Structural checks look healthy."] : ["The module needs stronger technical structure."]),
    createCheck("compositing-cleanliness", compositingScore >= 0.8, compositingScore, compositingScore >= 0.8 ? ["Transparent compositing looks clean."] : ["The asset likely needs a cleaner transparent edge discipline."]),
    createCheck("aesthetic-threshold", aestheticScore >= 0.72, aestheticScore, aestheticScore >= 0.72 ? ["Aesthetic signal is premium enough for review."] : ["The visual polish should be raised before promotion."]),
    createCheck("stylistic-adherence", styleScore >= 0.7, styleScore, styleScore >= 0.7 ? ["The output follows the governing brief."] : ["The output drifts from the requested style."]),
    createCheck("motion-suitability", motionScore >= 0.68, motionScore, motionScore >= 0.68 ? ["Motion grammar is usable."] : ["Motion language is too weak or too noisy."]),
    createCheck("reuse-potential", reuseScore >= 0.66, reuseScore, reuseScore >= 0.66 ? ["The asset should be reusable across scenes."] : ["The asset feels too one-off."])
  ];

  const passed = hardErrors.length === 0 && checks.every((check) => check.passed);

  return godValidationResultSchema.parse({
    passed,
    hardErrors,
    warnings,
    checks,
    technicalScore,
    compositingScore,
    aestheticScore,
    styleScore,
    motionScore,
    reuseScore,
    overallScore,
    contentHash: sha256Text(html),
    fileHash: sha256Text(`${draft.html}\n${draft.css ?? ""}`),
    normalizedHtmlPath: undefined,
    previewPath: undefined
  });
};

export const buildGodBenchmarkResult = ({
  validation,
  env,
  userApproved
}: {
  validation: GodValidationResult;
  env: BackendEnv;
  userApproved: boolean;
}): GodBenchmarkResult => {
  const thresholds = {
    technical: env.GOD_MIN_TECHNICAL_SCORE,
    compositing: env.GOD_MIN_COMPOSITING_SCORE,
    aesthetic: env.GOD_MIN_AESTHETIC_SCORE,
    style: env.GOD_MIN_STYLE_SCORE,
    motion: env.GOD_MIN_MOTION_SCORE,
    reuse: env.GOD_MIN_REUSE_SCORE,
    overall: env.GOD_MIN_OVERALL_SCORE
  };

  const gates = {
    technical: validation.technicalScore >= thresholds.technical,
    compositing: validation.compositingScore >= thresholds.compositing,
    aesthetic: validation.aestheticScore >= thresholds.aesthetic,
    style: validation.styleScore >= thresholds.style,
    motion: validation.motionScore >= thresholds.motion,
    reuse: validation.reuseScore >= thresholds.reuse,
    approval: userApproved
  };

  const reasons = [
    ...(validation.hardErrors.length > 0 ? validation.hardErrors : []),
    ...(validation.warnings.length > 0 ? validation.warnings : []),
    ...(gates.technical ? [] : [`Technical score ${validation.technicalScore.toFixed(2)} below ${thresholds.technical.toFixed(2)}`]),
    ...(gates.compositing ? [] : [`Compositing score ${validation.compositingScore.toFixed(2)} below ${thresholds.compositing.toFixed(2)}`]),
    ...(gates.aesthetic ? [] : [`Aesthetic score ${validation.aestheticScore.toFixed(2)} below ${thresholds.aesthetic.toFixed(2)}`]),
    ...(gates.style ? [] : [`Style score ${validation.styleScore.toFixed(2)} below ${thresholds.style.toFixed(2)}`]),
    ...(gates.motion ? [] : [`Motion score ${validation.motionScore.toFixed(2)} below ${thresholds.motion.toFixed(2)}`]),
    ...(gates.reuse ? [] : [`Reuse score ${validation.reuseScore.toFixed(2)} below ${thresholds.reuse.toFixed(2)}`]),
    ...(userApproved ? [] : ["User approval is still required for promotion."])
  ];

  const passed =
    validation.passed &&
    validation.overallScore >= thresholds.overall &&
    gates.technical &&
    gates.compositing &&
    gates.aesthetic &&
    gates.style &&
    gates.motion &&
    gates.reuse &&
    gates.approval;

  return godBenchmarkResultSchema.parse({
    passed,
    overallScore: validation.overallScore,
    technicalScore: validation.technicalScore,
    compositingScore: validation.compositingScore,
    aestheticScore: validation.aestheticScore,
    styleScore: validation.styleScore,
    motionScore: validation.motionScore,
    reuseScore: validation.reuseScore,
    userApproved,
    gates,
    reasons,
    thresholds
  });
};
