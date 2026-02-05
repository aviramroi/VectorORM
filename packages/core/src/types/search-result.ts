import type { VectorRecord } from './vector-record';

/**
 * Result from a vector search operation.
 */
export interface SearchResult {
  /** Matching vector records */
  records: VectorRecord[];

  /** Total count of matches (if available from DB) */
  totalCount?: number;

  /** Cursor for pagination (if supported by DB) */
  nextCursor?: string;
}
