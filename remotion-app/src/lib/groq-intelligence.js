import { z } from "zod";
import { captionPolicy } from "./caption-policy";
import { detectNameSpans } from "./chunk-semantics";
import { makeChunkFromGroqIndices } from "./caption-chunker";
import { getCaptionStyleProfile } from "./stylebooks/caption-style-profiles";
import { applyVariationBudget } from "./variation-router";
const intentSchema = z.enum(["default", "name-callout", "punch-emphasis"]);
const groqResponseSchema = z.object({
    chunks: z.array(z.object({
        startIndex: z.number().int().nonnegative(),
        endIndex: z.number().int().nonnegative(),
        intent: intentSchema.optional(),
        emphasisWordIndices: z.array(z.number().int().nonnegative()).default([])
    }))
});
const chatResponseSchema = z.object({
    choices: z.array(z.object({
        message: z.object({
            content: z.string()
        })
    }))
});
const getRelativeNameSpans = (nameSpans, start, end, sourceWords) => {
    const relative = [];
    nameSpans.forEach((span) => {
        if (span.endWord < start || span.startWord > end) {
            return;
        }
        const clippedStart = Math.max(span.startWord, start);
        const clippedEnd = Math.min(span.endWord, end);
        relative.push({
            startWord: clippedStart - start,
            endWord: clippedEnd - start,
            text: sourceWords.slice(clippedStart, clippedEnd + 1).map((word) => word.text).join(" ")
        });
    });
    return relative;
};
const validateCoverage = (words, chunks, groupingPolicy) => {
    let expectedStart = 0;
    for (const chunk of chunks) {
        if (chunk.startIndex !== expectedStart) {
            throw new Error("Groq chunk coverage is not contiguous.");
        }
        if (chunk.endIndex < chunk.startIndex) {
            throw new Error("Groq chunk endIndex must be >= startIndex.");
        }
        const wordCount = chunk.endIndex - chunk.startIndex + 1;
        if (wordCount < groupingPolicy.hardMinWords || wordCount > groupingPolicy.hardMaxWords) {
            throw new Error(`Groq chunk word count out of supported ${groupingPolicy.hardMinWords}-${groupingPolicy.hardMaxWords} range.`);
        }
        expectedStart = chunk.endIndex + 1;
    }
    if (expectedStart !== words.length) {
        throw new Error("Groq chunk coverage does not include all transcript words.");
    }
};
const validateNameLock = (nameSpans, chunks) => {
    for (const span of nameSpans) {
        for (let index = 0; index < chunks.length - 1; index += 1) {
            const boundary = chunks[index].endIndex;
            if (boundary >= span.startWord && boundary < span.endWord) {
                throw new Error(`Groq split detected inside name span "${span.text}".`);
            }
        }
    }
};
const validateVariationBudgetHints = (intents) => {
    if (intents.length === 0) {
        return;
    }
    const maxVariations = Math.max(1, Math.floor(intents.length * captionPolicy.variation.maxRatio));
    const variationIndexes = intents
        .map((intent, index) => ({ intent, index }))
        .filter((entry) => entry.intent !== "default")
        .map((entry) => entry.index);
    if (variationIndexes.length > maxVariations) {
        throw new Error("Groq variation hint count exceeds policy budget.");
    }
    for (let i = 1; i < variationIndexes.length; i += 1) {
        if (variationIndexes[i] - variationIndexes[i - 1] < captionPolicy.variation.minGapChunks) {
            throw new Error("Groq variation hint spacing violates policy.");
        }
    }
};
const buildPrompt = (words, groupingPolicy) => {
    const tokenized = words.map((word, index) => `${index}:${word.text}`).join(" ");
    return [
        "You are preparing cinematic captions for vertical social video.",
        "Output strict JSON only with schema:",
        '{"chunks":[{"startIndex":0,"endIndex":3,"intent":"default","emphasisWordIndices":[1]}]}',
        "Rules:",
        "1) Cover all words contiguously with no gaps and no overlaps.",
        `2) Each chunk must have ${groupingPolicy.hardMinWords}-${groupingPolicy.hardMaxWords} words.`,
        `3) Prefer ${groupingPolicy.softMinWords}-${groupingPolicy.softMaxWords} words for readability when possible.`,
        "4) Keep full person names together (do not split first/last names).",
        "5) intent can be default, name-callout, or punch-emphasis.",
        "6) Keep variation-like intents sparse and well-spaced.",
        "7) emphasisWordIndices are relative to each chunk and should contain 0-2 indices.",
        `Words with indices: ${tokenized}`
    ].join("\n");
};
export const buildGroqEnhancedChunks = async ({ words, env, fetchImpl = fetch }) => {
    const profile = getCaptionStyleProfile(env.CAPTION_STYLE_PROFILE);
    const groupingPolicy = profile.groupingPolicy;
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
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "Return strict JSON only. No markdown."
                },
                {
                    role: "user",
                    content: buildPrompt(words, groupingPolicy)
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
    const payload = groqResponseSchema.parse(JSON.parse(content));
    validateCoverage(words, payload.chunks, groupingPolicy);
    const nameSpans = detectNameSpans(words);
    validateNameLock(nameSpans, payload.chunks);
    const hintedIntents = payload.chunks.map((chunk) => chunk.intent ?? "default");
    validateVariationBudgetHints(hintedIntents);
    const emphasisOverrides = {};
    const chunks = payload.chunks.map((chunk, chunkIndex) => {
        const wordsForChunk = words.slice(chunk.startIndex, chunk.endIndex + 1);
        emphasisOverrides[chunkIndex] = chunk.emphasisWordIndices.filter((index) => index >= 0 && index < wordsForChunk.length);
        const relativeNameSpans = getRelativeNameSpans(nameSpans, chunk.startIndex, chunk.endIndex, words);
        const semantic = {
            intent: relativeNameSpans.length > 0 ? "name-callout" : chunk.intent ?? "default",
            nameSpans: relativeNameSpans,
            isVariation: false,
            suppressDefault: false
        };
        return makeChunkFromGroqIndices({
            words,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            semantic
        });
    });
    return {
        chunks: applyVariationBudget(chunks),
        emphasisOverrides
    };
};
