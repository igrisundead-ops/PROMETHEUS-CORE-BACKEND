import {afterEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

describe("backend startup", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)));
  });

  it("starts and serves health when Milvus-backed retrieval is disabled", async () => {
    const storageDir = await makeTempDir();
    tempDirs.push(storageDir);

    const appContext = await createTestApp({
      storageDir,
      envOverrides: {
        ASSET_MILVUS_ENABLED: "false"
      }
    });

    try {
      const response = await appContext.app.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ok: true});
    } finally {
      await appContext.app.close();
    }
  });
});
