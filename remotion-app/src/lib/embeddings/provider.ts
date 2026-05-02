import {spawn, type ChildProcessWithoutNullStreams} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sha256Text} from "../hash";

export type EmbeddingProviderKind = "openai" | "local-test" | "local-hf" | "bge-m3-local";

export type EmbeddingProvider = {
  provider: EmbeddingProviderKind;
  model: string;
  dimensions: number;
  embedTexts(texts: string[]): Promise<number[][]>;
  dispose?(): Promise<void>;
};

export type LocalEmbeddingWorkerEvent =
  | {
      kind: "launch";
      provider: EmbeddingProviderKind;
      model: string;
      pythonBin: string;
      scriptPath: string;
      batchSize: number;
    }
  | {
      kind: "ready";
      provider: EmbeddingProviderKind;
      model: string;
      runtime: string;
      processId: number | null;
      pythonBin: string;
      scriptPath: string;
      batchSize: number;
      timings: {
        startupMs?: number;
        modelLoadMs?: number;
        serializationMs?: number;
      };
    }
  | {
      kind: "request-complete";
      provider: EmbeddingProviderKind;
      model: string;
      textCount: number;
      timings: {
        inputParseMs?: number;
        encodeMs?: number;
        outputPrepMs?: number;
        serializationMs?: number;
        totalMs?: number;
      };
    };

export type EmbeddingProviderConfig = {
  provider: EmbeddingProviderKind;
  model: string;
  dimensions: number;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  pythonBin?: string;
  scriptPath?: string;
  useFp16?: boolean;
  localBatchSize?: number;
  onLocalEvent?: (event: LocalEmbeddingWorkerEvent) => void;
};

const buildDeterministicVector = (text: string, dimensions: number): number[] => {
  const vector = new Array<number>(dimensions);
  for (let index = 0; index < dimensions; index += 1) {
    const digest = sha256Text(`${text}|${index}`);
    const sample = Number.parseInt(digest.slice(0, 8), 16);
    vector[index] = ((sample % 2000) / 1000) - 1;
  }
  return vector;
};

const createLocalTestEmbeddingProvider = (config: EmbeddingProviderConfig): EmbeddingProvider => ({
  provider: "local-test",
  model: config.model,
  dimensions: config.dimensions,
  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map((text) => buildDeterministicVector(text, config.dimensions));
  },
  async dispose(): Promise<void> {
    // No-op.
  }
});

const createOpenAiEmbeddingProvider = (config: EmbeddingProviderConfig): EmbeddingProvider => ({
  provider: "openai",
  model: config.model,
  dimensions: config.dimensions,
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!config.apiKey) {
      throw new Error("An embedding API key is required when provider=openai.");
    }

    const response = await (config.fetchImpl ?? fetch)(
      `${(config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "")}/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
          dimensions: config.dimensions
        })
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Embedding request failed (${response.status} ${response.statusText}): ${body}`);
    }

    const payload = await response.json() as {
      data?: Array<{embedding?: number[]}>;
    };
    const embeddings = payload.data?.map((entry) => entry.embedding ?? []) ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, received ${embeddings.length}.`);
    }

    return embeddings;
  },
  async dispose(): Promise<void> {
    // No-op.
  }
});

const providerDir = path.dirname(fileURLToPath(import.meta.url));
const defaultLocalHfScriptPath = path.resolve(providerDir, "..", "..", "..", "scripts", "local_hf_embedder.py");
const defaultBgeM3ScriptPath = path.resolve(providerDir, "..", "..", "..", "scripts", "bge_m3_embedder.py");
const buildLocalEmbeddingSpawnOptions = (config: EmbeddingProviderConfig): {
  pythonBin: string;
  scriptPath: string;
  model: string;
  useFp16: boolean;
  batchSize: number;
} => {
  const pythonBin = config.pythonBin ?? "python";
  const scriptPath = config.scriptPath ?? (config.provider === "bge-m3-local" ? defaultBgeM3ScriptPath : defaultLocalHfScriptPath);
  return {
    pythonBin,
    scriptPath,
    model: config.model,
    useFp16: config.useFp16 ?? false,
    batchSize: Math.max(1, config.localBatchSize ?? 16)
  };
};

type LocalWorkerReadyPayload = {
  type: "ready";
  model?: string;
  runtime?: string;
  process_id?: number;
  timings?: {
    startup_ms?: number;
    model_load_ms?: number;
    serialization_ms?: number;
  };
};

type LocalWorkerResponsePayload = {
  id?: string;
  embeddings?: number[][];
  error?: string;
  text_count?: number;
  timings?: {
    input_parse_ms?: number;
    encode_ms?: number;
    output_prep_ms?: number;
    serialization_ms?: number;
    total_ms?: number;
  };
};

type PendingLocalEmbeddingRequest = {
  resolve: (embeddings: number[][]) => void;
  reject: (error: Error) => void;
};

const formatTimingMs = (value: number | undefined): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${value.toFixed(1)}ms`;
};

