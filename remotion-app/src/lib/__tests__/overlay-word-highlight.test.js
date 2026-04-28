import { describe, expect, it } from "vitest";
import { isNameWordIndex, isTokenActiveAtTime, isTokenActiveAtTimeStrict } from "../../components/CinematicCaptionOverlay";
describe("overlay word highlighting", () => {
    it("marks token active only inside timestamp window", () => {
        const token = { text: "YOU", wordIndex: 0, startMs: 1000, endMs: 1300 };
        expect(isTokenActiveAtTime(token, 999)).toBe(false);
        expect(isTokenActiveAtTime(token, 1100)).toBe(true);
        expect(isTokenActiveAtTime(token, 1400)).toBe(false);
    });
    it("uses strict boundary mode without end overlap", () => {
        const tokenA = { text: "BUILD", wordIndex: 0, startMs: 1000, endMs: 1200 };
        const tokenB = { text: "NOW", wordIndex: 1, startMs: 1200, endMs: 1400 };
        expect(isTokenActiveAtTimeStrict(tokenA, 1200)).toBe(false);
        expect(isTokenActiveAtTimeStrict(tokenB, 1200)).toBe(true);
    });
    it("detects name token spans for proper-case exception", () => {
        const chunk = {
            id: "c1",
            text: "Dan Martell",
            startMs: 0,
            endMs: 1000,
            words: [],
            styleKey: "tall_cinematic_contrast",
            motionKey: "cinematic_focus_lock",
            layoutVariant: "inline",
            emphasisWordIndices: [],
            semantic: {
                intent: "name-callout",
                nameSpans: [{ startWord: 0, endWord: 1, text: "Dan Martell" }],
                isVariation: true,
                suppressDefault: true
            },
            suppressDefault: true
        };
        expect(isNameWordIndex(0, chunk)).toBe(true);
        expect(isNameWordIndex(1, chunk)).toBe(true);
        expect(isNameWordIndex(2, chunk)).toBe(false);
    });
});
