import {
  VectorDBAdapter,
  type VectorRecord,
  type SearchResult,
  type UniversalFilter,
  type CollectionStats,
  type MetadataUpdate,
  type DistanceMetric,
} from '@vectororm/core';
import { Pinecone } from '@pinecone-database/pinecone';
import type { PineconeConfig } from './types.js';

/**
 * PineconeAdapter implements VectorDBAdapter for Pinecone vector database.
 *
 * Supports all VectorORM features including CRUD operations, filtering,
 * and metadata updates.
 */
export class PineconeAdapter extends VectorDBAdapter {
  private config: PineconeConfig;
  private client: Pinecone | null = null;

  constructor(config: PineconeConfig) {
    super();

    // Validate required config
    if (!config.apiKey) {
      throw new Error(
        'PineconeAdapter: apiKey is required in config or PINECONE_API_KEY environment variable'
      );
    }

    this.config = config;
    // Client will be initialized in a separate step
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async connect(): Promise<void> {
    try {
      this.client = new Pinecone({
        apiKey: this.config.apiKey,
      });

      // Verify connection by listing indexes
      await this.client.listIndexes();
    } catch (error) {
      throw new Error(
        `Pinecone connection failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async isConnected(): Promise<boolean> {
    return this.client !== null;
  }

  // ============================================================================
  // COLLECTION MANAGEMENT
  // ============================================================================

  async createCollection(
    name: string,
    dimension: number,
    metric: DistanceMetric = 'cosine'
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      // Map our metric to Pinecone metric
      const pineconeMetric = metric === 'dotProduct' ? 'dotproduct' : metric;

      await this.client.createIndex({
        name,
        dimension,
        metric: pineconeMetric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to create Pinecone index ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async deleteCollection(name: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      await this.client.deleteIndex(name);
    } catch (error) {
      throw new Error(
        `Failed to delete Pinecone index ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async collectionExists(name: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const indexes = await this.client.listIndexes();
      return indexes.indexes?.some((idx) => idx.name === name) ?? false;
    } catch (error) {
      throw new Error(
        `Failed to check if Pinecone index ${name} exists: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async getCollectionStats(name: string): Promise<CollectionStats> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const index = this.client.index(name);
      const stats = await index.describeIndexStats();

      return {
        vectorCount: stats.totalRecordCount ?? 0,
        dimension: stats.dimension ?? 0,
        metric: 'cosine', // Pinecone doesn't return metric in stats, default to cosine
        ...stats,
      };
    } catch (error) {
      throw new Error(
        `Failed to get Pinecone index stats for ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // VECTOR OPERATIONS
  // ============================================================================

  async upsert(collection: string, records: VectorRecord[]): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const index = this.client.index(collection);

      // Convert VectorRecord[] to Pinecone format
      const pineconeRecords = records.map((record) => ({
        id: record.id,
        values: record.embedding,
        metadata: record.metadata,
      }));

      await index.upsert(pineconeRecords);
    } catch (error) {
      throw new Error(
        `Failed to upsert vectors to Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async fetch(collection: string, ids: string[]): Promise<VectorRecord[]> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const index = this.client.index(collection);
      const response = await index.fetch(ids);

      return Object.entries(response.records || {}).map(([id, record]) => ({
        id,
        embedding: record.values || [],
        metadata: record.metadata || {},
      }));
    } catch (error) {
      throw new Error(
        `Failed to fetch vectors from Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const index = this.client.index(collection);
      await index.deleteMany(ids);
    } catch (error) {
      throw new Error(
        `Failed to delete vectors from Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // METADATA OPERATIONS
  // ============================================================================

  async updateMetadata(
    collection: string,
    updates: MetadataUpdate[]
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const index = this.client.index(collection);

      // Pinecone supports partial metadata updates via update()
      for (const update of updates) {
        await index.update({
          id: update.id,
          metadata: update.metadata,
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to update metadata in Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  async search(
    collection: string,
    queryVector: number[],
    options?: {
      topK?: number;
      filter?: UniversalFilter;
      includeMetadata?: boolean;
      includeValues?: boolean;
    }
  ): Promise<SearchResult> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const index = this.client.index(collection);

      const pineconeFilter = options?.filter
        ? this.translateFilter(options.filter)
        : undefined;

      const response = await index.query({
        vector: queryVector,
        topK: options?.topK || 10,
        filter: pineconeFilter,
        includeMetadata: options?.includeMetadata !== false,
        includeValues: options?.includeValues || false,
      });

      return {
        records: (response.matches || []).map((match) => ({
          id: match.id,
          embedding: match.values || [],
          metadata: match.metadata || {},
          score: match.score,
        })),
      };
    } catch (error) {
      throw new Error(
        `Failed to search Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // FILTER TRANSLATION
  // ============================================================================

  translateFilter(filter: UniversalFilter): any {
    // Handle compound AND filter
    if ('and' in filter) {
      const conditions = filter.and;

      // Check for nested compound filters (not supported yet)
      for (const condition of conditions) {
        if ('and' in condition || 'or' in condition) {
          throw new Error(
            'Nested compound filters not yet supported in PineconeAdapter. See TECH_DEBT.md',
            { cause: { filter } }
          );
        }
      }

      return {
        $and: conditions.map((c) => this.translateFilter(c)),
      };
    }

    // Handle compound OR filter (not supported)
    if ('or' in filter) {
      throw new Error(
        'OR filters not yet supported in PineconeAdapter. See TECH_DEBT.md',
        { cause: { filter } }
      );
    }

    // Handle basic filter condition
    const { field, op, value } = filter as any;

    // Operator mapping
    const operatorMap: Record<string, string> = {
      eq: '$eq',
      ne: '$ne',
      gt: '$gt',
      gte: '$gte',
      lt: '$lt',
      lte: '$lte',
      in: '$in',
      nin: '$nin',
    };

    const pineconeOp = operatorMap[op];
    if (!pineconeOp) {
      throw new Error(
        `Unsupported filter operator: ${op}`,
        { cause: { filter } }
      );
    }

    return {
      [field]: {
        [pineconeOp]: value,
      },
    };
  }

  // ============================================================================
  // ITERATION
  // ============================================================================

  async *iterate(
    collection: string,
    options?: {
      batchSize?: number;
      filter?: UniversalFilter;
    }
  ): AsyncIterableIterator<VectorRecord[]> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const index = this.client.index(collection);
      const batchSize = options?.batchSize || 100;
      const pineconeFilter = options?.filter
        ? this.translateFilter(options.filter)
        : undefined;

      // Pinecone uses pagination with tokens
      let paginationToken: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await index.listPaginated({
          limit: batchSize,
          paginationToken,
          ...(pineconeFilter && { filter: pineconeFilter }),
        });

        if (response.vectors && response.vectors.length > 0) {
          // Fetch full records with embeddings
          const ids = response.vectors
            .map((v) => v.id)
            .filter((id): id is string => id !== undefined);
          if (ids.length > 0) {
            const records = await this.fetch(collection, ids);
            yield records;
          }
        }

        // Check for more pages
        paginationToken = response.pagination?.next;
        hasMore = !!paginationToken;
      }
    } catch (error) {
      throw new Error(
        `Failed to iterate Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // CAPABILITY FLAGS
  // ============================================================================

  supportsMetadataUpdate(): boolean {
    return true; // Pinecone supports metadata updates
  }

  supportsFiltering(): boolean {
    return true; // Pinecone supports metadata filtering
  }

  supportsBatchOperations(): boolean {
    return true; // Pinecone supports batch operations
  }
}
