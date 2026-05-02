import {DataType, HttpClient, MetricType, MilvusClient} from "@zilliz/milvus2-sdk-node";

import type {AssetPipelineConfig} from "./config";
import type {NormalizedAssetDocument} from "./types";

const joinScalarList = (values: string[]): string => values.join(" | ");

const normalizeMilvusSearchEntries = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((entry) => Array.isArray(entry) ? entry : [entry])
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"));
};

type AssetMilvusSearchEntry = Record<string, unknown> & {id: string; score: number};

type AssetMilvusClient = {
  hasCollection(params: {collection_name: string}): Promise<{value: boolean}>;
  dropCollection(params: {collection_name: string}): Promise<void>;
  createCollection(params: {
    collection_name: string;
    enable_dynamic_field: boolean;
    fields: Array<Record<string, unknown>>;
    index_params: Array<Record<string, unknown>>;
  }): Promise<void>;
  loadCollection(params: {collection_name: string}): Promise<void>;
  upsert(params: {
    collection_name: string;
    data: Array<Record<string, unknown>>;
  }): Promise<void>;
  search(params: {
    collection_name: string;
    data: number[][];
    anns_field: string;
    limit: number;
    metric_type: string;
    params?: Record<string, unknown>;
    filter?: string;
    output_fields: string[];
  }): Promise<{results: AssetMilvusSearchEntry[]}>;
};

const isHttpMilvusAddress = (address: string): boolean => /^https?:\/\//i.test(address.trim());

const resolveHttpMilvusEndpoint = (address: string): string => {
  const parsed = new URL(address);
  return parsed.origin;
};

const toHttpFieldSchema = (field: Record<string, unknown>): Record<string, unknown> => {
  const dataType = field.data_type;

  if (dataType === DataType.VarChar) {
    return {
      fieldName: String(field.name),
      dataType: "VarChar",
      isPrimary: Boolean(field.is_primary_key),
      elementTypeParams: {
        max_length: Number(field.max_length ?? 0)
      }
    };
  }

  if (dataType === DataType.FloatVector) {
    return {
      fieldName: String(field.name),
      dataType: "FloatVector",
      elementTypeParams: {
        dim: Number(field.dim ?? 0)
      }
    };
  }

  if (dataType === DataType.Bool) {
    return {
      fieldName: String(field.name),
      dataType: "Bool"
    };
  }

  if (dataType === DataType.Float) {
    return {
      fieldName: String(field.name),
      dataType: "Float"
    };
  }

  throw new Error(`Unsupported HTTP Milvus field type for ${String(field.name)}.`);
};

const createGrpcAssetClient = (config: AssetPipelineConfig): AssetMilvusClient => {
  const client = new MilvusClient({
    address: config.MILVUS_ADDRESS,
    token: config.MILVUS_TOKEN || undefined,
    database: config.MILVUS_DATABASE || undefined,
    ssl: isHttpMilvusAddress(config.MILVUS_ADDRESS)
  });

  return {
    async hasCollection({collection_name}) {
      const result = await client.hasCollection({collection_name});
      return {value: Boolean(result.value)};
    },
    async dropCollection({collection_name}) {
      await client.dropCollection({collection_name});
    },
    async createCollection(params) {
      await client.createCollection(params as any);
    },
    async loadCollection({collection_name}) {
      await client.loadCollection({collection_name});
    },
    async upsert(params) {
      await client.upsert(params as any);
    },
    async search(params) {
      const result = await client.search(params);
      const rows = normalizeMilvusSearchEntries(result.results);
      return {
        results: rows.map((entry) => ({
          ...(entry as Record<string, unknown>),
          id: String(entry.id),
          score: Number(entry.score ?? 0)
        }))
      };
    }
  };
};

