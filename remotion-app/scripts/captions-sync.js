import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { transcribeWithAssemblyAI } from "../src/lib/assemblyai";
import { deterministicChunkWords, getChunkPolicyStats, mapWordChunksToCaptionChunks } from "../src/lib/caption-chunker";
import { loadEnv, assertSupabaseDisabled } from "../src/lib/env";
import { buildGroqEnhancedChunks } from "../src/lib/groq-intelligence";
import { sha256File, sha256Text } from "../src/lib/hash";
import { getCaptionStyleProfile } from "../src/lib/stylebooks/caption-style-profiles";
import { getVariationStats } from "../src/lib/variation-router";
import { probeVideoMetadata } from "../src/lib/video-probe";
const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache", "assemblyai");
const DATA_DIR = path.join(ROOT, "src", "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUTPUT_TRANSCRIPT_PATH = path.join(DATA_DIR, "transcript.words.json");
const OUTPUT_CAPTIONS_PATH = path.join(DATA_DIR, "captions.dean-graziosi.json");
const OUTPUT_VIDEO_METADATA_PATH = path.join(DATA_DIR, "video.metadata.json");
const OUTPUT_VIDEO_PUBLIC_PATH = path.join(PUBLIC_DIR, "input-video.mp4");
const readJsonIfExists = async (filePath) => {
    try {
        const contents = await readFile(filePath, "utf-8");
        return JSON.parse(contents);
    }
    catch {
        return null;
    }
};
const writeJson = async (filePath, value) => {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};
const normalizeWords = (words) => {
    return words
        .map((word) => ({
        ...word,
        text: word.text.trim()
    }))
        .filter((word) => word.text.length > 0)
        .sort((a, b) => a.startMs - b.startMs);
};
const ensureMonotonicWordTimings = (words) => {
    for (let i = 1; i < words.length; i += 1) {
        const previous = words[i - 1];
        const current = words[i];
        if (current.startMs < previous.startMs) {
            throw new Error(`Transcript timing regression at index ${i}: ${current.startMs} < ${previous.startMs}`);
        }
        if (current.endMs < current.startMs) {
            throw new Error(`Transcript word has invalid timing at index ${i}: end < start.`);
        }
    }
};
const syncCaptions = async () => {
    const env = loadEnv();
    assertSupabaseDisabled(env);
    const captionStyleProfile = getCaptionStyleProfile(env.CAPTION_STYLE_PROFILE);
    await mkdir(CACHE_DIR, { recursive: true });
    await mkdir(DATA_DIR, { recursive: true });
    await mkdir(PUBLIC_DIR, { recursive: true });
    await mkdir(path.join(ROOT, "out"), { recursive: true });
    const videoPath = path.resolve(env.VIDEO_SOURCE_PATH);
    await stat(videoPath);
    const [videoFileHash, videoMetadata] = await Promise.all([
        sha256File(videoPath),
        probeVideoMetadata(videoPath)
    ]);
    const transcriptCacheKey = sha256Text(`${videoPath}|${videoFileHash}`);
    const transcriptCachePath = path.join(CACHE_DIR, `${transcriptCacheKey}.words.json`);
    console.log(`Video source: ${videoPath}`);
    console.log(`Video hash key: ${transcriptCacheKey}`);
    let transcriptWords = await readJsonIfExists(transcriptCachePath);
    if (!transcriptWords) {
        console.log("No transcript cache hit. Uploading media to AssemblyAI...");
        const rawWords = await transcribeWithAssemblyAI({
            filePath: videoPath,
            apiKey: env.ASSEMBLYAI_API_KEY
        });
        transcriptWords = normalizeWords(rawWords);
        ensureMonotonicWordTimings(transcriptWords);
        await writeJson(transcriptCachePath, transcriptWords);
        console.log(`AssemblyAI transcript cached at: ${transcriptCachePath}`);
    }
    else {
        console.log("AssemblyAI cache hit. Reusing transcript.");
        transcriptWords = normalizeWords(transcriptWords);
        ensureMonotonicWordTimings(transcriptWords);
    }
    const deterministicChunks = deterministicChunkWords(transcriptWords, {
        profileId: env.CAPTION_STYLE_PROFILE
    });
    let finalChunks = deterministicChunks;
    let emphasisOverrides;
    let intelligenceSource = "deterministic";
    if (env.CAPTION_INTELLIGENCE_MODE === "auto" && env.GROQ_API_KEY.trim().length > 0) {
        try {
            const groqResult = await buildGroqEnhancedChunks({
                words: transcriptWords,
                env
            });
            finalChunks = groqResult.chunks;
            emphasisOverrides = groqResult.emphasisOverrides;
            intelligenceSource = "groq-auto";
            console.log("Groq caption intelligence applied successfully.");
        }
        catch (error) {
            console.warn(`Groq caption intelligence failed. Falling back to deterministic chunks. Reason: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const captionChunks = mapWordChunksToCaptionChunks(finalChunks, emphasisOverrides, {
        profileId: env.CAPTION_STYLE_PROFILE
    });
    const policyStats = getChunkPolicyStats(finalChunks, {
        profileId: env.CAPTION_STYLE_PROFILE
    });
    const variationStats = getVariationStats(finalChunks);
    await Promise.all([
        writeJson(OUTPUT_TRANSCRIPT_PATH, transcriptWords),
        writeJson(OUTPUT_CAPTIONS_PATH, captionChunks),
        writeJson(OUTPUT_VIDEO_METADATA_PATH, videoMetadata),
        cp(videoPath, OUTPUT_VIDEO_PUBLIC_PATH, { force: true })
    ]);
    console.log(`Transcript words: ${transcriptWords.length}`);
    console.log(`Caption chunks: ${captionChunks.length}`);
    console.log(`Caption intelligence source: ${intelligenceSource}`);
    console.log(`Caption style profile: ${captionStyleProfile.displayName} (${captionStyleProfile.id})`);
    console.log(`Policy stats: hardWords=${captionStyleProfile.groupingPolicy.hardMinWords}-${captionStyleProfile.groupingPolicy.hardMaxWords} ` +
        `softWords=${captionStyleProfile.groupingPolicy.softMinWords}-${captionStyleProfile.groupingPolicy.softMaxWords} ` +
        `observed[min/max]=${policyStats.minWordsObserved}/${policyStats.maxWordsObserved} ` +
        `softRangeRatio=${policyStats.softRangeRatio} hardViolations=${policyStats.hardRangeViolations} ` +
        `durMs[min/avg/max]=${policyStats.minDurationMs}/${policyStats.avgDurationMs}/${policyStats.maxDurationMs}`);
    console.log(`Variation stats: count=${variationStats.variationCount} ratio=${variationStats.variationRatio} ` +
        `intents=${JSON.stringify(variationStats.intents)}`);
    console.log(`Name split violations: ${policyStats.nameSplitViolations}`);
    console.log(`Word-count histogram: ${JSON.stringify(policyStats.wordCountHistogram)}`);
    console.log(`Wrote: ${OUTPUT_TRANSCRIPT_PATH}`);
    console.log(`Wrote: ${OUTPUT_CAPTIONS_PATH}`);
    console.log(`Wrote: ${OUTPUT_VIDEO_METADATA_PATH}`);
    console.log(`Copied source video to: ${OUTPUT_VIDEO_PUBLIC_PATH}`);
};
syncCaptions().catch((error) => {
    console.error(error);
    process.exit(1);
});
