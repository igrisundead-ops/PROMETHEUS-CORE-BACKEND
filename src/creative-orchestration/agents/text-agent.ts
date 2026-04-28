import {resolveCaptionEditorialDecision} from "../../lib/motion-platform/caption-editorial-engine";
import type {CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {extractCreativeKeywords} from "../assets/asset-search";
import {clamp01, hashString, normalizeText} from "../utils";

const pickStyleToken = (moment: CreativeMoment): string => {
  const text = normalizeText(moment.transcriptText);
  if (/(mistake|wrong|bottleneck|risk|problem|avoid|lose)/.test(text)) {
    return "danger-red";
  }
  if (/(growth|scale|progress|increase|better|more|faster|up)/.test(text)) {
    return "hormozi-yellow";
  }
  if (moment.momentType === "question") {
    return "cinematic-blue";
  }
  if (moment.momentType === "title" || moment.momentType === "hook") {
    return "premium-white";
  }
  return "apple-minimal";
};

const pickAnimation = (moment: CreativeMoment): string => {
  if (moment.momentType === "question") {
    return "underline-sweep";
  }
  if (moment.momentType === "title" || moment.momentType === "hook") {
    return "glass-card-reveal";
  }
  if (moment.momentType === "keyword" || moment.momentType === "payoff") {
    return "kinetic-pop";
  }
  if (moment.momentType === "list") {
    return "word-stagger";
  }
  return "blur-slide-up";
};

const selectKeywords = (moment: CreativeMoment): string[] => {
  return extractCreativeKeywords(moment).slice(0, moment.momentType === "keyword" ? 2 : 4);
};

export class TextAgent implements CreativeAgent<CreativeContext> {
  id = "text-agent";
  label = "Text";

  async propose(context: CreativeContext, moment: CreativeMoment) {
    const keywords = selectKeywords(moment);
    const editorialDecision = resolveCaptionEditorialDecision({
      chunk: context.chunks.find((chunk) => moment.chunkIds?.includes(chunk.id)) ?? context.chunks[0]!,
      captionProfileId: context.captionProfileId ?? undefined,
      motionTier: context.motionTier ?? undefined
    });

    const basePriority = Math.round(moment.importance * 100);
    const baseConfidence = clamp01(0.55 + moment.importance * 0.35 + moment.energy * 0.1);
    const keywordText = keywords[0] ?? moment.transcriptText;
    const hasOcclusionRisk = moment.momentType === "hook" || moment.momentType === "title" || moment.importance >= 0.9;

    return [
      {
        id: `proposal-text-${moment.id}-keyword`,
        agentId: this.id,
        momentId: moment.id,
        type: "text",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: basePriority + 22,
        confidence: baseConfidence,
        renderCost: "low",
        requiresMatting: hasOcclusionRisk,
        requiresVideoFrames: false,
        compatibleWith: ["motion", "sound", "background", "asset"],
        payload: {
          mode: "keyword-only",
          text: keywordText,
          emphasizedWords: keywords.slice(0, 2),
          animation: pickAnimation(moment),
          styleToken: pickStyleToken(moment),
          positionIntent: hasOcclusionRisk ? "hero-center" : "center",
          requiresMatting: hasOcclusionRisk,
          accentColor: editorialDecision.textColor,
          contrastRequirement: editorialDecision.surfaceTone === "dark" ? "light-on-dark" : editorialDecision.surfaceTone === "light" ? "dark-on-light" : "auto"
        },
        reasoning: `Moment ${moment.momentType} with importance ${moment.importance.toFixed(2)} favors a keyword-first treatment.`,
        conflictsWith: moment.momentType === "ambient" ? ["title-card"] : undefined
      },
      {
        id: `proposal-text-${moment.id}-caption`,
        agentId: this.id,
        momentId: moment.id,
        type: "text",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: basePriority + 8,
        confidence: Math.max(0.42, baseConfidence - 0.1),
        renderCost: "low",
        payload: {
          mode: "full-caption",
          text: moment.transcriptText,
          emphasizedWords: keywords.slice(0, 3),
          animation: "word-stagger",
          styleToken: "apple-minimal",
          positionIntent: "lower-third",
          requiresMatting: false,
          accentColor: editorialDecision.textColor,
          contrastRequirement: "auto"
        },
        reasoning: `Fallback caption treatment preserves clarity when the moment does not justify a more aggressive move.`
      },
      ...(moment.momentType === "title" || moment.momentType === "hook" || moment.momentType === "payoff"
        ? [{
            id: `proposal-text-${moment.id}-title`,
            agentId: this.id,
            momentId: moment.id,
            type: "text",
            startMs: moment.startMs,
            endMs: moment.endMs,
            priority: basePriority + 30 + hashString(moment.id) % 6,
            confidence: Math.min(0.97, baseConfidence + 0.08),
            renderCost: "medium",
            requiresMatting: hasOcclusionRisk,
            payload: {
              mode: "title-card",
              text: moment.transcriptText.toUpperCase(),
              emphasizedWords: keywords.slice(0, 2),
              animation: "glass-card-reveal",
              styleToken: moment.momentType === "payoff" ? "hormozi-yellow" : "premium-white",
              positionIntent: "hero-center",
              requiresMatting: hasOcclusionRisk,
              accentColor: editorialDecision.textColor,
              contrastRequirement: editorialDecision.surfaceTone === "dark" ? "light-on-dark" : "auto"
            },
            reasoning: `Short high-impact moments can carry a title-card style reveal instead of generic captions.`
          }]
        : []),
      ...(moment.momentType === "ambient" || moment.energy < 0.34
        ? [{
            id: `proposal-text-${moment.id}-none`,
            agentId: this.id,
            momentId: moment.id,
            type: "text",
            startMs: moment.startMs,
            endMs: moment.endMs,
            priority: Math.max(1, basePriority - 12),
            confidence: 0.74,
            renderCost: "low",
            payload: {
              mode: "no-text",
              text: "",
              emphasizedWords: [],
              animation: "none",
              styleToken: "hidden",
              positionIntent: "center",
              requiresMatting: false,
              accentColor: editorialDecision.textColor,
              contrastRequirement: "auto"
            },
            reasoning: `This moment is better left to motion, background, or sound than to another visible caption.`
          }]
        : [])
    ];
  }
}

