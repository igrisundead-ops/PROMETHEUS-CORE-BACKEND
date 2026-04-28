import { describe, expect, it } from "vitest";
import { resolveMotionAssets } from "../motion-platform/asset-manifests";
import { gradeProfiles } from "../motion-platform/grade-profiles";
import { resolveMatteManifest, shouldUseMatte } from "../motion-platform/matte-manifests";
import { buildMotionCompositionModel, buildMotionSceneSpecs, selectActiveCameraCueAtTime, selectActiveMotionSceneAtTime } from "../motion-platform/scene-engine";
import { getTransitionPresetsForTier, resolveTransitionPreset } from "../motion-platform/transition-presets";
const makeChunk = (partial) => ({
    id: partial.id ?? "chunk-1",
    text: partial.text ?? "Allow people",
    startMs: partial.startMs ?? 0,
    endMs: partial.endMs ?? 900,
    words: partial.words ?? [],
    styleKey: partial.styleKey ?? "svg_typography_v1:cinematic_text_preset",
    motionKey: partial.motionKey ?? "svg_typography_v1:cinematic_text_preset",
    layoutVariant: partial.layoutVariant ?? "inline",
    emphasisWordIndices: partial.emphasisWordIndices ?? [],
    profileId: partial.profileId ?? "svg_typography_v1",
    semantic: partial.semantic ?? {
        intent: "default",
        nameSpans: [],
        isVariation: false,
        suppressDefault: false
    },
    suppressDefault: partial.suppressDefault ?? false
});
describe("motion platform", () => {
    it("resolves local assets by tier and mood", () => {
        const assets = resolveMotionAssets({
            tier: "premium",
            moodTags: ["warm", "authority"],
            safeArea: "avoid-caption-region"
        });
        expect(assets.length).toBeGreaterThanOrEqual(4);
        expect(assets.some((asset) => asset.id === "premium-halo-field")).toBe(true);
        expect(assets.every((asset) => asset.src.startsWith("motion-assets/"))).toBe(true);
    });
    it("prefers text-matched minimalist assets when query terms are available", () => {
        const library = [
            {
                id: "minimal-frame-generic",
                family: "frame",
                tier: "minimal",
                src: "motion-assets/minimal-frame-generic.svg",
                alphaMode: "straight",
                placementZone: "edge-frame",
                durationPolicy: "scene-span",
                themeTags: ["neutral", "calm"],
                searchTerms: ["frame", "border", "neutral"],
                safeArea: "avoid-caption-region",
                loopable: true,
                blendMode: "screen",
                opacity: 0.6
            },
            {
                id: "minimal-camera-outline",
                family: "frame",
                tier: "minimal",
                src: "motion-assets/minimal-camera-outline.svg",
                alphaMode: "straight",
                placementZone: "edge-frame",
                durationPolicy: "scene-span",
                themeTags: ["neutral", "calm"],
                searchTerms: ["camera", "lens", "shot"],
                safeArea: "avoid-caption-region",
                loopable: true,
                blendMode: "screen",
                opacity: 0.6
            }
        ];
        const assets = resolveMotionAssets({
            tier: "minimal",
            moodTags: ["calm"],
            safeArea: "avoid-caption-region",
            families: ["frame"],
            queryText: "camera shot",
            library
        });
        expect(assets[0].id).toBe("minimal-camera-outline");
    });
    it("builds scene specs with resolved transitions and asset ids", () => {
        const chunks = [
            makeChunk({ id: "chunk-a", text: "Allow people", startMs: 0, endMs: 700 }),
            makeChunk({ id: "chunk-b", text: "Experience you", startMs: 720, endMs: 1500 })
        ];
        const scenes = buildMotionSceneSpecs({
            chunks,
            tier: "editorial",
            fps: 30,
            gradeProfileId: "cool-editorial"
        });
        expect(scenes).toHaveLength(2);
        expect(scenes[0].assetIds.length).toBeGreaterThan(0);
        expect(scenes[0].transitionInPreset.tier).toBe("editorial");
        expect(scenes[0].gradeProfile).toBe("cool-editorial");
    });
    it("creates composition models for every tier without breaking caption linkage", () => {
        const chunks = [
            makeChunk({ id: "chunk-a", startMs: 0, endMs: 900 }),
            makeChunk({ id: "chunk-b", startMs: 960, endMs: 1800, semantic: {
                    intent: "name-callout",
                    nameSpans: [],
                    isVariation: false,
                    suppressDefault: false
                } })
        ];
        for (const tier of ["minimal", "editorial", "premium", "hero"]) {
            const model = buildMotionCompositionModel({
                chunks,
                tier,
                fps: 30,
                gradeProfileId: tier === "editorial" ? "cool-editorial" : undefined
            });
            expect(model.scenes).toHaveLength(chunks.length);
            expect(model.captionMode).toBe("existing-profile");
            expect(gradeProfiles[model.gradeProfile.id]).toBeDefined();
        }
    });
    it("keeps hero matte disabled when cached foreground is unavailable", () => {
        const manifest = resolveMatteManifest("female-coach-rvm");
        expect(manifest?.status).toBe("missing");
        const enabled = shouldUseMatte({
            mode: "auto",
            tier: "hero",
            manifest
        });
        expect(enabled).toBe(false);
    });
    it("selects one active scene at a time across transition windows", () => {
        const chunks = [
            makeChunk({ id: "chunk-a", startMs: 0, endMs: 900 }),
            makeChunk({ id: "chunk-b", startMs: 860, endMs: 1600 })
        ];
        const scenes = buildMotionSceneSpecs({
            chunks,
            tier: "minimal",
            fps: 30
        });
        const selected = selectActiveMotionSceneAtTime({
            scenes,
            currentTimeMs: 920,
            fps: 30
        });
        expect(selected?.sourceChunkId).toBe("chunk-b");
    });
    it("exposes tier-compatible transition presets", () => {
        const premiumPresets = getTransitionPresetsForTier("premium");
        const premiumIds = premiumPresets.map((preset) => preset.id);
        expect(premiumIds).toContain("premium-layered-sweep");
        expect(resolveTransitionPreset("hero-subject-wipe").captionCompatibility.allowForegroundCross).toBe(true);
    });
    it("keeps caption-safe transition opacity caps low for protected presets", () => {
        const protectedPresets = getTransitionPresetsForTier("hero")
            .filter((preset) => preset.captionCompatibility.protectSafeZone);
        expect(protectedPresets.length).toBeGreaterThan(0);
        protectedPresets.forEach((preset) => {
            expect(preset.captionCompatibility.safeZoneOpacityCap).toBeLessThanOrEqual(0.16);
        });
    });
    it("assigns at most two centered camera punch cues with a safe zoom ceiling", () => {
        const chunks = [
            makeChunk({
                id: "cue-a",
                text: "Experience you.",
                startMs: 1000,
                endMs: 2050,
                words: [{ text: "Experience", startMs: 1000, endMs: 1500 }, { text: "you.", startMs: 1500, endMs: 2050 }],
                emphasisWordIndices: [0],
                semantic: { intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false }
            }),
            makeChunk({
                id: "cue-b",
                text: "Listen attentively.",
                startMs: 10400,
                endMs: 11320,
                words: [{ text: "Listen", startMs: 10400, endMs: 10850 }, { text: "attentively.", startMs: 10850, endMs: 11320 }],
                emphasisWordIndices: [1],
                semantic: { intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false }
            }),
            makeChunk({
                id: "cue-c",
                text: "All right?",
                startMs: 18000,
                endMs: 18400,
                words: [{ text: "All", startMs: 18000, endMs: 18200 }, { text: "right?", startMs: 18200, endMs: 18400 }],
                emphasisWordIndices: [1],
                semantic: { intent: "punch-emphasis", nameSpans: [], isVariation: true, suppressDefault: true }
            })
        ];
        const scenes = buildMotionSceneSpecs({
            chunks,
            tier: "minimal",
            fps: 30
        });
        const cues = scenes.map((scene) => scene.cameraCue).filter((cue) => cue);
        expect(cues.length).toBeLessThanOrEqual(2);
        expect(cues.length).toBe(2);
        cues.forEach((cue) => {
            expect(cue.peakScale).toBeLessThanOrEqual(1.2);
            expect(cue.panX).toBe(0);
            expect(cue.panY).toBe(0);
            expect(["assertive", "glide", "linger", "reveal"]).toContain(cue.timingFamily);
            expect(cue.endMs - cue.startMs).toBeGreaterThanOrEqual(1800);
            expect(cue.endMs - cue.startMs).toBeLessThanOrEqual(3000);
            expect(cue.zoomInMs + cue.holdMs + cue.zoomOutMs).toBe(cue.endMs - cue.startMs);
        });
        expect(cues[0]?.timingFamily).not.toBe(cues[1]?.timingFamily);
    });
    it("exposes the active camera cue only while the zoom envelope is running", () => {
        const scenes = buildMotionSceneSpecs({
            chunks: [
                makeChunk({
                    id: "cue-a",
                    text: "Experience you.",
                    startMs: 1000,
                    endMs: 2050,
                    words: [{ text: "Experience", startMs: 1000, endMs: 1500 }, { text: "you.", startMs: 1500, endMs: 2050 }],
                    emphasisWordIndices: [0],
                    semantic: { intent: "punch-emphasis", nameSpans: [], isVariation: false, suppressDefault: false }
                })
            ],
            tier: "minimal",
            fps: 30
        });
        const cue = scenes[0].cameraCue;
        expect(cue).toBeTruthy();
        expect(selectActiveCameraCueAtTime({ scenes, currentTimeMs: cue.peakStartMs })).toEqual(cue);
        expect(selectActiveCameraCueAtTime({ scenes, currentTimeMs: cue.endMs + 10 })).toBeNull();
    });
});
