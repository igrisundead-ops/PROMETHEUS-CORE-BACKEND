import type {JudgmentEngineInput, VisualPriorityEntry} from "../types";
import {rankByScore} from "../utils/ranking";
import {normalizeText} from "../../utils";

export const rankVisualPriorities = (input: JudgmentEngineInput): VisualPriorityEntry[] => {
  const text = normalizeText(input.transcriptSegment || input.moment.transcriptText);
  const speakerFaceScore = input.speakerMetadata?.faceOccupancy ?? 0.45;
  const negativeSpaceScore = input.sceneAnalysis?.negativeSpaceScore ?? 0.5;
  const proofScore = /\bresults?\b|\bproof\b|\bevidence\b|\bdata\b|\bpercent\b/.test(text) ? 0.88 : 0.18;
  const productScore = /\bproduct\b|\btool\b|\bapp\b|\bsystem\b|\bplatform\b/.test(text) ? 0.76 : 0.14;
  const emotionalPunchScore = input.moment.importance >= 0.84 || input.moment.momentType === "hook" ? 0.9 : 0.32;

  return rankByScore<VisualPriorityEntry>([
    {
      subject: "speaker-face",
      score: speakerFaceScore,
      reason: "Speaker presence anchors trust and human context."
    },
    {
      subject: "punch-word",
      score: emotionalPunchScore,
      reason: "The strongest phrase should carry the moment's semantic spike."
    },
    {
      subject: "headline-phrase",
      score: input.moment.words.length <= 8 ? 0.82 : 0.55,
      reason: "Compact moments can sustain a headline-led hierarchy."
    },
    {
      subject: "supporting-phrase",
      score: input.moment.words.length >= 8 ? 0.68 : 0.28,
      reason: "Longer moments may need a secondary explanatory layer."
    },
    {
      subject: "product-object",
      score: productScore,
      reason: "Product or object references deserve foreground when the copy is concrete."
    },
    {
      subject: "proof-element",
      score: proofScore,
      reason: "Proof cues become editorial anchors when evidence is present."
    },
    {
      subject: "symbolic-visual",
      score: input.moment.energy >= 0.7 ? 0.62 : 0.34,
      reason: "Symbolic visuals help when energy outruns literal information."
    },
    {
      subject: "matte-background-text",
      score: (input.subjectSegmentation?.matteConfidence ?? 0.5) * 0.8,
      reason: "Behind-subject text only rises when matte confidence supports it."
    },
    {
      subject: "supporting-motion-graphics",
      score: input.moment.energy >= 0.65 ? 0.6 : 0.26,
      reason: "Motion accents should support rather than dominate the frame."
    },
    {
      subject: "negative-space",
      score: negativeSpaceScore,
      reason: "Breathing room is a creative priority, not empty leftover space."
    }
  ]);
};
