import {mkdtemp, mkdir, readFile, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {runAnimationPrototypeIndex, scanAnimationPrototypeDirectory} from "../../../scripts/animation-prototype-index";

const writeHtml = async (filePath: string, body: string): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, body, "utf-8");
};

describe("animation prototype index scanner", () => {
  it("normalizes filenames with spaces, parentheses, and mixed casing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "animation-prototype-index-"));

    await writeHtml(
      path.join(root, "CORE replaceable word (syllabic break for core words).html"),
      `<!doctype html><html><body><div data-replaceable="true"><span data-part="serif">under</span><span data-part="sans">stand</span></div></body></html>`
    );
    await writeHtml(
      path.join(root, "Graph Widget.HTML"),
      `<!doctype html><html><body><canvas id="graph"></canvas></body></html>`
    );
    await writeHtml(
      path.join(root, "Nested Folder", "Card Animation, Two Image Section.HTML"),
      `<!doctype html><html><body><div class="card"></div></body></html>`
    );

    const records = await scanAnimationPrototypeDirectory(root);
    const byId = new Map(records.map((record) => [record.id, record]));

    expect(records).toHaveLength(3);
    expect(byId.get("core-replaceable-word")?.category).toBe("emphasis");
    expect(byId.get("core-replaceable-word")?.triggerType).toEqual(expect.arrayContaining(["word-level", "syllable-level"]));
    expect(byId.get("graph-widget")?.category).toBe("template-graphic");
    expect(byId.get("graph-widget")?.compatibleWith).toEqual(expect.arrayContaining(["template-family:graph-chart"]));
    expect(byId.get("card-animation-two-image-section")?.category).toBe("bubble-card");
    expect(byId.get("card-animation-two-image-section")?.relativePath).toBe("Nested Folder/Card Animation, Two Image Section.HTML");
  });

  it("promotes repeated modular structured-animation layouts into cinematic complete coverage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "animation-prototype-cinematic-"));

    await writeHtml(
      path.join(root, "four steps really cool animation(place text yourself).html"),
      `<!doctype html><html><body>
        <div class="notebook"><div class="spiral-loop"></div></div>
        <div class="notebook"><div class="spiral-loop"></div></div>
        <div class="notebook"><div class="spiral-loop"></div></div>
        <div class="notebook"><div class="spiral-loop"></div></div>
      </body></html>`
    );

    const records = await scanAnimationPrototypeDirectory(root);
    const record = records[0];

    expect(record?.functionalTags).toEqual(expect.arrayContaining(["cinematic", "premium", "editorial"]));
    expect(record?.coverageStatus).toBe("complete");
    expect(record?.metadataConfidence ?? 0).toBeGreaterThanOrEqual(0.82);
  });

  it("writes a coverage audit with unsupported and tagged file counts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "animation-prototype-audit-"));
    const catalogPath = path.join(root, "catalog.json");
    const coveragePath = path.join(root, "coverage.json");

    await writeHtml(
      path.join(root, "growth animation.html"),
      `<!doctype html><html><body><div data-region="growth-bars"><span data-region="growth-label">Growth</span></div></body></html>`
    );
    await writeFile(path.join(root, "notes.txt"), "not a supported prototype", "utf-8");

    const records = await runAnimationPrototypeIndex({
      sourceRoot: root,
      outputPath: catalogPath,
      coverageOutputPath: coveragePath
    });
    const coverage = JSON.parse(await readFile(coveragePath, "utf-8")) as {
      supportedFiles: number;
      unsupportedFiles: number;
      unsupportedFileTypes: Record<string, number>;
      flaggedForReviewCount: number;
      records: Array<{relativePath: string; coverageStatus: string; metadataConfidence: number | null; structuralRegionCount: number}>;
    };

    expect(records).toHaveLength(1);
    expect(coverage.supportedFiles).toBe(1);
    expect(coverage.unsupportedFiles).toBe(1);
    expect(coverage.unsupportedFileTypes[".txt"]).toBe(1);
    expect(coverage.records.find((record) => record.relativePath === "growth animation.html")?.structuralRegionCount).toBeGreaterThan(0);
    expect(coverage.records.find((record) => record.relativePath === "growth animation.html")?.coverageStatus).not.toBe("untagged");
    expect(coverage.flaggedForReviewCount).toBeGreaterThanOrEqual(0);
  });
});
