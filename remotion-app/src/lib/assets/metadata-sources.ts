import claudeSchemaMapping from "../../data/claude-schema-mapping.generated.json" with {type: "json"};
import godMotionAssetCache from "../../data/god-assets.generated.json" with {type: "json"};
import authoringMotionAssetCache from "../../data/motion-assets.authoring.generated.json" with {type: "json"};
import remoteMotionAssetCache from "../../data/motion-assets.remote.json" with {type: "json"};
import showcaseAssetCache from "../../data/showcase-assets.remote.json" with {type: "json"};
import type {MotionAssetManifest} from "../types";

import type {AssetDiscoveryRecord} from "./types";
import {buildSearchTerms, normalizeAssetText, splitDelimitedText, tokenizeAssetText, uniqueStrings} from "./text-utils";

type SchemaMappingRow = {
  asset_id?: string;
  filename?: string;
  html_title?: string;
  name_semantic_prior?: string;
  object_type?: string;
  family?: string;
  literal_tags?: string;
  intent_tags?: string;
  contexts?: string;
  anti_contexts?: string;
  constraints?: string;
  retrieval_caption?: string;
  semantic_confidence?: string;
};

type MetadataMatch = {
  labels: string[];
  tags: string[];
  contexts: string[];
  antiContexts: string[];
  constraints: string[];
  retrievalCaption: string;
  semanticDescription: string;
  animationFamily: string;
  subject: string;
  category: string;
  dominantRole: string;
  confidence: number;
  sourceReferences: string[];
};

type ManifestMatchSeed = {
  id?: string;
  canonicalLabel?: string;
  sourceFile?: string;
  sourceHtml?: string;
  searchTerms?: string[];
  semanticTags?: string[];
  functionalTags?: string[];
  subjectTags?: string[];
  graphTags?: string[];
  sourceBatch?: string;
  family?: string;
  templateGraphicCategory?: string | null;
  metadataConfidence?: number;
};

const schemaRows = claudeSchemaMapping as SchemaMappingRow[];
const catalogSeeds = [
  ...(authoringMotionAssetCache as MotionAssetManifest[]),
  ...(remoteMotionAssetCache as MotionAssetManifest[]),
  ...(showcaseAssetCache as MotionAssetManifest[]),
  ...(godMotionAssetCache as MotionAssetManifest[])
] as ManifestMatchSeed[];

const toNormalizedFilename = (value: string): string => normalizeAssetText(value).replace(/\s+/g, " ");

const pickCompetitiveMatches = <T,>(
  entries: Array<{value: T; score: number}>,
  {
    minScore,
    strongScore,
    strongWithin,
    defaultWithin,
    maxCount
  }: {
    minScore: number;
    strongScore: number;
    strongWithin: number;
    defaultWithin: number;
    maxCount: number;
  }
): T[] => {
  const filtered = entries
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score);

  if (filtered.length === 0) {
    return [];
  }

  const bestScore = filtered[0]!.score;
  const within = bestScore >= strongScore ? strongWithin : defaultWithin;
  return filtered
    .filter((entry) => entry.score >= Math.max(minScore, bestScore - within))
    .slice(0, maxCount)
    .map((entry) => entry.value);
};

const schemaScore = (record: AssetDiscoveryRecord, row: SchemaMappingRow): number => {
  const filename = toNormalizedFilename(record.filename);
  const filenameStem = toNormalizedFilename(record.filename.replace(record.fileExtension, ""));
  const candidateFilename = toNormalizedFilename(row.filename ?? "");
  const queryTerms = new Set([
    ...tokenizeAssetText(record.filename),
    ...record.parentFolders.flatMap((folder) => tokenizeAssetText(folder))
  ]);

  let score = 0;
  if (candidateFilename && filename === candidateFilename) {
    score += 120;
  }
  if (candidateFilename && filenameStem === toNormalizedFilename(candidateFilename.replace(/\.[a-z0-9]+$/i, ""))) {
    score += 42;
  }
  if (toNormalizedFilename(row.html_title ?? "") === filenameStem) {
    score += 34;
  }
  tokenizeAssetText(row.asset_id ?? "").forEach((token) => {
    if (queryTerms.has(token)) {
      score += 10;
    }
  });
  [
    row.name_semantic_prior,
    row.object_type,
    row.family,
    row.retrieval_caption,
    row.literal_tags,
    row.intent_tags,
    row.contexts
  ].forEach((value) => {
    tokenizeAssetText(String(value ?? "")).forEach((token) => {
      if (queryTerms.has(token)) {
        score += 6;
      }
    });
  });

  return score;
};

const manifestScore = (record: AssetDiscoveryRecord, manifest: ManifestMatchSeed): number => {
  const relativePath = normalizeAssetText(record.relativePath);
  const fileName = normalizeAssetText(record.filename);
  const fileStem = normalizeAssetText(record.filename.replace(record.fileExtension, ""));
  const sourceFile = normalizeAssetText(manifest.sourceFile ?? manifest.sourceHtml ?? "");
  const sourceBatch = normalizeAssetText(manifest.sourceBatch ?? "");
  const queryTerms = new Set([
    ...tokenizeAssetText(record.rootLabel),
    ...tokenizeAssetText(record.filename),
    ...record.parentFolders.flatMap((folder) => tokenizeAssetText(folder))
  ]);
  let score = 0;

  if (sourceFile && (relativePath.endsWith(sourceFile) || fileName === normalizeAssetText(sourceFile.split("/").pop() ?? ""))) {
    score += 132;
  }
  if (sourceFile && fileStem === normalizeAssetText((sourceFile.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, ""))) {
    score += 34;
  }
  if (sourceBatch) {
    let batchHits = 0;
    tokenizeAssetText(sourceBatch).forEach((token) => {
      if (queryTerms.has(token)) {
        batchHits += 1;
      }
    });
    score += batchHits * 12;
  }
  tokenizeAssetText(manifest.id ?? "").forEach((token) => {
    if (queryTerms.has(token)) {
      score += 10;
    }
  });
  tokenizeAssetText(manifest.canonicalLabel ?? "").forEach((token) => {
    if (queryTerms.has(token)) {
      score += 12;
    }
  });
  [
    ...(manifest.searchTerms ?? []),
    ...(manifest.semanticTags ?? []),
    ...(manifest.functionalTags ?? []),
    ...(manifest.subjectTags ?? []),
    ...(manifest.graphTags ?? [])
  ].forEach((value) => {
    tokenizeAssetText(value).forEach((token) => {
      if (queryTerms.has(token)) {
        score += 4;
      }
    });
  });

  return score;
};

