/**
 * Query Composition Layer - Retrieval Types and Interfaces
 *
 * Defines the core interfaces for retrieval operations in Glyph.
 * These types abstract query parameters and results across different
 * vector database adapters.
 */

import type { UniversalFilter } from '../filters/types';
import type { VectorRecord } from '../types/vector-record';

/**
 * Parameters for a retrieval operation.
 *
 * Combines query text, collection targeting, and optional filters
 * for both vertical (document-level) and horizontal (theme-level) filtering.
 */
export interface RetrievalParams {
  /** The search query text to embed and search for */
  query: string;

  /** Target collection to search in */
  collection: string;

  /** Number of results to return */
  topK: number;

  /** Optional document-level filters (e.g., filter by doc_id, region, year) */
  verticalFilters?: UniversalFilter;

  /** Optional theme/section-level filters (e.g., filter by theme, section) */
  horizontalFilters?: UniversalFilter;

  /** Optional additional user-defined filters */
  customFilters?: UniversalFilter;

  /** Whether to include embedding vectors in results (default: false) */
  includeEmbeddings?: boolean;
}

/**
 * Result of a retrieval operation.
 *
 * Contains the retrieved records, original query, and information
 * about which filters were applied.
 */
export interface RetrievalResult {
  /** The retrieved vector records */
  records: VectorRecord[];

  /** The original query text */
  query: string;

  /** Information about which filters were applied */
  filtersApplied: {
    vertical?: UniversalFilter;
    horizontal?: UniversalFilter;
    custom?: UniversalFilter;
  };
}

/**
 * Options for a search operation at the adapter level.
 *
 * These are lower-level options used by adapters to perform
 * the actual vector search.
 */
export interface SearchOptions {
  /** Number of results to return */
  topK: number;

  /** Optional adapter-specific filter (already translated) */
  filter?: any;

  /** Whether to include embedding vectors in results */
  includeEmbeddings?: boolean;
}

/**
 * Results grouped by different dimensions.
 *
 * Used for organizing search results by vertical (document)
 * or horizontal (theme) dimensions.
 */
export interface GroupedResults {
  /** Records grouped by document ID (__v_doc_id) */
  vertical: Map<string, VectorRecord[]>;

  /** Records grouped by theme (__h_theme) */
  horizontal: Map<string, VectorRecord[]>;
}
