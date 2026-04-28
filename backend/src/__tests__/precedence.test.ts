import {describe, expect, it} from "vitest";

import type {NormalizedJobRequest} from "../schemas";
import {synthesizeMetadataProfile, type SourceAnalysis, type TranscriptResolution} from "../pipeline";

describe("metadata precedence", () => {
  it("prefers explicit overrides over prompt, asset, media, and system defaults", () => {
    const request: NormalizedJobRequest = {
      job_id: "job_precedence",
      prompt: "Make this cinematic for YouTube Shorts.",
      source_media_ref: undefined,
      input_source_video: null,
      input_assets: [
        {
          asset_id: "asset_1",
          role: "asset",
          original_name: "hero.png",
          stored_path: "/tmp/hero.png",
          mime_type: "image/png",
          label: "Abraham Lincoln",
          size_bytes: 10
        }
      ],
      descriptor_assets: [],
      metadata_overrides: {
        typography: {
          caption_style_profile: "longform_svg_typography_v1"
        },
        user_intent: {
          target_platform: "youtube"
        }
      },
      provided_transcript: undefined
    };

    const analysis: SourceAnalysis = {
      source_path: null,
      source_exists: false,
      source_filename: null,
      source_storage_uri: null,
      source_filesize_bytes: null,
      probe: {
        width: 1080,
        height: 1920,
        fps: 30,
        duration_seconds: 12,
        duration_in_frames: 360
      },
      warnings: [],
      fallback_events: [],
      source_file_hash: null
    };

    const transcript: TranscriptResolution = {
      words: [],
      source: "missing",
      warnings: [],
      fallback_events: []
    };

    const result = synthesizeMetadataProfile({
      request,
      analysis,
      transcript,
      deps: {}
    });

    expect(result.profile.typography.caption_style_profile).toBe("longform_svg_typography_v1");
    expect(result.profile.field_source_map["typography.caption_style_profile"]).toBe("user_explicit");
    expect(result.profile.user_intent.target_platform).toBe("youtube");
    expect(result.profile.field_source_map["user_intent.target_platform"]).toBe("user_explicit");
  });
});
