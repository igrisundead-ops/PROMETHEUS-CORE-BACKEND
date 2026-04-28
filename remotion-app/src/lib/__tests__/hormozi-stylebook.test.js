import { describe, expect, it } from "vitest";
import { clampWordTimingToFrame, hormoziWordLockV1 } from "../stylebooks/hormozi-word-lock-v1";
describe("hormozi stylebook", () => {
    it("clamps invalid word duration to at least one frame", () => {
        const clamped = clampWordTimingToFrame({
            startMs: 1000,
            endMs: 1000,
            fps: 25
        });
        expect(clamped.startMs).toBe(1000);
        expect(clamped.endMs).toBeCloseTo(1040, 4);
    });
    it("defines required svg contract mapping keys", () => {
        expect(hormoziWordLockV1.svgContract.text.fontFamily).toBe("font-family");
        expect(hormoziWordLockV1.svgContract.activeRect.fill).toBe("fill");
        expect(hormoziWordLockV1.svgContract.activeWord.fill).toBe("fill");
    });
});
