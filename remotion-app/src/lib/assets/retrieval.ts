import {backendFetchJson} from "../backend-api";

import {getUnifiedAssetDocuments} from "./catalog";
import {toCreativeAsset, toMotionAssetManifest} from "./runtime-catalog";
import {toAssetSearchResult} from "./reranking";
import type {AssetSearchRequest, AssetSearchResponse, AssetSearchResult, NormalizedAssetDocument} from "./types";
import {normalizeAssetText} from "./text-utils";

type BackendAssetRetrievalResult = Omit<AssetSearchResult, "motion_asset" | "creative_asset">;
type BackendAssetRetrievalResponse = {
  backend: "milvus";
  query: string;
  totalCandidates: number;
  results: BackendAssetRetrievalResult[];
  warnings: string[];
};

const snapshotDocuments = getUnifiedAssetDocuments();
const snapshotDocumentMap = new Map(snapshotDocuments.map((document) => [document.asset_id, document]));
const snapshotDocumentsByAssetType = snapshotDocuments.reduce((index, document) => {
  const current = index.get(document.asset_type) ?? [];
  current.push(document);
  index.set(document.asset_type, current);
  return index;
}, new Map<string, NormalizedAssetDocument[]>());
const snapshotSearchCache = new Map<string, AssetSearchResponse>();

const hydrateResult = (result: AssetSearchResult, documents: Map<string, NormalizedAssetDocument>): AssetSearchResult => {
  const document = documents.get(result.asset_id);
  if (!document) {
    return result;
  }

  return {
    ...result,
    motion_asset: toMotionAssetManifest(document),
    creative_asset: toCreativeAsset(document)
  };
};

const matchesAssetTypeConstraint = (document: NormalizedAssetDocument, request: AssetSearchRequest): boolean => {
  if (request.desiredAssetTypes && request.desiredAssetTypes.length > 0 && !request.desiredAssetTypes.includes(document.asset_type)) {
    return false;
  }
  if (request.sourceLibraries && request.sourceLibraries.length > 0 && !request.sourceLibraries.includes(document.source_library)) {
    return false;
  }
  if (request.requireAnimated && !document.extension_is_animated) {
    return false;
  }
  if (request.requireStatic && document.extension_is_animated) {
    return false;
  }
  return true;
};

const buildSnapshotSearchCacheKey = (request: AssetSearchRequest): string => {
  return JSON.stringify({
    queryText: request.queryText,
    sceneIntent: request.sceneIntent ?? null,
    contexts: request.contexts ?? [],
    antiContexts: request.antiContexts ?? [],
    compositionHints: request.compositionHints ?? [],
    constraints: request.constraints ?? [],
    desiredAssetTypes: request.desiredAssetTypes ?? [],
    sourceLibraries: request.sourceLibraries ?? [],
    requireAnimated: request.requireAnimated ?? false,
    requireStatic: request.requireStatic ?? false,
    positionRole: request.positionRole ?? null,
    motionLevel: request.motionLevel ?? null,
    mood: request.mood ?? [],
    limit: request.limit ?? 8
  });
};

const cloneSnapshotResponse = (response: AssetSearchResponse): AssetSearchResponse => {
  return {
    ...response,
    results: [...response.results],
    warnings: [...response.warnings]
  };
};

const getSnapshotCandidateDocuments = (request: AssetSearchRequest): NormalizedAssetDocument[] => {
  const typeFilteredDocuments = request.desiredAssetTypes && request.desiredAssetTypes.length > 0
    ? request.desiredAssetTypes.flatMap((assetType) => snapshotDocumentsByAssetType.get(assetType) ?? [])
    : snapshotDocuments;

  return typeFilteredDocuments.filter((document) => matchesAssetTypeConstraint(document, request));
};

export const searchUnifiedAssetSnapshot = (request: AssetSearchRequest): AssetSearchResponse => {
  const cacheKey = buildSnapshotSearchCacheKey(request);
  const cached = snapshotSearchCache.get(cacheKey);
  if (cached) {
    return cloneSnapshotResponse(cached);
  }

  const filteredDocuments = getSnapshotCandidateDocuments(request).map((document) => {
    const vectorSeed = normalizeAssetText(`${request.queryText} ${request.sceneIntent ?? ""}`).includes(normalizeAssetText(document.category))
      ? 0.22
      : 0;
    return toAssetSearchResult({
      document,
      request,
      vectorScore: vectorSeed
    });
  });
  const results = filteredDocuments
    .sort((a, b) => b.score - a.score || a.asset_id.localeCompare(b.asset_id))
    .slice(0, request.limit ?? 8);

  const response: AssetSearchResponse = {
    backend: "snapshot",
    query: request.queryText,
    totalCandidates: filteredDocuments.length,
    results: results.map((result) => hydrateResult(result, snapshotDocumentMap)),
    warnings: ["Using local snapshot retrieval. Configure backend + Milvus for live semantic search."]
  };

  snapshotSearchCache.set(cacheKey, response);
  return cloneSnapshotResponse(response);
};

export const queryUnifiedAssetRetriever = async (request: AssetSearchRequest): Promise<AssetSearchResponse> => {
  try {
    const remote = await backendFetchJson<BackendAssetRetrievalResponse>("/api/assets/retrieve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    return {
      ...remote,
      results: remote.results.map((result) => hydrateResult(result, snapshotDocumentMap))
    };
  } catch {
    return searchUnifiedAssetSnapshot(request);
  }
};
