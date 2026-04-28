import {backendFetchJson} from "../../../lib/backend-api";
import {buildRetrievalTrace} from "../../../lib/vector/retrieval-trace";
import {buildMilvusSearchRequests} from "../../../lib/vector/vector-retrieval-router";
import type {
  RankedAssetCandidate,
  RetrievalEnforcementSummary,
  RetrievalTrace,
  VectorSearchRequest,
  VectorSearchResponse
} from "../../../lib/vector/schemas";
import {rankAssetCandidatesForJudgment} from "../rules/asset-ranking";
import {enforceMilvusSearchRequests, enforceRankedAssetCandidates} from "../rules/retrieval-enforcement";
import type {CandidateTreatmentProfile, JudgmentEngineInput, PreJudgmentSnapshot} from "../types";

export type VectorSearchTransport = {
  search(requests: VectorSearchRequest[]): Promise<VectorSearchResponse[]>;
};

type VectorRetrievalResult = {
  retrievalEnforcementSummary: RetrievalEnforcementSummary;
  milvusSearchRequests: VectorSearchRequest[];
  milvusSearchResults: VectorSearchResponse[];
  rankedAssetCandidates: RankedAssetCandidate[];
  rejectedAssetCandidates: RankedAssetCandidate[];
  selectedAssetCandidateIds: string[];
  assetRankingRationale: string[];
  retrievalTrace: RetrievalTrace;
};

const mergeSummaries = (
  base: RetrievalEnforcementSummary,
  next: RetrievalEnforcementSummary
): RetrievalEnforcementSummary => ({
  ...base,
  searchedPartitions: [...new Set([...base.searchedPartitions, ...next.searchedPartitions])],
  blockedPartitions: [...new Set([...base.blockedPartitions, ...next.blockedPartitions])],
  approvedCandidateCount: next.approvedCandidateCount,
  rejectedCandidateCount: next.rejectedCandidateCount,
  inspirationOnlyCount: next.inspirationOnlyCount,
  bypassPrevented: base.bypassPrevented || next.bypassPrevented,
  notes: [...base.notes, ...next.notes]
});

class BackendVectorSearchTransport implements VectorSearchTransport {
  async search(requests: VectorSearchRequest[]): Promise<VectorSearchResponse[]> {
    return Promise.all(
      requests.map((request) => backendFetchJson<VectorSearchResponse>("/api/assets/vector-retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      }))
    );
  }
}

export class VectorRetrievalEngine {
  constructor(private readonly transport: VectorSearchTransport = new BackendVectorSearchTransport()) {}

  async retrieve({
    input,
    snapshot,
    selectedTreatment
  }: {
    input: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    selectedTreatment: CandidateTreatmentProfile;
  }): Promise<VectorRetrievalResult> {
    const rawRequests = buildMilvusSearchRequests({
      input,
      snapshot,
      selectedTreatment
    });
    const enforcedRequests = enforceMilvusSearchRequests({
      action: snapshot.retrievalDecision.action,
      requests: rawRequests
    });

    if (enforcedRequests.requests.length === 0) {
      const retrievalTrace = buildRetrievalTrace({
        action: snapshot.retrievalDecision.action,
        requests: [],
        responses: [],
        approved: [],
        rejected: [],
        summary: enforcedRequests.summary,
        warnings: []
      });
      return {
        retrievalEnforcementSummary: enforcedRequests.summary,
        milvusSearchRequests: [],
        milvusSearchResults: [],
        rankedAssetCandidates: [],
        rejectedAssetCandidates: [],
        selectedAssetCandidateIds: [],
        assetRankingRationale: [],
        retrievalTrace
      };
    }

    let responses: VectorSearchResponse[] = [];
    const warnings: string[] = [];

    try {
      responses = await this.transport.search(enforcedRequests.requests);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }

    const hits = responses.flatMap((response) => response.results);
    const ranked = rankAssetCandidatesForJudgment({
      hits,
      input,
      snapshot,
      selectedTreatment,
      action: snapshot.retrievalDecision.action
    });
    const enforcedCandidates = enforceRankedAssetCandidates({
      action: snapshot.retrievalDecision.action,
      candidates: ranked
    });
    const summary = mergeSummaries(enforcedRequests.summary, enforcedCandidates.summary);
    const retrievalTrace = buildRetrievalTrace({
      action: snapshot.retrievalDecision.action,
      requests: enforcedRequests.requests,
      responses,
      approved: enforcedCandidates.approved,
      rejected: enforcedCandidates.rejected,
      summary,
      warnings
    });

    return {
      retrievalEnforcementSummary: summary,
      milvusSearchRequests: enforcedRequests.requests,
      milvusSearchResults: responses,
      rankedAssetCandidates: enforcedCandidates.approved,
      rejectedAssetCandidates: enforcedCandidates.rejected,
      selectedAssetCandidateIds: enforcedCandidates.approved.filter((candidate) => candidate.selected).map((candidate) => candidate.assetId),
      assetRankingRationale: enforcedCandidates.approved.slice(0, 4).flatMap((candidate) => candidate.rankingRationale),
      retrievalTrace
    };
  }
}
