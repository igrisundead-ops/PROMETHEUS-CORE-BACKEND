import {describe, expect, it} from "vitest";

import {
  buildViralClipJobPayload,
  formatViralClipStageLabel,
  getBackendViralClipApiUrl,
  isTerminalViralClipStage,
  normalizeBackendTranscriptWords,
  viralClipSelectionSchema
} from "../backend-viral-clips";

describe("backend viral clips client", () => {
  it("maps transcript words to backend snake_case payload fields", () => {
    const payload = normalizeBackendTranscriptWords([
      {
        text: "Hook",
        startMs: 120,
        endMs: 480,
        confidence: 0.98
      }
    ]);

    expect(payload).toEqual([
      {
        text: "Hook",
        start_ms: 120,
        end_ms: 480,
        confidence: 0.98
      }
    ]);
  });

  it("fills the backend job payload with safe defaults", () => {
    const payload = buildViralClipJobPayload({
      projectId: "proj_1",
      videoId: "vid_1",
      targetPlatform: "shorts",
      providedTranscript: [
        {
          text: "This should become a clip.",
          startMs: 0,
          endMs: 1000
        }
      ]
    });

    expect(payload.clipCountMin).toBe(2);
    expect(payload.clipCountMax).toBe(4);
    expect(payload.assets).toEqual([]);
    expect(payload.metadataOverrides).toEqual({});
    expect(payload.providedTranscript?.[0]).toEqual({
      text: "This should become a clip.",
      start_ms: 0,
      end_ms: 1000
    });
  });

  it("builds backend urls and exposes readable stage labels", () => {
    expect(getBackendViralClipApiUrl("/api/jobs/job_1")).toBe(
      "http://localhost:8000/api/jobs/job_1"
    );
    expect(formatViralClipStageLabel("llm_scoring")).toBe("LLM scoring");
    expect(isTerminalViralClipStage("completed")).toBe(true);
    expect(isTerminalViralClipStage("ranking")).toBe(false);
  });

  it("preserves portrait focus hints from backend clip results", () => {
    const selection = viralClipSelectionSchema.parse({
      job_id: "job_1",
      plan_version: "1.0.0",
      source_summary: {
        transcript_available: true,
        transcript_source: "provided",
        target_platform: "shorts",
        creator_niche: "creator",
        requested_clip_count_min: 2,
        requested_clip_count_max: 4,
        candidate_count: 1,
        selected_count: 1
      },
      window_config: [],
      scoring_weights: {
        hook: 0.22,
        clarity: 0.18,
        payoff: 0.18,
        emotion: 0.12,
        shareability: 0.12,
        curiosity: 0.08,
        clip_cleanliness: 0.06,
        platform_fit: 0.04
      },
      candidate_segments: [],
      selected_clips: [
        {
          clip_id: "clip_1",
          window_label: "tight_hook",
          start_ms: 0,
          end_ms: 16000,
          duration_ms: 16000,
          transcript_excerpt: "Most creators make one mistake.",
          leading_context: "",
          trailing_context: "Here's why it matters.",
          scores: {
            hook: 8,
            clarity: 7.5,
            payoff: 7.2,
            emotion: 6.1,
            shareability: 7.8,
            curiosity: 7.4,
            clip_cleanliness: 7.1,
            platform_fit: 8.8
          },
          heuristic_signals: {
            opening_question: false,
            strong_hook_phrase: true,
            contrast_phrase: false,
            emotional_phrase: false,
            quoteable_sentence: true,
            context_dependency_penalty: false,
            clean_start_boundary: true,
            clean_end_boundary: true,
            matched_keywords: ["most_people"],
            emphasis_words: ["mistake"]
          },
          final_score: 7.65,
          ranking_notes: ["Strong opening tension lands quickly."],
          recommended_start_adjustment_ms: -900,
          recommended_end_adjustment_ms: 1200,
          rank: 1,
          export_start_ms: 0,
          export_end_ms: 17200,
          export_duration_ms: 17200,
          virality_score: 7.65,
          reason_selected: "Strong opening tension lands quickly.",
          hook_line: "Most creators make one mistake.",
          suggested_title: "Most creators make one mistake",
          suggested_caption: "Most creators make one mistake. Strong opening tension lands quickly.",
          punch_in_moments_ms: [2500, 11000],
          subtitle_emphasis_words: ["mistake"],
          portrait_focus: {
            mode: "speaker_head",
            aspect_ratio: "9:16",
            focus_x_pct: 50,
            focus_y_pct: 34,
            confidence: 0.65,
            reference_label: "speaker head",
            rationale: "Speaker-head framing keeps the portrait crop centered without extra tracking dependencies."
          }
        }
      ],
      warnings: []
    });

    expect(selection.selected_clips[0].portrait_focus?.mode).toBe("speaker_head");
    expect(selection.selected_clips[0].portrait_focus?.focus_y_pct).toBe(34);
  });
});
