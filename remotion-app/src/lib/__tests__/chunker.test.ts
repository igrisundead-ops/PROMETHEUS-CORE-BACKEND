import {describe, expect, it} from "vitest";

import {deterministicChunkWords, getChunkPolicyStats, mapWordChunksToCaptionChunks, type WordChunk} from "../caption-chunker";
import {captionPolicy, isHardWordCountAllowed} from "../caption-policy";
import {
  getSvgTypographyVariantFamily,
  getSvgTypographyVariantFromStyleKey,
  getSvgSlotKeysForSchema,
  isBlurHeavySvgTypographyVariant,
  SVG_TYPOGRAPHY_STYLE_PREFIX
} from "../stylebooks/svg-typography-v1";
import type {ChunkSemanticMeta, TranscribedWord} from "../types";

const w = (text: string, startMs: number, endMs: number): TranscribedWord => ({
  text,
  startMs,
  endMs
});

describe("deterministic chunker", () => {
  it("respects SLCP hard range (1-3) and prefers semantic 2-3 clustering", () => {
    const words: TranscribedWord[] = [
      w("IF", 0, 120),
      w("you", 130, 210),
      w("are", 220, 290),
      w("a", 300, 340),
      w("coach", 350, 450),
      w("like", 460, 540),
      w("Dan", 560, 650),
      w("Martell", 660, 790),
      w("you", 1200, 1290),
      w("can", 1300, 1380),
      w("build", 1390, 1500),
      w("systems", 1510, 1660),
      w("that", 1670, 1750),
      w("scale.", 1760, 1900)
    ];

    const chunks = deterministicChunkWords(words);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flatMap((chunk) => chunk.words).length).toBe(words.length);

    chunks.forEach((chunk) => {
      expect(chunk.words.length).toBeLessThanOrEqual(3);
      expect(isHardWordCountAllowed(chunk.words.length)).toBe(true);
    });

    const stats = getChunkPolicyStats(chunks);
    expect(stats.hardRangeViolations).toBe(0);
    expect(stats.softRangeRatio).toBeGreaterThan(0);
  });

  it("keeps full names together and marks name-callout intent", () => {
    const words: TranscribedWord[] = [
      w("Work", 0, 110),
      w("with", 120, 190),
      w("Dan", 200, 320),
      w("Martell", 330, 480),
      w("for", 490, 560),
      w("clarity", 570, 720)
    ];

    const chunks = deterministicChunkWords(words);
    const joined = chunks.map((chunk) => chunk.text).join(" | ");
    expect(joined.includes("Dan Martell")).toBe(true);
    expect(chunks.some((chunk) => chunk.semantic.intent === "name-callout")).toBe(true);
  });

  it("retains hard-range compliance on real transcript", async () => {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile("src/data/transcript.words.json", "utf-8");
    const words = JSON.parse(raw) as TranscribedWord[];
    const chunks = deterministicChunkWords(words);

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk) => {
      expect(chunk.words.length).toBeGreaterThanOrEqual(captionPolicy.chunking.hardMinWords);
      expect(chunk.words.length).toBeLessThanOrEqual(captionPolicy.chunking.hardMaxWords);
    });
  });

  it("uses adaptive 1-4 grouping for Hormozi profile", () => {
    const words: TranscribedWord[] = [
      w("Build", 0, 90),
      w("offers", 95, 170),
      w("that", 175, 220),
      w("sell", 225, 290),
      w("faster", 295, 370),
      w("today", 610, 700),
      w("with", 705, 760),
      w("clarity", 765, 860)
    ];

    const chunks = deterministicChunkWords(words, {profileId: "hormozi_word_lock_v1"});
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.words.length).toBeGreaterThanOrEqual(1);
      expect(chunk.words.length).toBeLessThanOrEqual(4);
    });
    expect(chunks.some((chunk) => chunk.endMs <= 370)).toBe(true);
  });

  it("routes SVG typography profile chunks with svg-prefixed style keys", () => {
    const words: TranscribedWord[] = [
      w("But", 0, 90),
      w("who", 95, 160),
      w("cares", 165, 260),
      w("about", 265, 330),
      w("it", 335, 390),
      w("now", 395, 470)
    ];

    const chunks = deterministicChunkWords(words, {profileId: "svg_typography_v1"});
    const captionChunks = mapWordChunksToCaptionChunks(chunks, undefined, {profileId: "svg_typography_v1"});

    expect(captionChunks.length).toBeGreaterThan(0);
    captionChunks.forEach((chunk) => {
      const variant = getSvgTypographyVariantFromStyleKey(chunk.styleKey);
      expect(chunk.profileId).toBe("svg_typography_v1");
      expect(chunk.styleKey.startsWith(SVG_TYPOGRAPHY_STYLE_PREFIX)).toBe(true);
      expect(chunk.motionKey.startsWith(SVG_TYPOGRAPHY_STYLE_PREFIX)).toBe(true);
      expect(chunk.words.length).toBeGreaterThanOrEqual(1);
      expect(chunk.words.length).toBeLessThanOrEqual(4);
      expect(variant).not.toBeNull();
      expect(getSvgSlotKeysForSchema(variant!.slotSchema).length).toBeLessThanOrEqual(chunk.words.length);
    });
  });

  it("limits blur-heavy svg variants across a full caption sequence", () => {
    const semantic: ChunkSemanticMeta = {
      intent: "default",
      nameSpans: [],
      isVariation: false,
      suppressDefault: false
    };

    const chunks: WordChunk[] = Array.from({length: 12}, (_, index) => {
      const startMs = index * 700;
      const words = [
        w(`alpha${index}`, startMs, startMs + 120),
        w(`beta${index}`, startMs + 140, startMs + 300),
        w(`gamma${index}`, startMs + 320, startMs + 520)
      ];

      return {
        words,
        startMs,
        endMs: startMs + 520,
        text: words.map((word) => word.text).join(" "),
        semantic
      };
    });

    const captionChunks = mapWordChunksToCaptionChunks(chunks, undefined, {profileId: "svg_typography_v1"});
    const variants = captionChunks
      .map((chunk) => getSvgTypographyVariantFromStyleKey(chunk.styleKey))
      .filter((variant) => variant !== null);

    const blurHeavyCount = variants.filter((variant) => isBlurHeavySvgTypographyVariant(variant)).length;
    const typingCount = variants.filter((variant) => getSvgTypographyVariantFamily(variant) === "typing").length;

    let maxBlurStreak = 0;
    let currentBlurStreak = 0;
    variants.forEach((variant) => {
      if (isBlurHeavySvgTypographyVariant(variant)) {
        currentBlurStreak += 1;
        maxBlurStreak = Math.max(maxBlurStreak, currentBlurStreak);
        return;
      }
      currentBlurStreak = 0;
    });

    expect(blurHeavyCount).toBeLessThanOrEqual(3);
    expect(typingCount).toBeLessThanOrEqual(1);
    expect(maxBlurStreak).toBeLessThanOrEqual(1);
  });
});
