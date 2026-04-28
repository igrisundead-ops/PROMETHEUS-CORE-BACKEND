import {vectorPartitionSchema, type RankedAssetCandidate, type RetrievalEnforcementSummary, type VectorPartition, type VectorSearchRequest} from "./schemas";

const ACTION_PARTITION_MAP: Record<string, VectorPartition[]> = {
  skip: [],
  "retrieve-typography-only": ["typography"],
  "retrieve-motion-only": ["motion_graphics", "gsap_animation_logic"],
  "retrieve-matte-related-treatments": ["motion_graphics", "gsap_animation_logic"],
  "retrieve-reference-inspiration-only": ["references", "static_images", "motion_graphics"],
  "retrieve-diverse-treatment-families": ["static_images", "motion_graphics", "gsap_animation_logic"],
  "retrieve-full-support": ["static_images", "motion_graphics", "gsap_animation_logic", "typography", "references"]
};

const unique = <T,>(values: T[]): T[] => [...new Set(values)];

export const getAllowedPartitionsForAction = (action: string): VectorPartition[] => {
  return ACTION_PARTITION_MAP[action] ?? ACTION_PARTITION_MAP["retrieve-full-support"];
};

export const enforceMilvusSearchRequests = ({
  action,
  requests
}: {
  action: string;
  requests: VectorSearchRequest[];
}): {
  requests: VectorSearchRequest[];
  summary: RetrievalEnforcementSummary;
} => {
  const allowed = getAllowedPartitionsForAction(action);
  const blockedPartitions: VectorPartition[] = [];
  const sanitizedRequests = action === "skip"
    ? []
    : requests
      .map((request) => {
        const nextPartitions = request.partitions.filter((partition) => {
          const valid = allowed.includes(partition);
          if (!valid) {
            blockedPartitions.push(vectorPartitionSchema.parse(partition));
          }
          return valid;
        });
        return {
          ...request,
          partitions: nextPartitions
        };
      })
      .filter((request) => request.partitions.length > 0);

  return {
    requests: sanitizedRequests,
    summary: {
      action,
      requestedPartitions: unique(requests.flatMap((request) => request.partitions)),
      searchedPartitions: unique(sanitizedRequests.flatMap((request) => request.partitions)),
      blockedPartitions: unique(blockedPartitions),
      approvedCandidateCount: 0,
      rejectedCandidateCount: 0,
      inspirationOnlyCount: 0,
      bypassPrevented: blockedPartitions.length > 0,
      notes: action === "skip"
        ? ["Judgment engine skipped retrieval, so no Milvus requests were issued."]
        : blockedPartitions.length > 0
          ? ["Removed unauthorized partitions before the search request was sent."]
          : []
    }
  };
};

export const enforceRankedAssetCandidates = ({
  action,
  candidates,
  selectCount = 6
}: {
  action: string;
  candidates: RankedAssetCandidate[];
  selectCount?: number;
}): {
  approved: RankedAssetCandidate[];
  rejected: RankedAssetCandidate[];
  summary: RetrievalEnforcementSummary;
} => {
  const inspirationOnly = action === "retrieve-reference-inspiration-only";
  const approved: RankedAssetCandidate[] = [];
  const rejected: RankedAssetCandidate[] = [];

  for (const candidate of candidates) {
    const next = {
      ...candidate,
      inspirationOnly
    };
    if (inspirationOnly) {
      next.rejectionReasons = [...next.rejectionReasons, "Inspiration-only retrieval cannot be executed directly by agents."];
    }
    if (next.rejectionReasons.length > 0) {
      rejected.push({
        ...next,
        selected: false
      });
      continue;
    }
    approved.push(next);
  }

  const selectedApproved = approved.map((candidate, index) => ({
    ...candidate,
    selected: index < selectCount
  }));

  return {
    approved: selectedApproved,
    rejected,
    summary: {
      action,
      requestedPartitions: [],
      searchedPartitions: [],
      blockedPartitions: [],
      approvedCandidateCount: selectedApproved.length,
      rejectedCandidateCount: rejected.length,
      inspirationOnlyCount: inspirationOnly ? selectedApproved.length + rejected.length : 0,
      bypassPrevented: inspirationOnly,
      notes: inspirationOnly ? ["Reference inspiration can shape taste but cannot be executed directly."] : []
    }
  };
};
