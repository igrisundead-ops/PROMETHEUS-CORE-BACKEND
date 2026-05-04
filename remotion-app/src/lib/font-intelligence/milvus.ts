import {DataType, HttpClient, MetricType, MilvusClient} from "@zilliz/milvus2-sdk-node";

import type {FontPipelineConfig} from "./config";
import type {FontEmbeddingRecord} from "./types";

type FontMilvusClient = {
  hasCollection(params: {collection_name: string}): Promise<{value: boolean}>;
  createCollection(params: {
    collection_name: string;
    enable_dynamic_field: boolean;
    fields: Array<Record<string, unknown>>;
    index_params: Array<Record<string, unknown>>;
  }): Promise<void>;
  dropCollection(params: {collection_name: string}): Promise<void>;
  loadCollection(params: {collection_name: string}): Promise<void>;
  upsert(params: {collection_name: string; data: Array<Record<string, unknown>>}): Promise<void>;
};

const isHttpMilvusAddress = (address: string): boolean => /^https?:\/\//i.test(address.trim());

const resolveHttpMilvusEndpoint = (address: string): string => new URL(address).origin;

const toHttpFieldSchema = (field: Record<string, unknown>): Record<string, unknown> => {
  const dataType = field.data_type;
  if (dataType === DataType.VarChar) {
    return {
      fieldName: String(field.name),
      dataType: "VarChar",
      isPrimary: Boolean(field.is_primary_key),
      elementTypeParams: {max_length: Number(field.max_length ?? 0)}
    };
  }
  if (dataType === DataType.FloatVector) {
    return {
      fieldName: String(field.name),
      dataType: "FloatVector",
      elementTypeParams: {dim: Number(field.dim ?? 0)}
    };
  }
  if (dataType === DataType.Bool) {
    return {fieldName: String(field.name), dataType: "Bool"};
  }
  throw new Error(`Unsupported field type for ${String(field.name)}.`);
};

const createGrpcClient = (config: FontPipelineConfig): FontMilvusClient => {
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
    async createCollection(params) {
      await client.createCollection(params as any);
    },
    async dropCollection({collection_name}) {
      await client.dropCollection({collection_name});
    },
    async loadCollection({collection_name}) {
      await client.loadCollection({collection_name});
    },
    async upsert(params) {
      await client.upsert(params as any);
    }
  };
};

const createHttpClient = (config: FontPipelineConfig): FontMilvusClient => {
  const client = new HttpClient({
    endpoint: resolveHttpMilvusEndpoint(config.MILVUS_ADDRESS),
    token: config.MILVUS_TOKEN || undefined,
    database: config.MILVUS_DATABASE || undefined,
    timeout: 60000
  });
  return {
    async hasCollection({collection_name}) {
      const result = await client.hasCollection({collectionName: collection_name, dbName: config.MILVUS_DATABASE});
      return {value: Boolean(result.data?.has)};
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
    async dropCollection({collection_name}) {
      await client.dropCollection({collectionName: collection_name});
    },
    async loadCollection({collection_name}) {
      await client.loadCollection({collectionName: collection_name});
    },
    async upsert({collection_name, data}) {
      await client.upsert({collectionName: collection_name, data});
    }
  };
};

const createFontMilvusClient = (config: FontPipelineConfig): FontMilvusClient => {
  return isHttpMilvusAddress(config.MILVUS_ADDRESS) ? createHttpClient(config) : createGrpcClient(config);
};

export const ensureFontCollection = async ({
  config,
  reset = false
}: {
  config: FontPipelineConfig;
  reset?: boolean;
}): Promise<FontMilvusClient> => {
  const client = createFontMilvusClient(config);
  const collection_name = config.FONT_INTELLIGENCE_MILVUS_COLLECTION;
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
        {name: "family_id", data_type: DataType.VarChar, max_length: 256},
        {name: "family_name", data_type: DataType.VarChar, max_length: 512},
        {name: "style_name", data_type: DataType.VarChar, max_length: 512},
        {name: "source_zip", data_type: DataType.VarChar, max_length: 512},
        {name: "primary_role", data_type: DataType.VarChar, max_length: 64},
        {name: "roles_text", data_type: DataType.VarChar, max_length: 2048},
        {name: "personality_text", data_type: DataType.VarChar, max_length: 2048},
        {name: "classifications_text", data_type: DataType.VarChar, max_length: 2048},
        {name: "descriptor", data_type: DataType.VarChar, max_length: 16384},
        {name: "needs_manual_license_review", data_type: DataType.Bool},
        {name: "metadata_json", data_type: DataType.VarChar, max_length: 65535},
        {name: "embedding", data_type: DataType.FloatVector, dim: config.FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS}
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
  return client;
};

export const upsertFontsToMilvus = async ({
  config,
  embeddings,
  reset = false
}: {
  config: FontPipelineConfig;
  embeddings: FontEmbeddingRecord[];
  reset?: boolean;
}): Promise<{insertedCount: number; collectionName: string}> => {
  const client = await ensureFontCollection({config, reset});
  const collection_name = config.FONT_INTELLIGENCE_MILVUS_COLLECTION;
  const batchSize = 100;
  for (let index = 0; index < embeddings.length; index += batchSize) {
    const chunk = embeddings.slice(index, index + batchSize);
    await client.upsert({
      collection_name,
      data: chunk.map((entry) => ({
        id: entry.font_id,
        family_id: entry.family_id,
        family_name: entry.metadata.observed.familyName ?? "",
        style_name: entry.metadata.observed.subfamilyName ?? "",
        source_zip: entry.metadata.canonicalSourceZip,
        primary_role: entry.metadata.inferred.primaryRole,
        roles_text: entry.metadata.inferred.roles.join(" | "),
        personality_text: entry.metadata.inferred.personality.join(" | "),
        classifications_text: entry.metadata.inferred.classifications.join(" | "),
        descriptor: entry.descriptor,
        needs_manual_license_review: entry.metadata.needsManualLicenseReview,
        metadata_json: JSON.stringify(entry.metadata),
        embedding: entry.embedding
      }))
    });
  }
  return {
    insertedCount: embeddings.length,
    collectionName: collection_name
  };
};
