import {describe, expect, it} from "vitest";

import {buildMotionSoundDesignPlan} from "../motion-platform/sound-design-brain";
import type {
  CaptionChunk,
  MotionBackgroundOverlayPlan,
  MotionShowcasePlan,
  MotionSoundAsset
} from "../types";

const makeChunk = ({
  id,
  text,
  startMs,
  endMs
}: {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}): CaptionChunk => {
  const words = text.split(" ").map((word, index, entries) => {
    const step = (endMs - startMs) / Math.max(1, entries.length);
    return {
      text: word,
      startMs: Math.round(startMs + step * index),
      endMs: Math.round(startMs + step * (index + 1))
    };
  });

  return {
    id,
    text,
    startMs,
    endMs,
    words,
    styleKey: "svg_typography_v1/longform_serif_spread",
    motionKey: "generic_single_word",
    layoutVariant: "fourplus-grid",
    emphasisWordIndices: [],
    semantic: {
      intent: "default",
      isVariation: false,
      nameSpans: [],
      suppressDefault: false
    }
  };
};

const soundCatalog: MotionSoundAsset[] = [
  {
    id: "text-typing-fast",
    label: "Typing Fast",
    src: "audio/sfx/text/typing-fast.mp3",
    sourceFileName: "typing-fast.mp3",
    librarySection: "text",
    durationSeconds: 1.6,
    tags: ["typing", "keyboard", "fast"],
    intensity: "soft"
  },
  {
    id: "clock-tick",
    label: "Clock Tick",
    src: "audio/sfx/clock/tick.mp3",
    sourceFileName: "tick.mp3",
    librarySection: "clock",
    durationSeconds: 1.2,
    tags: ["clock", "tick", "time"],
    intensity: "soft"
  },
  {
    id: "impact-hit",
    label: "Impact Hit",
    src: "audio/sfx/impact/impact.mp3",
    sourceFileName: "impact.mp3",
    librarySection: "impact-hit",
    durationSeconds: 1.1,
    tags: ["impact", "accent", "money"],
    intensity: "hard"
  },
  {
    id: "ui-click",
    label: "UI Click",
    src: "audio/sfx/ui/click.mp3",
    sourceFileName: "click.mp3",
    librarySection: "ui",
    durationSeconds: 0.9,
    tags: ["click", "accent", "message"],
    intensity: "soft"
  },
  {
    id: "whoosh-soft",
    label: "Whoosh Soft",
    src: "audio/sfx/whoosh/whoosh.mp3",
    sourceFileName: "whoosh.mp3",
    librarySection: "whoosh",
    durationSeconds: 1.3,
    tags: ["transition", "movement"],
    intensity: "medium"
  },
  {
    id: "whoosh-soundreality-whoosh-large-sub-384631",
    label: "Soundreality Whoosh Large Sub 384631",
    src: "audio/sfx/whoosh/whoosh-large-sub.mp3",
    sourceFileName: "whoosh-large-sub.mp3",
    librarySection: "whoosh",
    durationSeconds: 8.04,
    tags: ["soundreality", "whoosh", "large", "sub", "transition", "movement"],
    intensity: "medium"
  },
  {
    id: "transition-glitch",
    label: "Transition Glitch",
    src: "audio/sfx/transition/glitch.mp3",
    sourceFileName: "glitch.mp3",
    librarySection: "transition",
    durationSeconds: 1.3,
    tags: ["glitch", "transition", "flashback"],
    intensity: "medium"
  },
  {
    id: "riser-short",
    label: "Riser Short",
    src: "audio/sfx/riser/riser.mp3",
    sourceFileName: "riser.mp3",
    librarySection: "riser",
    durationSeconds: 1.5,
    tags: ["build", "lift", "transition"],
    intensity: "hard"
  },
  {
    id: "drone-subtle",
    label: "Drone Subtle",
    src: "audio/sfx/drone/drone.mp3",
    sourceFileName: "drone.mp3",
    librarySection: "drone",
    durationSeconds: 4.2,
    tags: ["tension", "ambience"],
    intensity: "medium"
  }
];

const musicCatalog: MotionSoundAsset[] = [
  {
    id: "music-podcast-pad",
    label: "Podcast Pad",
    src: "audio/music/podcast-pad.mp3",
    sourceFileName: "podcast-pad.mp3",
    librarySection: "music",
    durationSeconds: 24,
    tags: ["music", "song", "ambience", "pad"],
    intensity: "soft"
  },
  {
    id: "music-drive-bed",
    label: "Drive Bed",
    src: "audio/music/drive-bed.mp3",
    sourceFileName: "drive-bed.mp3",
    librarySection: "music",
    durationSeconds: 18,
    tags: ["music", "song", "drive", "tension"],
    intensity: "medium"
  }
];

