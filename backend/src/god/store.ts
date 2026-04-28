import path from "node:path";
import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";

import type {GodGeneratedAssetRecord} from "./types";

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
};

export type GodStorePaths = {
  rootDir: string;
  reviewRootDir: string;
  collectionDir: string;
  collectionManifestPath: string;
  ledgerPath: string;
};

export class GodStore {
  public readonly paths: GodStorePaths;

  public constructor(paths: GodStorePaths) {
    this.paths = paths;
  }

  public async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.paths.rootDir, {recursive: true}),
      mkdir(this.paths.reviewRootDir, {recursive: true}),
      mkdir(this.paths.collectionDir, {recursive: true}),
      mkdir(path.dirname(this.paths.collectionManifestPath), {recursive: true}),
      mkdir(path.dirname(this.paths.ledgerPath), {recursive: true})
    ]);
  }

  public reviewDir(reviewId: string): string {
    return path.join(this.paths.reviewRootDir, reviewId);
  }

  public reviewRecordPath(reviewId: string): string {
    return path.join(this.reviewDir(reviewId), "review.json");
  }

  public reviewAssetDir(reviewId: string): string {
    return path.join(this.reviewDir(reviewId), "asset");
  }

  public permanentAssetDir(assetId: string): string {
    return path.join(this.paths.collectionDir, assetId);
  }

  public permanentManifestPath(): string {
    return this.paths.collectionManifestPath;
  }

  public async writeReviewRecord(record: GodGeneratedAssetRecord): Promise<GodGeneratedAssetRecord> {
    await writeJson(this.reviewRecordPath(record.reviewId), record);
    return record;
  }

  public async readReviewRecord(reviewId: string): Promise<GodGeneratedAssetRecord | null> {
    return readJson<GodGeneratedAssetRecord>(this.reviewRecordPath(reviewId));
  }

  public async listReviewRecords(): Promise<GodGeneratedAssetRecord[]> {
    try {
      const directories = await readdir(this.paths.reviewRootDir, {withFileTypes: true});
      const records = await Promise.all(
        directories
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => this.readReviewRecord(entry.name))
      );
      return records.filter((record): record is GodGeneratedAssetRecord => Boolean(record));
    } catch {
      return [];
    }
  }

  public async updateReviewRecord(
    reviewId: string,
    updater: (current: GodGeneratedAssetRecord) => GodGeneratedAssetRecord
  ): Promise<GodGeneratedAssetRecord> {
    const current = await this.readReviewRecord(reviewId);
    if (!current) {
      throw new Error(`God review ${reviewId} was not found.`);
    }
    const next = updater(current);
    await this.writeReviewRecord(next);
    return next;
  }

  public async appendLedger(entry: Record<string, unknown>): Promise<string> {
    await mkdir(path.dirname(this.paths.ledgerPath), {recursive: true});
    await writeFile(this.paths.ledgerPath, `${JSON.stringify(entry)}\n`, {encoding: "utf-8", flag: "a"});
    return this.paths.ledgerPath;
  }

  public async readApprovedCatalog(): Promise<Record<string, unknown>[]> {
    const catalog = await readJson<Record<string, unknown>[]>(this.paths.collectionManifestPath);
    return Array.isArray(catalog) ? catalog : [];
  }

  public async writeApprovedCatalog(catalog: Record<string, unknown>[]): Promise<string> {
    await writeJson(this.paths.collectionManifestPath, catalog);
    return this.paths.collectionManifestPath;
  }

  public async upsertApprovedAsset(manifest: Record<string, unknown>): Promise<string> {
    const catalog = await this.readApprovedCatalog();
    const next = [...catalog.filter((entry) => entry.id !== manifest.id), manifest];
    await this.writeApprovedCatalog(next);
    return this.paths.collectionManifestPath;
  }
}

