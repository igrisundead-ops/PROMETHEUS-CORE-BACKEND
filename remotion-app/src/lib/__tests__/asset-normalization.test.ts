import {describe, expect, it} from "vitest";

import {normalizeDiscoveredAsset} from "../assets/normalization";

describe("asset normalization", () => {
  it("merges Claude schema semantics for structured animation files", () => {
    const document = normalizeDiscoveredAsset({
      absolutePath: "C:/workspace/STRUCTURED ANIMATION/GROWTH animation.html",
      relativePath: "GROWTH animation.html",
      rootDir: "C:/workspace/STRUCTURED ANIMATION",
      rootLabel: "STRUCTURED ANIMATION",
      sourceLibrary: "structured-animation-root",
      folderName: "STRUCTURED ANIMATION",
      parentFolders: [],
      filename: "GROWTH animation.html",
      fileExtension: ".html",
      fileSizeBytes: 1200,
      modifiedTimeMs: 10,
      detectedAssetType: "motion_graphic",
      width: null,
      height: null,
      aspectRatio: null,
      durationSeconds: null
    });

    expect(document.asset_id).toContain("structured-animation");
    expect(document.animation_family).toBe("chart");
    expect(document.tags).toContain("growth");
    expect(document.contexts).toContain("results section");
    expect(document.retrieval_caption.toLowerCase()).toContain("growth");
  });
});
