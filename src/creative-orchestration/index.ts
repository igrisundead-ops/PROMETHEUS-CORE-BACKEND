import {normalizeCaptionStyleProfileId} from "../lib/stylebooks/caption-style-profiles";
import {routeStyleForWords} from "../lib/style-routing";
import type {CaptionChunk, CaptionStyleProfileId} from "../lib/types";
import {isCreativeOrchestrationEnabled} from "../lib/env";
import {MomentSegmentationAgent} from "./segmentation/moment-segmentation-agent";
import {TextAgent} from "./agents/text-agent";
import {AssetAgent} from "./agents/asset-agent";
import {BackgroundOverlayAgent} from "./agents/background-overlay-agent";
import {MotionAgent} from "./agents/motion-agent";
import {SoundAgent} from "./agents/sound-agent";
import {LayoutAgent} from "./agents/layout-agent";
import {MattingDepthAgent} from "./agents/matting-depth-agent";
import {RenderBudgetAgent} from "./agents/render-budget-agent";
import {PatternMemoryAgent} from "./agents/pattern-memory-agent";
import {CreativeDirector} from "./director/creative-director";
import {AestheticCritic} from "./director/aesthetic-critic";
import {buildAudioOnlyCreativePreview} from "./render/audio-preview-renderer";
import {buildOverlayCreativePreview} from "./render/overlay-preview-renderer";
import {creativeTimelineToRemotion, type CreativeRenderInput, type CreativeRenderMode} from "./render/creative-timeline-to-remotion";
import type {
  AgentProposal,
  CreativeContext,
  CreativeOrchestrationDebugReport,
  CreativeOrchestrationResult,
  CreativePatternMemory,
  CreativeTimeline,
  DirectorDecision
} from "./types";
import {hashString} from "./utils";

const getTextProfileForTreatment = (treatment: DirectorDecision["finalTreatment"], chunk: CaptionChunk): CaptionStyleProfileId => {
  if (treatment === "no-treatment") {
    return normalizeCaptionStyleProfileId(chunk.profileId ?? "slcp");
  }
  if (treatment === "caption-only") {
    return normalizeCaptionStyleProfileId(chunk.profileId ?? "slcp");
  }
  if (treatment === "keyword-emphasis") {
    return chunk.words.length <= 3 ? "hormozi_word_lock_v1" : "svg_typography_v1";
  }
  if (treatment === "asset-supported") {
    return "longform_semantic_sidecall_v1";
  }
  if (treatment === "asset-led") {
    return "longform_semantic_sidecall_v1";
  }
  if (treatment === "title-card") {
    return chunk.words.length <= 4 ? "svg_typography_v1" : "longform_svg_typography_v1";
  }
  if (treatment === "background-overlay" || treatment === "cinematic-transition") {
    return "svg_typography_v1";
  }
  if (treatment === "behind-speaker-depth") {
    return "longform_semantic_sidecall_v1";
  }
  return normalizeCaptionStyleProfileId(chunk.profileId ?? "slcp");
};

const applyDecisionToChunk = (chunk: CaptionChunk, decision: DirectorDecision): CaptionChunk => {
  const profileId = getTextProfileForTreatment(decision.finalTreatment, chunk);
  const routed = routeStyleForWords(chunk.words.map((word) => word.text), chunk.semantic ?? {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: chunk.suppressDefault ?? false
  }, {
    profileId,
    chunkIndex: Number.parseInt(decision.momentId.split("-").pop() ?? "1", 10) - 1
  });
  const suppressDefault = decision.finalTreatment === "no-treatment" || chunk.suppressDefault === true;

  return {
    ...chunk,
    profileId,
    styleKey: routed.styleKey,
    motionKey: routed.motionKey,
    layoutVariant: routed.layoutVariant,
    suppressDefault,
    semantic: {
      ...(chunk.semantic ?? {
        intent: "default",
        nameSpans: [],
        isVariation: false,
        suppressDefault: false
      }),
      suppressDefault
    }
  };
};

