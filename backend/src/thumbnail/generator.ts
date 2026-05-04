import type {BackendEnv} from "../config";

export type ThumbnailGeneratorInput = {
  frameBuffer: Buffer;
  styleImageBuffer?: Buffer;
  textPrompt: string;
  visualPrompt: string;
};

/**
 * Wrapper for the external Image-to-Image API.
 * Currently uses Google AI Studio Imagen 3 Text-to-Image as a starting point.
 */
export const generateThumbnailImage = async (
  env: BackendEnv,
  input: ThumbnailGeneratorInput
): Promise<Buffer> => {
  const apiKey = env.GOOGLE_AI_STUDIO_API_KEY; 
  if (!apiKey) {
    console.warn("[Thumbnail] GOOGLE_AI_STUDIO_API_KEY is not set. Returning extracted frame instead.");
    return input.frameBuffer;
  }

  console.log(`[Thumbnail] Generating thumbnail using Google AI Studio (Imagen 3)...`);
  console.log(`[Thumbnail] Text: "${input.textPrompt}"`);
  console.log(`[Thumbnail] Visual Prompt: "${input.visualPrompt}"`);
  
  // Note: Imagen 3 on Google AI Studio is primarily Text-to-Image at the moment.
  // We will combine the visual prompt and the text prompt to drive the generation.
  // We are ignoring the input.frameBuffer for the generation itself, but keeping the signature the same.
  
  const combinedPrompt = `${input.visualPrompt} Feature the text: "${input.textPrompt}" prominently and clearly.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [
        {
          prompt: combinedPrompt
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9"
      }
    })
  });

  if (!response.ok) {
    console.error(`[Thumbnail] Generation failed: ${await response.text()}`);
    console.warn("[Thumbnail] Falling back to extracted frame.");
    return input.frameBuffer;
  }

  const data = await response.json() as any;
  const base64Image = data?.predictions?.[0]?.bytesBase64Encoded;

  if (!base64Image) {
    console.warn("[Thumbnail] No image returned from Google AI Studio. Falling back to extracted frame.");
    return input.frameBuffer;
  }

  return Buffer.from(base64Image, "base64");
};
