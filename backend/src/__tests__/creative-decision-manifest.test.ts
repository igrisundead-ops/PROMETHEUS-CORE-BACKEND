import {readFile} from "node:fs/promises";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {creativeDecisionManifestSchema} from "../contracts/creative-decision-manifest";

const fixturePath = path.join(process.cwd(), "src", "__tests__", "fixtures", "creative-decision-manifest.fixture.json");

describe("creativeDecisionManifestSchema", () => {
  it("parses the canonical fixture", async () => {
    const raw = await readFile(fixturePath, "utf8");
    const parsed = creativeDecisionManifestSchema.parse(JSON.parse(raw));
    expect(parsed.jobId).toBe("job_123");
    expect(parsed.typography.fontPairing.graphUsed).toBe(true);
    expect(parsed.animation.engine).toBe("gsap");
  });

  it("fails when required top-level fields are missing", async () => {
    const raw = await readFile(fixturePath, "utf8");
    const payload = JSON.parse(raw) as Record<string, unknown>;
    delete payload.manifestVersion;
    delete payload.typography;
    expect(() => creativeDecisionManifestSchema.parse(payload)).toThrowError();
  });
});
