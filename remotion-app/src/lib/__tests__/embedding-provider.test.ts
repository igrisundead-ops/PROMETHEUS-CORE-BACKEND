import {describe, expect, it, vi} from "vitest";

import {createEmbeddingProvider} from "../embeddings/provider";

describe("embedding provider", () => {
  it("builds deterministic local-test embeddings", async () => {
    const provider = createEmbeddingProvider({
      provider: "local-test",
      model: "deterministic",
      dimensions: 4
    });

    const [first, second] = await provider.embedTexts(["alpha", "alpha"]);

    expect(first).toHaveLength(4);
    expect(second).toEqual(first);
  });

  it("uses the OpenAI-compatible embeddings endpoint for the openai provider", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {embedding: [0.1, 0.2]},
            {embedding: [0.3, 0.4]}
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });

    const provider = createEmbeddingProvider({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 2,
      apiKey: "test-key",
      baseUrl: "https://api.openai.com/v1",
      fetchImpl
    });

    const embeddings = await provider.embedTexts(["first", "second"]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string | URL | Request, RequestInit | undefined] | undefined;
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toBe("https://api.openai.com/v1/embeddings");
    expect(embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4]
    ]);
  });
});
