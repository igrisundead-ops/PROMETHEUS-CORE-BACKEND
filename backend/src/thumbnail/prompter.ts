import {z} from "zod";
import {maybeCallGroqJson} from "../groq";
import type {BackendEnv} from "../config";

const thumbnailPromptSchema = z.object({
  keywords: z.string(),
  visualPrompt: z.string()
});

export type ThumbnailPromptContext = {
  transcriptSnippet: string;
  speakerName?: string;
  styleReferenceName?: string;
};

export type ThumbnailPromptOutput = z.infer<typeof thumbnailPromptSchema>;

export const generateThumbnailPrompt = async (
  env: BackendEnv,
  context: ThumbnailPromptContext
): Promise<ThumbnailPromptOutput | null> => {
  const systemPrompt = `You are an expert YouTube thumbnail designer.
Given a transcript snippet from a video, your job is to generate:
1. "keywords": A highly-clickable, short, punchy 3-5 word phrase to put on the thumbnail in large text.
2. "visualPrompt": A descriptive prompt for an Image-to-Image AI generation API detailing how to composite the speaker and the text.

You MUST respond in strict JSON matching this schema:
{
  "keywords": "string",
  "visualPrompt": "string"
}`;

  const userPrompt = `
Transcript Snippet:
"""
${context.transcriptSnippet}
"""

Style Reference Requested: ${context.styleReferenceName ?? "None"}
Speaker Name: ${context.speakerName ?? "Unknown"}

Generate the thumbnail keywords and visual prompt.
  `.trim();

  return await maybeCallGroqJson({
    env,
    schema: thumbnailPromptSchema,
    systemPrompt,
    userPrompt
  });
};
