import {describe, expect, it, vi} from "vitest";

import {buildGroqEnhancedChunks} from "../groq-intelligence";
import type {AppEnv, TranscribedWord} from "../types";

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

describe("groq guards", () => {
  it("rejects segmentation outside hard 1-3 word range", async () => {
    const words: TranscribedWord[] = [
      {text: "A", startMs: 0, endMs: 100},
      {text: "B", startMs: 120, endMs: 200},
      {text: "C", startMs: 220, endMs: 300},
      {text: "D", startMs: 320, endMs: 400},
      {text: "E", startMs: 420, endMs: 500},
      {text: "F", startMs: 520, endMs: 600},
      {text: "G", startMs: 620, endMs: 700},
      {text: "H", startMs: 720, endMs: 800}
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chunks: [{startIndex: 0, endIndex: 7, intent: "default", emphasisWordIndices: [0]}]
                })
              }
            }
          ]
        }),
        {status: 200}
      )
    );

    await expect(
      buildGroqEnhancedChunks({
        words,
        env,
        fetchImpl: fetchMock as unknown as typeof fetch
      })
    ).rejects.toThrow(/supported 1-3 range/);
  });

  it("rejects segmentation that splits a detected name span", async () => {
    const words: TranscribedWord[] = [
      {text: "with", startMs: 0, endMs: 90},
      {text: "Dan", startMs: 100, endMs: 200},
      {text: "Martell", startMs: 210, endMs: 320},
      {text: "today", startMs: 330, endMs: 420}
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chunks: [
                    {startIndex: 0, endIndex: 1, intent: "name-callout", emphasisWordIndices: [1]},
                    {startIndex: 2, endIndex: 3, intent: "default", emphasisWordIndices: [0]}
                  ]
                })
              }
            }
          ]
        }),
        {status: 200}
      )
    );

    await expect(
      buildGroqEnhancedChunks({
        words,
        env,
        fetchImpl: fetchMock as unknown as typeof fetch
      })
    ).rejects.toThrow(/name span/);
  });
});
