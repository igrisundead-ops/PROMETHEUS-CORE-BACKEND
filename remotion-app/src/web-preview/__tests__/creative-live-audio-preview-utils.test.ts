import {describe, expect, it} from "vitest";

import {
  buildLiveAudioSourceKey,
  resolveLiveCreativePreviewDurationMs,
  selectActiveCreativeMoment,
  selectActiveCreativeTracks
} from "../creative-live-audio-preview-utils";
import type {CreativeTimeline} from "../../creative-orchestration/types";

const timeline: CreativeTimeline = {
  id: "timeline-1",
  sourceJobId: "job-1",
  durationMs: 12000,
  moments: [
    {
      id: "moment-1",
      startMs: 0,
      endMs: 2400,
      transcriptText: "Start the hook",
      words: [],
      momentType: "hook",
      energy: 0.8,
      importance: 0.94,
      density: 2,
      suggestedIntensity: "hero"
    },
    {
      id: "moment-2",
      startMs: 2800,
      endMs: 5600,
      transcriptText: "Explain the core idea",
      words: [],
      momentType: "explanation",
      energy: 0.52,
      importance: 0.6,
      density: 3,
      suggestedIntensity: "medium"
    }
  ],
  decisions: [],
  tracks: [
    {
      id: "background-1",
      type: "background",
      startMs: 0,
      endMs: 6000,
      zIndex: 0,
      payload: {backgroundStyle: "radial-spotlight"}
    },
    {
      id: "text-1",
      type: "text",
      startMs: 0,
      endMs: 2400,
      zIndex: 4,
      payload: {mode: "title-card", text: "START", positionIntent: "hero-center"}
    },
    {
      id: "asset-1",
      type: "asset",
      startMs: 0,
      endMs: 2400,
      zIndex: 3,
      payload: {assetId: "asset_title_plate_001", usage: "replace-text"}
    },
    {
      id: "sound-1",
      type: "sound",
      startMs: 0,
      endMs: 800,
      zIndex: 1,
      payload: {soundType: "soft-hit"}
    }
  ],
  diagnostics: {
    proposalCount: 4,
    approvedCount: 4,
    rejectedCount: 0,
    renderCost: "low",
    mattingWindows: [],
    warnings: []
  }
};

describe("creative-live-audio-preview-utils", () => {
  it("selects active tracks in z-index order", () => {
    const activeTracks = selectActiveCreativeTracks(timeline, 600);
    expect(activeTracks.map((track) => track.id)).toEqual(["text-1", "asset-1", "sound-1", "background-1"]);
  });

  it("returns the active moment or nearest moment when none is active", () => {
    expect(selectActiveCreativeMoment(timeline, 1200)?.id).toBe("moment-1");
    expect(selectActiveCreativeMoment(timeline, 7000)?.id).toBe("moment-2");
  });

  it("resolves preview duration using the timeline and track fallback chain", () => {
    expect(resolveLiveCreativePreviewDurationMs({providedDurationMs: 9000, creativeTimeline: timeline})).toBe(9000);
    expect(resolveLiveCreativePreviewDurationMs({creativeTimeline: timeline})).toBe(12000);
    expect(resolveLiveCreativePreviewDurationMs({providedDurationMs: null, creativeTimeline: null, fallbackDurationMs: 14000})).toBe(14000);
    expect(resolveLiveCreativePreviewDurationMs({providedDurationMs: null, creativeTimeline: null})).toBe(30000);
  });

  it("builds a stable audio source key that changes when the source changes", () => {
    expect(buildLiveAudioSourceKey({jobId: "job-1", audioSrc: "blob:abc", previewTimelineResetVersion: 2})).toBe("job-1|blob:abc|2");
    expect(buildLiveAudioSourceKey({jobId: "job-1", audioSrc: "  ", previewTimelineResetVersion: 2})).toBe("job-1|missing|2");
    expect(buildLiveAudioSourceKey({jobId: "job-1", audioSrc: "blob:def", previewTimelineResetVersion: 2})).not.toBe(
      buildLiveAudioSourceKey({jobId: "job-1", audioSrc: "blob:abc", previewTimelineResetVersion: 2})
    );
  });
});
