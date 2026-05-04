import {afterEach, describe, expect, it, vi} from "vitest";

import {streamAudioBufferWithAssemblyAI} from "../integrations/assemblyai";

describe("AssemblyAI streaming integration", () => {
  const originalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it("requests streaming tokens from the streaming host before opening the websocket", async () => {
    const requestedUrls: string[] = [];
    globalThis.WebSocket = undefined as unknown as typeof WebSocket;

    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          token: "stream-token",
          expires_in_seconds: 60
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });

    await expect(
      streamAudioBufferWithAssemblyAI({
        audioBuffer: Buffer.from([0x00, 0x00, 0x01, 0x00]),
        apiKey: "test-key",
        fetchImpl
      })
    ).rejects.toThrow("WebSocket is not available in this runtime.");

    expect(requestedUrls).toEqual([
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=60"
    ]);
  });
});
