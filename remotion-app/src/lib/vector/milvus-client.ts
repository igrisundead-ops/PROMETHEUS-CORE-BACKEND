import {DataType, MetricType, MilvusClient} from "@zilliz/milvus2-sdk-node";

import type {VectorConfig} from "./config";
import {PROMETHEUS_CREATIVE_ASSET_COLLECTION, VECTOR_PARTITIONS} from "./collections";
import {
  vectorAssetRecordSchema,
  vectorSearchRequestSchema,
  vectorSearchResponseSchema,
  type VectorAssetRecord,
  type VectorSearchFilters,
  type VectorSearchHit,
  type VectorSearchRequest,
  type VectorSearchResponse
} from "./schemas";

const joinScalarList = (values: string[]): string => values.join(" | ");

const splitScalarList = (value: unknown): string[] => {
  return String(value ?? "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const renderComplexityRank = (value: string): number => {
  if (value === "low") return 1;
  if (value === "medium") return 2;
  if (value === "high") return 3;
  return 99;
};

const includesAny = (haystack: string[], needles: string[]): boolean => {
  if (needles.length === 0) {
    return true;
  }
  const pool = new Set(haystack.map((value) => value.toLowerCase()));
  return needles.some((needle) => pool.has(needle.toLowerCase()));
};

const containsForbidden = (record: VectorAssetRecord, forbiddenTags: string[]): boolean => {
  if (forbiddenTags.length === 0) {
    return false;
  }
  const pool = [
    record.title,
    ...record.literalTags,
    ...record.semanticTags,
    ...record.motionTags,
    ...record.styleFamily,
    ...record.negativeGrammar
  ].join(" ").toLowerCase();
  return forbiddenTags.some((tag) => pool.includes(tag.toLowerCase()));
};

export const matchesVectorSearchFilters = (record: VectorAssetRecord, filters: VectorSearchFilters): boolean => {
  if (filters.assetTypes.length > 0 && !filters.assetTypes.includes(record.assetType)) {
    return false;
  }
  if (filters.sourceLibraries.length > 0 && !filters.sourceLibraries.includes(record.sourceLibrary)) {
    return false;
  }
  if (!includesAny(record.rhetoricalRoles, filters.rhetoricalRoles)) {
    return false;
  }
  if (!includesAny(record.emotionalRoles, filters.emotionalRoles)) {
    return false;
  }
  if (!includesAny(record.motionTags, filters.motionTags)) {
    return false;
  }
  if (!includesAny(record.styleFamily, filters.styleFamily)) {
    return false;
  }
  if (!includesAny(record.creatorFit, filters.creatorFit)) {
    return false;
  }
  if (!includesAny(record.sceneUseCases, filters.sceneUseCases)) {
    return false;
  }
  if (!includesAny(record.compatibility, filters.compatibility)) {
    return false;
  }
  if (!includesAny(record.negativeGrammar, filters.negativeGrammar)) {
    return false;
  }
  if (filters.supportedAspectRatio && record.supportedAspectRatios.length > 0 && !record.supportedAspectRatios.includes(filters.supportedAspectRatio)) {
    return false;
  }
  if (filters.renderComplexityMax && renderComplexityRank(record.renderComplexity) > renderComplexityRank(filters.renderComplexityMax)) {
    return false;
  }
  if (filters.matteRelatedOnly && !includesAny(record.compatibility, ["requiresMatting", "supportsBehindSubjectText", "requiresTransparentAsset"])) {
    return false;
  }
  if (containsForbidden(record, filters.forbiddenTags)) {
    return false;
  }
  return true;
};

const createRecordFromMilvusHit = (hit: Record<string, unknown>): VectorAssetRecord => {
  return vectorAssetRecordSchema.parse({
    id: String(hit.id ?? ""),
    assetId: String(hit.asset_id ?? ""),
    assetType: String(hit.asset_type ?? ""),
    partition: String(hit.partition ?? ""),
    sourceLibrary: String(hit.source_library ?? ""),
    title: String(hit.title ?? ""),
    relativePath: String(hit.relative_path ?? ""),
    absolutePath: String(hit.absolute_path ?? ""),
    publicPath: String(hit.public_path ?? ""),
    vectorSearchText: String(hit.vector_search_text ?? ""),
    literalTags: splitScalarList(hit.literal_tags_text),
    semanticTags: splitScalarList(hit.semantic_tags_text),
    rhetoricalRoles: splitScalarList(hit.rhetorical_roles_text),
    emotionalRoles: splitScalarList(hit.emotional_roles_text),
    motionTags: splitScalarList(hit.motion_tags_text),
    styleFamily: splitScalarList(hit.style_family_text),
    creatorFit: splitScalarList(hit.creator_fit_text),
    sceneUseCases: splitScalarList(hit.scene_use_cases_text),
    symbolicMeaning: splitScalarList(hit.symbolic_meaning_text),
    compatibility: splitScalarList(hit.compatibility_text),
    negativeGrammar: splitScalarList(hit.negative_grammar_text),
    renderComplexity: String(hit.render_complexity ?? "unknown"),
    visualEnergy: String(hit.visual_energy ?? "unknown"),
    supportedAspectRatios: splitScalarList(hit.supported_aspect_ratios_text),
    replaceableSlots: splitScalarList(hit.replaceable_slots_text),
    features: splitScalarList(hit.features_text),
    metadataJson: JSON.parse(String(hit.metadata_json ?? "{}")) as Record<string, unknown>,
    createdAt: String(hit.created_at ?? ""),
    updatedAt: String(hit.updated_at ?? "")
  });
};

export const createMilvusCreativeClient = (config: VectorConfig): MilvusClient => {
  return new MilvusClient({
    address: config.MILVUS_ADDRESS,
    token: config.milvusToken || undefined,
    database: config.MILVUS_DATABASE || undefined
  });
};

export const ensureCreativeAssetCollection = async ({
  client,
  config,
  reset = false
}: {
  client: MilvusClient;
  config: VectorConfig;
  reset?: boolean;
}): Promise<void> => {
  const collectionName = config.MILVUS_COLLECTION || PROMETHEUS_CREATIVE_ASSET_COLLECTION;
  const existing = await client.hasCollection({collection_name: collectionName});

  if (existing.value && reset) {
    await client.dropCollection({collection_name: collectionName});
  }

  if (!existing.value || reset) {
    await client.createCollection({
      collection_name: collectionName,
      enable_dynamic_field: false,
      fields: [
        {name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 256},
        {name: "asset_id", data_type: DataType.VarChar, max_length: 256},
        {name: "asset_type", data_type: DataType.VarChar, max_length: 64},
        {name: "partition", data_type: DataType.VarChar, max_length: 64},
        {name: "source_library", data_type: DataType.VarChar, max_length: 128},
        {name: "title", data_type: DataType.VarChar, max_length: 512},
        {name: "relative_path", data_type: DataType.VarChar, max_length: 2048},
        {name: "absolute_path", data_type: DataType.VarChar, max_length: 2048},
        {name: "public_path", data_type: DataType.VarChar, max_length: 2048},
        {name: "vector_search_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "literal_tags_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "semantic_tags_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "rhetorical_roles_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "emotional_roles_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "motion_tags_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "style_family_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "creator_fit_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "scene_use_cases_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "symbolic_meaning_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "compatibility_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "negative_grammar_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "render_complexity", data_type: DataType.VarChar, max_length: 32},
        {name: "visual_energy", data_type: DataType.VarChar, max_length: 64},
        {name: "supported_aspect_ratios_text", data_type: DataType.VarChar, max_length: 512},
        {name: "replaceable_slots_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "features_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "metadata_json", data_type: DataType.VarChar, max_length: 32768},
        {name: "created_at", data_type: DataType.VarChar, max_length: 64},
        {name: "updated_at", data_type: DataType.VarChar, max_length: 64},
        {name: "embedding", data_type: DataType.FloatVector, dim: config.EMBEDDING_DIMENSIONS}
      ],
      index_params: [
        {
          field_name: "embedding",
          index_type: "HNSW",
          metric_type: MetricType.COSINE,
          params: {M: 16, efConstruction: 256}
        }
      ]
    });
  }

  for (const partition of VECTOR_PARTITIONS) {
    const hasPartition = await client.hasPartition({
      collection_name: collectionName,
      partition_name: partition
    });
    if (!hasPartition.value) {
      await client.createPartition({
        collection_name: collectionName,
        partition_name: partition
      });
    }
  }

  await client.loadCollection({
    collection_name: collectionName
  });
};

export const upsertCreativeAssetRecords = async ({
  client,
  config,
  records,
  embeddings
}: {
  client: MilvusClient;
  config: VectorConfig;
  records: VectorAssetRecord[];
  embeddings: number[][];
}): Promise<void> => {
  const collectionName = config.MILVUS_COLLECTION || PROMETHEUS_CREATIVE_ASSET_COLLECTION;
  const groups = new Map<string, Array<{record: VectorAssetRecord; embedding: number[]}>>();
  records.forEach((record, index) => {
    const bucket = groups.get(record.partition) ?? [];
    bucket.push({record, embedding: embeddings[index] ?? []});
    groups.set(record.partition, bucket);
  });

  for (const [partition, batch] of groups.entries()) {
    if (batch.length === 0) {
      continue;
    }
    await client.upsert({
      collection_name: collectionName,
      partition_name: partition,
      data: batch.map(({record, embedding}) => ({
        id: record.id,
        asset_id: record.assetId,
        asset_type: record.assetType,
        partition: record.partition,
        source_library: record.sourceLibrary,
        title: record.title,
        relative_path: record.relativePath,
        absolute_path: record.absolutePath,
        public_path: record.publicPath,
        vector_search_text: record.vectorSearchText,
        literal_tags_text: joinScalarList(record.literalTags),
        semantic_tags_text: joinScalarList(record.semanticTags),
        rhetorical_roles_text: joinScalarList(record.rhetoricalRoles),
        emotional_roles_text: joinScalarList(record.emotionalRoles),
        motion_tags_text: joinScalarList(record.motionTags),
        style_family_text: joinScalarList(record.styleFamily),
        creator_fit_text: joinScalarList(record.creatorFit),
        scene_use_cases_text: joinScalarList(record.sceneUseCases),
        symbolic_meaning_text: joinScalarList(record.symbolicMeaning),
        compatibility_text: joinScalarList(record.compatibility),
        negative_grammar_text: joinScalarList(record.negativeGrammar),
        render_complexity: record.renderComplexity,
        visual_energy: record.visualEnergy,
        supported_aspect_ratios_text: joinScalarList(record.supportedAspectRatios),
        replaceable_slots_text: joinScalarList(record.replaceableSlots),
        features_text: joinScalarList(record.features),
        metadata_json: JSON.stringify(record.metadataJson),
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        embedding
      }))
    });
  }
};

export const searchCreativeAssetRecords = async ({
  client,
  config,
  queryVector,
  request
}: {
  client: MilvusClient;
  config: VectorConfig;
  queryVector: number[];
  request: VectorSearchRequest;
}): Promise<VectorSearchResponse> => {
  const parsedRequest = vectorSearchRequestSchema.parse(request);
  const collectionName = config.MILVUS_COLLECTION || PROMETHEUS_CREATIVE_ASSET_COLLECTION;
  const raw = await client.search({
    collection_name: collectionName,
    data: [queryVector],
    anns_field: "embedding",
    partition_names: parsedRequest.partitions,
    limit: parsedRequest.topK * parsedRequest.overfetchMultiplier,
    metric_type: "COSINE",
    params: {
      ef: 96
    },
    output_fields: [
      "asset_id",
      "asset_type",
      "partition",
      "source_library",
      "title",
      "relative_path",
      "absolute_path",
      "public_path",
      "vector_search_text",
      "literal_tags_text",
      "semantic_tags_text",
      "rhetorical_roles_text",
      "emotional_roles_text",
      "motion_tags_text",
      "style_family_text",
      "creator_fit_text",
      "scene_use_cases_text",
      "symbolic_meaning_text",
      "compatibility_text",
      "negative_grammar_text",
      "render_complexity",
      "visual_energy",
      "supported_aspect_ratios_text",
      "replaceable_slots_text",
      "features_text",
      "metadata_json",
      "created_at",
      "updated_at"
    ]
  });

  const hits = raw.results
    .map((entry) => {
      const record = createRecordFromMilvusHit(entry as Record<string, unknown>);
      return {
        ...record,
        vectorScore: Math.max(0, Math.min(1, Number(entry.score ?? 0))),
        backendScore: Number(entry.score ?? 0)
      } satisfies VectorSearchHit;
    })
    .filter((record) => matchesVectorSearchFilters(record, parsedRequest.filters))
    .sort((left, right) => right.vectorScore - left.vectorScore || left.assetId.localeCompare(right.assetId))
    .slice(0, parsedRequest.topK);

  return vectorSearchResponseSchema.parse({
    requestId: parsedRequest.requestId,
    backend: "milvus",
    collection: collectionName,
    partitions: parsedRequest.partitions,
    totalCandidates: hits.length,
    warnings: [],
    results: hits
  });
};
