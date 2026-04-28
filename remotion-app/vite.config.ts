import type {IncomingMessage, ServerResponse} from "node:http";

import react from "@vitejs/plugin-react";
import {defineConfig, type Plugin} from "vite";

type DraftPreviewServiceModule = typeof import("./scripts/draft-preview-longform");

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const sendJson = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  response.statusCode = statusCode;
  Object.entries(jsonHeaders).forEach(([key, value]) => response.setHeader(key, value));
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
};

let draftPreviewServicePromise: Promise<DraftPreviewServiceModule> | null = null;

const getDraftPreviewService = (): Promise<DraftPreviewServiceModule> => {
  if (!draftPreviewServicePromise) {
    // Native config loading should only touch the draft preview service in dev server mode.
    // @ts-expect-error Native config loading needs the explicit extension for this dev-only service import.
    draftPreviewServicePromise = import("./scripts/draft-preview-longform.ts");
  }

  return draftPreviewServicePromise;
};

const draftPreviewApiPlugin = (): Plugin => {
  let activeRenderPromise: Promise<void> | null = null;

  return {
    name: "draft-preview-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url ? new URL(request.url, "http://localhost").pathname : "";
        if (!pathname.startsWith("/api/draft-preview")) {
          next();
          return;
        }

        try {
          if (pathname === "/api/draft-preview/status" && request.method === "GET") {
            const {getLongformDraftPreviewStatus} = await getDraftPreviewService();
            sendJson(response, 200, await getLongformDraftPreviewStatus());
            return;
          }

          if (pathname === "/api/draft-preview/render" && request.method === "POST") {
            const body = await readJsonBody(request);
            const {getLongformDraftPreviewStatus, renderLongformDraftPreview} = await getDraftPreviewService();

            if (!activeRenderPromise) {
              activeRenderPromise = renderLongformDraftPreview({
                request: body,
                force: body.force === true
              })
                .then(() => undefined)
                .catch(() => undefined)
                .finally(() => {
                  activeRenderPromise = null;
                });
            }

            sendJson(response, 202, await getLongformDraftPreviewStatus());
            return;
          }

          sendJson(response, 404, {
            error: "Unknown draft preview endpoint."
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(response, 500, {
            error: message
          });
        }
      });
    }
  };
};

export default defineConfig({
  define: {
    "import.meta.env.VITE_DISPLAY_GOD_PREVIEW": JSON.stringify(
      process.env.VITE_DISPLAY_GOD_PREVIEW ?? process.env.DISPLAY_GOD_PREVIEW ?? ""
    )
  },
  plugins: [draftPreviewApiPlugin(), react()],
  server: {
    host: "0.0.0.0",
    port: 3101,
    strictPort: true
  },
  preview: {
    host: "0.0.0.0",
    port: 4101,
    strictPort: true
  }
});
