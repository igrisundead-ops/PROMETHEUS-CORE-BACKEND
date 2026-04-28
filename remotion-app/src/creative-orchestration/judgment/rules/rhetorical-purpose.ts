import type {JudgmentEngineInput, RhetoricalPurpose} from "../types";
import {normalizeText} from "../../utils";

const matchList = (text: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

export const classifyRhetoricalPurpose = (input: JudgmentEngineInput): RhetoricalPurpose => {
  const text = normalizeText(input.transcriptSegment || input.moment.transcriptText);
  const wordCount = input.moment.words.length;

  if (matchList(text, [/\bproof\b/, /\bresults?\b/, /\bcase study\b/, /\bevidence\b/, /\bdata\b/, /\bpercent\b/, /\bnumber\b/])) {
    return "proof";
  }
  if (matchList(text, [/\btrust\b/, /\bhonest\b/, /\breliable\b/, /\bbelieve\b/, /\bcredib/])) {
    return "trust";
  }
  if (matchList(text, [/\bwhy\b/, /\bwhat if\b/, /\bimagine\b/, /\bsecret\b/, /\bcurious\b/]) || input.moment.momentType === "question") {
    return "curiosity";
  }
  if (matchList(text, [/\burgent\b/, /\bnow\b/, /\btoday\b/, /\bimmediately\b/, /\bbefore\b/])) {
    return "urgency";
  }
  if (matchList(text, [/\bluxury\b/, /\bpremium\b/, /\belegant\b/, /\brefined\b/, /\bexclusive\b/])) {
    return "luxury-premium";
  }
  if (matchList(text, [/\baspire\b/, /\bvision\b/, /\bfuture\b/, /\bgrow\b/, /\bscale\b/])) {
    return "aspiration";
  }
  if (matchList(text, [/\blearn\b/, /\bexplain\b/, /\bhow to\b/, /\bframework\b/, /\bprocess\b/]) || input.moment.momentType === "explanation") {
    return "education";
  }
  if (matchList(text, [/\bbut\b/, /\bhowever\b/, /\binstead\b/, /\bversus\b/, /\bvs\b/, /\bnot\b/])) {
    return "contrast";
  }
  if (matchList(text, [/\bmistake\b/, /\bproblem\b/, /\brisk\b/, /\bobjection\b/, /\bconcern\b/])) {
    return "objection-handling";
  }
  if (matchList(text, [/\bfix\b/, /\bsolution\b/, /\bresolve\b/, /\bfinally\b/, /\bso\b/]) || input.moment.momentType === "payoff") {
    return "resolution";
  }
  if (input.moment.momentType === "hook" || matchList(text, [/\bstop\b/, /\bthis changes\b/, /\beverything\b/, /\bnever\b/])) {
    return "emotional-punch";
  }
  if (input.moment.energy >= 0.82 || matchList(text, [/\bmore\b/, /\bfaster\b/, /\bbigger\b/, /\bstronger\b/])) {
    return "escalation";
  }
  if (matchList(text, [/\btransform\b/, /\bfrom\b.*\bto\b/, /\bbecome\b/, /\bshift\b/])) {
    return "transformative";
  }
  if (wordCount <= 4 && input.moment.importance >= 0.84) {
    return "authority";
  }
  if (matchList(text, [/\bpush\b/, /\bpressure\b/, /\btension\b/, /\bconflict\b/])) {
    return "tension";
  }
  if (matchList(text, [/\bmotivation\b/, /\bkeep going\b/, /\bdo it\b/, /\bact\b/])) {
    return "motivation";
  }
  return input.moment.importance >= 0.8 ? "authority" : "education";
};
