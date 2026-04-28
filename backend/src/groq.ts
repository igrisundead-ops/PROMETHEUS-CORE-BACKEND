import {z} from "zod";

import type {BackendEnv} from "./config";

type FetchLike = typeof fetch;

const chatResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string()
      })
    })
  )
});

export const maybeCallGroqJson = async <T>({
  env,
  schema,
  systemPrompt,
  userPrompt,
  fetchImpl = fetch
}: {
  env: BackendEnv;
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  fetchImpl?: FetchLike;
}): Promise<T | null> => {
  if (!env.GROQ_API_KEY.trim()) {
    return null;
  }

  const response = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GROQ_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: env.GROQ_TEMPERATURE,
      max_tokens: env.GROQ_MAX_TOKENS,
      response_format: {type: "json_object"},
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API call failed (${response.status}): ${await response.text()}`);
  }

  const parsed = chatResponseSchema.parse(await response.json());
  const content = parsed.choices[0]?.message.content?.trim();
  if (!content) {
    throw new Error("Groq response was empty.");
  }

  return schema.parse(JSON.parse(content));
};
