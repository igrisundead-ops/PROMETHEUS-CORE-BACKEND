import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {loadEnv} from "../src/lib/env";
import {
  normalizeMotionAssetCatalog,
  type MotionAssetSourceRecord
} from "../src/lib/motion-platform/asset-catalog";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "src", "data", "motion-assets.remote.json");

type JsonValue = unknown;

const readJsonIfExists = async <T,>(filePath: string): Promise<T | null> => {
  try {
    const contents = await readFile(filePath, "utf-8");
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const asArray = (value: JsonValue): MotionAssetSourceRecord[] => {
  if (Array.isArray(value)) {
    return value as MotionAssetSourceRecord[];
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, JsonValue>;
  if (Array.isArray(record.assets)) {
    return record.assets as MotionAssetSourceRecord[];
  }
  if (Array.isArray(record.items)) {
    return record.items as MotionAssetSourceRecord[];
  }
  if (Array.isArray(record.data)) {
    return record.data as MotionAssetSourceRecord[];
  }
  if (Array.isArray(record.rows)) {
    return record.rows as MotionAssetSourceRecord[];
  }

  return [];
};

const fetchJson = async (url: string, init?: RequestInit): Promise<JsonValue> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText}) for ${url}`);
  }
  return response.json() as Promise<JsonValue>;
};

const fetchSupabaseAssets = async (): Promise<MotionAssetSourceRecord[]> => {
  const env = loadEnv();
  if (!env.ASSET_BRAIN_ENABLED) {
    return [];
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ASSETS_TABLE) {
    return [];
  }

  const token = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!token) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_ANON_KEY is required when ASSET_BRAIN_ENABLED=true"
    );
  }

  const url = new URL(`/rest/v1/${env.SUPABASE_ASSETS_TABLE}`, env.SUPABASE_URL);
  url.searchParams.set("select", env.SUPABASE_ASSETS_SELECT || "*");
  url.searchParams.set("limit", String(env.SUPABASE_ASSETS_SCAN_LIMIT || 200));

  const rows = await fetchJson(url.toString(), {
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  return asArray(rows);
};

const fetchDriveAssets = async (): Promise<MotionAssetSourceRecord[]> => {
  const env = loadEnv();
  if (!env.ASSET_BRAIN_ENABLED || !env.MOTION_ASSET_MANIFEST_URL) {
    return [];
  }

  const payload = await fetchJson(env.MOTION_ASSET_MANIFEST_URL, {
    headers: {
      Accept: "application/json"
    }
  });

  return asArray(payload);
};

const run = async (): Promise<void> => {
  const env = loadEnv();
  await mkdir(path.dirname(OUTPUT_PATH), {recursive: true});

  const existingCache = (await readJsonIfExists<MotionAssetSourceRecord[]>(OUTPUT_PATH)) ?? [];

  const [supabaseAssets, driveAssets] = await Promise.all([
    fetchSupabaseAssets().catch((error) => {
      console.warn(`Supabase asset sync skipped: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
    fetchDriveAssets().catch((error) => {
      console.warn(`Drive asset sync skipped: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    })
  ]);

  const normalized = normalizeMotionAssetCatalog([
    ...existingCache,
    ...supabaseAssets.map((asset) => ({...asset, source: "supabase" as const})),
    ...driveAssets.map((asset) => ({...asset, source: "drive" as const}))
  ]);

  await writeJson(OUTPUT_PATH, normalized);

  console.log(`Motion asset cache updated at ${OUTPUT_PATH}`);
  console.log(`Remote gating: ${env.ASSET_BRAIN_ENABLED ? "enabled" : "disabled"}`);
  console.log(`Supabase rows: ${supabaseAssets.length}`);
  console.log(`Drive rows: ${driveAssets.length}`);
  console.log(`Total normalized assets: ${normalized.length}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
