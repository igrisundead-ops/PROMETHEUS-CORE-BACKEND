import { buildZoomEnvelope, buildZoomTimingFamilyOrder } from "./zoom-timing";
const MAX_CAMERA_CUES_PER_MINUTE = 2;
const MAX_CAMERA_CUES_TOTAL = 12;
const CAMERA_TRIGGER_MIN_GAP_MS = 9000;
const CAMERA_TRIGGER_WINDOW_GAP_MS = 1200;
const CAMERA_TRIGGER_MAX_CHUNKS = 3;
const CAMERA_TRIGGER_MAX_DURATION_MS = 3200;
const CAMERA_TRIGGER_MIN_SCORE = 92;
const CAMERA_TRIGGER_PATTERNS = [
    {
        id: "for-you-payoff",
        category: "direct-address",
        score: 78,
        phrases: ["for you", "this video is for you"],
        timingFamilyBias: ["bobby", "assertive", "linger"]
    },
    {
        id: "definition-called",
        category: "definition-reveal",
        score: 76,
        phrases: ["is called", "are called", "called"],
        timingFamilyBias: ["reveal", "glide"]
    },
    {
        id: "identity-intro",
        category: "identity-intro",
        score: 70,
        phrases: ["his name is", "her name is", "my name is", "their name is"],
        timingFamilyBias: ["bobby", "reveal", "glide"]
    },
    {
        id: "video-intro",
        category: "direct-address",
        score: 60,
        phrases: ["this video is", "these videos are", "those videos are", "this is", "these are"],
        timingFamilyBias: ["bobby", "reveal", "glide"]
    },
    {
        id: "command-attention",
        category: "instruction",
        score: 58,
        phrases: ["listen attentively", "listen", "look", "remember", "pay attention"],
        timingFamilyBias: ["assertive"]
    },
    {
        id: "you-just",
        category: "direct-address",
        score: 52,
        phrases: ["you just"],
        timingFamilyBias: ["bobby", "assertive", "linger"]
    }
];
const normalizeText = (value) => {
    return value
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[^a-z0-9']+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};
const getCameraCueDurationMs = (chunks) => {
    if (chunks.length === 0) {
        return 0;
    }
    return Math.max(1, chunks[chunks.length - 1].endMs - chunks[0].startMs);
};
export const getTargetCameraCueCount = (chunks) => {
    const durationMinutes = getCameraCueDurationMs(chunks) / 60000;
    return Math.max(2, Math.min(MAX_CAMERA_CUES_TOTAL, Math.round(Math.max(1, durationMinutes) * MAX_CAMERA_CUES_PER_MINUTE)));
};
const buildCameraTriggerWindows = (chunks) => {
    const windows = [];
    for (let startIndex = 0; startIndex < chunks.length; startIndex += 1) {
        let endIndex = startIndex;
        while (endIndex < chunks.length && endIndex < startIndex + CAMERA_TRIGGER_MAX_CHUNKS) {
            const previous = chunks[endIndex - 1];
            const current = chunks[endIndex];
            if (endIndex > startIndex &&
                previous &&
                current.startMs - previous.endMs > CAMERA_TRIGGER_WINDOW_GAP_MS) {
                break;
            }
            const startMs = chunks[startIndex].startMs;
            const endMs = current.endMs;
            const durationMs = Math.max(1, endMs - startMs);
            if (durationMs > CAMERA_TRIGGER_MAX_DURATION_MS) {
                break;
            }
            const text = chunks.slice(startIndex, endIndex + 1).map((chunk) => chunk.text).join(" ");
            windows.push({
                startIndex,
                endIndex,
                startMs,
                endMs,
                durationMs,
                text,
                normalizedText: normalizeText(text)
            });
            endIndex += 1;
        }
    }
    return windows;
};
const getMatchedPatterns = (window) => {
    return CAMERA_TRIGGER_PATTERNS.filter((pattern) => {
        return pattern.phrases.some((phrase) => window.normalizedText.includes(phrase));
    });
};
const resolveWindowAnchorIndex = ({ chunks, window, matchedPatterns }) => {
    for (let index = window.endIndex; index >= window.startIndex; index -= 1) {
        const chunk = chunks[index];
        const normalizedChunkText = normalizeText(chunk.text);
        if (chunk.semantic?.intent !== "default" || chunk.semantic?.isVariation) {
            return index;
        }
        if (matchedPatterns.some((pattern) => pattern.phrases.some((phrase) => normalizedChunkText.includes(phrase)))) {
            return index;
        }
    }
    return window.endIndex;
};
const getWindowCategoryBonus = ({ window, chunks }) => {
    const windowChunks = chunks.slice(window.startIndex, window.endIndex + 1);
    let bonus = 0;
    if (windowChunks.some((chunk) => chunk.semantic?.intent === "name-callout")) {
        bonus += 16;
    }
    if (windowChunks.some((chunk) => chunk.semantic?.intent === "punch-emphasis")) {
        bonus += 12;
    }
    if (windowChunks.some((chunk) => chunk.semantic?.isVariation)) {
        bonus += 8;
    }
    if (windowChunks.some((chunk) => /[!?]$/.test(chunk.text))) {
        bonus += 6;
    }
    if (windowChunks.length === 2) {
        bonus += 12;
    }
    else if (windowChunks.length === 3) {
        bonus += 8;
    }
    const durationSec = window.durationMs / 1000;
    if (durationSec >= 1.5 && durationSec <= 2.8) {
        bonus += 18;
    }
    else if (durationSec >= 1.2 && durationSec <= 3.0) {
        bonus += 10;
    }
    else {
        bonus -= 10;
    }
    const normalizedText = window.normalizedText;
    if (normalizedText.includes("you")) {
        bonus += 6;
    }
    if (normalizedText.includes("called")) {
        bonus += 10;
    }
    if (normalizedText.includes("for you")) {
        bonus += 12;
    }
    return bonus;
};
const buildFallbackPatternIds = (chunks, window) => {
    const windowChunks = chunks.slice(window.startIndex, window.endIndex + 1);
    const fallbackIds = [];
    if (windowChunks.some((chunk) => chunk.semantic?.intent === "punch-emphasis")) {
        fallbackIds.push("fallback-punch-emphasis");
    }
    if (windowChunks.some((chunk) => chunk.semantic?.intent === "name-callout")) {
        fallbackIds.push("fallback-name-callout");
    }
    if (windowChunks.some((chunk) => chunk.emphasisWordIndices.length > 0)) {
        fallbackIds.push("fallback-emphasis-words");
    }
    return fallbackIds;
};
const getPreferredTimingFamilies = ({ chunks, window, matchedPatterns }) => {
    const preferredFromPatterns = matchedPatterns.flatMap((pattern) => pattern.timingFamilyBias ?? []);
    if (preferredFromPatterns.length > 0) {
        return [...new Set(preferredFromPatterns)];
    }
    const windowChunks = chunks.slice(window.startIndex, window.endIndex + 1);
    if (windowChunks.some((chunk) => chunk.semantic?.intent === "name-callout")) {
        return ["bobby", "reveal", "glide", "linger"];
    }
    if (windowChunks.some((chunk) => chunk.semantic?.intent === "punch-emphasis")) {
        return ["assertive", "bobby", "linger", "glide"];
    }
    if (window.normalizedText.includes("called")) {
        return ["bobby", "reveal", "glide"];
    }
    if (window.normalizedText.includes("you")) {
        return ["bobby", "assertive", "linger"];
    }
    return ["glide", "bobby", "linger", "assertive", "reveal"];
};
const scoreCameraTriggerWindow = ({ chunks, window }) => {
    const matchedPatterns = getMatchedPatterns(window);
    const anchorIndex = resolveWindowAnchorIndex({ chunks, window, matchedPatterns });
    const patternIds = matchedPatterns.map((pattern) => pattern.id);
    let score = matchedPatterns.reduce((total, pattern) => total + pattern.score, 0);
    score += getWindowCategoryBonus({ window, chunks });
    if (patternIds.length === 0) {
        const fallbackPatternIds = buildFallbackPatternIds(chunks, window);
        if (fallbackPatternIds.length === 0) {
            return { score: 0, patternIds: [], reason: "no semantic trigger match", anchorIndex };
        }
        patternIds.push(...fallbackPatternIds);
        score += 48 + fallbackPatternIds.length * 8;
    }
    if (anchorIndex < window.endIndex) {
        score -= (window.endIndex - anchorIndex) * 26;
    }
    if (window.endIndex === window.startIndex && !window.normalizedText.includes("for you")) {
        score -= 16;
    }
    const reason = patternIds.length > 0
        ? `semantic trigger: ${patternIds.join(", ")}`
        : "semantic trigger fallback";
    return { score, patternIds, reason, anchorIndex };
};
const buildCueForCandidate = ({ candidate, previousFamily }) => {
    const seed = `${candidate.anchorChunkId}|${candidate.text}|${candidate.patternIds.join("|")}|${candidate.startMs}|${candidate.endMs}`;
    const timingFamily = buildZoomTimingFamilyOrder({
        seed,
        preferredFamilies: candidate.preferredTimingFamilies,
        previousFamily
    })[0];
    const scaleBoost = candidate.patternIds.some((id) => id.includes("for-you") || id.includes("called"))
        ? 0.01
        : candidate.patternIds.some((id) => id.includes("identity") || id.includes("video-intro")) || candidate.score >= 112
            ? 0.005
            : 0;
    const envelope = buildZoomEnvelope({
        family: timingFamily,
        seed,
        contentDurationMs: candidate.endMs - candidate.startMs,
        contentStartMs: candidate.startMs,
        scaleBoost
    });
    return {
        id: `camera-${candidate.anchorChunkId}`,
        mode: "punch-in-out",
        timingFamily,
        ...envelope,
        panX: 0,
        panY: 0,
        reason: candidate.reason,
        triggerText: candidate.text,
        triggerPatternIds: candidate.patternIds
    };
};
export const buildSemanticCameraTriggerCandidates = (chunks) => {
    const candidateMap = new Map();
    buildCameraTriggerWindows(chunks).forEach((window) => {
        const matchedPatterns = getMatchedPatterns(window);
        const { score, patternIds, reason, anchorIndex } = scoreCameraTriggerWindow({ chunks, window });
        if (score < CAMERA_TRIGGER_MIN_SCORE) {
            return;
        }
        const anchorChunkId = chunks[anchorIndex].id;
        const triggerText = chunks.slice(window.startIndex, anchorIndex + 1).map((chunk) => chunk.text).join(" ");
        const candidate = {
            anchorChunkId,
            startMs: window.startMs,
            endMs: window.endMs,
            score,
            text: triggerText,
            patternIds,
            preferredTimingFamilies: getPreferredTimingFamilies({ chunks, window, matchedPatterns }),
            reason
        };
        const existing = candidateMap.get(anchorChunkId);
        if (!existing || candidate.score > existing.score) {
            candidateMap.set(anchorChunkId, candidate);
        }
    });
    return [...candidateMap.values()].sort((a, b) => b.score - a.score || a.startMs - b.startMs);
};
export const selectSemanticCameraCueMap = (chunks) => {
    const selectedCandidates = [];
    const minuteBuckets = {};
    const targetCueCount = getTargetCameraCueCount(chunks);
    for (const candidate of buildSemanticCameraTriggerCandidates(chunks)) {
        if (selectedCandidates.length >= targetCueCount) {
            break;
        }
        const startBucket = Math.floor(candidate.startMs / 60000);
        if ((minuteBuckets[startBucket] ?? 0) >= MAX_CAMERA_CUES_PER_MINUTE) {
            continue;
        }
        const tooClose = selectedCandidates.some((existingCandidate) => {
            return Math.abs(existingCandidate.startMs - candidate.startMs) < CAMERA_TRIGGER_MIN_GAP_MS;
        });
        if (tooClose) {
            continue;
        }
        selectedCandidates.push(candidate);
        minuteBuckets[startBucket] = (minuteBuckets[startBucket] ?? 0) + 1;
    }
    const selected = new Map();
    let previousFamily;
    selectedCandidates
        .sort((a, b) => a.startMs - b.startMs)
        .forEach((candidate) => {
        const cue = buildCueForCandidate({ candidate, previousFamily });
        selected.set(candidate.anchorChunkId, cue);
        previousFamily = cue.timingFamily;
    });
    return selected;
};
