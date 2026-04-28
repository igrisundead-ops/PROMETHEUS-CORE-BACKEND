import {describe, expect, it} from "vitest";

import {
  isLikelyAudioFileLike,
  isLikelyVideoFileLike,
  planAudioPreviewSource,
  resolveAudioPreviewUrl,
  resolveEditSessionSourceUrl
} from "../../web-preview/audio-preview-source";

describe("audio preview source planning", () => {
  it("keeps true audio uploads on the direct browser path", () => {
    expect(isLikelyAudioFileLike({name: "preview.m4a", type: "audio/mp4"})).toBe(true);

    expect(planAudioPreviewSource({
      sourceAudioSrc: "blob:audio-preview",
      sourceFile: {
        name: "preview.m4a",
        type: "audio/mp4"
      }
    })).toEqual({
      kind: "direct",
      src: "blob:audio-preview"
    });
  });

  it("routes video containers through backend extraction before preview", () => {
    expect(isLikelyVideoFileLike({name: "speaker.mp4", type: "video/mp4"})).toBe(true);

    expect(planAudioPreviewSource({
      sourceAudioSrc: "blob:video-preview",
      sourceFile: {
        name: "speaker.mp4",
        type: "video/mp4"
      }
    })).toEqual({
      kind: "backend",
      sourceFile: {
        name: "speaker.mp4",
        type: "video/mp4"
      },
      sourcePath: null
    });
  });

  it("routes local paths through the backend audio preview endpoint", () => {
    expect(planAudioPreviewSource({
      sourcePath: "C:\\\\clips\\\\episode.mp4"
    })).toEqual({
      kind: "backend",
      sourcePath: "C:\\\\clips\\\\episode.mp4"
    });
  });

  it("normalizes backend audio preview urls against the API base", () => {
    expect(resolveAudioPreviewUrl("http://127.0.0.1:8000/", "/api/local-preview/audio-preview/abc"))
      .toBe("http://127.0.0.1:8000/api/local-preview/audio-preview/abc");
    expect(resolveAudioPreviewUrl("http://127.0.0.1:8000", "https://cdn.example/audio.m4a"))
      .toBe("https://cdn.example/audio.m4a");
  });

  it("resolves the edit session source route for native video playback", () => {
    expect(resolveEditSessionSourceUrl("http://127.0.0.1:8000/", "session-123"))
      .toBe("http://127.0.0.1:8000/api/edit-sessions/session-123/source");
  });
});
