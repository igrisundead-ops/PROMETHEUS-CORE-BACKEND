import {describe, expect, it, vi} from "vitest";

import {normalizeAssemblyWords, pollAssemblyTranscriptJob} from "../assemblyai";

describe("assemblyai polling", () => {
  it("resolves processing -> completed flow", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "abc",
            status: "processing"
          }),
          {status: 200}
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "abc",
            status: "completed",
            words: [{text: "Hello", start: 0, end: 400, confidence: 0.99}]
          }),
          {status: 200}
        )
      );

    const transcript = await pollAssemblyTranscriptJob({
      transcriptId: "abc",
      apiKey: "test",
      fetchImpl: fetchMock as unknown as typeof fetch,
      pollIntervalMs: 0,
      maxPollAttempts: 5
    });
    const words = normalizeAssemblyWords(transcript);
    expect(words).toHaveLength(1);
    expect(words[0].text).toBe("Hello");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when assemblyai returns error status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "abc",
          status: "error",
          error: "bad audio"
        }),
        {status: 200}
      )
    );

    await expect(
      pollAssemblyTranscriptJob({
        transcriptId: "abc",
        apiKey: "test",
        fetchImpl: fetchMock as unknown as typeof fetch,
        pollIntervalMs: 0,
        maxPollAttempts: 2
      })
    ).rejects.toThrow(/bad audio/);
  });
});
