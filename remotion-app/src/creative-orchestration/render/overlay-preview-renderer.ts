import type {CreativeRenderInput} from "./creative-timeline-to-remotion";

export const buildOverlayCreativePreview = (input: CreativeRenderInput): {
  mode: "overlay-preview";
  input: CreativeRenderInput;
  sampledFrameWindows: Array<{startMs: number; endMs: number}>;
} => {
  return {
    mode: "overlay-preview",
    input,
    sampledFrameWindows: input.creativeTimeline.moments.slice(0, 5).map((moment) => ({
      startMs: moment.startMs,
      endMs: moment.endMs
    }))
  };
};

