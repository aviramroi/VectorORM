import {
  VectorDBAdapter,
  type VectorRecord,
  type SearchResult,
  type UniversalFilter,
  type CollectionStats,
  type MetadataUpdate,
  type DistanceMetric,
} from '@vectororm/core';
import { ChromaClient, type Collection } from 'chromadb';
import type { ChromaConfig } from './types.js';

/**
 * ChromaAdapter implements VectorDBAdapter for Chroma vector database.
 *
 * Supports both self-hosted and cloud Chroma instances.
 * Uses chromadb npm package for native TypeScript support.
 */
export class ChromaAdapter extends VectorDBAdapter {
  private config: ChromaConfig;
  private client: ChromaClient | null = null;
  private collectionCache: Map<string, Collection> = new Map();

  constructor(config: ChromaConfig = {}) {
    super();
    this.config = config;
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async connect(): Promise<void> {
    try {
      const host = this.config.host || process.env.CHROMA_HOST || 'localhost';
      const port = this.config.port ||
        (process.env.CHROMA_PORT ? parseInt(process.env.CHROMA_PORT, 10) : 8000);

      // Determine SSL usage
      const ssl = this.config.ssl !== undefined
        ? this.config.ssl
        : (process.env.CHROMA_SSL === 'true' || host !== 'localhost');

      const protocol = ssl ? 'https' : 'http';
      const path = `${protocol}://${host}:${port}`;

      const clientConfig: any = { path };

      // Add auth if API key is provided
      const apiKey = this.config.apiKey || process.env.CHROMA_API_KEY;
      if (apiKey) {
        clientConfig.auth = { provider: 'token', credentials: apiKey };
      }

      // Add tenant/database if provided
      if (this.config.tenant) {
        clientConfig.tenant = this.config.tenant;
      }
      if (this.config.database) {
        clientConfig.database = this.config.database;
      }

      this.client = new ChromaClient(clientConfig);

      // Verify connection by getting heartbeat
      await this.client.heartbeat();
    } catch (error) {
      throw new Error(
        `Chroma connection failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.collectionCache.clear();
  }

  async isConnected(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.heartbeat();
      return true;
    } catch {
      return false;
    }
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
      // Map our metric to Chroma distance function
      const chromaMetric = this.mapDistanceMetric(metric);

      const collection = await this.client.createCollection({
        name,
        metadata: {
          'hnsw:space': chromaMetric,
          dimension: dimension.toString(),
        },
      });

      this.collectionCache.set(name, collection);
    } catch (error) {
      throw new Error(
        `Failed to create Chroma collection ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async deleteCollection(name: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      await this.client.deleteCollection({ name });
      this.collectionCache.delete(name);
    } catch (error) {
      throw new Error(
        `Failed to delete Chroma collection ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async collectionExists(name: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const collections = await this.client.listCollections();
      return collections.some((col: any) => col.name === name);
    } catch (error) {
      throw new Error(
        `Failed to check if Chroma collection ${name} exists: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async getCollectionStats(name: string): Promise<CollectionStats> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const collection = await this.getCollection(name);
      const count = await collection.count();

      // Get metadata from collection
      const metadata = (collection as any).metadata || {};
      const dimension = metadata.dimension
        ? parseInt(metadata.dimension, 10)
        : 0;

      const metricStr = metadata['hnsw:space'] || 'cosine';
      const metric = this.unmapDistanceMetric(metricStr);

      return {
        vectorCount: count,
        dimension,
        metric,
        ...metadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to get Chroma collection stats for ${name}: ${error instanceof Error ? error.message : String(error)}`,
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
      const col = await this.getCollection(collection);

      const ids = records.map((r) => r.id);
      const embeddings = records.map((r) => r.embedding);
      const metadatas = records.map((r) => r.metadata || {});

      await col.upsert({
        ids,
        embeddings,
        metadatas,
      });
    } catch (error) {
      throw new Error(
        `Failed to upsert vectors to Chroma collection ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async fetch(collection: string, ids: string[]): Promise<VectorRecord[]> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const col = await this.getCollection(collection);

      const response = await col.get({
        ids,
        include: ['embeddings' as any, 'metadatas' as any],
      });

      const records: VectorRecord[] = [];

      if (response.ids && response.ids.length > 0) {
        for (let i = 0; i < response.ids.length; i++) {
          records.push({
            id: response.ids[i],
            embedding: response.embeddings?.[i] || [],
            metadata: response.metadatas?.[i] || {},
          });
        }
      }

      return records;
    } catch (error) {
      throw new Error(
        `Failed to fetch vectors from Chroma collection ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const col = await this.getCollection(collection);
      await col.delete({ ids });
    } catch (error) {
      throw new Error(
        `Failed to delete vectors from Chroma collection ${collection}: ${error instanceof Error ? error.message : String(error)}`,
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
      const col = await this.getCollection(collection);

      // Chroma supports metadata updates via update method
      for (const update of updates) {
        await col.update({
          ids: [update.id],
          metadatas: [update.metadata],
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to update metadata in Chroma collection ${collection}: ${error instanceof Error ? error.message : String(error)}`,
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
      const col = await this.getCollection(collection);

      const chromaFilter = options?.filter
        ? this.translateFilter(options.filter)
        : undefined;

      const include: any[] = ['distances' as any];
      if (options?.includeMetadata !== false) {
        include.push('metadatas' as any);
      }
      if (options?.includeValues) {
        include.push('embeddings' as any);
      }

      const response = await col.query({
        queryEmbeddings: [queryVector],
        nResults: options?.topK || 10,
        where: chromaFilter,
        include,
      });

      const records: VectorRecord[] = [];

      if (response.ids && response.ids[0]) {
        const resultIds = response.ids[0];
        const distances = response.distances?.[0] || [];
        const embeddings = response.embeddings?.[0] || [];
        const metadatas = response.metadatas?.[0] || [];

        for (let i = 0; i < resultIds.length; i++) {
          const record: VectorRecord = {
            id: resultIds[i],
            embedding: options?.includeValues ? (embeddings[i] || []) : [],
            metadata: options?.includeMetadata !== false ? (metadatas[i] || {}) : {},
          };

          // Convert distance to score (inverse relationship)
          if (distances[i] !== undefined) {
            record.score = 1 / (1 + distances[i]);
          }

          records.push(record);
        }
      }

      return { records };
    } catch (error) {
      throw new Error(
        `Failed to search Chroma collection ${collection}: ${error instanceof Error ? error.message : String(error)}`,
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
      const translated = conditions.map((c) => this.translateFilter(c));

      return { $and: translated };
    }

    // Handle compound OR filter
    if ('or' in filter) {
      const conditions = filter.or;
      const translated = conditions.map((c) => this.translateFilter(c));

      return { $or: translated };
    }

    // Handle basic filter condition
    const { field, op, value } = filter as any;

    // Operator mapping to Chroma's MongoDB-like syntax
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

    const chromaOp = operatorMap[op];
    if (!chromaOp) {
      throw new Error(
        `Unsupported filter operator: ${op}`,
        { cause: { filter } }
      );
    }

    return {
      [field]: {
        [chromaOp]: value,
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
      const col = await this.getCollection(collection);
      const batchSize = options?.batchSize || 100;
      const chromaFilter = options?.filter
        ? this.translateFilter(options.filter)
        : undefined;

      // Chroma uses offset/limit pagination
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await col.get({
          where: chromaFilter,
          limit: batchSize,
          offset,
          include: ['embeddings' as any, 'metadatas' as any],
        });

        if (response.ids && response.ids.length > 0) {
          const records: VectorRecord[] = [];

          for (let i = 0; i < response.ids.length; i++) {
            records.push({
              id: response.ids[i],
              embedding: response.embeddings?.[i] || [],
              metadata: response.metadatas?.[i] || {},
            });
          }

          yield records;

          // Check if there are more results
          hasMore = response.ids.length === batchSize;
          offset += batchSize;
        } else {
          hasMore = false;
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to iterate Chroma collection ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // CAPABILITY FLAGS
  // ============================================================================

  supportsMetadataUpdate(): boolean {
    return true; // Chroma supports metadata updates
  }

  supportsFiltering(): boolean {
    return true; // Chroma supports metadata filtering
  }

  supportsBatchOperations(): boolean {
    return true; // Chroma supports batch operations
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async getCollection(name: string): Promise<Collection> {
    if (this.collectionCache.has(name)) {
      return this.collectionCache.get(name)!;
    }

    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    const collection = await this.client.getCollection({ name, embeddingFunction: undefined as any });
    this.collectionCache.set(name, collection);
    return collection;
  }

  private mapDistanceMetric(metric: DistanceMetric): string {
    const metricMap: Record<DistanceMetric, string> = {
      cosine: 'cosine',
      euclidean: 'l2',
      dotProduct: 'ip', // Inner product
    };

    return metricMap[metric] || 'cosine';
  }

  private unmapDistanceMetric(chromaMetric: string): DistanceMetric {
    const metricMap: Record<string, DistanceMetric> = {
      cosine: 'cosine',
      l2: 'euclidean',
      ip: 'dotProduct',
    };

    return metricMap[chromaMetric] || 'cosine';
  }
}
