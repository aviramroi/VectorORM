import type { VectorDBAdapter } from '../adapters/vector-db-adapter';
import type { Embedder } from '../embedders/embedder';
import type { RetrievalParams, RetrievalResult } from './types';
import type { VectorRecord } from '../types/vector-record';
import { FilterBuilder } from './filter-builder';
import { VerticalFields, HorizontalFields } from '../metadata/constants';

/**
 * RAGQueryComposer - Main orchestrator for retrieval operations.
 *
 * Coordinates between embedder and vector database adapter to perform
 * semantic search with filtering. Provides specialized methods for
 * grouping results by vertical (document) or horizontal (theme) dimensions.
 *
 * @example
 * ```typescript
 * const composer = new RAGQueryComposer(adapter, embedder);
 *
 * // Basic retrieval
 * const result = await composer.retrieve({
 *   query: 'pricing information',
 *   collection: 'documents',
 *   topK: 10
 * });
 *
 * // Retrieval with filters
 * const filtered = await composer.retrieve({
 *   query: 'pricing information',
 *   collection: 'documents',
 *   topK: 10,
 *   verticalFilters: { doc_id: 'contract-123' },
 *   horizontalFilters: { theme: 'legal' }
 * });
 *
 * // Grouped by document
 * const byDocument = await composer.retrieveVertical({
 *   query: 'pricing information',
 *   collection: 'documents',
 *   topK: 10
 * });
 * ```
 */
export class RAGQueryComposer {
  /**
   * Create a new RAGQueryComposer.
   *
   * @param adapter - Vector database adapter for search operations
   * @param embedder - Embedder for converting text queries to vectors
   */
  constructor(
    private readonly adapter: VectorDBAdapter,
    private readonly embedder: Embedder
  ) {}

  /**
   * Main retrieval method.
   *
   * Performs semantic search with optional filtering:
   * 1. Embeds query text using embedder
   * 2. Builds combined filter using FilterBuilder
   * 3. Calls adapter.search() with query vector and filter
   * 4. Returns results with filter information
   *
   * @param params - Retrieval parameters
   * @returns Retrieval result with records and filter information
   */
  async retrieve(params: RetrievalParams): Promise<RetrievalResult> {
    // 1. Embed the query text
    const queryVector = await this.embedder.embed(params.query);

    // 2. Build combined filter using FilterBuilder
    const filterBuilder = new FilterBuilder();

    if (params.verticalFilters) {
      filterBuilder.withVerticalFilter(params.verticalFilters);
    }

    if (params.horizontalFilters) {
      filterBuilder.withHorizontalFilter(params.horizontalFilters);
    }

    if (params.customFilters) {
      filterBuilder.withCustomFilter(params.customFilters);
    }

    const combinedFilter = filterBuilder.build();

    // 3. Call adapter.search() with query vector and filter
    const searchResult = await this.adapter.search(
      params.collection,
      queryVector,
      {
        topK: params.topK,
        filter: combinedFilter,
        includeMetadata: true,
        includeValues: params.includeEmbeddings
      }
    );

    // 4. Return RetrievalResult with records and filters applied
    return {
      records: searchResult.records,
      query: params.query,
      filtersApplied: {
        ...(params.verticalFilters && { vertical: params.verticalFilters }),
        ...(params.horizontalFilters && { horizontal: params.horizontalFilters }),
        ...(params.customFilters && { custom: params.customFilters })
      }
    };
  }

  /**
   * Retrieve and group results by document ID.
   *
   * Calls retrieve() and organizes results into a Map keyed by __v_doc_id.
   * Records without a doc_id are excluded.
   *
   * @param params - Retrieval parameters
   * @returns Map of document ID to array of records
   */
  async retrieveVertical(
    params: RetrievalParams
  ): Promise<Map<string, VectorRecord[]>> {
    const result = await this.retrieve(params);

    const grouped = new Map<string, VectorRecord[]>();

    for (const record of result.records) {
      const docId = record.metadata[VerticalFields.DOC_ID];

      if (typeof docId === 'string') {
        if (!grouped.has(docId)) {
          grouped.set(docId, []);
        }
        grouped.get(docId)!.push(record);
      }
    }

    return grouped;
  }

  /**
   * Retrieve and group results by theme.
   *
   * Calls retrieve() and organizes results into a Map keyed by __h_theme.
   * Records without a theme are excluded.
   *
   * @param params - Retrieval parameters
   * @returns Map of theme to array of records
   */
  async retrieveHorizontal(
    params: RetrievalParams
  ): Promise<Map<string, VectorRecord[]>> {
    const result = await this.retrieve(params);

    const grouped = new Map<string, VectorRecord[]>();

    for (const record of result.records) {
      const theme = record.metadata[HorizontalFields.THEME];

      if (typeof theme === 'string') {
        if (!grouped.has(theme)) {
          grouped.set(theme, []);
        }
        grouped.get(theme)!.push(record);
      }
    }

    return grouped;
  }
}
