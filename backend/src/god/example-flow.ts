import type {GodService, GodGenerationResult} from "./service";
import type {GodGeneratedAssetRecord, GodReferenceAsset, GodReviewUpdate, GodSceneContext} from "./types";

export type GodExampleFlowResult = {
  assessmentDecision: GodGenerationResult["decision"];
  assessmentSummary: GodGenerationResult["assessment"];
  reusedAsset: GodReferenceAsset | null;
  generation: GodGenerationResult | null;
  reviewRecord: GodGeneratedAssetRecord | null;
  promotedRecord: GodGeneratedAssetRecord | null;
};

export const runGodExampleFlow = async ({
  service,
  context,
  approveGeneratedAsset = true,
  approvalOverride
}: {
  service: GodService;
  context: GodSceneContext;
  approveGeneratedAsset?: boolean;
  approvalOverride?: Partial<GodReviewUpdate>;
}): Promise<GodExampleFlowResult> => {
  const assessment = await service.assessScene(context);

  if (assessment.decision === "use_existing_asset") {
    return {
      assessmentDecision: assessment.decision,
      assessmentSummary: assessment,
      reusedAsset: assessment.topCandidates[0]?.asset ?? null,
      generation: null,
      reviewRecord: null,
      promotedRecord: null
    };
  }

  if (assessment.decision === "escalate_for_manual_review" && !context.variationRequested) {
    return {
      assessmentDecision: assessment.decision,
      assessmentSummary: assessment,
      reusedAsset: assessment.topCandidates[0]?.asset ?? null,
      generation: null,
      reviewRecord: null,
      promotedRecord: null
    };
  }

  const generation = await service.prepareGeneration({
    context,
    forceGeneration: Boolean(context.variationRequested)
  });

  if (!generation.record) {
    return {
      assessmentDecision: generation.decision,
      assessmentSummary: generation.assessment,
      reusedAsset: generation.reusedAsset,
      generation,
      reviewRecord: null,
      promotedRecord: null
    };
  }

  const shouldApprove = approveGeneratedAsset && ((generation.validation?.passed ?? false) || Boolean(approvalOverride?.overrideBenchmarkFailures));
  let promotedRecord: GodGeneratedAssetRecord | null = null;
  let reviewRecord = generation.record;

  if (shouldApprove) {
    promotedRecord = await service.approveReview(generation.record.reviewId, {
      approved: true,
      sceneOnly: approvalOverride?.sceneOnly ?? false,
      reuseEligible: approvalOverride?.reuseEligible ?? true,
      promoteToCollection: approvalOverride?.promoteToCollection ?? true,
      overrideBenchmarkFailures: approvalOverride?.overrideBenchmarkFailures ?? false,
      approvedBy: approvalOverride?.approvedBy ?? "god-example-flow",
      notes: approvalOverride?.notes ?? "Approved through the example GOD flow."
    });
    reviewRecord = promotedRecord;
  }

  return {
    assessmentDecision: generation.decision,
    assessmentSummary: generation.assessment,
    reusedAsset: generation.reusedAsset,
    generation,
    reviewRecord,
    promotedRecord
  };
};
