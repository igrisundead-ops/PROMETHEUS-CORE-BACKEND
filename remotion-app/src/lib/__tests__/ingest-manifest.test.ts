import {describe, expect, it} from "vitest";

import {
  buildVersionedPublicAssetUrl,
  getPublicAssetPathFromOutput,
  isIngestManifestReady,
  resolveIngestDisplayLabel
} from "../ingest-manifest";

describe("ingest manifest helpers", () => {
  it("extracts public asset names from absolute output paths", () => {
    expect(getPublicAssetPathFromOutput("C:\\repo\\public\\input-video-landscape.mp4")).toBe("input-video-landscape.mp4");
  });

  it("builds versioned public asset urls for preview cache busting", () => {
    expect(buildVersionedPublicAssetUrl({
      assetPath: "C:\\repo\\public\\input-video-landscape.preview.mp4",
      version: "abc123"
    })).toBe("/input-video-landscape.preview.mp4?v=abc123");
  });

  it("reports manifest readiness and display labels safely", () => {
    expect(isIngestManifestReady({syncState: "ready"})).toBe(true);
    expect(resolveIngestDisplayLabel({
      description: "",
      sourceVideoPath: "C:\\videos\\example.mp4"
    })).toBe("example.mp4");
  });
});
