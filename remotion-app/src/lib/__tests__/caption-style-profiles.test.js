import { describe, expect, it } from "vitest";
import { getCaptionStyleProfile, normalizeCaptionStyleProfileId } from "../stylebooks/caption-style-profiles";
describe("caption style profiles", () => {
    it("defaults to slcp when profile id is missing or unknown", () => {
        expect(normalizeCaptionStyleProfileId(undefined)).toBe("slcp");
        expect(normalizeCaptionStyleProfileId("unknown")).toBe("slcp");
    });
    it("loads SLCP profile with capped 1-3 grouping policy", () => {
        const profile = getCaptionStyleProfile("slcp");
        expect(profile.id).toBe("slcp");
        expect(profile.groupingPolicy.hardMinWords).toBe(1);
        expect(profile.groupingPolicy.hardMaxWords).toBe(3);
        expect(profile.groupingPolicy.softMinWords).toBe(2);
        expect(profile.groupingPolicy.softMaxWords).toBe(3);
        expect(profile.strictWordLockHighlight).toBe(false);
    });
    it("loads Hormozi profile with 1-4 grouping policy", () => {
        const profile = getCaptionStyleProfile("hormozi_word_lock_v1");
        expect(profile.id).toBe("hormozi_word_lock_v1");
        expect(profile.groupingPolicy.hardMinWords).toBe(1);
        expect(profile.groupingPolicy.hardMaxWords).toBe(4);
        expect(profile.strictWordLockHighlight).toBe(true);
    });
    it("loads SVG typography profile with tuned 1-4 grouping policy", () => {
        const profile = getCaptionStyleProfile("svg_typography_v1");
        expect(profile.id).toBe("svg_typography_v1");
        expect(profile.groupingPolicy.hardMinWords).toBe(1);
        expect(profile.groupingPolicy.hardMaxWords).toBe(4);
        expect(profile.groupingPolicy.softMinWords).toBe(2);
        expect(profile.groupingPolicy.softMaxWords).toBe(3);
        expect(profile.strictWordLockHighlight).toBe(false);
    });
});
