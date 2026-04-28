import type {AgentProposal, CreativeAgent, CreativeAsset, CreativeContext, CreativeMoment} from "../types";
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

  async propose(context: CreativeContext, moment: CreativeMoment): Promise<AgentProposal[]> {
    const directive = context.judgmentDirectives?.[moment.id];
    const assets = context.availableAssets?.length ? context.availableAssets : SAMPLE_CREATIVE_ASSETS;
    const keywords = extractCreativeKeywords(moment);
    const captain = directive?.editorialDoctrine.captain ?? "text";
    const allowTextAssetPairing = directive?.editorialDoctrine.allowTextAssetPairing ?? true;
    const preferTextOnlyForAbstractMoments = directive?.editorialDoctrine.preferTextOnlyForAbstractMoments ?? false;
    const shouldSkipRetrieval = directive?.retrievalDecision.action === "skip" || !directive?.requestedAgentTypes.includes("asset");
    const matches = searchCreativeAssets(assets, moment, 3);
    const approvedCandidates = directive?.approvedAssetCandidates.filter((candidate) => candidate.selected && !candidate.inspirationOnly) ?? [];
    const approvedAssetCandidate = approvedCandidates.find((candidate) => candidate.assetType === "static_image" || candidate.assetType === "reference" || candidate.assetType === "motion_graphic") ?? null;
    const matched = shouldSkipRetrieval ? (matches[0] ?? null) : null;

    if ((!matched && !approvedAssetCandidate) || !directive?.requestedAgentTypes.includes("asset") || (moment.momentType === "ambient" && moment.importance < 0.62)) {
      return [];
    }

    if (preferTextOnlyForAbstractMoments && captain !== "asset") {
      return [];
    }

    const fallbackUsage = matched ? getUsage(moment, matched) : moment.momentType === "transition" ? "transition-bridge" : "foreground-card";
    const usage =
      captain === "asset"
        ? matched?.hasTextSlot && !allowTextAssetPairing
          ? "replace-text"
          : "foreground-card"
        : captain === "background"
          ? "background-visual"
          : "support-text";
    const slotHeadline = matched?.hasTextSlot ? (keywords[0] ?? moment.transcriptText).slice(0, 36) : undefined;
    const slotSubline = matched?.hasTextSlot && keywords[1] ? keywords[1] : undefined;

    return [
      {
        id: `proposal-asset-${moment.id}-${approvedAssetCandidate?.assetId ?? matched?.id ?? "local"}`,
        agentId: this.id,
        momentId: moment.id,
        type: "asset",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.round(moment.importance * 100) + ((matched?.renderCost ?? "medium") === "high" ? 6 : 14) + (captain === "asset" ? 24 : captain === "background" ? 8 : -6),
        confidence: clamp01(0.58 + matches.length * 0.09 + moment.importance * 0.18 + (approvedAssetCandidate ? 0.1 : 0)),
        renderCost: matched?.renderCost ?? (approvedAssetCandidate?.renderComplexity === "high" ? "high" : approvedAssetCandidate?.renderComplexity === "low" ? "low" : "medium"),
        requiresMatting: usage === "foreground-card" && moment.importance > 0.88,
        requiresVideoFrames: false,
        compatibleWith: ["text", "motion", "background"],
        payload: {
          assetId: approvedAssetCandidate?.assetId ?? matched?.id,
          usage: usage ?? fallbackUsage,
          visualRole: captain === "asset" ? "captain" : "support",
          textSlots: matched?.hasTextSlot
            ? {
                headline: slotHeadline,
                subline: slotSubline
              }
            : undefined,
          placementIntent: captain === "asset"
            ? moment.momentType === "title" ? "hero-center" : "right-side-card"
            : captain === "background"
              ? "full-frame"
              : "right-side-card",
          animationIntent: matched?.motionCompatible ? "float-in-depth" : approvedAssetCandidate?.assetType === "motion_graphic" ? "float-in-depth" : "fade-on",
          approvedRetrievedCandidateId: approvedAssetCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedCandidates.slice(0, 4).map((candidate) => candidate.assetId),
          retrievalWhy: approvedAssetCandidate?.rankingRationale[0],
          retrievalLibraries: directive?.retrievalDecision.allowedLibraries,
          retrievedAssets: approvedCandidates.slice(0, 4).map((candidate) => ({
            assetId: candidate.assetId,
            score: candidate.finalScore,
            publicPath: candidate.publicPath,
            why: candidate.rankingRationale[0]
          })),
          reason: approvedAssetCandidate
            ? `Judgment-approved candidate ${approvedAssetCandidate.assetId} was chosen for ${moment.momentType} moment ${moment.id}.`
            : `Keyword match favored ${matched?.name} for ${moment.momentType} moment ${moment.id}.`
        },
        reasoning: shouldSkipRetrieval
          ? `Asset selection stayed local because retrieval was skipped by the judgment engine.`
          : approvedAssetCandidate
            ? `Judgment-approved retrieval chose ${approvedAssetCandidate.assetId} because ${approvedAssetCandidate.rankingRationale[0] ?? "it ranked best for the current treatment"}.`
            : `No approved asset candidate was available, so the agent declined to improvise beyond the governed plan.`
      } satisfies AgentProposal
    ];
  }
}
