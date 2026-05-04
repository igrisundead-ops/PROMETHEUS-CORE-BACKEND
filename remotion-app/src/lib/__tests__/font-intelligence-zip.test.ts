import os from "node:os";
import path from "node:path";
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";

import {zipSync} from "fflate";
import {afterEach, describe, expect, it} from "vitest";

import {safeExtractFontZips} from "../font-intelligence/zip";

describe("font zip extraction", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, {recursive: true, force: true})));
  });

  it("safely extracts only valid font entries and blocks traversal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "font-zip-"));
    tempDirs.push(root);
    const sourceDir = path.join(root, "source");
    const extractedDir = path.join(root, "font-intelligence", "extracted-fonts");
    await mkdir(sourceDir, {recursive: true});

    const zipBuffer = Buffer.from(zipSync({
      "fonts/Test Display.otf": new Uint8Array([1, 2, 3]),
      "../escape.ttf": new Uint8Array([9, 9, 9]),
      "__MACOSX/ghost.otf": new Uint8Array([4]),
      "thumbs.db": new Uint8Array([5]),
      "notes/readme.txt": new Uint8Array([6])
    }));
    await writeFile(path.join(sourceDir, "bundle.zip"), zipBuffer);

    const result = await safeExtractFontZips({
      sourceZipDir: sourceDir,
      extractedFontsDir: extractedDir
    });

    expect(result.report.scannedZipCount).toBe(1);
    expect(result.report.canonicalFontCount).toBe(1);
    expect(result.candidates.filter((candidate) => candidate.duplicateOfHash === null)).toHaveLength(1);
    expect(result.report.failures.some((failure) => failure.entryName === "../escape.ttf")).toBe(true);
  });

  it("deduplicates identical font binaries across zip files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "font-zip-dedupe-"));
    tempDirs.push(root);
    const sourceDir = path.join(root, "source");
    const extractedDir = path.join(root, "font-intelligence", "extracted-fonts");
    await mkdir(sourceDir, {recursive: true});

    const bytes = new Uint8Array([7, 7, 7, 7]);
    await writeFile(path.join(sourceDir, "a.zip"), Buffer.from(zipSync({"A.otf": bytes})));
    await writeFile(path.join(sourceDir, "b.zip"), Buffer.from(zipSync({"B.otf": bytes})));

    const result = await safeExtractFontZips({
      sourceZipDir: sourceDir,
      extractedFontsDir: extractedDir
    });

    expect(result.report.canonicalFontCount).toBe(1);
    expect(result.report.duplicatesSkipped).toBe(1);
    expect(result.candidates.filter((candidate) => candidate.duplicateOfHash === null)).toHaveLength(1);
  });
});