export const buildCreativeOrchestrationPlan = async (input: {
  jobId: string;
  captionChunks: CaptionChunk[];
  captionProfileId?: CaptionStyleProfileId | null;
  motionTier?: CreativeContext["motionTier"];
  renderMode?: CreativeRenderMode;
  videoMetadata?: CreativeContext["videoMetadata"];
  audioFeatures?: CreativeContext["audioFeatures"];
  patternMemory?: CreativePatternMemory[];
  availableAssets?: CreativeContext["availableAssets"];
  sourceJobId?: string;
  featureFlags?: CreativeContext["featureFlags"];
}): Promise<CreativeOrchestrationResult> => {
  const enabled = input.featureFlags?.creativeOrchestrationV1 ?? isCreativeOrchestrationEnabled();
  const context: CreativeContext = {
    jobId: input.jobId,
    sourceJobId: input.sourceJobId,
    captionProfileId: input.captionProfileId ?? null,
    motionTier: input.motionTier ?? null,
    renderMode: input.renderMode ?? "overlay-preview",
    chunks: input.captionChunks,
    videoMetadata: input.videoMetadata ?? null,
    audioFeatures: input.audioFeatures ?? null,
    availableAssets: input.availableAssets,
    patternMemory: input.patternMemory,
    featureFlags: input.featureFlags,
    revisionPass: 0
  };

  if (!enabled) {
    const fallbackTimeline: CreativeTimeline = {
      id: `creative-timeline-${hashString(`${input.jobId}|fallback`)}`,
      sourceJobId: input.sourceJobId ?? input.jobId,
      durationMs: input.captionChunks.reduce((max, chunk) => Math.max(max, chunk.endMs), 0),
      moments: [],
      decisions: [],
      tracks: [],
      diagnostics: {
        proposalCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        renderCost: "low",
        mattingWindows: [],
        warnings: ["Creative orchestration disabled; using existing caption behavior."]
      }
    };
    const debugReport: CreativeOrchestrationDebugReport = {
      jobId: input.jobId,
      moments: [],
      allProposals: [],
      directorDecisions: [],
      criticReview: {status: "approved", score: 100, issues: []},
      finalCreativeTimeline: fallbackTimeline
    };

    return {
      jobId: input.jobId,
      enabled: false,
      moments: [],
      allProposals: [],
      directorDecisions: [],
      criticReview: debugReport.criticReview,
      finalCreativeTimeline: fallbackTimeline,
      captionChunks: input.captionChunks,
      debugReport
    };
  }

  const segmenter = new MomentSegmentationAgent();
  const moments = segmenter.segment(context);
  const patternMemoryAgent = new PatternMemoryAgent(input.patternMemory ?? []);
  const agents = [
    new TextAgent(),
    new AssetAgent(),
    new BackgroundOverlayAgent(),
    new MotionAgent(),
    new SoundAgent(),
    new LayoutAgent(),
    new MattingDepthAgent(),
    new RenderBudgetAgent(),
    patternMemoryAgent
  ];

  const allProposals = (
    await Promise.all(
      moments.flatMap((moment) =>
        agents.map(async (agent) => agent.propose(context, moment))
      )
    )
  ).flat();
  const proposalsByMoment = new Map<string, AgentProposal[]>();
  for (const proposal of allProposals) {
    const bucket = proposalsByMoment.get(proposal.momentId) ?? [];
    bucket.push(proposal);
    proposalsByMoment.set(proposal.momentId, bucket);
  }

  const director = new CreativeDirector();
  const critic = new AestheticCritic();
  const firstPass = director.decide(context, moments, proposalsByMoment, 0, []);
  let criticReview = critic.review(firstPass.timeline, context);
  let finalDecisionSet = firstPass;

  if (criticReview.status === "needs-revision") {
    const revisionContext: CreativeContext = {...context, revisionPass: 1};
    finalDecisionSet = director.decide(
      revisionContext,
      moments,
      proposalsByMoment,
      1,
      criticReview.issues.map((issue) => issue.issue)
    );
    criticReview = critic.review(finalDecisionSet.timeline, revisionContext);
  }

  const captionChunks = input.captionChunks.map((chunk) => {
    const momentIndex = moments.findIndex((moment) => moment.chunkIds?.includes(chunk.id));
    const decision = finalDecisionSet.decisions[momentIndex];
    return decision ? applyDecisionToChunk(chunk, decision) : chunk;
  });

  const creativeInput: CreativeRenderInput = {
    sourceVideoUrl: null,
    sourceAudioUrl: null,
    creativeTimeline: finalDecisionSet.timeline,
    renderMode: context.renderMode
  };
  if (context.renderMode === "audio-preview") {
    buildAudioOnlyCreativePreview(creativeInput);
  } else if (context.renderMode === "overlay-preview") {
    buildOverlayCreativePreview(creativeInput);
  } else {
    creativeTimelineToRemotion(creativeInput);
  }

  const debugReport: CreativeOrchestrationDebugReport = {
    jobId: input.jobId,
    moments,
    allProposals,
    directorDecisions: finalDecisionSet.decisions,
    criticReview,
    finalCreativeTimeline: finalDecisionSet.timeline
  };

  return {
    jobId: input.jobId,
    enabled: true,
    moments,
    allProposals,
    directorDecisions: finalDecisionSet.decisions,
    criticReview,
    finalCreativeTimeline: finalDecisionSet.timeline,
    captionChunks,
    debugReport
  };
};

export {
  AssetAgent,
  AestheticCritic,
  BackgroundOverlayAgent,
  CreativeDirector,
  LayoutAgent,
  MattingDepthAgent,
  MomentSegmentationAgent,
  PatternMemoryAgent,
  RenderBudgetAgent,
  SoundAgent,
  TextAgent,
  buildAudioOnlyCreativePreview,
  buildOverlayCreativePreview,
  creativeTimelineToRemotion
};