const createHttpAssetClient = (config: AssetPipelineConfig): AssetMilvusClient => {
  const client = new HttpClient({
    endpoint: resolveHttpMilvusEndpoint(config.MILVUS_ADDRESS),
    token: config.MILVUS_TOKEN || undefined,
    database: config.MILVUS_DATABASE || undefined,
    timeout: 60000
  });

  return {
    async hasCollection({collection_name}) {
      const result = await client.hasCollection({
        collectionName: collection_name,
        dbName: config.MILVUS_DATABASE
      });
      return {value: Boolean(result.data?.has)};
    },
    async dropCollection({collection_name}) {
      await client.dropCollection({
        collectionName: collection_name
      });
    },
    async createCollection({collection_name, enable_dynamic_field, fields, index_params}) {
      await client.createCollection({
        collectionName: collection_name,
        schema: {
          autoID: false,
          enabledDynamicField: enable_dynamic_field,
          fields: fields.map((field) => toHttpFieldSchema(field)) as any
        },
        indexParams: index_params.map((indexParam) => ({
          fieldName: String(indexParam.field_name),
          indexName: `${String(indexParam.field_name)}_idx`,
          metricType: String(indexParam.metric_type),
          params: {
            index_type: String(indexParam.index_type),
            M: String((indexParam.params as Record<string, unknown> | undefined)?.M ?? 16),
            efConstruction: String((indexParam.params as Record<string, unknown> | undefined)?.efConstruction ?? 256)
          }
        }))
      });
    },
    async loadCollection({collection_name}) {
      await client.loadCollection({
        collectionName: collection_name
      });
    },
    async upsert({collection_name, data}) {
      await client.upsert({
        collectionName: collection_name,
        data
      });
    },
    async search({collection_name, data, anns_field, limit, metric_type, params, filter, output_fields}) {
      const result = await client.search({
        collectionName: collection_name,
        data,
        annsField: anns_field,
        limit,
        filter,
        outputFields: output_fields,
        searchParams: params
      });
      const rows = normalizeMilvusSearchEntries(Array.isArray(result.data) ? result.data : [result.data]);
      return {
        results: rows.map((entry) => ({
          ...(entry as Record<string, unknown>),
          id: String((entry as Record<string, unknown>).id ?? (entry as Record<string, unknown>).asset_id ?? ""),
          score: Number((entry as Record<string, unknown>).distance ?? (entry as Record<string, unknown>).score ?? 0)
        }))
      };
    }
  };
};

const buildFilterExpression = ({
  assetTypes,
  requireAnimated,
  requireStatic
}: {
  assetTypes?: string[];
  requireAnimated?: boolean;
  requireStatic?: boolean;
}): string | undefined => {
  const filters: string[] = [];

  if (assetTypes && assetTypes.length > 0) {
    filters.push(`asset_type in [${assetTypes.map((value) => `"${value}"`).join(", ")}]`);
  }
  if (requireAnimated) {
    filters.push("extension_is_animated == true");
  }
  if (requireStatic) {
    filters.push("extension_is_animated == false");
  }

  return filters.length > 0 ? filters.join(" && ") : undefined;
};

export const createMilvusAssetClient = (config: AssetPipelineConfig): AssetMilvusClient => {
  if (isHttpMilvusAddress(config.MILVUS_ADDRESS)) {
    return createHttpAssetClient(config);
  }

  return createGrpcAssetClient(config);
};

