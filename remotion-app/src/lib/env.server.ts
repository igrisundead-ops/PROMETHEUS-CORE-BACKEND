import {config as loadDotenv} from "dotenv";
import path from "node:path";

import {assertSupabaseDisabled, parseEnv} from "./env";
import type {AppEnv} from "./types";

let cachedEnv: AppEnv | null = null;

export const loadEnv = (): AppEnv => {
  if (cachedEnv) {
    return cachedEnv;
  }

  loadDotenv();
  loadDotenv({
    path: path.resolve(process.cwd(), "..", ".env")
  });
  loadDotenv({
    path: path.resolve(process.cwd(), ".env.local"),
    override: true
  });
  loadDotenv({
    path: path.resolve(process.cwd(), "..", ".env.local"),
    override: true
  });
  cachedEnv = parseEnv(process.env);
  return cachedEnv;
};

export {assertSupabaseDisabled};
