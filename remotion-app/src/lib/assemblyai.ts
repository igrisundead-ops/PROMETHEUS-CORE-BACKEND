import {readFile} from "node:fs/promises";
import {z} from "zod";

import type {AssemblyTranscript, TranscribedWord} from "./types";

type FetchLike = typeof fetch;

const uploadResponseSchema = z.object({
  upload_url: z.string().url()
});

const createTranscriptResponseSchema = z.object({
  id: z.string()
});

const transcriptStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "processing", "completed", "error"]),
  error: z.string().nullable().optional(),
  words: z
    .array(
      z.object({
        text: z.string(),
        start: z.number(),
        end: z.number(),
        confidence: z.number().optional()
      })
    )
    .nullable()
    .optional()
});

const baseUrl = "https://api.assemblyai.com/v2";

const getHeaders = (apiKey: string): HeadersInit => ({
  authorization: apiKey,
  "content-type": "application/json"
});

const getUploadHeaders = (apiKey: string): HeadersInit => ({
  authorization: apiKey,
  "content-type": "application/octet-stream"
});

export const uploadToAssemblyAI = async ({
  filePath,
  apiKey,
  fetchImpl = fetch
}: {
  filePath: string;
  apiKey: string;
  fetchImpl?: FetchLike;
}): Promise<string> => {
  const fileBuffer = await readFile(filePath);
  const response = await fetchImpl(`${baseUrl}/upload`, {
    method: "POST",
    headers: getUploadHeaders(apiKey),
    body: fileBuffer
  });

  if (!response.ok) {
    throw new Error(`AssemblyAI upload failed (${response.status}): ${await response.text()}`);
  }

  const payload = uploadResponseSchema.parse(await response.json());
  return payload.upload_url;
};

export const createAssemblyTranscriptJob = async ({
  uploadUrl,
  apiKey,
  fetchImpl = fetch
}: {
  uploadUrl: string;
  apiKey: string;
  fetchImpl?: FetchLike;
}): Promise<string> => {
  const response = await fetchImpl(`${baseUrl}/transcript`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      audio_url: uploadUrl,
      speech_model: "best"
    })
  });

  if (!response.ok) {
    throw new Error(
      `AssemblyAI transcript create failed (${response.status}): ${await response.text()}`
    );
  }

  const payload = createTranscriptResponseSchema.parse(await response.json());
  return payload.id;
};

export const pollAssemblyTranscriptJob = async ({
  transcriptId,
  apiKey,
  fetchImpl = fetch,
  pollIntervalMs = 2500,
  maxPollAttempts = 240
}: {
  transcriptId: string;
  apiKey: string;
  fetchImpl?: FetchLike;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}): Promise<AssemblyTranscript> => {
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const response = await fetchImpl(`${baseUrl}/transcript/${transcriptId}`, {
      method: "GET",
      headers: {authorization: apiKey}
    });

    if (!response.ok) {
      throw new Error(
        `AssemblyAI transcript polling failed (${response.status}): ${await response.text()}`
      );
    }

    const transcript = transcriptStatusSchema.parse(await response.json());
    if (transcript.status === "completed") {
      return transcript;
    }

    if (transcript.status === "error") {
      throw new Error(`AssemblyAI transcription error: ${transcript.error || "Unknown error"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`AssemblyAI transcription timed out for transcript ID ${transcriptId}.`);
};

export const normalizeAssemblyWords = (transcript: AssemblyTranscript): TranscribedWord[] => {
  const words = transcript.words ?? [];
  return words.map((word) => ({
    text: word.text.trim(),
    startMs: word.start,
    endMs: word.end,
    confidence: word.confidence
  }));
};

export const transcribeWithAssemblyAI = async ({
  filePath,
  apiKey,
  fetchImpl = fetch,
  pollIntervalMs = 2500,
  maxPollAttempts = 240
}: {
  filePath: string;
  apiKey: string;
  fetchImpl?: FetchLike;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}): Promise<TranscribedWord[]> => {
  const uploadUrl = await uploadToAssemblyAI({filePath, apiKey, fetchImpl});
  const transcriptId = await createAssemblyTranscriptJob({
    uploadUrl,
    apiKey,
    fetchImpl
  });
  const transcript = await pollAssemblyTranscriptJob({
    transcriptId,
    apiKey,
    fetchImpl,
    pollIntervalMs,
    maxPollAttempts
  });
  return normalizeAssemblyWords(transcript);
};
