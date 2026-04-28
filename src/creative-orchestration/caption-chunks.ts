import {buildCreativeOrchestrationPlan} from "./index";
import type {CaptionChunk, CaptionStyleProfileId} from "../lib/types";
import type {CreativeContext, CreativePatternMemory} from "./types";

export const applyCreativeOrchestrationToCaptionChunks = async (
  captionChunks: CaptionChunk[],
  input: {
    jobId: string;
    captionProfileId?: CaptionStyleProfileId | null;
    renderMode?: CreativeContext["renderMode"];
    featureFlags?: CreativeContext["featureFlags"];
    patternMemory?: CreativePatternMemory[];
    availableAssets?: CreativeContext["availableAssets"];
    videoMetadata?: CreativeContext["videoMetadata"];
    audioFeatures?: CreativeContext["audioFeatures"];
    motionTier?: CreativeContext["motionTier"];
    sourceJobId?: string;
  }
): Promise<{captionChunks: CaptionChunk[]}> => {
  const result = await buildCreativeOrchestrationPlan({
    jobId: input.jobId,
    captionChunks,
    captionProfileId: input.captionProfileId,
    renderMode: input.renderMode ?? "overlay-preview",
    featureFlags: input.featureFlags,
    patternMemory: input.patternMemory,
    availableAssets: input.availableAssets,
    videoMetadata: input.videoMetadata,
    audioFeatures: input.audioFeatures,
    motionTier: input.motionTier,
    sourceJobId: input.sourceJobId
  });

  return {
    captionChunks: result.captionChunks
  };
};

