import {describe, expect, it} from "vitest";

import captions from "../../data/captions.dean-graziosi.json" with {type: "json"};
import {rerouteSvgTypographyChunks, routeStyleForWords} from "../style-routing";
import {
  HORMOZI_WORD_LOCK_MOTION_KEY,
  HORMOZI_WORD_LOCK_STYLE_KEY
} from "../stylebooks/hormozi-word-lock-v1";
import {
  getSvgVariantExitProfile,
  getSvgVariantMotionProfile,
  getSvgTypographyVariantFamily,
  getSvgTypographyVariantFromStyleKey,
  isSvgVariantLegacyOptIn,
  SVG_TYPOGRAPHY_STYLE_PREFIX
} from "../stylebooks/svg-typography-v1";
import type {CaptionChunk, ChunkSemanticMeta} from "../types";

const defaultSemantic: ChunkSemanticMeta = {
  intent: "default",
  nameSpans: [],
  isVariation: false,
  suppressDefault: false
};

describe("style routing", () => {
  it("routes default chunks to uppercase cinematic baseline families", () => {
    const one = routeStyleForWords(["Power"], defaultSemantic);
    const two = routeStyleForWords(["Take", "Action"], defaultSemantic);
    const four = routeStyleForWords(["Build", "systems", "that", "scale"], defaultSemantic);

    expect(one.layoutVariant).toBe("inline");
    expect(one.motionKey).toBe("cinematic_focus_lock");

    expect(two.styleKey).toBe("duo_script_block");
    expect(two.layoutVariant).toBe("inline");
    expect(two.motionKey).toBe("two_word_cinematic_pair");

    expect(four.layoutVariant).toBe("fourplus-grid");
    expect(["four_word_banner_drift", "four_word_split_stagger", "six_word_quad_duo_depth"]).toContain(four.motionKey);
  });

  it("routes default three-word chunks through the flat SLCP lane", () => {
    const words = ["Those", "videos", "are"];
    const routed = routeStyleForWords(words, defaultSemantic);

    expect(routed.styleKey).toBe("tall_generic_default");
    expect(routed.motionKey).toBe("three_word_tall_blade");
    expect(routed.layoutVariant).toBe("inline");
  });

  it("routes variation name-callout chunks to the flat SLCP lane", () => {
    const variationSemantic: ChunkSemanticMeta = {
      intent: "name-callout",
      nameSpans: [{startWord: 0, endWord: 1, text: "Dan Martell"}],
      isVariation: true,
      suppressDefault: true
    };

    const threeWord = routeStyleForWords(["Dan", "Martell", "today"], variationSemantic);
    expect(threeWord.styleKey).toBe("tall_generic_default");
    expect(threeWord.motionKey).toBe("three_word_tall_blade");
    expect(threeWord.layoutVariant).toBe("inline");
  });

  it("routes variation punch-emphasis three-word chunks to the flat SLCP lane", () => {
    const variationSemantic: ChunkSemanticMeta = {
      intent: "punch-emphasis",
      nameSpans: [],
      isVariation: true,
      suppressDefault: true
    };

    const routed = routeStyleForWords(["Take", "action", "now"], variationSemantic);
    expect(routed.styleKey).toBe("tall_generic_default");
    expect(routed.motionKey).toBe("three_word_tall_blade");
    expect(routed.layoutVariant).toBe("inline");
  });

  it("routes Hormozi profile chunks to a fixed word-lock style", () => {
    const routed = routeStyleForWords(["Build", "the", "offer"], defaultSemantic, {
      profileId: "hormozi_word_lock_v1"
    });
    expect(routed.styleKey).toBe(HORMOZI_WORD_LOCK_STYLE_KEY);
    expect(routed.motionKey).toBe(HORMOZI_WORD_LOCK_MOTION_KEY);
    expect(routed.layoutVariant).toBe("inline");
  });

  it("routes SVG typography profile deterministically by chunk seed", () => {
    const a = routeStyleForWords(["But", "who", "cares"], defaultSemantic, {
      profileId: "svg_typography_v1",
      chunkIndex: 7
    });
    const b = routeStyleForWords(["But", "who", "cares"], defaultSemantic, {
      profileId: "svg_typography_v1",
      chunkIndex: 7
    });
    const c = routeStyleForWords(["But", "who", "cares"], defaultSemantic, {
      profileId: "svg_typography_v1",
      chunkIndex: 8
    });

    expect(a.styleKey.startsWith(SVG_TYPOGRAPHY_STYLE_PREFIX)).toBe(true);
    expect(a.motionKey.startsWith(SVG_TYPOGRAPHY_STYLE_PREFIX)).toBe(true);
    expect(a.layoutVariant).toBe("inline");
    expect(a.styleKey).toBe(b.styleKey);
    expect(a.motionKey).toBe(b.motionKey);
    expect(c.styleKey.startsWith(SVG_TYPOGRAPHY_STYLE_PREFIX)).toBe(true);
  });

  it("prefers cleaner two-word svg motion profiles for punch emphasis", () => {
    const punchSemantic: ChunkSemanticMeta = {
      intent: "punch-emphasis",
      nameSpans: [],
      isVariation: false,
      suppressDefault: false
    };

    const routed = routeStyleForWords(["listen", "attentively"], punchSemantic, {
      profileId: "svg_typography_v1",
      chunkIndex: 9
    });
    const variant = getSvgTypographyVariantFromStyleKey(routed.styleKey);

    expect(variant).not.toBeNull();
    expect(getSvgVariantMotionProfile(variant!)).not.toBe("sweep-heavy");
    expect(getSvgTypographyVariantFamily(variant!)).not.toBe("wipe-reveal");
  });

  it("avoids blur-heavy, typing, stacked, sweep-heavy, and wipe-reveal svg families in the current Dean SVG routing pass", () => {
    const rerouted = rerouteSvgTypographyChunks(captions as CaptionChunk[]);
    const variants = rerouted
      .map((chunk) => getSvgTypographyVariantFromStyleKey(chunk.styleKey))
      .filter((variant): variant is NonNullable<typeof variant> => variant !== null);
    const forbiddenMotionProfiles = new Set(["blur-heavy", "typing", "stacked", "sweep-heavy"]);
    const forbiddenFamilies = new Set(["wipe-reveal"]);

    expect(variants.length).toBeGreaterThan(0);
    expect(variants.some((variant) => forbiddenMotionProfiles.has(getSvgVariantMotionProfile(variant)))).toBe(false);
    expect(variants.some((variant) => forbiddenFamilies.has(getSvgTypographyVariantFamily(variant)))).toBe(false);
  });

  it("routes the three-word SVG chunk away from the elastic impact family", () => {
    const rerouted = rerouteSvgTypographyChunks(captions as CaptionChunk[]);
    const chunk = rerouted.find((entry) => entry.id === "chunk-0008");
    const variant = chunk ? getSvgTypographyVariantFromStyleKey(chunk.styleKey) : null;

    expect(variant).not.toBeNull();
    expect(variant?.slotSchema).toBe("script+primary+secondary");
    expect(variant?.id).not.toBe("cinematic_text_preset_8");
    expect(getSvgTypographyVariantFamily(variant!)).not.toBe("impact-pop");
  });

  it("near-bans legacy sweep-heavy exits in the current Dean SVG routing pass", () => {
    const rerouted = rerouteSvgTypographyChunks(captions as CaptionChunk[]);
    const variants = rerouted
      .map((chunk) => getSvgTypographyVariantFromStyleKey(chunk.styleKey))
      .filter((variant): variant is NonNullable<typeof variant> => variant !== null);

    expect(variants.length).toBeGreaterThan(0);
    expect(variants.some((variant) => getSvgVariantExitProfile(variant) === "integrated-sweep")).toBe(false);
    expect(variants.some((variant) => isSvgVariantLegacyOptIn(variant))).toBe(false);
  });
});
