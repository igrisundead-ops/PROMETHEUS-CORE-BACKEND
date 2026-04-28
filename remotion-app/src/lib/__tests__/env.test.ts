import {describe, expect, it} from "vitest";

import {parseEnv} from "../env";

describe("env validation", () => {
  it("defaults ASSEMBLYAI_API_KEY to an empty string when omitted", () => {
    const parsed = parseEnv({
      VIDEO_SOURCE_PATH: "C:\\video.mp4"
    });

    expect(parsed.ASSEMBLYAI_API_KEY).toBe("");
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

  it("accepts creative orchestration feature flag", () => {
    const parsed = parseEnv({
      ASSEMBLYAI_API_KEY: "key",
      VIDEO_SOURCE_PATH: "C:\\video.mp4",
      CREATIVE_ORCHESTRATION_V1: "true"
    });
    expect(parsed.CREATIVE_ORCHESTRATION_V1).toBe(true);
  });
});
