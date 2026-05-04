import type {FontClassification, FontPersonality, FontRole} from "./types";

export const FONT_PAIRING_LANES = [
  {pairingType: "hero_to_support", from: "hero", to: "support"},
  {pairingType: "hero_to_body", from: "hero", to: "body"},
  {pairingType: "hero_to_subtitle", from: "hero", to: "subtitle"},
  {pairingType: "quote_to_caption", from: "quote", to: "caption"},
  {pairingType: "quote_to_support", from: "quote", to: "support"},
  {pairingType: "subtitle_to_caption", from: "subtitle", to: "caption"},
  {pairingType: "support_to_caption", from: "support", to: "caption"}
] as const satisfies ReadonlyArray<{
  pairingType: string;
  from: FontRole;
  to: FontRole;
}>;

export const LICENSE_REVIEW_PHRASES = [
  "unknown",
  "personal use",
  "demo",
  "trial",
  "free for personal",
  "contact",
  "copyright",
  "unlicensed"
];

export const NAME_TOKEN_CLASSIFICATIONS: Array<{tokens: string[]; classification: FontClassification}> = [
  {tokens: ["sans", "grotesk", "grotesque", "neo"], classification: "sans"},
  {tokens: ["serif", "garamond", "bodoni", "didot", "caslon", "roman"], classification: "serif"},
  {tokens: ["script", "signature", "hand", "brush", "calligraphy", "monoline"], classification: "script"},
  {tokens: ["display", "headline", "poster"], classification: "display"},
  {tokens: ["mono", "code", "typewriter"], classification: "mono"},
  {tokens: ["blackletter", "gothic", "fraktur"], classification: "blackletter"},
  {tokens: ["decorative", "ornament", "swash"], classification: "decorative"},
  {tokens: ["condensed", "narrow", "compressed"], classification: "condensed"},
  {tokens: ["expanded", "extended", "wide"], classification: "wide"},
  {tokens: ["variable"], classification: "variable"}
];

export const NAME_TOKEN_PERSONALITY: Array<{tokens: string[]; tags: FontPersonality[]}> = [
  {tokens: ["lux", "royal", "regal", "vogue", "editorial", "fashion", "couture"], tags: ["luxury", "editorial", "fashion"]},
  {tokens: ["modern", "minimal", "clean", "neue", "inter"], tags: ["clean", "minimal", "neutral"]},
  {tokens: ["tech", "future", "futur", "cyber", "space"], tags: ["technical", "futuristic"]},
  {tokens: ["romance", "romantic", "love", "rose", "floral"], tags: ["romantic", "organic"]},
  {tokens: ["retro", "vintage", "classic"], tags: ["vintage", "decorative"]},
  {tokens: ["dramatic", "black", "bold", "heavy", "monster"], tags: ["dramatic", "expressive", "authoritative"]},
  {tokens: ["script", "signature", "brush", "hand"], tags: ["expressive", "romantic", "decorative"]},
  {tokens: ["serif", "garamond", "didot", "playfair"], tags: ["editorial", "ceremonial"]},
  {tokens: ["sans", "grotesk", "grotesque"], tags: ["clean", "readable", "neutral"]}
];

export const DEFAULT_LIKELY_USE_CASES = [
  "cinematic hero typography",
  "subtitle overlays",
  "editorial compositions",
  "brand-led typography systems"
];
