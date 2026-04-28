import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {CreativeLiveAudioPreview} from "../CreativeLiveAudioPreview";
import type {CreativeTimeline} from "../../creative-orchestration/types";
import {buildMotionCompositionModel} from "../../lib/motion-platform/scene-engine";
import type {CaptionChunk} from "../../lib/types";

const captionChunks: CaptionChunk[] = [
  {
    id: "chunk-static-1",
    text: "Looking for the bottleneck",
    startMs: 0,
    endMs: 2000,
    words: [
      {text: "Looking", startMs: 0, endMs: 540},
      {text: "for", startMs: 540, endMs: 880},
      {text: "the", startMs: 880, endMs: 1180},
      {text: "bottleneck", startMs: 1180, endMs: 2000}
    ],
    styleKey: "eve-premium",
    motionKey: "word-rise-blur-resolve",
    layoutVariant: "inline",
    emphasisWordIndices: [3],
    profileId: "longform_eve_typography_v1"
  }
];

const videoMetadata = {
  width: 1920,
  height: 1080,
  fps: 30
} as const;

const motionModel = buildMotionCompositionModel({
  chunks: captionChunks,
  tier: "premium",
  fps: videoMetadata.fps,
  videoMetadata: {
    ...videoMetadata,
    durationSeconds: 8,
    durationInFrames: 240
  },
  captionProfileId: "longform_eve_typography_v1"
});

const timeline: CreativeTimeline = {
  id: "timeline-static",
  sourceJobId: "job-static",
  durationMs: 8000,
  moments: [
    {
      id: "moment-static-1",
      startMs: 0,
      endMs: 2000,
      transcriptText: "Looking for the bottleneck",
      words: [],
      momentType: "hook",
      energy: 0.84,
      importance: 0.93,
      density: 2,
      suggestedIntensity: "hero"
    }
  ],
  decisions: [],
  tracks: [
    {
      id: "text-static-1",
      type: "text",
      startMs: 0,
      endMs: 2000,
      zIndex: 4,
      payload: {
        mode: "title-card",
        text: "LOOKING",
        positionIntent: "hero-center",
        styleToken: "premium-white"
      }
    }
  ],
  diagnostics: {
    proposalCount: 1,
    approvedCount: 1,
    rejectedCount: 0,
    renderCost: "low",
    mattingWindows: [],
    warnings: []
  }
};

describe("CreativeLiveAudioPreview", () => {
  it("renders a native audio-driven preview surface without video or Remotion player markup", () => {
    const markup = renderToStaticMarkup(
      <CreativeLiveAudioPreview
        jobId="job-static"
        audioSrc="blob:preview"
        durationMs={8000}
        captionChunks={captionChunks}
        captionProfileId="longform_eve_typography_v1"
        creativeTimeline={timeline}
        motionModel={motionModel}
        videoMetadata={videoMetadata}
        showDebugOverlay={true}
      />
    );

    expect(markup).toContain("<audio");
    expect(markup).not.toContain("<video");
    expect(markup).not.toContain("remotion-player");
    expect(markup).toContain("Native Audio Clock");
    expect(markup).toContain("data-live-audio-stage-viewport=\"true\"");
    expect(markup).toContain("data-live-audio-control-dock=\"true\"");
  });
});
