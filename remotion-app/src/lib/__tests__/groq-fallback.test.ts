import {describe, expect, it, vi} from "vitest";

import {deterministicChunkWords} from "../caption-chunker";
import {buildGroqEnhancedChunks} from "../groq-intelligence";
import type {AppEnv, TranscribedWord} from "../types";

const words: TranscribedWord[] = [
  {text: "Build", startMs: 0, endMs: 150},
  {text: "your", startMs: 170, endMs: 260},
  {text: "future", startMs: 280, endMs: 460},
  {text: "today", startMs: 480, endMs: 660}
];

const env: AppEnv = {
  ASSEMBLYAI_API_KEY: "x",
  GROQ_API_KEY: "x",
  GROQ_MODEL: "llama-3.3-70b-versatile",
  GROQ_TEMPERATURE: 0.2,
  GROQ_MAX_TOKENS: 900,
  CAPTION_INTELLIGENCE_MODE: "auto",
  CAPTION_STYLE_PROFILE: "slcp",
  CREATIVE_ORCHESTRATION_V1: false,
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_ANON_KEY: "",
  SUPABASE_STORAGE_BUCKET: "",
  SUPABASE_STORAGE_PREFIX: "",
  SUPABASE_ASSETS_TABLE: "",
  SUPABASE_ASSETS_SELECT: "",
  SUPABASE_ASSETS_SCAN_LIMIT: 200,
  MOTION_ASSET_MANIFEST_URL: "",
  ASSET_BRAIN_ENABLED: false,
  VIDEO_SOURCE_PATH: "C:\\video.mp4"
};

describe("groq fallback", () => {
  it("falls back when groq payload is malformed", async () => {
    const badFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{message: {content: "{not-json"}}]
        }),
        {status: 200}
      )
    );

    await expect(
      buildGroqEnhancedChunks({
        words,
        env,
        fetchImpl: badFetch as unknown as typeof fetch
      })
    ).rejects.toThrow();

    const fallback = deterministicChunkWords(words);
    expect(fallback.length).toBeGreaterThan(0);
  });
});
