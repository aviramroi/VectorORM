import {
  VectorDBAdapter,
  type VectorRecord,
  type SearchResult,
  type UniversalFilter,
  type CollectionStats,
  type MetadataUpdate,
  type DistanceMetric,
} from '@glyph/core';
import type { TurbopufferConfig } from './types.js';

/**
 * TurbopufferAdapter implements VectorDBAdapter for Turbopuffer vector database.
 *
 * Uses REST API with fetch (no SDK dependency to avoid Node version constraints).
 * Supports all VectorORM features including CRUD operations, filtering,
 * and metadata updates.
 */
export class TurbopufferAdapter extends VectorDBAdapter {
  private config: TurbopufferConfig;
  private baseUrl: string;
  private connected: boolean = false;
  private namespaceMetrics: Map<string, { dimension: number; metric: DistanceMetric }> = new Map();

  constructor(config: TurbopufferConfig) {
    super();

    // Validate required config
    if (!config.apiKey) {
      throw new Error(
        'TurbopufferAdapter: apiKey is required in config or TURBOPUFFER_API_KEY environment variable'
      );
    }

    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.turbopuffer.com';
  }

  // ============================================================================
  // HTTP HELPERS
  // ============================================================================

  private async request(
    method: string,
    path: string,
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Turbopuffer API error: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
        }
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      throw new Error(errorMessage);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async connect(): Promise<void> {
    try {
      // Verify connection by listing namespaces
      await this.request('GET', '/v2/namespaces');
      this.connected = true;
    } catch (error) {
      throw new Error(
        `Turbopuffer connection failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.namespaceMetrics.clear();
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  // ============================================================================
  // COLLECTION MANAGEMENT
  // ============================================================================

  async createCollection(
    name: string,
    dimension: number,
    metric: DistanceMetric = 'cosine'
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      // Turbopuffer creates namespaces implicitly on first upsert
      // We'll store metadata locally and create with a dummy vector
      const distanceMetric = metric === 'euclidean' ? 'euclidean_squared' : 'cosine_distance';

      // Store metrics for later use
      this.namespaceMetrics.set(name, { dimension, metric });

      // Create namespace with initial dummy vector to set schema
      await this.request('POST', `/v2/namespaces/${name}`, {
        upsert_rows: [{
          id: '__init__',
          vector: new Array(dimension).fill(0),
          attributes: { __init__: true }
        }],
        distance_metric: distanceMetric,
      });

      // Delete the initialization vector
      await this.request('POST', `/v2/namespaces/${name}`, {
        deletes: ['__init__'],
      });
    } catch (error) {
      throw new Error(
        `Failed to create Turbopuffer namespace ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async deleteCollection(name: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      await this.request('DELETE', `/v2/namespaces/${name}`);
      this.namespaceMetrics.delete(name);
    } catch (error) {
      throw new Error(
        `Failed to delete Turbopuffer namespace ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async collectionExists(name: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const response = await this.request('GET', '/v2/namespaces');
      const namespaces = response.namespaces || [];
      return namespaces.some((ns: any) => ns.name === name);
    } catch (error) {
      throw new Error(
        `Failed to check if Turbopuffer namespace ${name} exists: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async getCollectionStats(name: string): Promise<CollectionStats> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      // Use query with limit 0 to get aggregation stats
      const result = await this.request('POST', `/v2/namespaces/${name}/query`, {
        top_k: 0,
        aggregate_by: { Count: '*' },
      });

      const vectorCount = result.aggregations?.Count ?? 0;

      // Get dimension from stored metrics or estimate from a sample vector
      let dimension = this.namespaceMetrics.get(name)?.dimension ?? 0;
      let metric = this.namespaceMetrics.get(name)?.metric ?? 'cosine';

      if (dimension === 0 && vectorCount > 0) {
        // Query one vector to get dimension
        const sample = await this.request('POST', `/v2/namespaces/${name}/query`, {
          top_k: 1,
          include_vectors: true,
        });

        if (sample.rows && sample.rows.length > 0) {
          dimension = sample.rows[0].vector?.length ?? 0;
        }
      }

      return {
        vectorCount: typeof vectorCount === 'number' ? vectorCount : 0,
        dimension,
        metric,
      };
    } catch (error) {
      throw new Error(
        `Failed to get Turbopuffer namespace stats for ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // VECTOR OPERATIONS
  // ============================================================================

  async upsert(collection: string, records: VectorRecord[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      // Get or infer distance metric
      const storedMetric = this.namespaceMetrics.get(collection);
      const distanceMetric = storedMetric?.metric === 'euclidean'
        ? 'euclidean_squared'
        : 'cosine_distance';

      // Convert VectorRecord[] to Turbopuffer format
      const rows = records.map((record) => ({
        id: record.id,
        vector: record.embedding,
        ...record.metadata,
      }));

      await this.request('POST', `/v2/namespaces/${collection}`, {
        upsert_rows: rows,
        distance_metric: distanceMetric,
      });
    } catch (error) {
      throw new Error(
        `Failed to upsert vectors to Turbopuffer namespace ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async fetch(collection: string, ids: string[]): Promise<VectorRecord[]> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      // Turbopuffer doesn't have a direct fetch by IDs
      // We need to use query with filters for each ID
      const results: VectorRecord[] = [];

      // Query with In filter for multiple IDs
      if (ids.length > 0) {
        const result = await this.request('POST', `/v2/namespaces/${collection}/query`, {
          top_k: ids.length,
          filters: ['id', 'In', ids],
          include_vectors: true,
        });

        if (result.rows) {
          for (const row of result.rows) {
            const { id, vector, ...metadata } = row;
            results.push({
              id: String(id),
              embedding: vector || [],
              metadata,
            });
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(
        `Failed to fetch vectors from Turbopuffer namespace ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      await this.request('POST', `/v2/namespaces/${collection}`, {
        deletes: ids,
      });
    } catch (error) {
      throw new Error(
        `Failed to delete vectors from Turbopuffer namespace ${collection}: ${error instanceof Error ? error.message : String(error)}`,
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
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      // Turbopuffer supports patch operations
      // We'll fetch existing records and patch them
      for (const update of updates) {
        // Fetch the existing record
        const existing = await this.fetch(collection, [update.id]);

        if (existing.length === 0) {
          throw new Error(`Vector ${update.id} not found for metadata update`);
        }

        // Merge metadata
        const merged = { ...existing[0].metadata, ...update.metadata };

        // Upsert with updated metadata
        await this.request('POST', `/v2/namespaces/${collection}`, {
          upsert_rows: [{
            id: update.id,
            vector: existing[0].embedding,
            ...merged,
          }],
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to update metadata in Turbopuffer namespace ${collection}: ${error instanceof Error ? error.message : String(error)}`,
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
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const turbopufferFilter = options?.filter
        ? this.translateFilter(options.filter)
        : undefined;

      const result = await this.request('POST', `/v2/namespaces/${collection}/query`, {
        rank_by: ['vector', 'ANN', queryVector],
        top_k: options?.topK || 10,
        filters: turbopufferFilter,
        include_vectors: options?.includeValues || false,
      });

      const records: VectorRecord[] = [];

      if (result.rows) {
        for (const row of result.rows) {
          const { id, vector, $dist, ...metadata } = row;
          const record: VectorRecord = {
            id: String(id),
            embedding: options?.includeValues ? (vector || []) : [],
            metadata: options?.includeMetadata !== false ? metadata : {},
            score: $dist !== undefined ? (1 / (1 + $dist)) : undefined,
          };

          records.push(record);
        }
      }

      return { records };
    } catch (error) {
      throw new Error(
        `Failed to search Turbopuffer namespace ${collection}: ${error instanceof Error ? error.message : String(error)}`,
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

      // Convert all conditions
      const translated = conditions.map((c) => this.translateFilter(c));

      return ['And', translated];
    }

    // Handle compound OR filter
    if ('or' in filter) {
      const conditions = filter.or;

      const translated = conditions.map((c) => this.translateFilter(c));

      return ['Or', translated];
    }

    // Handle basic filter condition
    const { field, op, value } = filter as any;

    // Operator mapping
    const operatorMap: Record<string, string> = {
      eq: 'Eq',
      ne: 'Neq',
      gt: 'Gt',
      gte: 'Gte',
      lt: 'Lt',
      lte: 'Lte',
      in: 'In',
      nin: 'Nin',
    };

    const turbopufferOp = operatorMap[op];
    if (!turbopufferOp) {
      throw new Error(
        `Unsupported filter operator: ${op}`,
        { cause: { filter } }
      );
    }

    return [field, turbopufferOp, value];
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
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const batchSize = options?.batchSize || 100;

      const turbopufferFilter = options?.filter
        ? this.translateFilter(options.filter)
        : undefined;

      // Turbopuffer uses attribute-based pagination
      // We'll paginate by ID using greater-than filters
      let lastId: string | null = null;
      let hasMore = true;

      while (hasMore) {
        // Build filters for pagination
        let filters = turbopufferFilter;

        if (lastId !== null) {
          const paginationFilter = ['id', 'Gt', lastId];

          if (filters) {
            // Combine with existing filters
            filters = ['And', [filters, paginationFilter]];
          } else {
            filters = paginationFilter;
          }
        }

        const result = await this.request('POST', `/v2/namespaces/${collection}/query`, {
          top_k: batchSize,
          filters,
          include_vectors: true,
          rank_by: ['id', 'Asc'],
        });

        if (result.rows && result.rows.length > 0) {
          const records: VectorRecord[] = [];

          for (const row of result.rows) {
            const { id, vector, ...metadata } = row;
            records.push({
              id: String(id),
              embedding: vector || [],
              metadata,
            });

            lastId = String(id);
          }

          yield records;

          // Check if we got fewer records than requested
          hasMore = result.rows.length === batchSize;
        } else {
          hasMore = false;
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to iterate Turbopuffer namespace ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  // ============================================================================
  // CAPABILITY FLAGS
  // ============================================================================

  supportsMetadataUpdate(): boolean {
    return true; // Turbopuffer supports metadata updates via upsert
  }

  supportsFiltering(): boolean {
    return true; // Turbopuffer supports metadata filtering
  }

  supportsBatchOperations(): boolean {
    return true; // Turbopuffer supports batch operations
  }
}
