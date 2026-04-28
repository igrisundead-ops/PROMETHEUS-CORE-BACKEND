import type {CaptionChunk, TranscribedWord} from "../lib/types";

const buildWords = (text: string, startMs: number, endMs: number): TranscribedWord[] => {
  const tokens = text.split(/\s+/).filter(Boolean);
  const step = (endMs - startMs) / Math.max(1, tokens.length);
  return tokens.map((word, index) => ({
    text: word,
    startMs: Math.round(startMs + step * index),
    endMs: Math.round(startMs + step * (index + 1))
  }));
};

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
}): CaptionChunk => ({
  id,
  text,
  startMs,
  endMs,
  words: buildWords(text, startMs, endMs),
  styleKey: "svg_typography_v1:cinematic_text_preset",
  motionKey: "svg_typography_v1:cinematic_text_preset",
  layoutVariant: "inline",
  emphasisWordIndices: [],
  profileId: "svg_typography_v1",
  semantic: {
    intent: "default",
    nameSpans: [],
    isVariation: false,
    suppressDefault: false
  },
  suppressDefault: false
});

export const choreographyProofChunks: CaptionChunk[] = [
  makeChunk({
    id: "proof-feature",
    text: "Build the message before you buy the traffic.",
    startMs: 0,
    endMs: 2300
  }),
  makeChunk({
    id: "proof-stat",
    text: "That one shift lifted replies by 42 percent.",
    startMs: 2300,
    endMs: 4900
  }),
  makeChunk({
    id: "proof-cta",
    text: "Now sharpen the offer and scale it cleanly.",
    startMs: 4900,
    endMs: 7600
  })
];