class LocalEmbeddingWorker {
  private readonly spawnConfig: ReturnType<typeof buildLocalEmbeddingSpawnOptions>;
  private readonly pending = new Map<string, PendingLocalEmbeddingRequest>();
  private readonly launchedAt = Date.now();
  private readonly readyPromise: Promise<void>;
  private readonly child: ChildProcessWithoutNullStreams;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private ready = false;
  private settleReady: ((error?: Error) => void) | null = null;

  constructor(private readonly config: EmbeddingProviderConfig) {
    this.spawnConfig = buildLocalEmbeddingSpawnOptions(config);
    this.config.onLocalEvent?.({
      kind: "launch",
      provider: config.provider,
      model: this.spawnConfig.model,
      pythonBin: this.spawnConfig.pythonBin,
      scriptPath: this.spawnConfig.scriptPath,
      batchSize: this.spawnConfig.batchSize
    });
    console.log(
      `[embeddings:local] Launching worker provider=${config.provider} model=${this.spawnConfig.model} ` +
      `python=${this.spawnConfig.pythonBin} script=${this.spawnConfig.scriptPath} batchSize=${this.spawnConfig.batchSize}.`
    );

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.settleReady = (error?: Error) => {
        if (!this.settleReady) {
          return;
        }
        this.settleReady = null;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };
    });

    this.child = spawn(
      this.spawnConfig.pythonBin,
      [
        "-u",
        this.spawnConfig.scriptPath,
        "--model-name",
        this.spawnConfig.model,
        "--use-fp16",
        this.spawnConfig.useFp16 ? "true" : "false",
        "--batch-size",
        String(this.spawnConfig.batchSize)
      ],
      {
        stdio: "pipe",
        env: {
          ...process.env,
          PYTHONUTF8: process.env.PYTHONUTF8 ?? "1",
          TOKENIZERS_PARALLELISM: process.env.TOKENIZERS_PARALLELISM ?? "false",
          HF_HUB_DISABLE_XET: process.env.HF_HUB_DISABLE_XET ?? "1",
          HF_HUB_OFFLINE: process.env.HF_HUB_OFFLINE ?? "1",
          TRANSFORMERS_OFFLINE: process.env.TRANSFORMERS_OFFLINE ?? "1",
          HF_HUB_DISABLE_SYMLINKS_WARNING: process.env.HF_HUB_DISABLE_SYMLINKS_WARNING ?? "1"
        }
      }
    );

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.stdoutBuffer += chunk;
      this.flushStdoutLines();
    });
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
    });
    this.child.on("error", (error) => {
      this.failAllPending(error instanceof Error ? error : new Error(String(error)));
    });
    this.child.on("exit", (code, signal) => {
      const detail = this.stderrBuffer.trim();
      const message =
        `Local embedding worker exited${code !== null ? ` with code ${code}` : ""}` +
        `${signal ? ` (signal: ${signal})` : ""}${detail ? `: ${detail}` : ""}`;
      this.failAllPending(new Error(message));
    });

    const dispose = (): void => {
      if (!this.child.killed) {
        this.child.kill();
      }
    };
    process.once("exit", dispose);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    await this.readyPromise;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<number[][]>((resolve, reject) => {
      this.pending.set(requestId, {resolve, reject});
      this.child.stdin.write(`${JSON.stringify({id: requestId, texts})}\n`, "utf8", (error) => {
        if (!error) {
          return;
        }
        this.pending.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  async dispose(): Promise<void> {
    this.failAllPending(new Error("Local embedding worker disposed before all requests completed."));
    if (this.child.killed) {
      return;
    }

    this.child.stdin.end();
    this.child.kill();
  }

  private flushStdoutLines(): void {
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      try {
        this.handleWorkerPayload(JSON.parse(line) as LocalWorkerReadyPayload | LocalWorkerResponsePayload | {
          type?: string;
          error?: string;
        });
      } catch (error) {
        this.failAllPending(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private handleWorkerPayload(
    payload: LocalWorkerReadyPayload | LocalWorkerResponsePayload | {type?: string; error?: string}
  ): void {
    if ("type" in payload && payload.type === "ready") {
      const readyPayload = payload as LocalWorkerReadyPayload;
      this.ready = true;
      this.settleReady?.();
      this.config.onLocalEvent?.({
        kind: "ready",
        provider: this.config.provider,
        model: readyPayload.model ?? this.spawnConfig.model,
        runtime: readyPayload.runtime ?? "unknown",
        processId: readyPayload.process_id ?? null,
        pythonBin: this.spawnConfig.pythonBin,
        scriptPath: this.spawnConfig.scriptPath,
        batchSize: this.spawnConfig.batchSize,
        timings: {
          startupMs: readyPayload.timings?.startup_ms,
          modelLoadMs: readyPayload.timings?.model_load_ms,
          serializationMs: readyPayload.timings?.serialization_ms
        }
      });
      console.log(
        `[embeddings:local] Worker ready provider=${this.config.provider} model=${readyPayload.model ?? this.spawnConfig.model} ` +
        `runtime=${readyPayload.runtime ?? "unknown"} pid=${readyPayload.process_id ?? "n/a"} ` +
        `startup=${formatTimingMs(readyPayload.timings?.startup_ms)} load=${formatTimingMs(readyPayload.timings?.model_load_ms)} ` +
        `serialize=${formatTimingMs(readyPayload.timings?.serialization_ms)} wall=${formatTimingMs(Date.now() - this.launchedAt)}.`
      );
      return;
    }

    if ("type" in payload && payload.type === "error") {
      this.failAllPending(new Error(payload.error ?? "Local embedding worker failed during startup."));
      return;
    }

    const requestId = "id" in payload ? payload.id : undefined;
    if (!requestId) {
      return;
    }

    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(requestId);

    if ("error" in payload && payload.error) {
      pending.reject(new Error(payload.error));
      return;
    }

    const responsePayload = payload as LocalWorkerResponsePayload;
    this.config.onLocalEvent?.({
      kind: "request-complete",
      provider: this.config.provider,
      model: this.spawnConfig.model,
      textCount: responsePayload.text_count ?? responsePayload.embeddings?.length ?? 0,
      timings: {
        inputParseMs: responsePayload.timings?.input_parse_ms,
        encodeMs: responsePayload.timings?.encode_ms,
        outputPrepMs: responsePayload.timings?.output_prep_ms,
        serializationMs: responsePayload.timings?.serialization_ms,
        totalMs: responsePayload.timings?.total_ms
      }
    });
    console.log(
      `[embeddings:local] Request complete provider=${this.config.provider} model=${this.spawnConfig.model} ` +
      `texts=${responsePayload.text_count ?? responsePayload.embeddings?.length ?? 0} parse=${formatTimingMs(responsePayload.timings?.input_parse_ms)} ` +
      `encode=${formatTimingMs(responsePayload.timings?.encode_ms)} prep=${formatTimingMs(responsePayload.timings?.output_prep_ms)} ` +
      `serialize=${formatTimingMs(responsePayload.timings?.serialization_ms)} total=${formatTimingMs(responsePayload.timings?.total_ms)}.`
    );
    pending.resolve(responsePayload.embeddings ?? []);
  }

  private failAllPending(error: Error): void {
    this.settleReady?.(error);
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

const createLocalHfEmbeddingProvider = (config: EmbeddingProviderConfig): EmbeddingProvider => {
  let worker: LocalEmbeddingWorker | null = null;

    return {
      provider: config.provider,
      model: config.model,
      dimensions: config.dimensions,
      async embedTexts(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) {
        return [];
      }

        worker ??= new LocalEmbeddingWorker(config);
        return worker.embedTexts(texts);
      },
      async dispose(): Promise<void> {
        if (!worker) {
          return;
        }

        await worker.dispose();
        worker = null;
      }
    };
};

export const createEmbeddingProvider = (config: EmbeddingProviderConfig): EmbeddingProvider => {
  if (config.provider === "local-test") {
    return createLocalTestEmbeddingProvider(config);
  }

  if (config.provider === "local-hf" || config.provider === "bge-m3-local") {
    return createLocalHfEmbeddingProvider(config);
  }

  return createOpenAiEmbeddingProvider(config);
};
