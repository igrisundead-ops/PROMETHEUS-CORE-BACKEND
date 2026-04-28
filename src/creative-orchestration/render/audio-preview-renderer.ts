import type {CreativeRenderInput} from "./creative-timeline-to-remotion";

export const buildAudioOnlyCreativePreview = (input: CreativeRenderInput): {
  mode: "audio-preview";
  input: CreativeRenderInput;
  neutralBackground: true;
} => {
  return {
    mode: "audio-preview",
    input,
    neutralBackground: true
  };
};

