import {mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {createBackendApp, type BackendAppContext} from "../app";
import type {BackendDependencies} from "../app";

export const makeTempDir = async (): Promise<string> => {
  return mkdtemp(path.join(os.tmpdir(), "video-backend-"));
};

export const cleanupTempDir = async (dir: string): Promise<void> => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(dir, {recursive: true, force: true});
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  throw lastError;
};

export const createTempFile = async ({
  dir,
  fileName,
  contents
}: {
  dir: string;
  fileName: string;
  contents: string | Buffer;
}): Promise<string> => {
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, contents);
  return filePath;
};

export const createTestApp = async ({
  storageDir,
  envOverrides,
  deps
}: {
  storageDir: string;
  envOverrides?: Partial<NodeJS.ProcessEnv>;
  deps?: BackendDependencies;
}): Promise<BackendAppContext> => {
  return createBackendApp({
    storageDir,
    envOverrides: {
      ASSEMBLYAI_API_KEY: "",
      GROQ_API_KEY: "",
      ASSET_MILVUS_ENABLED: "false",
      ...envOverrides
    },
    deps
  });
};

export const buildMultipartBody = (
  parts: Array<{
    name: string;
    value: string | Buffer;
    filename?: string;
    contentType?: string;
  }>
): {body: Buffer; contentType: string} => {
  const boundary = `----codex-${Date.now().toString(16)}`;
  const buffers: Buffer[] = [];

  for (const part of parts) {
    buffers.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename) {
      buffers.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
        )
      );
      buffers.push(
        Buffer.from(`Content-Type: ${part.contentType ?? "application/octet-stream"}\r\n\r\n`)
      );
      buffers.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
      buffers.push(Buffer.from("\r\n"));
      continue;
    }

    buffers.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
    buffers.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    buffers.push(Buffer.from("\r\n"));
  }

  buffers.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(buffers),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
};
