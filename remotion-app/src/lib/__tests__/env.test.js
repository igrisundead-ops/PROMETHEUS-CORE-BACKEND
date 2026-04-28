import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";
describe("env validation", () => {
    it("fails when ASSEMBLYAI_API_KEY is missing", () => {
        expect(() => parseEnv({
            VIDEO_SOURCE_PATH: "C:\\video.mp4"
        })).toThrow(/ASSEMBLYAI_API_KEY/);
    });
    it("accepts explicit caption style profile", () => {
        const parsed = parseEnv({
            ASSEMBLYAI_API_KEY: "key",
            VIDEO_SOURCE_PATH: "C:\\video.mp4",
            CAPTION_STYLE_PROFILE: "hormozi_word_lock_v1"
        });
        expect(parsed.CAPTION_STYLE_PROFILE).toBe("hormozi_word_lock_v1");
    });
    it("accepts svg typography caption profile", () => {
        const parsed = parseEnv({
            ASSEMBLYAI_API_KEY: "key",
            VIDEO_SOURCE_PATH: "C:\\video.mp4",
            CAPTION_STYLE_PROFILE: "svg_typography_v1"
        });
        expect(parsed.CAPTION_STYLE_PROFILE).toBe("svg_typography_v1");
    });
});