const emptyShowcasePlan: MotionShowcasePlan = {
  aspectRatio: 1.78,
  layoutMode: "landscape-callout",
  cues: [],
  selectedAssets: [],
  reasons: []
};

const emptyBackgroundPlan: MotionBackgroundOverlayPlan = {
  enabled: true,
  aspectRatio: 1.78,
  layoutMode: "landscape-cover",
  targetCueCount: 0,
  minGapMs: 9000,
  cues: [],
  selectedAssets: [],
  reasons: []
};

describe("sound-design-brain", () => {
  it("creates short typing and clock cues from caption timing and time language", () => {
    const chunks = [
      makeChunk({
        id: "a",
        text: "Plan your next 12 months carefully",
        startMs: 0,
        endMs: 1400
      }),
      makeChunk({
        id: "b",
        text: "Time compounds when you stay focused",
        startMs: 1700,
        endMs: 3000
      })
    ];

    const plan = buildMotionSoundDesignPlan({
      chunks,
      tier: "premium",
      fps: 30,
      showcasePlan: emptyShowcasePlan,
      backgroundOverlayPlan: emptyBackgroundPlan,
      catalog: soundCatalog,
      musicCatalog
    });

    expect(plan.enabled).toBe(true);
    expect(plan.cues.some((cue) => cue.category === "text-typing")).toBe(true);
    expect(plan.cues.some((cue) => cue.category === "time-tick")).toBe(true);
    expect(plan.musicCues.length).toBeGreaterThan(0);
    expect(plan.cues.every((cue) => cue.playFrames > 0)).toBe(true);
    expect(plan.cues.every((cue) => cue.trimAfterFrames > cue.trimBeforeFrames)).toBe(true);
    expect(plan.musicCues.every((cue) => cue.trimAfterFrames > cue.trimBeforeFrames)).toBe(true);
  });

  it("adds impact accents for strong showcase cues", () => {
    const chunks = [
      makeChunk({
        id: "a",
        text: "Profit is what keeps the business alive",
        startMs: 0,
        endMs: 1200
      })
    ];

    const showcasePlan: MotionShowcasePlan = {
      aspectRatio: 1.78,
      layoutMode: "landscape-callout",
      selectedAssets: [],
      reasons: [],
      cues: [
        {
          id: "showcase-money-1",
          assetId: "money-assets",
          asset: {
            id: "money-assets",
            assetRole: "showcase",
            canonicalLabel: "money",
            showcasePlacementHint: "center",
            family: "foreground-element",
            tier: "premium",
            src: "showcase-assets/money.png",
            alphaMode: "straight",
            placementZone: "foreground-cross",
            durationPolicy: "scene-span",
            themeTags: ["neutral", "authority"],
            searchTerms: ["money", "profit"],
            safeArea: "full-frame",
            loopable: false,
            blendMode: "normal",
            opacity: 1,
            source: "local",
            sourceId: "money-assets",
            score: 80
          },
          canonicalLabel: "money",
          cueSource: "direct-asset",
          matchedText: "Profit",
          matchedWordIndex: 0,
          matchedStartMs: 150,
          matchedEndMs: 520,
          startMs: 100,
          peakStartMs: 150,
          peakEndMs: 600,
          endMs: 820,
          leadMs: 50,
          holdMs: 180,
          exitMs: 220,
          placement: "landscape-left",
          showLabelPlate: false,
          score: 90,
          matchKind: "exact",
          reason: "profit cue"
        }
      ]
    };

    const plan = buildMotionSoundDesignPlan({
      chunks,
      tier: "premium",
      fps: 30,
      showcasePlan,
      backgroundOverlayPlan: emptyBackgroundPlan,
      catalog: soundCatalog
    });

    expect(plan.cues.some((cue) => cue.category === "impact-hit" && cue.asset.librarySection === "impact-hit")).toBe(true);
  });

  it("lets a singleton showcase linger for the full showcase window and prefers the longer whoosh asset", () => {
    const chunks = [
      makeChunk({
        id: "a",
        text: "You can make the whole thing feel cinematic",
        startMs: 0,
        endMs: 1200
      })
    ];

    const showcasePlan: MotionShowcasePlan = {
      aspectRatio: 1.78,
      layoutMode: "landscape-callout",
      selectedAssets: [],
      reasons: [],
      cues: [
        {
          id: "showcase-single-1",
          assetId: "single-showcase",
          asset: {
            id: "single-showcase",
            assetRole: "showcase",
            canonicalLabel: "camera",
            showcasePlacementHint: "center",
            family: "foreground-element",
            tier: "premium",
            src: "showcase-assets/camera.png",
            alphaMode: "straight",
            placementZone: "foreground-cross",
            durationPolicy: "scene-span",
            themeTags: ["neutral", "authority"],
            searchTerms: ["camera", "showcase"],
            safeArea: "full-frame",
            loopable: false,
            blendMode: "normal",
            opacity: 1,
            source: "local",
            sourceId: "single-showcase",
            score: 80
          },
          canonicalLabel: "camera",
          cueSource: "direct-asset",
          matchedText: "camera",
          matchedWordIndex: 0,
          matchedStartMs: 0,
          matchedEndMs: 320,
          startMs: 0,
          peakStartMs: 40,
          peakEndMs: 220,
          endMs: 7600,
          leadMs: 40,
          holdMs: 7000,
          exitMs: 220,
          placement: "landscape-left",
          showLabelPlate: false,
          score: 92,
          matchKind: "exact",
          reason: "singleton showcase"
        }
      ]
    };

    const plan = buildMotionSoundDesignPlan({
      chunks,
      tier: "premium",
      fps: 30,
      showcasePlan,
      backgroundOverlayPlan: emptyBackgroundPlan,
      catalog: soundCatalog
    });

    const showcaseCue = plan.cues.find((cue) => cue.category === "showcase-sweep");
    expect(showcaseCue).toBeDefined();
    expect(showcaseCue?.asset.id).toBe("whoosh-soundreality-whoosh-large-sub-384631");
    expect((showcaseCue?.endMs ?? 0) - (showcaseCue?.startMs ?? 0)).toBeGreaterThanOrEqual(7600);
    expect(showcaseCue?.playFrames).toBeGreaterThanOrEqual(220);
  });

  it("skips fragile overlay transition sounds when the boundary should stay audio-protected", () => {
    const chunks = [
      makeChunk({
        id: "a",
        text: "The Milky",
        startMs: 0,
        endMs: 600
      }),
      makeChunk({
        id: "b",
        text: "is our galaxy",
        startMs: 640,
        endMs: 1400
      })
    ];

    const backgroundOverlayPlan: MotionBackgroundOverlayPlan = {
      enabled: true,
      aspectRatio: 1.78,
      layoutMode: "landscape-cover",
      targetCueCount: 1,
      minGapMs: 9000,
      selectedAssets: [],
      reasons: [],
      cues: [
        {
          id: "overlay-1",
          assetId: "bg-1",
          asset: {
            id: "bg-1",
            label: "BG 1",
            src: "background-overlays/bg1.mp4",
            originalFileName: "bg1.mp4",
            width: 720,
            height: 1280,
            fps: 30,
            durationSeconds: 6
          },
          sourceBoundaryId: "a__b",
          sourceChunkId: "b",
          sourceChunkText: "is our galaxy",
          startMs: 620,
          peakStartMs: 700,
          peakEndMs: 1100,
          endMs: 1500,
          score: 88,
          boundaryGapMs: 40,
          boundarySafety: "unsafe",
          reasoning: "unsafe continuation",
          trimBeforeFrames: 0,
          trimAfterFrames: 120,
          fitStrategy: {
            rotateDeg: 90,
            baseScale: 1.4,
            orientedWidth: 1280,
            orientedHeight: 720,
            sourceAspectRatio: 0.56,
            targetAspectRatio: 1.78,
            focusOffsetX: 0.02,
            focusOffsetY: -0.01,
            rationale: "rotate"
          }
        }
      ]
    };

    const plan = buildMotionSoundDesignPlan({
      chunks,
      tier: "premium",
      fps: 30,
      showcasePlan: emptyShowcasePlan,
      backgroundOverlayPlan,
      catalog: soundCatalog
    });

    expect(plan.cues.some((cue) => cue.category === "overlay-transition")).toBe(false);
  });

  it("keeps continuous long-form podcast chunks from firing repetitive text cues while still building a soundtrack bed", () => {
    const chunks = Array.from({length: 10}, (_, index) => {
      const startMs = index * 11000;
      return makeChunk({
        id: `chunk-${index}`,
        text: `This is a continuous spoken sentence ${index + 1}`,
        startMs,
        endMs: startMs + 10800
      });
    });

    const plan = buildMotionSoundDesignPlan({
      chunks,
      tier: "premium",
      fps: 30,
      videoMetadata: {durationSeconds: 120},
      showcasePlan: emptyShowcasePlan,
      backgroundOverlayPlan: emptyBackgroundPlan,
      catalog: soundCatalog,
      musicCatalog
    });

    expect(plan.musicCues.length).toBeGreaterThan(0);
    expect(plan.cues.filter((cue) => cue.category === "text-typing").length).toBe(0);
  });

  it("prefers steadier songs from the dedicated music library over stranger options", () => {
    const chunks = Array.from({length: 8}, (_, index) => {
      const startMs = index * 14000;
      return makeChunk({
        id: `podcast-${index}`,
        text: `This is a continuous podcast segment ${index + 1}`,
        startMs,
        endMs: startMs + 13940
      });
    });

    const soundtrackCatalog: MotionSoundAsset[] = [
      {
        id: "drone-pad-bed",
        label: "Drone Pad Bed",
        src: "audio/sfx/drone/pad-bed.mp3",
        sourceFileName: "pad-bed.mp3",
        librarySection: "drone",
        durationSeconds: 12,
        tags: ["ambience", "pad"],
        intensity: "medium"
      },
      {
        id: "drone-weird-bed",
        label: "Drone Weird Bed",
        src: "audio/sfx/drone/weird-bed.mp3",
        sourceFileName: "weird-bed.mp3",
        librarySection: "drone",
        durationSeconds: 24,
        tags: ["ambience", "weird"],
        intensity: "medium"
      }
    ];
    const dedicatedMusicCatalog: MotionSoundAsset[] = [
      {
        id: "music-pad-bed",
        label: "Music Pad Bed",
        src: "audio/music/pad-bed.mp3",
        sourceFileName: "pad-bed.mp3",
        librarySection: "music",
        durationSeconds: 12,
        tags: ["music", "song", "ambience", "pad"],
        intensity: "medium"
      },
      {
        id: "music-weird-bed",
        label: "Music Weird Bed",
        src: "audio/music/weird-bed.mp3",
        sourceFileName: "weird-bed.mp3",
        librarySection: "music",
        durationSeconds: 24,
        tags: ["music", "song", "ambience", "weird"],
        intensity: "medium"
      }
    ];

    const plan = buildMotionSoundDesignPlan({
      chunks,
      tier: "premium",
      fps: 30,
      videoMetadata: {durationSeconds: 120},
      showcasePlan: emptyShowcasePlan,
      backgroundOverlayPlan: emptyBackgroundPlan,
      catalog: soundtrackCatalog,
      musicCatalog: dedicatedMusicCatalog
    });

    expect(plan.musicCues.length).toBeGreaterThan(0);
    expect(plan.musicCues[0].assetId).toBe("music-pad-bed");
    expect(plan.musicCues.every((cue) => cue.asset.librarySection === "music")).toBe(true);
  });

  it("chains multiple songs across the full video runtime and overlaps them as soundtrack beds", () => {
    const chunks = Array.from({length: 12}, (_, index) => {
      const startMs = index * 25000;
      return makeChunk({
        id: `runtime-${index}`,
        text: `Long runtime podcast segment ${index + 1}`,
        startMs,
        endMs: startMs + 24000
      });
    });
    const dedicatedMusicCatalog: MotionSoundAsset[] = [
      {
        id: "music-first-bed",
        label: "Music First Bed",
        src: "audio/music/first-bed.mp3",
        sourceFileName: "first-bed.mp3",
        librarySection: "music",
        durationSeconds: 160,
        tags: ["music", "song", "ambience", "pad"],
        intensity: "soft"
      },
      {
        id: "music-second-bed",
        label: "Music Second Bed",
        src: "audio/music/second-bed.mp3",
        sourceFileName: "second-bed.mp3",
        librarySection: "music",
        durationSeconds: 170,
        tags: ["music", "song", "tension"],
        intensity: "medium"
      }
    ];

    const plan = buildMotionSoundDesignPlan({
      chunks,
      tier: "premium",
      fps: 30,
      videoMetadata: {durationSeconds: 300},
      showcasePlan: emptyShowcasePlan,
      backgroundOverlayPlan: emptyBackgroundPlan,
      catalog: soundCatalog,
      musicCatalog: dedicatedMusicCatalog
    });

    expect(plan.musicCues.length).toBe(2);
    expect(plan.musicCues.every((cue) => cue.trimBeforeFrames === 0)).toBe(true);
    expect(plan.musicCues[1].startMs).toBeLessThan(plan.musicCues[0].endMs);
    expect(plan.musicCues[1].endMs).toBeGreaterThanOrEqual(299900);
  });
});
