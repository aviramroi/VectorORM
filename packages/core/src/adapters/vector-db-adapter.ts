import type { VectorRecord, SearchResult } from '../types';
import type { UniversalFilter } from '../filters';
import type { CollectionStats, MetadataUpdate, DistanceMetric } from './types';

/**
 * Abstract base class for all vector database adapters.
 *
 * This is the KEY abstraction that enables database-agnostic operations.
 * Each database (Pinecone, Chroma, Qdrant, etc.) implements this interface,
 * allowing the SDK to work with any vector database.
 *
 * Design principles:
 * 1. All methods are abstract (must be implemented by subclasses)
 * 2. Capability flags have default implementations (can be overridden)
 * 3. Universal filter translation is adapter-specific
 * 4. Async iteration enables efficient enrichment pipelines
 *
 * @abstract
 */
export abstract class VectorDBAdapter {
  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Connect to the vector database.
   *
   * Initialize client, authenticate, verify connection.
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the vector database.
   *
   * Clean up resources, close connections.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if currently connected to the database.
   */
  abstract isConnected(): Promise<boolean>;

  // ============================================================================
  // COLLECTION MANAGEMENT
  // ============================================================================

  /**
   * Create a new vector collection.
   *
   * @param name - Collection name
   * @param dimension - Vector dimension
   * @param metric - Distance metric (default: cosine)
   */
  abstract createCollection(
    name: string,
    dimension: number,
    metric?: DistanceMetric
  ): Promise<void>;

  /**
   * Delete a collection and all its vectors.
   *
   * @param name - Collection name
   */
  abstract deleteCollection(name: string): Promise<void>;

  /**
   * Check if a collection exists.
   *
   * @param name - Collection name
   */
  abstract collectionExists(name: string): Promise<boolean>;

  /**
   * Get statistics about a collection.
   *
   * @param name - Collection name
   */
  abstract getCollectionStats(name: string): Promise<CollectionStats>;

  // ============================================================================
  // VECTOR OPERATIONS
  // ============================================================================

  /**
   * Upsert (insert or update) vector records.
   *
   * This is the primary method for adding vectors to the database.
   * If a record with the same ID exists, it is updated.
   *
   * @param collection - Collection name
   * @param records - Vector records to upsert
   */
  abstract upsert(collection: string, records: VectorRecord[]): Promise<void>;

  /**
   * Fetch vector records by ID.
   *
   * @param collection - Collection name
   * @param ids - Record IDs to fetch
   * @returns Array of matching records (may be empty)
   */
  abstract fetch(collection: string, ids: string[]): Promise<VectorRecord[]>;

  /**
   * Delete vector records by ID.
   *
   * @param collection - Collection name
   * @param ids - Record IDs to delete
   */
  abstract delete(collection: string, ids: string[]): Promise<void>;

  // ============================================================================
  // METADATA OPERATIONS (CRITICAL FOR ENRICHMENT)
  // ============================================================================

  /**
   * Update metadata for existing records without re-uploading vectors.
   *
   * This is CRITICAL for enrichment pipelines where we need to:
   * 1. Insert initial vectors with basic metadata
   * 2. Later enrich with vertical/horizontal metadata
   * 3. Avoid re-uploading large embedding vectors
   *
   * @param collection - Collection name
   * @param updates - Metadata updates to apply
   */
  abstract updateMetadata(
    collection: string,
    updates: MetadataUpdate[]
  ): Promise<void>;

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  /**
   * Search for similar vectors.
   *
   * @param collection - Collection name
   * @param queryVector - Query vector to search with
   * @param options - Search options
   * @returns Search results
   */
  abstract search(
    collection: string,
    queryVector: number[],
    options?: {
      topK?: number;
      filter?: UniversalFilter;
      includeMetadata?: boolean;
      includeValues?: boolean;
    }
  ): Promise<SearchResult>;

  // ============================================================================
  // FILTER TRANSLATION (KEY FOR DB AGNOSTICISM)
  // ============================================================================

  /**
   * Translate universal filter to database-specific filter format.
   *
   * This is the KEY method that enables database-agnostic filtering.
   * Each adapter translates the universal filter to its native format:
   *
   * - Pinecone: {field: {$eq: value}}
   * - Qdrant: {must: [{key: field, match: {value}}]}
   * - Chroma: {field: value}
   *
   * @param filter - Universal filter
   * @returns Database-specific filter object
   */
  abstract translateFilter(filter: UniversalFilter): any;

  // ============================================================================
  // ITERATION (FOR ENRICHMENT PIPELINE)
  // ============================================================================

  /**
   * Iterate over all vectors in a collection in batches.
   *
   * This enables efficient enrichment pipelines:
   * 1. Fetch vectors in batches
   * 2. Enrich each batch with metadata
   * 3. Update metadata back to DB
   *
   * @param collection - Collection name
   * @param options - Iteration options
   * @yields Batches of vector records
   */
  abstract iterate(
    collection: string,
    options?: {
      batchSize?: number;
      filter?: UniversalFilter;
    }
  ): AsyncIterableIterator<VectorRecord[]>;

  // ============================================================================
  // CAPABILITY FLAGS (WITH DEFAULT IMPLEMENTATIONS)
  // ============================================================================

  /**
   * Whether this adapter supports metadata updates without re-uploading vectors.
   *
   * Default: false (must re-upload entire record)
   * Override to return true if your DB supports partial updates.
   */
  supportsMetadataUpdate(): boolean {
    return false;
  }

  /**
   * Whether this adapter supports filtering during search.
   *
   * Default: false (no filtering support)
   * Override to return true if your DB supports metadata filtering.
   */
  supportsFiltering(): boolean {
    return false;
  }

  /**
   * Whether this adapter supports batch operations efficiently.
   *
   * Default: false (single operations only)
   * Override to return true if your DB supports batch upsert/delete.
   */
  supportsBatchOperations(): boolean {
    return false;
  }
}
