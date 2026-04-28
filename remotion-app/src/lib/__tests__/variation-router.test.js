import { describe, expect, it } from "vitest";
import { applyVariationBudget } from "../variation-router";
const chunk = (text, intent) => ({
    text,
    startMs: 0,
    endMs: 1000,
    words: [{ text, startMs: 0, endMs: 1000 }],
    semantic: {
        intent,
        nameSpans: [],
        isVariation: false,
        suppressDefault: false
    }
});
describe("variation router", () => {
    it("caps variations and enforces spacing", () => {
        const chunks = [
            chunk("A", "name-callout"),
            chunk("B", "punch-emphasis"),
            chunk("C", "default"),
            chunk("D", "name-callout"),
            chunk("E", "punch-emphasis"),
            chunk("F", "default"),
            chunk("G", "name-callout"),
            chunk("H", "default")
        ];
        const routed = applyVariationBudget(chunks);
        const variationIndexes = routed
            .map((entry, index) => (entry.semantic.isVariation ? index : -1))
            .filter((index) => index >= 0);
        expect(variationIndexes.length).toBeGreaterThan(0);
        expect(variationIndexes.length).toBeLessThanOrEqual(Math.max(1, Math.floor(chunks.length * 0.15)));
        for (let i = 1; i < variationIndexes.length; i += 1) {
            expect(variationIndexes[i] - variationIndexes[i - 1]).toBeGreaterThanOrEqual(4);
        }
    });
});
