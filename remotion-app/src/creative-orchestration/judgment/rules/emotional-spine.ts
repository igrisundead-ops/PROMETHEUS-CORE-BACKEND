import type {EmotionalSpine, JudgmentEngineInput} from "../types";
import {normalizeText} from "../../utils";

export const classifyEmotionalSpine = (input: JudgmentEngineInput): EmotionalSpine => {
  const text = normalizeText(input.transcriptSegment || input.moment.transcriptText);

  if (/\bluxury\b|\bpremium\b|\brefined\b|\belegant\b/.test(text)) {
    return "luxury";
  }
  if (/\btrust\b|\bhonest\b|\breliable\b|\bprove\b/.test(text)) {
    return "trust";
  }
  if (/\bdesire\b|\bwant\b|\bcrave\b|\bneed\b/.test(text)) {
    return "desire";
  }
  if (/\bsurprise\b|\bunexpected\b|\bshocking\b|\bsecret\b/.test(text)) {
    return "surprise";
  }
  if (/\bcalm\b|\bslow\b|\bquiet\b|\bsubtle\b/.test(text)) {
    return "calm";
  }
  if (/\bafraid\b|\braw\b|\bvulnerab/.test(text)) {
    return "vulnerability";
  }
  if (/\burgent\b|\bnow\b|\btoday\b|\bimmediately\b/.test(text) || input.moment.energy >= 0.9) {
    return "urgency";
  }
  if (/\btense\b|\bpressure\b|\bproblem\b|\brisk\b/.test(text)) {
    return "tension";
  }
  if (/\bconfident\b|\bstrong\b|\bcertain\b/.test(text) || input.moment.importance >= 0.88) {
    return "confidence";
  }
  if (/\baspire\b|\bvision\b|\bfuture\b|\bgrow\b/.test(text)) {
    return "aspiration";
  }
  if (/\bauthority\b|\blead\b|\bexpert\b|\bframework\b/.test(text) || input.moment.momentType === "title") {
    return "authority";
  }
  return input.moment.energy >= 0.72 ? "excitement" : "confidence";
};
