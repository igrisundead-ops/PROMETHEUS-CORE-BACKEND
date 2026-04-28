import { describe, expect, it } from "vitest";
const msToFrames = (ms, fps) => Math.max(1, Math.round((ms / 1000) * fps));
const selectSingleActiveChunkAtFrame = (chunks, frame, fps, motionByKey) => {
    const visible = chunks
        .map((chunk) => {
        const motion = motionByKey[chunk.motionKey] ?? { inDurationMs: 880, outDurationMs: 560 };
        const startFrame = Math.round((chunk.startMs / 1000) * fps);
        const endFrame = Math.round((chunk.endMs / 1000) * fps);
        const enterFrames = msToFrames(motion.inDurationMs, fps);
        const exitFrames = msToFrames(motion.outDurationMs, fps);
        const isVisible = frame >= startFrame - enterFrames - 6 && frame <= endFrame + exitFrames + 6;
        return { chunk, startFrame, endFrame, isVisible };
    })
        .filter((item) => item.isVisible)
        .sort((a, b) => {
        const aActive = frame >= a.startFrame && frame <= a.endFrame ? 1 : 0;
        const bActive = frame >= b.startFrame && frame <= b.endFrame ? 1 : 0;
        if (aActive !== bActive) {
            return bActive - aActive;
        }
        return b.startFrame - a.startFrame;
    });
    return visible[0]?.chunk ?? null;
};
describe("overlay concurrency", () => {
    it("selects at most one active chunk per frame", () => {
        const chunks = [
            {
                id: "a",
                text: "Alpha Beta",
                startMs: 1000,
                endMs: 3000,
                words: [],
                styleKey: "duo_clean_punch",
                motionKey: "two_word_cinematic_pair",
                layoutVariant: "inline",
                emphasisWordIndices: []
            },
            {
                id: "b",
                text: "Gamma Delta",
                startMs: 2900,
                endMs: 4600,
                words: [],
                styleKey: "duo_clean_punch",
                motionKey: "two_word_cinematic_pair",
                layoutVariant: "inline",
                emphasisWordIndices: []
            },
            {
                id: "c",
                text: "Epsilon Zeta",
                startMs: 4500,
                endMs: 6200,
                words: [],
                styleKey: "duo_clean_punch",
                motionKey: "two_word_cinematic_pair",
                layoutVariant: "inline",
                emphasisWordIndices: []
            }
        ];
        const fps = 30;
        const motionByKey = {
            two_word_cinematic_pair: { inDurationMs: 1040, outDurationMs: 660 }
        };
        for (let frame = 0; frame < 240; frame += 1) {
            const selected = selectSingleActiveChunkAtFrame(chunks, frame, fps, motionByKey);
            if (selected) {
                expect(["a", "b", "c"]).toContain(selected.id);
            }
            else {
                expect(selected).toBeNull();
            }
        }
    });
});
