import type {CreativeTimeline} from "../types";

export type CreativeRenderMode = "audio-preview" | "overlay-preview" | "final-video";

export type CreativeRenderInput = {
  sourceVideoUrl?: string | null;
  sourceAudioUrl?: string | null;
  creativeTimeline: CreativeTimeline;
  renderMode: CreativeRenderMode;
};

export const creativeTimelineToRemotion = (input: CreativeRenderInput): CreativeRenderInput => {
  return input;
};

