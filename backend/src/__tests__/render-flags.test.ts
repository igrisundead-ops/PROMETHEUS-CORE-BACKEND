import {beforeEach, describe, expect, it} from "vitest";

import {clearCachedEnv} from "../config";
import {loadRenderConfig} from "../config/render-flags";

describe("render flags config", () => {
  beforeEach(() => {
    clearCachedEnv();
  });

  it("uses the required default render posture", () => {
    const config = loadRenderConfig({
      PREVIEW_ENGINE: undefined,
      ENABLE_HYPERFRAMES_PREVIEW: undefined,
      ENABLE_LEGACY_OVERLAY: undefined,
      ENABLE_LIVE_BROWSER_OVERLAY: undefined,
      ENABLE_REMOTION_PREVIEW: undefined,
      ENABLE_AUDIO_ONLY_PREVIEW: undefined,
      ENABLE_DARK_AUDIO_PREVIEW: undefined,
      ENABLE_BLACK_PREVIEW_BACKGROUND: undefined,
      ENABLE_MANIFEST_TYPOGRAPHY: undefined,
      ENABLE_FONT_GRAPH: undefined,
      ENABLE_MILVUS_ANIMATION_RETRIEVAL: undefined,
      ENABLE_SERVER_RENDERED_PREVIEW: undefined,
      ENABLE_PREVIEW_DIAGNOSTICS: undefined,
      ENABLE_PREVIEW_PIPELINE_TRACE: undefined
    });

    expect(config.PREVIEW_ENGINE).toBe("hyperframes");
    expect(config.ENABLE_HYPERFRAMES_PREVIEW).toBe(true);
    expect(config.ENABLE_LEGACY_OVERLAY).toBe(false);
    expect(config.ENABLE_LIVE_BROWSER_OVERLAY).toBe(false);
    expect(config.ENABLE_REMOTION_PREVIEW).toBe(false);
    expect(config.ENABLE_AUDIO_ONLY_PREVIEW).toBe(false);
    expect(config.ENABLE_DARK_AUDIO_PREVIEW).toBe(false);
    expect(config.ENABLE_BLACK_PREVIEW_BACKGROUND).toBe(false);
    expect(config.ENABLE_MANIFEST_TYPOGRAPHY).toBe(true);
    expect(config.ENABLE_FONT_GRAPH).toBe(true);
    expect(config.ENABLE_MILVUS_ANIMATION_RETRIEVAL).toBe(true);
    expect(config.ENABLE_SERVER_RENDERED_PREVIEW).toBe(true);
    expect(config.ENABLE_PREVIEW_DIAGNOSTICS).toBe(true);
    expect(config.ENABLE_PREVIEW_PIPELINE_TRACE).toBe(true);
  });

  it("honors explicit overrides", () => {
    const config = loadRenderConfig({
      PREVIEW_ENGINE: "remotion",
      ENABLE_REMOTION_PREVIEW: "true",
      ENABLE_LIVE_BROWSER_OVERLAY: "true"
    });

    expect(config.PREVIEW_ENGINE).toBe("remotion");
    expect(config.ENABLE_REMOTION_PREVIEW).toBe(true);
    expect(config.ENABLE_LIVE_BROWSER_OVERLAY).toBe(true);
  });
});
