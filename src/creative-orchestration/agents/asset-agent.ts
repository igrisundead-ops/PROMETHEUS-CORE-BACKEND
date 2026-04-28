import type {CreativeAgent, CreativeAsset, CreativeContext, CreativeMoment} from "../types";
import {SAMPLE_CREATIVE_ASSETS} from "../assets/sample-assets";
import {extractCreativeKeywords, searchCreativeAssets} from "../assets/asset-search";
import {clamp01} from "../utils";

const getUsage = (moment: CreativeMoment, asset: CreativeAsset): "replace-text" | "support-text" | "background-visual" | "foreground-card" | "transition-bridge" => {
  if (moment.momentType === "transition" || /transition|bridge|sweep/i.test(asset.name)) {
    return "transition-bridge";
  }
  if (asset.hasTextSlot && (moment.momentType === "title" || moment.momentType === "payoff" || moment.importance >= 0.82)) {
    return "replace-text";
  }
  if (asset.hasTextSlot) {
    return "support-text";
  }
  if (moment.suggestedIntensity === "hero" || asset.renderCost === "high") {
    return "foreground-card";
  }
  return "background-visual";
};

export class AssetAgent implements CreativeAgent<CreativeContext> {
  id = "asset-agent";
  label = "Asset";

  async propose(context: CreativeContext, moment: CreativeMoment) {
    const assets = context.availableAssets?.length ? context.availableAssets : SAMPLE_CREATIVE_ASSETS;
    const keywords = extractCreativeKeywords(moment);
    const matches = searchCreativeAssets(assets, moment, 3);
    const matched = matches[0] ?? null;

    if (!matched || (moment.momentType === "ambient" && moment.importance < 0.62)) {
      return [];
    }

    const usage = getUsage(moment, matched);
    const slotHeadline = matched.hasTextSlot ? (keywords[0] ?? moment.transcriptText).slice(0, 36) : undefined;
    const slotSubline = matched.hasTextSlot && keywords[1] ? keywords[1] : undefined;

    return [
      {
        id: `proposal-asset-${moment.id}-${matched.id}`,
        agentId: this.id,
        momentId: moment.id,
        type: "asset",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + (matched.renderCost === "high" ? 6 : 14),
        confidence: clamp01(0.58 + matches.length * 0.09 + moment.importance * 0.18),
        renderCost: matched.renderCost,
        requiresMatting: usage === "foreground-card" && moment.importance > 0.88,
        requiresVideoFrames: false,
        compatibleWith: ["text", "motion", "background"],
        payload: {
          assetId: matched.id,
          usage,
          textSlots: matched.hasTextSlot
            ? {
                headline: slotHeadline,
                subline: slotSubline
              }
            : undefined,
          placementIntent: moment.momentType === "title" ? "hero-center" : moment.momentType === "transition" ? "center" : "right-side-card",
          animationIntent: matched.motionCompatible ? "float-in-depth" : "fade-on",
          reason: `Keyword match favored ${matched.name} for ${moment.momentType} moment ${moment.id}.`
        },
        reasoning: `Asset selection matched ${matched.name} with ${keywords.slice(0, 3).join(", ") || "moment keywords"}.`
      }
    ];
  }
}

