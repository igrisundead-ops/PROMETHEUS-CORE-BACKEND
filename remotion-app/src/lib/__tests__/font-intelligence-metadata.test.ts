import os from "node:os";
import path from "node:path";
import {mkdtemp, rm, writeFile} from "node:fs/promises";

import {afterEach, describe, expect, it} from "vitest";

import {loadFontPipelineConfig} from "../font-intelligence/config";
import {loadObservedFontMetadata} from "../font-intelligence/metadata";

describe("font metadata fallback", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, {recursive: true, force: true})));
  });

  it("falls back to filename-derived metadata when the probe cannot parse the font", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "font-meta-"));
    tempDirs.push(root);
    const fontPath = path.join(root, "Inter-BlackItalic.otf");
    await writeFile(fontPath, Buffer.from([0, 1, 2]));
    const config = loadFontPipelineConfig({
      FONT_INTELLIGENCE_SOURCE_ZIP_DIR: root,
      FONT_INTELLIGENCE_WORKSPACE_DIR: path.join(root, "workspace")
    });

    const [result] = await loadObservedFontMetadata({
      config,
      candidates: [
        {
          sourceZipPath: path.join(root, "bundle.zip"),
          sourceZipFilename: "bundle.zip",
          entryName: "Inter-BlackItalic.otf",
          relativePath: "Inter-BlackItalic.otf",
          absolutePath: fontPath,
          extension: ".otf",
          contentHash: "abc123",
          duplicateOfHash: null,
          duplicateSourceZips: []
        }
      ],
      runner: async () => []
    });

    expect(result.status).toBe("fallback");
    expect(result.observed.familyName).toContain("Inter");
    expect(result.observed.weightClass).toBe(900);
    expect(result.observed.italic).toBe(true);
  });
});
