import {describe, expect, it} from "vitest";

import {resolveInteractivePreviewSurface} from "../CreativeAudioLivePlayer";
import {
  resolveDevLivePreviewLaunchFromSearch,
  resolvePreviewShellConfig,
  resolvePreviewShellVariant,
  resolveLivePreviewRendererFromSearch
} from "../PreviewApp";

describe("preview routing", () => {
  it("defaults the web preview shell to the remotion lane", () => {
    const renderer = resolveLivePreviewRendererFromSearch("");
    expect(renderer).toBe("remotion");
    expect(resolveLivePreviewRendererFromSearch("?previewLane=unknown")).toBe("remotion");
    expect(resolvePreviewShellVariant(renderer)).toBe("remotion-only");
  });

  it("uses the remotion-only shell by default without hyperframes setup labels", () => {
    const config = resolvePreviewShellConfig(resolveLivePreviewRendererFromSearch(""));

    expect(config.variant).toBe("remotion-only");
    expect(config.showDeliveryModePicker).toBe(false);
    expect(config.showRendererComparison).toBe(false);
    expect(config.showPreviewDownloads).toBe(false);
    expect(config.showPipelinePanel).toBe(false);
    expect(config.setupHeading).toBe("Remotion Preview Setup");
    expect(config.setupModeLabels).toEqual([]);
    expect(config.headerKicker).toBe("Remotion Preview");
  });

  it("keeps the remotion shell on standby when no sourcePath query is provided", () => {
    expect(resolveDevLivePreviewLaunchFromSearch("")).toBeNull();
    expect(resolveDevLivePreviewLaunchFromSearch("?motionTier=hero")).toBeNull();
  });

  it("maps a sourcePath query into the remotion live-preview launch inputs", () => {
    expect(
      resolveDevLivePreviewLaunchFromSearch(
        "?sourcePath=C%3A%5Cclips%5Creal-video.mp4&captionProfileId=longform_svg_typography_v1&motionTier=premium"
      )
    ).toEqual({
      sourcePath: "C:\\clips\\real-video.mp4",
      captionProfileId: "longform_svg_typography_v1",
      motionTier: "premium"
    });
  });

  it("keeps the explicit hyperframes query lane available", () => {
    const renderer = resolveLivePreviewRendererFromSearch("?previewLane=hyperframes");
    const config = resolvePreviewShellConfig(renderer);

    expect(renderer).toBe("hyperframes");
    expect(resolvePreviewShellVariant(renderer)).toBe("hyperframes-shell");
    expect(config.showDeliveryModePicker).toBe(true);
    expect(config.showRendererComparison).toBe(true);
    expect(config.setupModeLabels).toContain("Hyperframes Preview");
    expect(config.setupModeLabels).toContain("Final Render");
  });

  it("resolves the explicit remotion query lane to the remotion-only player shell", () => {
    const renderer = resolveLivePreviewRendererFromSearch("?previewLane=remotion");
    const config = resolvePreviewShellConfig(renderer);

    expect(renderer).toBe("remotion");
    expect(resolvePreviewShellVariant(renderer)).toBe("remotion-only");
    expect(config.showDeliveryModePicker).toBe(false);
    expect(config.setupModeLabels).toEqual([]);
    expect(
      resolveLivePreviewRendererFromSearch("?sourcePath=C%3A%5Cclips%5Creal-video.mp4&motionTier=hero")
    ).toBe("remotion");
    expect(resolveInteractivePreviewSurface({
      previewRenderer: "remotion",
      canRenderArtifact: true,
      canRenderNativeVideoStage: true,
      shouldUseDisplayGod: false
    })).toBe("remotion-player");
  });

  it("keeps remotion sourcePath bootstrap on the remotion-only shell", () => {
    const renderer = resolveLivePreviewRendererFromSearch(
      "?previewLane=remotion&sourcePath=C%3A%5Cclips%5Creal-video.mp4&motionTier=premium&captionProfileId=longform_svg_typography_v1"
    );

    expect(resolvePreviewShellVariant(renderer)).toBe("remotion-only");
    expect(
      resolveDevLivePreviewLaunchFromSearch(
        "?previewLane=remotion&sourcePath=C%3A%5Cclips%5Creal-video.mp4&motionTier=premium&captionProfileId=longform_svg_typography_v1"
      )
    ).toEqual({
      sourcePath: "C:\\clips\\real-video.mp4",
      captionProfileId: "longform_svg_typography_v1",
      motionTier: "premium"
    });
  });
});
