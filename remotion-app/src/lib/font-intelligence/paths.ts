import path from "node:path";

import type {FontPipelinePaths} from "./types";

export const resolveFontPipelinePaths = (workspaceDir?: string, sourceZipDir?: string): FontPipelinePaths => {
  const repoRoot = path.resolve(process.cwd(), "..");
  const resolvedWorkspaceDir = workspaceDir ? path.resolve(process.cwd(), workspaceDir) : path.join(repoRoot, "font-intelligence");
  const resolvedSourceZipDir = sourceZipDir ? path.resolve(process.cwd(), sourceZipDir) : path.join(repoRoot, "FONTS");
  const outputsDir = path.join(resolvedWorkspaceDir, "outputs");

  return {
    repoRoot,
    workspaceDir: resolvedWorkspaceDir,
    rawZipsDir: path.join(resolvedWorkspaceDir, "raw-zips"),
    sourceZipDir: resolvedSourceZipDir,
    extractedFontsDir: path.join(resolvedWorkspaceDir, "extracted-fonts"),
    specimensDir: path.join(resolvedWorkspaceDir, "specimens"),
    outputsDir,
    fontManifestPath: path.join(outputsDir, "font-manifest.json"),
    fontDescriptorsPath: path.join(outputsDir, "font-descriptors.jsonl"),
    fontEmbeddingsPath: path.join(outputsDir, "font-embeddings.jsonl"),
    fontIngestionReportPath: path.join(outputsDir, "font-ingestion-report.json"),
    fontCompatibilityGraphPath: path.join(outputsDir, "font-compatibility-graph.json")
  };
};
