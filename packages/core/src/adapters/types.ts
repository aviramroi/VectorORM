/**
 * Types for vector database adapters.
 *
 * These types define the common interface elements that all
 * adapters must support or return.
 */

/**
 * Statistics about a vector collection.
 */
export interface CollectionStats {
  /** Total number of vectors in the collection */
  vectorCount: number;

  /** Dimension of vectors in this collection */
  dimension: number;

  /** Distance metric used (cosine, euclidean, etc.) */
  metric: DistanceMetric;

  /** Additional DB-specific stats (optional) */
  [key: string]: any;
}

/**
 * Metadata update operation.
 *
 * Used for efficient metadata enrichment without re-uploading vectors.
 */
export interface MetadataUpdate {
  /** ID of the record to update */
  id: string;

  /** Metadata fields to set/update */
  metadata: Record<string, any>;
}

/**
 * Distance metric for vector similarity.
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dotProduct';
