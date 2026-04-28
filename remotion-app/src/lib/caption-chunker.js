import { applyProperCaseToNameWords, buildSemanticChunks } from "./chunk-semantics";
import { getDefaultEmphasisIndices, routeStyleForWords } from "./style-routing";
import { getCaptionStyleProfile } from "./stylebooks/caption-style-profiles";
import { createSvgVariantSelectionState } from "./stylebooks/svg-typography-v1";
import { applyVariationBudget } from "./variation-router";
const toChunk = (words, semantic) => {
    const startMs = words[0]?.startMs ?? 0;
    const endMs = words[words.length - 1]?.endMs ?? startMs;
    return {
        words,
        startMs,
        endMs,
        text: words.map((word) => word.text).join(" ").trim(),
        semantic
    };
};
export const deterministicChunkWords = (words, options = {}) => {
    const profile = getCaptionStyleProfile(options.profileId);
    const semanticChunks = buildSemanticChunks(words, profile.groupingPolicy);
    return applyVariationBudget(semanticChunks.map((chunk) => toChunk(chunk.words, chunk.semantic)));
};
export const mapWordChunksToCaptionChunks = (chunks, emphasisOverrides, options = {}) => {
    const profileId = options.profileId ?? "slcp";
    const svgSelectionState = profileId === "svg_typography_v1"
        ? createSvgVariantSelectionState()
        : undefined;
    return chunks.map((chunk, index) => {
        const semantic = chunk.semantic;
        const words = applyProperCaseToNameWords(chunk.words, semantic.nameSpans);
        const routed = routeStyleForWords(words.map((word) => word.text), semantic, {
            profileId,
            chunkIndex: index,
            svgSelectionState
        });
        const emphasis = emphasisOverrides?.[index] ?? getDefaultEmphasisIndices(words);
        return {
            id: `chunk-${String(index + 1).padStart(4, "0")}`,
            text: words.map((word) => word.text).join(" ").trim(),
            startMs: chunk.startMs,
            endMs: chunk.endMs,
            words,
            styleKey: routed.styleKey,
            motionKey: routed.motionKey,
            layoutVariant: routed.layoutVariant,
            emphasisWordIndices: emphasis,
            profileId,
            semantic,
            suppressDefault: semantic.suppressDefault
        };
    });
};
export const getChunkPolicyStats = (chunks, options = {}) => {
    const profile = getCaptionStyleProfile(options.profileId);
    const hardMinWords = profile.groupingPolicy.hardMinWords;
    const hardMaxWords = profile.groupingPolicy.hardMaxWords;
    const softMinWords = profile.groupingPolicy.softMinWords;
    const softMaxWords = profile.groupingPolicy.softMaxWords;
    const durations = chunks.map((chunk) => chunk.endMs - chunk.startMs);
    const wordCounts = chunks.map((chunk) => chunk.words.length);
    const minDurationMs = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDurationMs = durations.length > 0 ? Math.max(...durations) : 0;
    const avgDurationMs = durations.length > 0
        ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
        : 0;
    const minWordsObserved = wordCounts.length > 0 ? Math.min(...wordCounts) : 0;
    const maxWordsObserved = wordCounts.length > 0 ? Math.max(...wordCounts) : 0;
    const softRangeCount = chunks.filter((chunk) => chunk.words.length >= softMinWords && chunk.words.length <= softMaxWords).length;
    const hardRangeViolations = chunks.filter((chunk) => chunk.words.length < hardMinWords || chunk.words.length > hardMaxWords).length;
    const variationCount = chunks.filter((chunk) => chunk.semantic.isVariation).length;
    const nameSplitViolations = chunks.reduce((count, chunk) => {
        const hasInvalidNameSpan = chunk.semantic.nameSpans.some((span) => span.startWord < 0 || span.endWord >= chunk.words.length || span.endWord < span.startWord);
        return count + (hasInvalidNameSpan ? 1 : 0);
    }, 0);
    const wordCountHistogram = chunks.reduce((hist, chunk) => {
        const key = String(chunk.words.length);
        hist[key] = (hist[key] ?? 0) + 1;
        return hist;
    }, {});
    return {
        minDurationMs,
        avgDurationMs,
        maxDurationMs,
        minWordsObserved,
        maxWordsObserved,
        softRangeCount,
        softRangeRatio: chunks.length > 0 ? Number((softRangeCount / chunks.length).toFixed(3)) : 0,
        hardRangeViolations,
        variationCount,
        variationRatio: chunks.length > 0 ? Number((variationCount / chunks.length).toFixed(3)) : 0,
        nameSplitViolations,
        wordCountHistogram
    };
};
export const makeChunkFromGroqIndices = ({ words, startIndex, endIndex, semantic }) => {
    return toChunk(words.slice(startIndex, endIndex + 1), semantic);
};
