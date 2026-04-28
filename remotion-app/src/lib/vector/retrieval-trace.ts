import type {RankedAssetCandidate, RetrievalEnforcementSummary, RetrievalTrace, VectorSearchRequest, VectorSearchResponse} from "./schemas";

export const buildRetrievalTrace = ({
  action,
  requests,
  responses,
  approved,
  rejected,
  summary,
  warnings = []
}: {
  action: string;
  requests: VectorSearchRequest[];
  responses: VectorSearchResponse[];
  approved: RankedAssetCandidate[];
  rejected: RankedAssetCandidate[];
  summary: RetrievalEnforcementSummary;
  warnings?: string[];
}): RetrievalTrace => {
  return {
    action,
    requestCount: requests.length,
    warnings,
    approvedCandidateIds: approved.map((candidate) => candidate.assetId),
    rejectedCandidateIds: rejected.map((candidate) => candidate.assetId),
    entries: [
      {
        step: "policy",
        summary: `Retrieval action ${action} resolved to ${summary.searchedPartitions.length} legal partition(s).`,
        data: {
          requestedPartitions: summary.requestedPartitions,
          searchedPartitions: summary.searchedPartitions,
          blockedPartitions: summary.blockedPartitions
        }
      },
      ...requests.map((request) => ({
        step: "search-request",
        summary: `Submitted Milvus request ${request.requestId} across ${request.partitions.join(", ")}.`,
        data: {
          partitions: request.partitions,
          topK: request.topK,
          filters: request.filters
        }
      })),
      ...responses.map((response) => ({
        step: "search-result",
        summary: `Milvus returned ${response.results.length} candidate(s) for request ${response.requestId}.`,
        data: {
          requestId: response.requestId,
          partitions: response.partitions,
          totalCandidates: response.totalCandidates
        }
      })),
      {
        step: "ranking",
        summary: `Approved ${approved.length} candidate(s) and rejected ${rejected.length} after ranking and enforcement.`,
        data: {
          approvedCandidateIds: approved.slice(0, 8).map((candidate) => candidate.assetId),
          rejectedCandidateIds: rejected.slice(0, 8).map((candidate) => candidate.assetId)
        }
      }
    ]
  };
};
