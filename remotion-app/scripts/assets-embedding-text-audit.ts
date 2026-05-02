import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {loadAssetPipelineConfig} from "../src/lib/assets/config";
import {
  buildCompactAssetEmbeddingText,
  estimateTextTokens,
  getAssetEmbeddingFieldContributions
} from "../src/lib/assets/embedding-text";
import type {NormalizedAssetDocument} from "../src/lib/assets/types";

type LengthStats = {
  count: number;
  minChars: number;
  maxChars: number;
  averageChars: number;
  p50Chars: number;
  p90Chars: number;
  minTokens: number;
  maxTokens: number;
  averageTokens: number;
  p50Tokens: number;
  p90Tokens: number;
};

type RankedAsset = {
  assetId: string;
  filename: string;
  assetType: string;
  chars: number;
  tokenEstimate: number;
  topFields: Array<{field: string; chars: number; preview: string}>;
};

const parseFlag = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
};

const quantile = (values: number[], ratio: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[position] ?? 0;
};

const computeLengthStats = (values: string[]): LengthStats => {
  const charLengths = values.map((value) => value.length);
  const tokenLengths = values.map((value) => estimateTextTokens(value));

  return {
    count: values.length,
    minChars: Math.min(...charLengths),
    maxChars: Math.max(...charLengths),
    averageChars: Number((charLengths.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    p50Chars: quantile(charLengths, 0.5),
    p90Chars: quantile(charLengths, 0.9),
    minTokens: Math.min(...tokenLengths),
    maxTokens: Math.max(...tokenLengths),
    averageTokens: Number((tokenLengths.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    p50Tokens: quantile(tokenLengths, 0.5),
    p90Tokens: quantile(tokenLengths, 0.9)
  };
};

const preview = (value: string, maxChars = 110): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 1)}...`;
};

const main = async (): Promise<void> => {
  const config = loadAssetPipelineConfig();
  const sourcePath = parseFlag("--snapshot") ?? config.ASSET_SCAN_SNAPSHOT_PATH;
  const outputPath = parseFlag("--json-out");
  const documents = JSON.parse(await readFile(sourcePath, "utf8")) as NormalizedAssetDocument[];
  const fullTexts = documents.map((document) => document.embedding_text);
  const compactTexts = documents.map((document) => buildCompactAssetEmbeddingText(document));

  const aggregateFieldChars = new Map<string, number>();
  const aggregateFieldDocs = new Map<string, number>();
  const top20Longest: RankedAsset[] = documents
    .map((document) => {
      const contributions = getAssetEmbeddingFieldContributions(document);
      contributions.forEach((entry) => {
        aggregateFieldChars.set(entry.field, (aggregateFieldChars.get(entry.field) ?? 0) + entry.chars);
        if (entry.chars > 0) {
          aggregateFieldDocs.set(entry.field, (aggregateFieldDocs.get(entry.field) ?? 0) + 1);
        }
      });

      return {
        assetId: document.asset_id,
        filename: document.filename,
        assetType: document.asset_type,
        chars: document.embedding_text.length,
        tokenEstimate: estimateTextTokens(document.embedding_text),
        topFields: contributions.slice(0, 5).map((entry) => ({
          field: entry.field,
          chars: entry.chars,
          preview: preview(entry.value)
        }))
      };
    })
    .sort((left, right) => right.chars - left.chars)
    .slice(0, 20);

  const aggregateFieldBreakdown = [...aggregateFieldChars.entries()]
    .map(([field, chars]) => ({
      field,
      totalChars: chars,
      averageCharsPerDocument: Number((chars / Math.max(1, aggregateFieldDocs.get(field) ?? documents.length)).toFixed(2))
    }))
    .sort((left, right) => right.totalChars - left.totalChars);

  const summary = {
    sourcePath: path.resolve(sourcePath),
    documentCount: documents.length,
    fullTextStats: computeLengthStats(fullTexts),
    compactProjectionStats: computeLengthStats(compactTexts),
    aggregateFieldBreakdown,
    top20Longest
  };

  if (outputPath) {
    const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
    await writeFile(resolvedOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
