import {describe, expect, it} from "vitest";

import {
  buildTranscriptCacheKey,
  buildTranscriptSettingsFingerprint,
  getDefaultTranscriptionMode,
  getTranscriptionProviderOrder,
  normalizeTranscriptionMode
} from "../transcription-routing";

describe("transcription routing", () => {
  it("defaults long-form ingest to assemblyai mode", () => {
    expect(getDefaultTranscriptionMode("long-form")).toBe("assemblyai");
    expect(getDefaultTranscriptionMode("reel")).toBe("assemblyai");
  });

  it("normalizes invalid transcription modes back to the presentation default", () => {
    expect(normalizeTranscriptionMode(undefined, "long-form")).toBe("assemblyai");
    expect(normalizeTranscriptionMode("invalid", "reel")).toBe("assemblyai");
  });

  it("uses assemblyai as the only transcription provider", () => {
    expect(getTranscriptionProviderOrder("assemblyai")).toEqual(["assemblyai"]);
  });

  it("builds stable assemblyai cache keys", () => {
    const assemblyKey = buildTranscriptCacheKey({
      sourceVideoHash: "video-hash",
      provider: "assemblyai",
      settingsFingerprint: buildTranscriptSettingsFingerprint({
        provider: "assemblyai"
      })
    });
    const repeatedKey = buildTranscriptCacheKey({
      sourceVideoHash: "video-hash",
      provider: "assemblyai",
      settingsFingerprint: buildTranscriptSettingsFingerprint({
        provider: "assemblyai"
      })
    });

    expect(assemblyKey).toBe(repeatedKey);
  });
});