export const ensureMilvusAssetCollection = async ({
  client,
  config,
  reset
}: {
  client: AssetMilvusClient;
  config: AssetPipelineConfig;
  reset?: boolean;
}): Promise<void> => {
  const collection_name = config.MILVUS_COLLECTION_ASSETS;
  const existing = await client.hasCollection({collection_name});

  if (existing.value && reset) {
    await client.dropCollection({collection_name});
  }

  if (!existing.value || reset) {
    await client.createCollection({
      collection_name,
      enable_dynamic_field: false,
      fields: [
        {name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 256},
        {name: "asset_type", data_type: DataType.VarChar, max_length: 64},
        {name: "source_library", data_type: DataType.VarChar, max_length: 128},
        {name: "absolute_path", data_type: DataType.VarChar, max_length: 2048},
        {name: "relative_path", data_type: DataType.VarChar, max_length: 1024},
        {name: "public_path", data_type: DataType.VarChar, max_length: 1024},
        {name: "folder_name", data_type: DataType.VarChar, max_length: 256},
        {name: "filename", data_type: DataType.VarChar, max_length: 512},
        {name: "file_extension", data_type: DataType.VarChar, max_length: 24},
        {name: "tags_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "labels_text", data_type: DataType.VarChar, max_length: 4096},
        {name: "retrieval_caption", data_type: DataType.VarChar, max_length: 8192},
        {name: "semantic_description", data_type: DataType.VarChar, max_length: 8192},
        {name: "animation_family", data_type: DataType.VarChar, max_length: 128},
        {name: "motion_intensity", data_type: DataType.VarChar, max_length: 32},
        {name: "mood_text", data_type: DataType.VarChar, max_length: 512},
        {name: "subject", data_type: DataType.VarChar, max_length: 256},
        {name: "category", data_type: DataType.VarChar, max_length: 256},
        {name: "contexts_text", data_type: DataType.VarChar, max_length: 2048},
        {name: "anti_contexts_text", data_type: DataType.VarChar, max_length: 2048},
        {name: "constraints_text", data_type: DataType.VarChar, max_length: 2048},
        {name: "duration_class", data_type: DataType.VarChar, max_length: 64},
        {name: "aspect_ratio", data_type: DataType.VarChar, max_length: 64},
        {name: "dominant_visual_role", data_type: DataType.VarChar, max_length: 128},
        {name: "confidence", data_type: DataType.Float},
        {name: "source_mapping_reference", data_type: DataType.VarChar, max_length: 2048},
        {name: "embedding_text", data_type: DataType.VarChar, max_length: 8192},
        {name: "content_hash", data_type: DataType.VarChar, max_length: 128},
        {name: "metadata_version", data_type: DataType.VarChar, max_length: 128},
        {name: "extension_is_animated", data_type: DataType.Bool},
        {name: "embedding", data_type: DataType.FloatVector, dim: config.ASSET_EMBEDDING_DIMENSIONS}
      ],
      index_params: [
        {
          field_name: "embedding",
          index_type: config.MILVUS_INDEX_TYPE,
          metric_type: MetricType[config.MILVUS_METRIC_TYPE as keyof typeof MetricType] ?? MetricType.COSINE,
          params: {
            M: 16,
            efConstruction: 256
          }
        }
      ]
    });
  }

  await client.loadCollection({collection_name});
};

export const upsertMilvusAssetDocuments = async ({
  client,
  config,
  documents,
  embeddings
}: {
  client: AssetMilvusClient;
  config: AssetPipelineConfig;
  documents: NormalizedAssetDocument[];
  embeddings: number[][];
}): Promise<void> => {
  if (documents.length === 0) {
    return;
  }

  const upsertBatchSize = 100;

  for (let index = 0; index < documents.length; index += upsertBatchSize) {
    const chunkDocuments = documents.slice(index, index + upsertBatchSize);
    const chunkEmbeddings = embeddings.slice(index, index + upsertBatchSize);
    const chunkNumber = Math.floor(index / upsertBatchSize) + 1;
    const chunkCount = Math.max(1, Math.ceil(documents.length / upsertBatchSize));
    const chunkStartedAt = Date.now();
    console.log(
      `[assets:index] Milvus upsert chunk ${chunkNumber}/${chunkCount} (${Math.min(index + chunkDocuments.length, documents.length)}/${documents.length})...`
    );

    await client.upsert({
      collection_name: config.MILVUS_COLLECTION_ASSETS,
      data: chunkDocuments.map((document, chunkIndex) => ({
        id: document.asset_id,
        asset_type: document.asset_type,
        source_library: document.source_library,
        absolute_path: document.absolute_path,
        relative_path: document.relative_path,
        public_path: document.public_path,
        folder_name: document.folder_name,
        filename: document.filename,
        file_extension: document.file_extension,
        tags_text: joinScalarList(document.tags),
        labels_text: joinScalarList(document.labels),
        retrieval_caption: document.retrieval_caption,
        semantic_description: document.semantic_description,
        animation_family: document.animation_family,
        motion_intensity: document.motion_intensity,
        mood_text: joinScalarList(document.mood),
        subject: document.subject,
        category: document.category,
        contexts_text: joinScalarList(document.contexts),
        anti_contexts_text: joinScalarList(document.anti_contexts),
        constraints_text: joinScalarList(document.constraints),
        duration_class: document.duration_class,
        aspect_ratio: document.aspect_ratio,
        dominant_visual_role: document.dominant_visual_role,
        confidence: document.confidence,
        source_mapping_reference: joinScalarList(document.source_mapping_reference),
        embedding_text: document.embedding_text,
        content_hash: document.content_hash,
        metadata_version: document.metadata_version,
        extension_is_animated: document.extension_is_animated,
        embedding: chunkEmbeddings[chunkIndex]
      }))
    });
    console.log(
      `[assets:index] Milvus upsert chunk ${chunkNumber}/${chunkCount} complete in ${Math.max(0, Date.now() - chunkStartedAt)}ms.`
    );
  }
};

export const searchMilvusAssetDocuments = async ({
  client,
  config,
  vector,
  limit,
  assetTypes,
  requireAnimated,
  requireStatic
}: {
  client: AssetMilvusClient;
  config: AssetPipelineConfig;
  vector: number[];
  limit: number;
  assetTypes?: string[];
  requireAnimated?: boolean;
  requireStatic?: boolean;
}): Promise<Array<Record<string, unknown> & {id: string; score: number}>> => {
  const filter = buildFilterExpression({
    assetTypes,
    requireAnimated,
    requireStatic
  });
  const result = await client.search({
    collection_name: config.MILVUS_COLLECTION_ASSETS,
    data: [vector],
    anns_field: "embedding",
    limit,
    metric_type: config.MILVUS_METRIC_TYPE,
    params: {
      ef: 96
    },
    filter,
    output_fields: [
      "asset_type",
      "absolute_path",
      "relative_path",
      "public_path",
      "folder_name",
      "filename",
      "file_extension",
      "tags_text",
      "labels_text",
      "retrieval_caption",
      "semantic_description",
      "animation_family",
      "motion_intensity",
      "mood_text",
      "subject",
      "category",
      "contexts_text",
      "anti_contexts_text",
      "constraints_text",
      "duration_class",
      "aspect_ratio",
      "dominant_visual_role",
      "confidence",
      "source_mapping_reference",
      "embedding_text",
      "extension_is_animated"
    ]
  });

  return result.results;
};