export const resolveMetadataMatches = (record: AssetDiscoveryRecord): MetadataMatch => {
  const bestSchemaRows = pickCompetitiveMatches(
    schemaRows.map((row) => ({value: row, score: schemaScore(record, row)})),
    {
      minScore: 30,
      strongScore: 110,
      strongWithin: 24,
      defaultWithin: 10,
      maxCount: 3
    }
  );

  const bestCatalogMatches = pickCompetitiveMatches(
    catalogSeeds.map((seed) => ({value: seed, score: manifestScore(record, seed)})),
    {
      minScore: 34,
      strongScore: 110,
      strongWithin: 18,
      defaultWithin: 8,
      maxCount: 2
    }
  );

  const folderLabel = record.parentFolders[record.parentFolders.length - 1] ?? record.folderName;
  const labels = uniqueStrings([
    ...bestCatalogMatches.map((seed) => seed.canonicalLabel ?? seed.id ?? ""),
    ...bestSchemaRows.flatMap((row) => [row.html_title, row.name_semantic_prior, row.object_type]),
    folderLabel,
    record.filename.replace(record.fileExtension, "")
  ]);
  const constraints = uniqueStrings(bestSchemaRows.flatMap((row) => splitDelimitedText(row.constraints)));
  const tags = uniqueStrings([
    ...bestCatalogMatches.flatMap((seed) => [
      ...(seed.searchTerms ?? []),
      ...(seed.semanticTags ?? []),
      ...(seed.functionalTags ?? []),
      ...(seed.subjectTags ?? []),
      ...(seed.graphTags ?? [])
    ]),
    ...bestSchemaRows.flatMap((row) => [
      ...splitDelimitedText(row.literal_tags),
      ...splitDelimitedText(row.intent_tags),
      ...splitDelimitedText(row.constraints)
    ]),
    ...record.parentFolders
  ]);
  const contexts = uniqueStrings(bestSchemaRows.flatMap((row) => splitDelimitedText(row.contexts)));
  const antiContexts = uniqueStrings(bestSchemaRows.flatMap((row) => splitDelimitedText(row.anti_contexts)));
  const retrievalCaption = uniqueStrings(bestSchemaRows.map((row) => row.retrieval_caption ?? ""))[0] ??
    `${labels[0] ?? record.filename} retrieved from ${folderLabel}.`;
  const semanticDescription = uniqueStrings([
    ...bestSchemaRows.map((row) => row.name_semantic_prior ?? row.html_title ?? ""),
    ...bestCatalogMatches.map((seed) => seed.canonicalLabel ?? seed.id ?? ""),
    folderLabel
  ]).join(", ");
  const animationFamily = uniqueStrings([
    ...bestSchemaRows.map((row) => row.family ?? ""),
    ...bestCatalogMatches.map((seed) => seed.family ?? seed.templateGraphicCategory ?? ""),
    record.detectedAssetType
  ])[0] ?? "support";
  const subject = uniqueStrings([
    ...bestCatalogMatches.flatMap((seed) => seed.subjectTags ?? []),
    folderLabel
  ])[0] ?? folderLabel;
  const category = uniqueStrings([
    ...bestSchemaRows.map((row) => row.object_type ?? row.family ?? ""),
    ...bestCatalogMatches.map((seed) => seed.templateGraphicCategory ?? seed.family ?? ""),
    record.detectedAssetType
  ])[0] ?? record.detectedAssetType;
  const dominantRole = uniqueStrings([
    ...bestCatalogMatches.flatMap((seed) => seed.functionalTags ?? []),
    ...bestSchemaRows.map((row) => row.object_type ?? ""),
    record.detectedAssetType
  ])[0] ?? record.detectedAssetType;
  const confidenceCandidates = [
    ...bestSchemaRows.map((row) => Number.parseFloat(row.semantic_confidence ?? "0") || 0),
    ...bestCatalogMatches.map((seed) => Number(seed.metadataConfidence ?? 0) || 0)
  ];

  return {
    labels,
    tags: uniqueStrings([
      ...tags,
      ...buildSearchTerms(record.filename, record.folderName)
    ]),
    contexts,
    antiContexts,
    constraints,
    retrievalCaption,
    semanticDescription,
    animationFamily,
    subject,
    category,
    dominantRole,
    confidence: confidenceCandidates.length > 0
      ? Math.max(...confidenceCandidates.filter((value) => Number.isFinite(value)))
      : 0.56,
    sourceReferences: uniqueStrings([
      ...bestSchemaRows.map((row) => `schema:${row.asset_id ?? row.filename ?? "unknown"}`),
      ...bestCatalogMatches.map((seed) => `catalog:${seed.id ?? seed.canonicalLabel ?? "unknown"}`)
    ])
  };
};
