import { describe, expect, it } from "vitest";
import { buildPreviewCaptionChunks } from "../preview-caption-data";
describe("preview caption data", () => {
    it("builds profile-specific caption chunks for the supported profiles", () => {
        const slcpChunks = buildPreviewCaptionChunks("slcp");
        const hormoziChunks = buildPreviewCaptionChunks("hormozi_word_lock_v1");
        const svgChunks = buildPreviewCaptionChunks("svg_typography_v1");
        const longformChunks = buildPreviewCaptionChunks("longform_svg_typography_v1", "long-form");
        expect(slcpChunks.length).toBeGreaterThan(0);
        expect(hormoziChunks.length).toBeGreaterThan(0);
        expect(svgChunks.length).toBeGreaterThan(0);
        expect(longformChunks.length).toBeGreaterThan(0);
        expect(slcpChunks[0]?.profileId).toBe("slcp");
        expect(hormoziChunks[0]?.profileId).toBe("hormozi_word_lock_v1");
        expect(svgChunks[0]?.profileId).toBe("svg_typography_v1");
        expect(longformChunks[0]?.profileId).toBe("longform_svg_typography_v1");
        expect(hormoziChunks[0]?.styleKey).toBe("hormozi_word_lock_base");
        expect(svgChunks.some((chunk) => chunk.styleKey.startsWith("svg_typography_v1:"))).toBe(true);
        expect(longformChunks[0]?.text).not.toBe(slcpChunks[0]?.text);
        expect(longformChunks[0]?.words.length ?? 0).toBeGreaterThan(slcpChunks[0]?.words.length ?? 0);
    });
});
